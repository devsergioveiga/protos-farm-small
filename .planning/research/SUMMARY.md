# Project Research Summary

**Project:** Protos Farm — v1.1 Gestao de Compras (Procurement Module)
**Domain:** P2P (Purchase-to-Pay) procurement module added to a live agricultural ERP
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

This milestone adds a complete Purchase-to-Pay (P2P) procurement cycle to a system that already has live financial (payables, cost centers) and inventory (stock-entries, stock-outputs) modules. The research confirms this is not a greenfield procurement build — it is an upstream feeder module whose single most valuable action is a GoodsReceipt confirmation that atomically creates both a stock entry and a conta a pagar (CP), eliminating all double-entry. Every architecture and feature decision in this module must be evaluated against that core integration contract.

The recommended approach follows the dependency-driven sequence established by ERP procurement best practice and validated against the existing codebase: Suppliers first (root dependency for everything), then Requisition + Approval, then Quotation + Comparison Map, then Purchase Order, then Goods Receiving (the integration hub), then Purchase Return. The kanban pipeline view and procurement dashboard are pure aggregations that come last. Four new packages are needed: `bullmq` for async job queuing (reuses existing Redis), `validation-br` for CNPJ/CPF check-digit validation, `handlebars` for HTML email templates, and `@dnd-kit/core + sortable` for the kanban board. No new infrastructure is required.

The highest-risk area is the Goods Receiving implementation. Three pitfalls cluster around receiving: duplicate CP generation on partial shipments, stock/NF desynchronization across the 6 receiving scenarios, and return reversals that use the wrong stock output type. All three are recoverable but expensive if discovered in production. The mitigation is straightforward: define the `GoodsReceipt` data model and its atomic transaction contract before writing any service code, and require that CP creation fires only from the `ReceivingConfirmed` event — never from PO approval.

## Key Findings

### Recommended Stack

The project already ships all core infrastructure needed for procurement. The existing `ioredis`, `pdfkit`, `exceljs`, `decimal.js`, `nodemailer`, `recharts`, `multer`, and `lucide-react` are all reused at zero additional cost. The four new packages add specific missing capabilities: `bullmq` for event-driven async email dispatch without blocking HTTP responses, `validation-br` for backend CNPJ/CPF check-digit validation with support for the July 2026 alphanumeric CNPJ transition (Receita Federal Technical Note COCAD/SUARA/RFB no 49), `handlebars` for maintainable HTML email templates covering 5 workflow events, and `@dnd-kit` for the accessible kanban board (chosen over the unmaintained `react-beautiful-dnd` and the React 19-incompatible `react-dnd`). Real-time UI notifications use native SSE over Express — zero additional dependencies.

**Core technologies:**

- `bullmq ^5.71.0`: Async job queue for email dispatch and approval escalation timers — reuses existing `ioredis ^5.9.3`, no new infrastructure, ships own types
- `validation-br ^1.6.4`: CNPJ/CPF/IE backend validation — covers July 2026 alphanumeric CNPJ transition, actively maintained (published Jan 2026)
- `handlebars ^4.7.8`: HTML email templates for 5 workflow notification events — integrates with existing `nodemailer` via `mail.service.ts`, stable with no CVEs
- `@dnd-kit/core ^6.3.1` + `@dnd-kit/sortable ^10.0.0`: Kanban board — React 19 compatible, keyboard and screen reader accessible, 12KB gzipped core
- SSE (native Express): Real-time UI notifications — unidirectional, zero dependencies, works through HTTP/2, auto-reconnects

### Expected Features

**Must have (table stakes — v1.1 launch):**

- Supplier CRUD with fiscal data (CNPJ/CPF, IE, fiscal regime), contacts, and payment terms — root dependency for all downstream features
- Purchase Requisition (RC) with product catalog items, cost center rateio, and urgency flag — entry point of P2P cycle
- RC approval workflow with configurable value thresholds (alcadas), sequential state machine, and rejection with mandatory comment
- RFQ to multiple suppliers with manual quotation registration — covers 90% of agro suppliers who have no portal
- Quotation comparison map (mapa comparativo) — matrix view with per-item lowest-price highlight and winner selection audit trail
- Purchase Order (OC) generation with PDF export (pdfkit) and email dispatch
- Goods Receiving — 6 explicit scenarios with 3-way match tolerance bands (±3%): NF antecipada, standard, parcial, emergencial, divergencia, devolucao no ato
- Automatic CP generation from GRN + NF data — fires from ReceivingConfirmed event only, uses existing `generateInstallments` from `@protos-farm/shared`
- Automatic stock entry from GRN — inside same Prisma transaction as CP creation (atomic)
- Purchase return (devolucao) with stock reversal (`RETURN_TO_SUPPLIER` type) and payable credit note
- Kanban pipeline view (RC Pendente -> Cotacao -> Aprovacao OC -> OC Emitida -> Aguardando Recebimento -> Encerrada)
- Procurement dashboard: total spend MTD/YTD, open OC value, pending approvals count, savings realized, top 5 suppliers, spend by category
- Email notifications at key workflow transitions via BullMQ async queue

**Should have (v1.2 — after data accumulates):**

- Saving analysis (economia realizada) — needs 2-3 months of historical price data to be meaningful; comparing prices without data produces misleading results
- Supplier scorecard / ranking — needs multiple completed purchase cycles before scores are reliable
- Price history visualization per product — data exists after v1.1 runs; only UI addition required
- Mobile requisition (RC from campo) — validate web flow and approval process first
- CNPJ lookup from Receita Federal API for supplier registration pre-fill

**Defer (v2+):**

- Budget control (orcamento de compras) — requires budget planning module as prerequisite; organizational process change before enforcement makes sense
- Email RFQ with supplier response tracking — email + manual entry covers day-1 needs
- NF-e XML import — explicitly out of scope (full fiscal module)
- Supplier portal — high cost, low ROI at farm scale (Brazilian agro suppliers will not adopt a portal login)
- Frame contracts / blanket orders — enterprise feature, farm scale does not need it

### Architecture Approach

Procurement integrates as 8 new backend modules and 8 new frontend pages into the existing modular monolith, with additive-only modifications to `stock-entries` and `payables` (nullable FK additions, no breaking changes to existing data). The design follows the proven `modules/{domain}/routes+service+types` colocation pattern. All new modules use `withRlsContext` for multitenancy. The `Payable.originType = 'PURCHASE'` and `Payable.originId` fields are already stubbed in the existing schema — the integration interface was designed in advance. The `Supplier` entity replaces the denormalized `supplierName: String` on both `Payable` and `StockEntry` via nullable FK additions, with no backfill required for historical records. Approval workflow uses the existing `VALID_TRANSITIONS` map pattern from `checks.types.ts` — no new pattern introduction.

**Major components:**

1. `suppliers/` — Supplier CRUD with fiscal data, contacts, payment terms, evaluations; root dependency for all procurement documents; CNPJ/CPF validated backend via `validation-br`
2. `purchase-requisitions/` + approval workflow — RC state machine using existing `VALID_TRANSITIONS` map pattern; `ApprovalStep` records per approver level; `ApprovalPolicy` per org; in-app `Notification` table for badge counter
3. `purchase-quotations/` — `QuotationRequest` + `QuotationResponse` + items; mapa comparativo matrix UI; quotation transitions to `CLOSED` on PO issuance (prices frozen by snapshot)
4. `purchase-orders/` — OC document with sequential org-scoped number; PDF via pdfkit (same pattern as `pesticide-prescriptions`); email via BullMQ + Handlebars template
5. `goods-receipts/` — Integration hub: single `withRlsContext` transaction creates `StockEntry` + `Payable` on CONFIRM; 6-scenario state machine; tolerance bands ±3%; `PurchaseOrder.payableStatus` tracking
6. `purchase-returns/` — `PurchaseReturn` -> `StockOutput (RETURN_TO_SUPPLIER)` + `PayableCredit`; `RETURN_TO_SUPPLIER` type added to `StockOutput` enum during receiving phase
7. `purchase-budget/` — `PurchaseBudgetLine` with `softCommitted`/`hardCommitted`/`consumed` columns; schema initialized in Phase 2 (Requisition) even though enforcement is v2
8. `purchase-dashboard/` — Pure aggregation (read-only); KPIs + kanban summary; composite indexes on `(organizationId, status, createdAt)` on purchase_orders and goods_receipts

### Critical Pitfalls

1. **Duplicate CP on partial receiving** — CP amount must come from `receiving.confirmedAmount`, never from `purchaseOrder.totalAmount`. CP creation fires only from the `ReceivingConfirmed` event — not from PO approval. Add `PurchaseOrder.payableStatus` enum (`NOT_GENERATED | PARTIAL | FULLY_GENERATED`) to prevent duplicate generation on second shipment. Highest recovery cost if discovered in production.

2. **NF/goods desynchronization across 6 receiving scenarios** — Two receiving scenarios involve goods arriving before NF or NF before goods. Stock entry fires on goods arrival; CP fires on NF arrival. Never create both from the same code path. The current `invoiceNumber: String` on `StockEntry` is insufficient — must be upgraded before any receiving code is written.

3. **Approval state machine without explicit transitions** — Use `VALID_TRANSITIONS` map pattern already established in `checks.types.ts`. One `validateTransition(current, next)` function at service boundary. Never inline `if (status === 'DRAFT')` checks scattered across service methods. Rejection requires mandatory `rejectionReason`. Multi-level approval is modeled as ordered `ApprovalStep` records, not flags on the requisition.

4. **Synchronous email blocking workflow mutations** — Never `await emailService.send()` inside a Prisma transaction. BullMQ job is enqueued after transaction commits; HTTP response returns before email delivery. If SMTP fails, workflow state is already saved. Show UI distinction between success notification and notification failure.

5. **Quotation prices not frozen at PO issuance** — `PurchaseOrder` must snapshot `unitPrice`/`quantity`/`totalAmount` at issuance time, not store only a quotation FK. Quotation transitions to `CLOSED` status when PO is issued. Editing a closed quotation returns 409. CP amount is computed from the PO snapshot, not from live quotation or live product prices.

## Implications for Roadmap

Based on dependency analysis, the P2P cycle must be implemented in strict upstream-to-downstream order. No phase can be skipped without breaking the next. The minimum coherent unit is the complete cycle — a procurement module with requisitions but no GRN is useless; a GRN without CP auto-generation defeats the purpose.

### Phase 1: Cadastro de Fornecedores (Supplier Foundation)

**Rationale:** Supplier is the root dependency for every procurement document. No quotation, PO, or CP can be generated without a valid `supplierId`. Must be phase 1 with no exceptions.
**Delivers:** Supplier CRUD with fiscal data, multiple contacts, payment terms; backend CNPJ/CPF/IE validation via `validation-br`; `fiscalRegime` enum (SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, PESSOA_FISICA, RURAL_PRODUCER); `SupplierEvaluation` sub-resource; supplier search and filtering; purchasing history per supplier view.
**Addresses:** All table-stakes supplier features (registration, contacts, search, payment term defaults).
**Avoids:** Pitfall 8 — CNPJ stored without backend check-digit validation causes SEFAZ reconciliation failures discovered only months later.
**Research flag:** Standard CRUD patterns — no additional research needed.

### Phase 2: Requisicao de Compra e Aprovacao (Requisition + Approval Workflow)

**Rationale:** RC is the entry point of the P2P cycle. The approval workflow is the new architectural element with no existing precedent in this codebase — it must be designed completely before any downstream phase uses its output. The `VALID_TRANSITIONS` map and `Notification` model introduced here are reused by Kanban (Phase 6).
**Delivers:** `PurchaseRequisition` + `PurchaseRequisitionItem` + `ApprovalStep` + `ApprovalPolicy` + `Notification` models; `VALID_TRANSITIONS` state machine (DRAFT -> PENDING_APPROVAL -> APPROVED -> REJECTED -> RECALLED -> CANCELLED); in-app badge counter via `GET /api/notifications/unread-count`; BullMQ queue infrastructure for async email dispatch; `purchase_budget_lines` schema with `softCommitted`/`hardCommitted`/`consumed` columns (initialized here, enforcement v2).
**Addresses:** RC creation, RC approval workflow with configurable alcadas, rejection with mandatory comment, in-app notifications.
**Avoids:** Pitfall 3 (approval state machine without explicit transitions — VALID_TRANSITIONS map is the feature, not an implementation detail); pitfall 5 (synchronous email — BullMQ queue established here before first notification fires).
**Research flag:** Standard ERP patterns — no additional research needed.

### Phase 3: Cotacao e Pedido de Compra (Quotation + Purchase Order)

**Rationale:** RFQ flows from an APPROVED requisition. Quotation comparison map is the key decision-support UI. PO issuance must freeze prices — data model must snapshot prices, not reference live quotation records. Email dispatch to supplier uses Handlebars templates + BullMQ from Phase 2.
**Delivers:** `QuotationRequest` + `QuotationResponse` + `QuotationResponseItem`; mapa comparativo UI (matrix: rows = items, cols = suppliers, lowest price highlighted per item); winner selection with audit trail; `PurchaseOrder` with sequential org-scoped number, price snapshot fields, and `CLOSED` quotation status on issuance; OC PDF via pdfkit; email via BullMQ + Handlebars `purchase-order.hbs` template.
**Addresses:** RFQ to multiple suppliers, manual quotation registration, quotation comparison map, winner selection, OC generation, OC PDF export, OC email dispatch to supplier.
**Avoids:** Pitfall 6 (quotation price not frozen at PO issuance — snapshot prices on PO creation, transition quotation to CLOSED); pitfall 9 (saving analysis deferred to v1.2 when actual price data accumulates).
**Uses:** `handlebars` for OC email template; `pdfkit` existing pattern from `pesticide-prescriptions`.
**Research flag:** Standard patterns — no additional research needed.

### Phase 4: Recebimento de Mercadorias (Goods Receiving — Integration Hub)

**Rationale:** This is the highest-value and highest-risk phase. A single CONFIRM action must atomically create a `StockEntry` (existing module) and a `Payable` (existing module) via `withRlsContext`. The 6 receiving scenarios require careful state machine design before implementation begins. The `RETURN_TO_SUPPLIER` stock output type must be added to the `StockOutput` enum here (not in Phase 5) to avoid migrating a live enum in production.
**Delivers:** `GoodsReceipt` + `GoodsReceiptItem` with 6-scenario state machine; 3-way match with ±3% tolerance bands (warning-not-block); atomic transaction: StockEntry + Payable creation on CONFIRM; `PurchaseOrder.payableStatus` tracking (NOT_GENERATED -> PARTIAL -> FULLY_GENERATED); NF data capture (manual: number, serie, date, total, chave NF-e as future fiscal hook); modifications to `stock-entries` (add `supplierId`, `purchaseOrderId`, `goodsReceiptId` FKs) and `payables` (add `supplierId` FK, expose `POST /api/payables/from-purchase` route); `RETURN_TO_SUPPLIER` added to `StockOutput` type enum (used in Phase 5).
**Addresses:** Goods Receiving (all 6 scenarios), automatic CP generation, automatic stock entry, discrepancy handling, OC status tracking (EMITIDA -> RECEBIMENTO_PARCIAL -> ENCERRADA).
**Avoids:** Pitfall 1 (duplicate CP on partial receiving — `payableStatus` + event-driven CP from ReceivingConfirmed only); pitfall 2 (NF/goods desync — explicit two-phase state machine for goods vs NF arrival, not a flag on StockEntry).
**Research flag:** Needs implementation plan before coding — the atomic transaction across 3 tables and the 6-scenario state machine benefit from a dedicated phase planning document. Recommend `/gsd:research-phase` before implementation starts.

### Phase 5: Devolucao e Troca (Purchase Returns)

**Rationale:** Returns reference a confirmed GoodsReceipt and must reverse both stock and payable correctly. The `RETURN_TO_SUPPLIER` stock output type was added in Phase 4. A partial return against a partially-paid CP requires a `PayableCredit` model (not direct CP amount mutation) to preserve audit trail.
**Delivers:** `PurchaseReturn` + `PurchaseReturnItem`; `StockOutput (RETURN_TO_SUPPLIER)` reversal (FEFO preserved); `PayableCredit` record reducing outstanding CP (or `Receivable` generation if CP already paid); return reasons (DEFECT, WRONG_PRODUCT, EXCESS, QUALITY); resolution types (CREDIT_NOTE, EXCHANGE, REFUND); return status machine (PENDING -> CONFIRMED -> RESOLVED).
**Addresses:** Purchase return (devolucao) with supplier credit note; complete financial cycle closure.
**Avoids:** Pitfall 7 (return using DISPOSAL stock type — `RETURN_TO_SUPPLIER` ready from Phase 4; partial CP credit modeled as `PayableCredit` not direct amount mutation).
**Research flag:** Verify `PayableCredit` model fits existing payables schema before implementation — inspect `payables.service.ts` and `payables.types.ts` during Phase 5 planning.

### Phase 6: Kanban, Dashboard e Notificacoes (Visibility + Operations)

**Rationale:** Pure aggregation reads from all upstream tables. Kanban uses `@dnd-kit` with drag actions wired to the same service methods as form buttons (not a generic status override). Dashboard KPIs need composite indexes on `(organizationId, status, createdAt)` to perform at scale.
**Delivers:** Procurement kanban (5 columns, `@dnd-kit`, drag validates via existing `VALID_TRANSITIONS`); `PurchaseDashboardPage` with KPIs (total spend MTD/YTD, open OC value, pending approvals count, top 5 suppliers by spend, spend by category via recharts); SSE endpoint for real-time Kanban updates; composite DB indexes on `purchase_orders` and `goods_receipts`; Kanban server-side pagination per column (default: last 90 days); full BullMQ email notification suite for all 5 workflow templates.
**Addresses:** Kanban pipeline view, procurement dashboard (executive view), email notifications at all workflow steps, real-time UI feedback.
**Avoids:** Pitfall 10 (kanban drag bypassing state machine — reuse `validateTransition()` from Phase 2, card snaps back on invalid drag); performance trap (kanban without pagination; dashboard aggregation without indexes).
**Uses:** `@dnd-kit/core` + `@dnd-kit/sortable`; SSE native Express; existing `recharts` for dashboard charts; existing `Notification` table from Phase 2.
**Research flag:** Standard patterns — no additional research needed.

### Phase Ordering Rationale

- Supplier -> Requisition -> Quotation -> PurchaseOrder -> GoodsReceipt -> PurchaseReturn is the strict topological order of P2P dependencies. No entity at level N can exist without entities at level N-1.
- `PurchaseBudgetLine` schema is initialized during Phase 2 (Requisition) — even though budget enforcement is v2 — to avoid retroactive migrations when approval records are already live in production.
- `RETURN_TO_SUPPLIER` stock output type is added to the enum during Phase 4 (Receiving) schema work, not Phase 5 (Returns), to avoid migrating a live production enum with existing records.
- `VALID_TRANSITIONS` map and `Notification` table from Phase 2 are reused directly by Phase 6 (Kanban). This cross-cutting dependency is satisfied by the ordering.
- Saving analysis, supplier scorecard, and price history visualization are v1.2 — these features require real historical data from 2-3 months of production use to be meaningful.

### Research Flags

Phases needing `/gsd:research-phase` before implementation tasks are written:

- **Phase 4 (Goods Receiving):** The 6-scenario state machine, the atomic 3-table transaction contract, and the NF desynchronization handling are the most complex implementation in this milestone. The interaction between `GoodsReceipt` scenarios, `payableStatus` tracking, and `generateInstallments` rural calendar handling warrants a dedicated implementation plan before any code is written.

Phases with well-documented patterns (skip research-phase):

- **Phase 1 (Suppliers):** Standard entity CRUD + CNPJ validation. Established module pattern in this codebase.
- **Phase 2 (Requisition + Approval):** State machine follows existing `VALID_TRANSITIONS` pattern from `checks.types.ts`. `ApprovalStep` ordered list is a well-known ERP pattern.
- **Phase 3 (Quotation + PO):** PDF reuses `pesticide-prescriptions` pattern. Email reuses `mail.service.ts` with BullMQ queue. Quotation comparison is a standard matrix UI.
- **Phase 5 (Returns):** Standard reversal pattern dependent only on confirmed GRN records.
- **Phase 6 (Dashboard + Kanban):** Pure read aggregation. `@dnd-kit` integration is well-documented.

## Confidence Assessment

| Area         | Confidence                                                                                                                                                                          | Notes                                                                                                                                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH                                                                                                                                                                                | All 4 new packages npm-verified with exact versions and peer dep compatibility confirmed. `validation-br` alphanumeric CNPJ support is MEDIUM — specific function API not verified from official Receita Federal docs directly.                                     |
| Features     | HIGH                                                                                                                                                                                | ERP procurement is a mature domain. ERPNext, SAP, NetSuite, Dynamics 365 patterns verified. Brazilian agro-specific requirements (safra payment terms, NF-e manual entry, 6 receiving scenarios) confirmed against industry sources.                                |
| Architecture | HIGH                                                                                                                                                                                | Derived from direct codebase analysis of 5500+ line Prisma schema. `Payable.originType = 'PURCHASE'` integration interface pre-confirmed. `VALID_TRANSITIONS` pattern confirmed in `checks.types.ts`. `invoiceNumber: String` limitation on `StockEntry` confirmed. |
| Pitfalls     | HIGH for integration pitfalls (codebase-derived); MEDIUM for Brazilian fiscal NF workflow specifics (agribusiness ERP literature, not verified against current SEFAZ documentation) |                                                                                                                                                                                                                                                                     |

**Overall confidence:** HIGH

### Gaps to Address

- **`validation-br` alphanumeric CNPJ function API:** Support confirmed via package description and recent publish date, but the specific function signature (e.g., `validateCNPJ(str)` vs `cnpj.isValid(str)`) was not verified. Validate API during Phase 1 implementation before committing to the package call sites.
- **`PayableCredit` model for partial CP reduction:** The current `payables.service.ts` has no model for reducing a partially-settled payable. Inspect the payables schema during Phase 5 planning to determine whether a `PayableCredit` record or a `Payable` amount adjustment with audit trail is the better fit for the existing system.
- **`generateInstallments` rural calendar handling:** The existing shared helper must be verified for "safra" payment term (harvest-date-relative due date, not fixed calendar). Validate during Phase 4 planning before relying on it for GRN-triggered CP installment generation.
- **Saving analysis inflation adjustment (v1.2):** When Phase 6+ saving analysis is planned, the nominal vs IPCA-adjusted comparison must be addressed explicitly. For MVP v1.2, manual inflation adjustment percentage input is acceptable. Label all saving figures as "comparacao nominal (sem ajuste IPCA)" until inflation adjustment is implemented.

## Sources

### Primary (HIGH confidence)

- `apps/backend/prisma/schema.prisma` — existing data models, `Payable.originType`/`originId` integration interface, `StockEntry.supplierName` as plain string
- `apps/backend/src/modules/checks/checks.types.ts` — `VALID_TRANSITIONS` pattern adopted for approval state machine
- `apps/backend/src/modules/payables/payables.service.ts` — `Money` factory, `generateInstallments` import confirmed
- `apps/backend/src/modules/stock-outputs/stock-outputs.types.ts` — `RETURN_TO_SUPPLIER` type absence confirmed
- `apps/backend/src/modules/pesticide-prescriptions/` — PDF generation pattern reused for OC
- `apps/backend/src/database/redis.ts` + `src/shared/mail/mail.service.ts` — BullMQ and email infrastructure
- npm registry: `bullmq@5.71.0`, `validation-br@1.6.4`, `handlebars@4.7.8`, `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0` — versions verified
- ERPNext open source procurement documentation — RFQ, comparison map, PO generation patterns
- NetSuite procurement and three-way matching documentation — lifecycle and tolerance patterns

### Secondary (MEDIUM confidence)

- BullMQ official docs — job events, delayed jobs, ioredis peer dep compatibility
- dnd-kit GitHub — React 19 compatibility (confirmed for `@dnd-kit/core`; one open issue for `@dnd-kit/react`, which is not used here)
- Ramp, Stampli, HighRadius procurement guides — GRN scenarios, approval workflow patterns, supplier scorecard methodology
- Receita Federal Technical Note COCAD/SUARA/RFB no 49 — alphanumeric CNPJ July 2026 (via web search, not official Receita Federal site directly)
- Aegro blog — NF-e context for Brazilian agro suppliers, receituario agronômico integration context

### Tertiary (LOW confidence)

- IPCA agricultural price adjustment for saving analysis — common practice in agribusiness, not formally verified for this project's specific saving analysis requirements
- NF-e receiving scenarios per Brazilian fiscal law — derived from agribusiness ERP literature, not verified against current SEFAZ documentation for this project's specific 6 scenarios

---

_Research completed: 2026-03-17_
_Ready for roadmap: yes_
