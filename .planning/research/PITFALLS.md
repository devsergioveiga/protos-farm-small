# Pitfalls Research

**Domain:** Procurement / Purchasing module added to existing farm management ERP (financial + stock already live)
**Researched:** 2026-03-17
**Confidence:** HIGH for integration pitfalls (derived from codebase analysis); MEDIUM for workflow state machine patterns (established ERP practice + training data); LOW where only training data supports specific claims.

---

## Critical Pitfalls

### Pitfall 1: CP Auto-Generation Race Condition on Partial Receiving

**What goes wrong:**
When a purchase order is received in multiple partial shipments (scenario: "recebimento parcial" or "NF antecipada com entrega parcelada"), the receiving service generates a CP (conta a pagar) entry per shipment. If the first shipment auto-generates a CP for the full PO value (common mistake when the CP amount is read from the PO, not from the receiving event), the second shipment generates a duplicate CP. The financial module ends up with two CPs totalling 2x the original order value.

**Why it happens:**
Developers wire `createPayable()` to the purchase order event rather than to the receiving confirmation event. The PO is the known total; the receiving event is per-shipment. Under pressure to show "CP appears automatically," the shortcut is to link it to the PO approval.

**How to avoid:**

- CP creation must fire ONLY from the `ReceivingConfirmed` event, never from PO approval.
- Each receiving event creates a CP for exactly the confirmed items value — not the remaining PO value.
- Model `PurchaseOrder.payableStatus` as `NOT_GENERATED | PARTIAL | FULLY_GENERATED` to track what has been converted.
- On final partial receiving, sum all generated CPs and compare to PO total; create an adjustment CP if needed (handles rounding).
- The existing `generateInstallments` + `validateCostCenterItems` from `@protos-farm/shared` should be reused in the auto-CP service.

**Warning signs:**

- `createPayable()` called inside the `approvePurchaseOrder()` service method.
- `amount` passed to `createPayable()` comes from `purchaseOrder.totalAmount` rather than `receiving.confirmedAmount`.
- No `payableStatus` field on PurchaseOrder to prevent duplicate generation.

**Phase to address:** Receiving & CP Auto-Generation phase — define the event contract (what triggers CP creation) before writing any receiving code.

---

### Pitfall 2: Stock Entry Created Before NF is Received (Desynchronization)

**What goes wrong:**
The system handles 6 receiving scenarios, two of which involve goods arriving before the NF (nota fiscal) or the NF arriving before goods. If stock entry is created at goods arrival time without a NF, the stock balance increases but the CP cannot be created (no fiscal document = no valid CP in Brazilian accounting). When the NF eventually arrives, a second code path creates the CP but re-checks stock — and if someone already consumed those items, the reconciliation is impossible to audit.

**Why it happens:**
The existing `stock-entries` module was designed for direct entry (NF + goods arrive together). Extending it to handle the desynchronized case by adding flags after the fact produces spaghetti: `isProvisional`, `pendingNfNumber`, `nfArrivalDate` as nullable fields on a model not designed for two-phase commit.

**How to avoid:**

- Design `GoodsReceipt` (mercadoria) and `FiscalDocument` (NF) as separate entities with an explicit linking relationship.
- `GoodsReceipt` triggers stock entry creation immediately (with `source = PURCHASE_RECEIVING`).
- `FiscalDocument` triggers CP creation.
- The reconciliation between them is an explicit `ReceivingReconciliation` record (status: `GOODS_ONLY | NF_ONLY | MATCHED`).
- For the "NF first" scenario: create a `FiscalDocument` record in `PENDING_GOODS` state; CP is created but in `AGUARDANDO_MERCADORIA` status; stock entry follows on goods arrival.
- Never store fiscal document data on the `StockEntry` model — the existing model at `stock-entries.types.ts` has `invoiceNumber` as a plain string field which is insufficient for the 6-scenario requirement.

**Warning signs:**

- `invoiceNumber` is a string field on `StockEntry` (existing pattern — must be upgraded to a FK).
- Receiving service creates stock entry and CP in the same function call without checking NF availability.
- No state machine on the receiving record to track which documents have arrived.

**Phase to address:** Receiving & Conferência phase — the `GoodsReceipt`/`FiscalDocument` data model must be designed before any receiving implementation. Retrofitting this split is expensive because stock balances are already live.

---

### Pitfall 3: Approval Workflow State Machine Without Explicit Transitions

**What goes wrong:**
Approval workflows are typically implemented as a `status` field with `if/else` guards in the service. Over time, as new approval rules are added (approval by value threshold, approval by type, multi-level chain), the guard conditions become inconsistent. It becomes possible to approve an already-rejected requisition, to skip levels, or to send a quotation request from a requisition that was never approved. The existing cheque state machine (`VALID_TRANSITIONS` map in `checks.types.ts`) shows the project already knows the right pattern — but it was applied only to cheques.

**Why it happens:**
Approval flows look simple in the happy path (DRAFT → PENDING_APPROVAL → APPROVED → ORDERED). The complexity emerges from: rejections, recall/editing after rejection, partial approval (approve 80% of requested quantity), escalation on timeout, and concurrent approval by multiple roles. Without an explicit transition map, each edge case is handled ad hoc.

**How to avoid:**

- Define a `VALID_REQUISITION_TRANSITIONS` map identical in structure to `VALID_TRANSITIONS` in `checks.types.ts` — this project has a proven pattern.
- States: `DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | RECALLED | CANCELLED | ORDERED | RECEIVED | CLOSED`.
- Transitions should be validated by a single `validateTransition(current, next)` function called at the service boundary — never inline `if (status === 'DRAFT')` checks scattered across controllers.
- Multi-level approval: model as `ApprovalStep` records (level, approver role, threshold range, requiredAll/any), not as flags on the requisition itself.
- Rejection must include a mandatory `rejectionReason` — without it, the requester cannot correct and resubmit.

**Warning signs:**

- Approval logic implemented as `if (requisition.status !== 'APPROVED') throw error` without a transition map.
- `status` updated with `prisma.purchaseRequisition.update({ data: { status: 'APPROVED' } })` without checking current state.
- No `ApprovalStep` or `ApprovalHistory` model — approval is just a boolean flag.

**Phase to address:** Requisição & Aprovação phase — define the full state machine before writing a single approval endpoint. The state machine is the feature, not an implementation detail.

---

### Pitfall 4: Budget Control Updated at Wrong Points in the Workflow

**What goes wrong:**
Budget control is implemented as a check at requisition creation: "is there budget remaining?" If the requisition is later rejected and the budget is not released back, the budget balance becomes permanently understated. Conversely, if budget is only committed on PO issuance (not on requisition), a flood of requisitions can exceed budget before any PO is issued, because each requisition check sees the full remaining budget.

**Why it happens:**
Budget commitment has two distinct concepts: soft commitment (requisition created, not yet approved) and hard commitment (PO issued). Most implementations either skip one or confuse both, using a single "committed" column.

**How to avoid:**

- Model budget as: `budgetAmount`, `softCommitted` (sum of approved requisitions without PO), `hardCommitted` (sum of issued POs), `consumed` (sum of confirmed receiving CPs).
- Available budget = `budgetAmount - softCommitted - hardCommitted - consumed`.
- State transitions must update the appropriate commitment column atomically (PostgreSQL transaction + `FOR UPDATE` on the budget row).
- Rejection, cancellation, and return must release the corresponding commitment immediately — add this to the state transition handler, not as a separate cleanup job.
- Budget check at requisition approval: `softCommitted + amount <= budgetAmount - hardCommitted - consumed`.

**Warning signs:**

- `BudgetLine` table has only `allocated` and `spent` columns (missing soft/hard commitment split).
- Budget is checked with a simple `SELECT SUM(amount) FROM payables WHERE category = 'INPUTS'` — this reads actual CPs only, misses committed but not yet paid.
- Budget release on rejection is a TODO comment.

**Phase to address:** Orçamento & Controle Orçamentário phase — but the budget model must be defined before the Requisição phase begins, because requisition approval writes to the budget.

---

### Pitfall 5: Email Notification Implemented Synchronously in the Request Cycle

**What goes wrong:**
Approvers and requesters need email notifications at each workflow step. If the notification service is called synchronously inside the Express route handler, a slow or failed email delivery (SMTP timeout, rate limit) causes the entire workflow mutation to fail or time out. The user gets a 504 or a confusing error when approving a requisition, not an email failure.

**Why it happens:**
Email is new to this codebase (PROJECT.md confirms it is not yet implemented). The first implementation instinct is `await sendEmail(approverEmail, ...)` inside the same transaction that saves the approval — because it is the most direct path.

**How to avoid:**

- Never await email sending inside a database transaction.
- Use a job queue pattern: save the workflow state change first, then enqueue an email job. The email job runs outside the request cycle.
- Minimum viable queue for this project: a `NotificationJob` table with `status: PENDING | SENT | FAILED | SKIPPED`, processed by a setInterval or a lightweight worker (no need for Redis/Bull at current scale).
- If email fails, the workflow state is already saved — the user's action succeeded. Show a warning in the UI "Notificação enviada" vs "Não foi possível enviar notificação — ação salva".
- Add a "reenviar notificação" button for failed notifications.

**Warning signs:**

- `await emailService.send(...)` called inside `prisma.$transaction(...)`.
- No `NotificationJob` or equivalent table in the schema.
- Email sending has no retry logic.

**Phase to address:** Notificações & Alertas phase — but the async notification infrastructure must be established before any workflow phase that fires notifications, because retrofitting synchronous-to-async email is a refactor across multiple service methods.

---

### Pitfall 6: Quotation Price Not Frozen at PO Issuance

**What goes wrong:**
The comparative quotation map shows prices per supplier. When the winning quotation is selected and a PO is issued, the PO price should be locked to the approved quotation price. If the quotation record is mutable (can be edited after selection), the PO price can diverge from what was approved. Later, when receiving triggers CP creation, the CP amount differs from the PO amount, which differs from the quotation amount — three different numbers for the same transaction.

**Why it happens:**
Quotation records are created as mutable drafts and nobody thinks to freeze them at approval. The UI allows editing a quotation even after a PO references it.

**How to avoid:**

- Quotation record must transition to `CLOSED` status when a PO is issued from it — closed quotations are immutable.
- PO must snapshot the winning quotation's `unitPrice`, `quantity`, and `totalAmount` at issuance time — do not store only a FK to the quotation.
- Price history analysis (saving analysis feature) queries the quotation snapshot, not the live quotation record.
- Receiving tolerance: allow a configurable percentage divergence between PO price and actual NF price (typically 5% for rural inputs due to freight variations); flag but do not block receiving if within tolerance.

**Warning signs:**

- `PurchaseOrder` has only a `quotationId` FK with no price snapshot fields.
- Quotation has no `status` field or can be edited after PO reference exists.
- CP amount is computed at receiving time from live product prices rather than from the PO snapshot.

**Phase to address:** Cotação & Pedido de Compra phase.

---

### Pitfall 7: Return/Devolution Not Reversing Stock and CP Correctly

**What goes wrong:**
A goods return creates a negative stock movement and (if NF-based) triggers a CP cancellation or credit note. If the return service calls `stockOutputService.createOutput()` with type `DISPOSAL` (the closest existing type in `stock-outputs.types.ts`), it is semantically wrong and may bypass FEFO logic. If the CP linked to the original receiving is partially paid when the return happens, the service must handle a credit against a partially-settled payable — which the current `payables.service.ts` has no model for.

**Why it happens:**
Returns are treated as an afterthought ("just do the inverse of receiving"). The existing stock output types (`CONSUMPTION, MANUAL_CONSUMPTION, TRANSFER, DISPOSAL`) do not include `RETURN_TO_SUPPLIER`, so the closest available type is misused. The CP partial credit scenario is not modeled.

**How to avoid:**

- Add `RETURN_TO_SUPPLIER` to the `StockOutput` type enum at the stock-entries phase — do not wait until the return feature phase.
- Model returns as: `PurchaseReturn` (document) → `StockOutput (RETURN_TO_SUPPLIER)` + optional `PayableCredit` or `PayableCancellation`.
- `PayableCredit`: a new model that reduces the outstanding amount on a `PENDING` or `PARTIAL` payable. Do not edit the original CP amount — create a linked credit record.
- If the original CP is already `PAID`, the credit generates a `Receivable` (CR) from the supplier — this is a different flow.
- Test the scenario: partial delivery received → CP generated → return half the goods → CP amount should be reduced by 50%.

**Warning signs:**

- Return service calls `stockOutputService.createOutput()` with type `DISPOSAL`.
- Return service calls `payable.update({ totalAmount: newAmount })` directly — no audit trail.
- No `PurchaseReturn` entity — return is modeled as a flag on the receiving record.

**Phase to address:** Devolução & Troca phase — but the `RETURN_TO_SUPPLIER` stock output type must be added during the Receiving phase so the schema is ready.

---

### Pitfall 8: Supplier Tax Data Stored Without Validation

**What goes wrong:**
Supplier cadastro includes CNPJ, IE (Inscrição Estadual), and fiscal regime (Simples Nacional, Lucro Presumido, Lucro Real). These determine: whether ICMS-ST applies to purchases, whether the supplier's NF is valid for input credit, and whether FUNRURAL applies if the supplier is a rural producer (PF). If CNPJ is stored without format validation or check digit verification, bogus suppliers pass through and their NFs are later rejected by SEFAZ during accounting reconciliation.

**Why it happens:**
CNPJ validation is treated as a UI-only concern (mask input). The backend accepts any 14-digit string and stores it. Later, when the NF has a CNPJ that differs by one digit from what is stored, no alert fires.

**How to avoid:**

- Validate CNPJ check digits in the backend service (not just frontend mask) using the standard Receita Federal algorithm.
- Store CNPJ as 14 raw digits (no separators) — format only for display.
- Add `fiscalRegime` enum (`SIMPLES_NACIONAL | LUCRO_PRESUMIDO | LUCRO_REAL | PESSOA_FISICA | RURAL_PRODUCER`) — this drives automatic ICMS-ST and FUNRURAL rules.
- For rural producer suppliers (PF): store CPF + IE of producer, not CNPJ.
- Supplier import (CSV) must validate CNPJ check digits and reject invalid rows with a clear error message.

**Warning signs:**

- `cnpj` stored as `String` without backend validation.
- No `fiscalRegime` field on the Supplier model.
- Supplier create endpoint does not call a CNPJ validation function before persisting.

**Phase to address:** Cadastro de Fornecedores phase.

---

### Pitfall 9: Saving Analysis Using Nominal Prices Without Inflation Adjustment

**What goes wrong:**
The saving analysis feature compares current quotation prices against historical prices to show "how much we saved." If historical prices are compared nominally (R$ 100 in 2024 vs R$ 107 in 2025), the system may report a "saving" when in reality the price tracked IPCA exactly and no real saving occurred. In agricultural input purchasing, IPCA-adjusted comparison is the standard.

**Why it happens:**
Price history storage is implemented as a simple log of prices with dates. The comparison query does `currentPrice < historicalAveragePrice` without inflation adjustment. This is technically correct SQL but economically misleading.

**How to avoid:**

- Store a `referencePeriod` (year-month) and `inflationIndex` (IPCA, IGP-M, or INPC) on each price history record.
- For MVP: allow the user to input the inflation adjustment percentage manually (avoid the complexity of live IPCA API integration).
- Saving = `(adjustedHistoricalPrice - currentPrice) * quantity`. Always show both nominal and adjusted saving.
- Mark LOW confidence: IPCA API integration (IBGE Sidra API) could be explored in a future milestone.

**Warning signs:**

- `PriceHistory` table has only `price` and `date` columns — no inflation adjustment fields.
- Saving calculation is `SUM((basePrice - currentPrice) * qty)` with no mention of inflation.
- Dashboard shows a single "Total economizado" figure without a "real vs nominal" distinction.

**Phase to address:** Análise de Saving & Histórico de Preços phase.

---

### Pitfall 10: Kanban Workflow State Inconsistent with Database State Machine

**What goes wrong:**
The Kanban board displays purchase requisitions and orders as cards in columns (DRAFT, PENDING_APPROVAL, APPROVED, ORDERED, RECEIVED). If the Kanban drag-and-drop updates the `status` field directly (common in Kanban implementations), it bypasses the state machine transition validation in the service layer. A user can drag a DRAFT card to RECEIVED, skipping approval and ordering entirely.

**Why it happens:**
Kanban UI libraries (react-beautiful-dnd, dnd-kit) emit `onDragEnd(sourceColumn, destinationColumn)` events. The quickest integration is `PATCH /purchase-requisitions/:id { status: destinationColumn }`. This works visually but is semantically wrong.

**How to avoid:**

- The Kanban drag endpoint must call the same `validateTransition()` service function used by the standard approval endpoints — never bypass it.
- On invalid drag, snap the card back to its original column and show a toast: "Esta movimentação requer aprovação — use o fluxo de aprovação."
- Kanban should only allow drags to valid next states from the `VALID_TRANSITIONS` map — disable drop targets for invalid transitions at the UI level too.
- Do not implement Kanban drag as a general status override — implement it as convenience shortcuts for valid transitions (e.g., marking received as a drag gesture calls the same receiving endpoint).

**Warning signs:**

- Kanban update endpoint is `PATCH /purchase-requisitions/:id` with a body of `{ status: string }` without server-side transition validation.
- Kanban component renders all columns as valid drop targets regardless of current state.
- Kanban `onDragEnd` calls a different API endpoint than the "Aprovar" button in the form.

**Phase to address:** Kanban & Dashboard phase — but the transition validation function must be defined in the Requisição phase so Kanban can reuse it.

---

## Technical Debt Patterns

| Shortcut                                                           | Immediate Benefit                           | Long-term Cost                                                                          | When Acceptable                                                              |
| ------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| CP created on PO approval instead of receiving confirmation        | CP appears immediately when order is placed | Duplicate CPs on partial receiving; financial module shows inflated liabilities         | Never                                                                        |
| Single `status` field without transition map for approval workflow | Simple schema                               | Invalid state transitions become possible; inconsistent data after any edge case        | Never — the project already has the `VALID_TRANSITIONS` pattern from cheques |
| Synchronous email sending inside service methods                   | Works in dev/test                           | Production SMTP timeouts fail the entire workflow mutation; user action appears to fail | Never for production; acceptable for MVP demo only                           |
| `invoiceNumber` as plain string on receiving (existing pattern)    | No migration needed                         | Cannot model the 6 NF scenarios; partial and desynchronized receiving is impossible     | Only if all 6 scenarios are reduced to 1 (not acceptable per requirements)   |
| Budget check with CP sum query only                                | Simple query                                | Misses requisitions in approval; budget appears available when it is soft-committed     | Never                                                                        |
| Quotation without price freeze on PO issuance                      | Simpler schema                              | PO amount diverges from quotation; audit trail is broken                                | Never                                                                        |
| `DISPOSAL` stock type used for supplier returns                    | Reuses existing enum value                  | FEFO logic is bypassed; inventory reports show incorrect disposal quantities            | Never — add `RETURN_TO_SUPPLIER` type                                        |
| Nominal price comparison in saving analysis                        | Simpler query                               | Reports fake savings during inflation periods; misleads management                      | Acceptable for MVP if clearly labeled "nominal comparison"                   |

---

## Integration Gotchas

| Integration                         | Common Mistake                                                                           | Correct Approach                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Payables service (auto-CP)          | Calling `createPayable()` with PO total instead of receiving confirmed amount            | Fire from `ReceivingConfirmed` event; use receiving line item amounts                                            |
| Stock entries (receiving → stock)   | Reusing `CreateStockEntryInput` directly from receiving payload                          | Receiving module computes the `StockEntryInput`; stock-entries service does not know it came from a PO           |
| Payables service (installments)     | Generating installments at CP creation with `installmentCount` from the PO payment terms | Verify `generateInstallments` from `@protos-farm/shared` handles due date alignment with rural payment calendars |
| Budget module (commitment tracking) | Reading budget from `payables` table instead of dedicated commitment records             | Budget commitment is a separate ledger updated by state machine transitions, not by CP existence                 |
| Email notifications                 | Awaiting SMTP send inside Prisma transaction                                             | Always enqueue; transaction commits first; email is fire-and-forget with retry                                   |
| Stock outputs (returns)             | Using `DISPOSAL` type for supplier returns                                               | Add and use `RETURN_TO_SUPPLIER` type so reports remain accurate                                                 |
| CNPJ validation (supplier)          | Frontend mask only                                                                       | Backend must validate check digits using Receita Federal algorithm before `INSERT`                               |

---

## Performance Traps

| Trap                                                                            | Symptoms                                                   | Prevention                                                                                             | When It Breaks               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Budget availability computed by summing all CPs on every requisition create     | Slow requisition submission on farms with large CP history | Maintain running `softCommitted`/`hardCommitted`/`consumed` columns on `BudgetLine`; update atomically | ~500 payable records         |
| Comparative quotation map loading all supplier quotations in memory for sorting | Slow quotation comparison page with many suppliers         | Paginate and sort at database level; index on `(requisitionId, supplierId, unitPrice)`                 | >20 suppliers per quotation  |
| Kanban query loading all active purchase orders without pagination              | Kanban board freezes with large backlog                    | Server-side pagination per Kanban column; limit to last 90 days by default                             | >200 active requisitions     |
| Email notification job table polling every second with `SELECT ... FOR UPDATE`  | Database lock contention on notification worker            | Poll every 10–30 seconds; use advisory locks; batch up to 20 emails per poll cycle                     | >50 pending notifications    |
| Saving analysis querying full price history on every load                       | Slow analytics page                                        | Pre-compute monthly price averages in a materialized view or a scheduled aggregation job               | >1,000 price history records |

---

## Security Mistakes

| Mistake                                                            | Risk                                          | Prevention                                                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Approval endpoint accessible to any authenticated user             | Any user approves their own requisition       | Check that `approver.id !== requisition.requesterId`; enforce `purchases:approve` permission distinct from `purchases:create` |
| Supplier CNPJ/CPF visible in paginated list API without role check | Fiscal data exposed to field operators        | Mask tax IDs to last 4 digits for non-financial roles; full access only with `FINANCIAL` or `ADMIN` role                      |
| PO PDF URL guessable (sequential IDs in URL)                       | Competitor or supplier sees all PO prices     | Sign PO PDF URLs with short-expiry tokens (same pattern as CNAB files in existing security guidance)                          |
| Budget configuration editable by any manager                       | Managers raise their own approval threshold   | Budget configuration requires `ADMIN` role; approval threshold changes must be logged in audit trail                          |
| Email notifications sent to external addresses with PO details     | Price and supplier data leaked if wrong email | Validate recipient email against `org_users` table; never send to free-text email from requisition form                       |
| Quotation amounts visible to competing suppliers                   | Supplier sees rivals' prices                  | Quotation comparison view accessible only to internal approvers; never expose via a public link                               |

---

## UX Pitfalls

| Pitfall                                                                        | User Impact                                                               | Better Approach                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Approval notification arriving with no link to the requisition                 | Approver receives email, cannot find the record                           | Every notification email must include a deep link to the specific requisition/PO in the system                   |
| Requisition form allowing submission without confirming cost center allocation | CP auto-generation fails at receiving time because cost center is missing | Validate cost center completeness (sum = 100%) at requisition submit, not at CP creation                         |
| Receiving form showing all PO lines even when some are fully received          | User accidentally receives already-received items                         | Filter PO lines to show only items with pending quantity; show fulfilled lines as read-only                      |
| Budget alert appearing only when budget is 100% consumed                       | Manager discovers budget problem only when it is too late                 | Alert at 80% consumed (configurable threshold); show visual indicator at 60% / 80% / 100%                        |
| Quotation comparison showing unit prices in different units (kg vs sc vs t)    | Impossible to compare fairly                                              | Normalize all prices to the product's base stock unit before displaying comparison; show original unit alongside |
| Saving analysis showing negative saving (we paid more) without explanation     | Confusing to management                                                   | Show "acima da média histórica" vs "abaixo da média histórica" labels, not just positive/negative numbers        |
| PO status updates not reflected in real time on Kanban                         | Cards show stale state after another user acts                            | Use polling (every 30s) or SSE for Kanban updates; show "updated X seconds ago" indicator                        |
| Return form not showing linked PO/NF details                                   | User creates return without knowing what was received                     | Return form must show the original receiving details (items, quantities, NF number) as read-only reference       |

---

## "Looks Done But Isn't" Checklist

- [ ] **CP Auto-Generation:** Often generates from PO total — verify CP amount matches receiving confirmation amount, not PO amount.
- [ ] **Partial Receiving:** Often creates duplicate CPs on second shipment — verify `PurchaseOrder.payableStatus` transitions correctly and second receiving does not duplicate the first CP.
- [ ] **Approval Transitions:** Often allows skipping states via direct API — verify that PATCH endpoint rejects any transition not in `VALID_TRANSITIONS` map with a 409 response.
- [ ] **Budget Release on Rejection:** Often left as TODO — verify that rejecting a requisition immediately decrements `softCommitted` on the budget line.
- [ ] **Email Async:** Often blocking — verify that approving a requisition returns HTTP 200 even when SMTP is down; email failure is logged but does not fail the approval.
- [ ] **Quotation Price Freeze:** Often mutable after PO — verify that editing a quotation after a PO references it returns 409 or is rejected at the service layer.
- [ ] **Stock Return Type:** Often uses `DISPOSAL` — verify `StockOutput.type` for supplier returns is `RETURN_TO_SUPPLIER` in database records.
- [ ] **CNPJ Backend Validation:** Often frontend-only — verify that POST /suppliers with CNPJ "00.000.000/0000-00" (invalid check digits) returns 400 from the backend.
- [ ] **Multi-Level Approval:** Often single approver only — verify that a requisition above the first approver's threshold is escalated to the next level, not auto-approved.
- [ ] **Kanban Drag Validation:** Often bypasses state machine — verify that dragging a DRAFT card to RECEIVED column returns an error and the card snaps back.
- [ ] **NF Desync Scenario:** Often crashes — verify the "NF antecipada" scenario: NF arrives before goods, CP created in `AGUARDANDO_MERCADORIA`, goods arrive, CP transitions to normal flow without creating a second CP.
- [ ] **Saving Analysis Nominal Label:** Often unlabeled — verify that saving figures are clearly labeled "comparação nominal (sem ajuste IPCA)" if inflation adjustment is not implemented.

---

## Recovery Strategies

| Pitfall                                                       | Recovery Cost | Recovery Steps                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate CPs from partial receiving discovered in production | HIGH          | Audit all `Payable` records with `source = PURCHASE_RECEIVING` for duplicates; write reconciliation script to identify and void duplicates; require manual financial review of affected periods |
| Invalid approval state transitions allowed                    | MEDIUM        | Add transition validation to service; write migration to audit existing records and flag any in impossible states; no data migration needed for valid records                                   |
| Synchronous email blocking approval in production             | MEDIUM        | Deploy async queue immediately; existing approved requisitions are unaffected; re-send failed notifications via admin panel                                                                     |
| Budget consumed column not tracking soft commitment           | HIGH          | Requires full recalculation from requisition history; freeze budget mutations during recalculation; high risk if requisition volume is large                                                    |
| Wrong stock type for returns                                  | LOW           | Update existing `RETURN_TO_SUPPLIER` records (rename from `DISPOSAL` after adding new enum value); inventory reports need recomputation for affected periods                                    |
| Price freeze not implemented on quotation                     | MEDIUM        | Add price snapshot columns to PO; backfill from linked quotation where still unchanged; flag records where quotation was edited after PO creation for manual review                             |

---

## Pitfall-to-Phase Mapping

| Pitfall                                     | Prevention Phase                                                    | Verification                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| CP auto-generation race (partial receiving) | Receiving & CP Auto-Generation                                      | Second partial receiving does not create duplicate CP; PO.payableStatus shows PARTIAL after first receiving |
| NF/goods desynchronization                  | Receiving & Conferência (data model design)                         | "NF antecipada" scenario completes without creating duplicate CP or orphaned stock entry                    |
| Approval state machine without transitions  | Requisição & Aprovação (first story)                                | Direct API call with invalid transition returns 409; transition map is the single source of truth           |
| Budget commitment at wrong points           | Orçamento phase (but budget model defined before Requisição)        | Requisition rejection decrements softCommitted; budget available never goes negative due to stale data      |
| Synchronous email blocking mutations        | Notificações phase (queue infrastructure before first notification) | Approval succeeds with SMTP disconnected; notification shows FAILED status in job table                     |
| Quotation price not frozen                  | Cotação & Pedido de Compra phase                                    | Editing a closed quotation returns 409; PO shows snapshotted prices not live quotation prices               |
| Return not reversing stock/CP correctly     | Devolução & Troca phase                                             | Partial return reduces CP by correct proportion; stock output uses RETURN_TO_SUPPLIER type                  |
| Supplier CNPJ not validated backend         | Cadastro de Fornecedores phase (first phase)                        | POST /suppliers with invalid CNPJ check digit returns 400 from service layer                                |
| Nominal saving analysis misleading          | Análise de Saving phase                                             | Saving figure labeled "nominal"; if inflation adjustment absent, clear disclaimer shown                     |
| Kanban bypassing state machine              | Kanban & Dashboard phase                                            | Kanban drag to invalid state returns error; card snaps back; uses same service method as approval button    |

---

## Sources

- Codebase analysis: `apps/backend/src/modules/checks/checks.types.ts` — existing `VALID_TRANSITIONS` pattern (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/payables/payables.types.ts` — `CreatePayableInput` interface; `supplierName` as plain string (no `supplierId` FK) — confirms supplier entity is not yet implemented (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/stock-entries/stock-entries.types.ts` — `invoiceNumber` as plain string, `StockEntryStatus` without receiving-specific states (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/stock-outputs/stock-outputs.types.ts` — existing output types do not include `RETURN_TO_SUPPLIER` (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/payables/payables.service.ts` — `Money` factory from `@protos-farm/shared` already in use; `generateInstallments` imported (HIGH confidence)
- Project context: `.planning/PROJECT.md` — email not yet implemented (HIGH confidence); 6 receiving scenarios specified (HIGH confidence)
- Domain knowledge: Brazilian fiscal workflow for NF-e receiving (MEDIUM confidence — training data, NF scenarios are well-documented in agribusiness ERP literature but not verified against current SEFAZ documentation for this project's specific scenarios)
- Domain knowledge: Procurement approval workflow state machines in ERP systems — established pattern (HIGH confidence)
- Domain knowledge: Budget soft/hard commitment accounting in procurement (HIGH confidence — standard ERP accounting)
- Domain knowledge: CNPJ check digit validation algorithm (Receita Federal) — HIGH confidence, algorithmic
- Domain knowledge: IPCA agricultural price adjustment for saving analysis (MEDIUM confidence — common practice in agribusiness, not formally verified)

---

_Pitfalls research for: Procurement / Purchasing module (v1.1 Gestão de Compras) added to existing financial + stock ERP_
_Researched: 2026-03-17_
