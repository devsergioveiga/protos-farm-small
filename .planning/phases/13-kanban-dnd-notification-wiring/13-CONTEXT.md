# Phase 13: Kanban DnD Fixes + Notification Wiring - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 2 broken Kanban DnD transition calls and wire 4 notification types that are defined but never dispatched — restoring full Kanban interactivity and completing the notification pipeline. SC1 (RC_PENDENTE→RC_APROVADA) removed from scope — already works correctly.

</domain>

<decisions>
## Implementation Decisions

### EM_COTACAO → OC_EMITIDA transition

- **Navigate to quotation page**, same redirect pattern as AGUARDANDO_ENTREGA→RECEBIDO
- ConfirmModal shown before navigating: "Para emitir o pedido de compra, é necessário aprovar a cotação vencedora primeiro." Button: "Ir para Cotações"
- Navigates to `/quotations?highlight={quotationId}` on confirm
- Keep EM_COTACAO→OC_EMITIDA in the VALID_TRANSITIONS map (drop zone lights up) — handler navigates instead of calling API
- No direct PO creation from kanban — user must go through quotation approval flow

### OC_EMITIDA → AGUARDANDO_ENTREGA transition

- Use PATCH `/purchase-orders/{id}/transition` with `{ action: 'CONFIRM_SHIPMENT' }` (state-machine pattern)
- Follows same VALID_TRANSITIONS pattern as purchase-requests
- Replaces broken PUT `/purchase-orders/{id}/status` with `EM_TRANSITO`

### BUDGET_EXCEEDED notification

- **Disparo duplo**: fires at RC approval (orçamento requisitado) AND at OC emission (orçamento comprometido)
- Recipients: the approver + FINANCIAL role users
- Dispatch in: `purchase-requests.service.ts` (APPROVE action, after budget check) and `purchase-orders.service.ts` (at OC creation, after budget check)

### PO_GOODS_RECEIVED notification

- Fires when `confirmGoodsReceipt` completes successfully
- Recipients: RC creator + buyer (person who emitted the OC)
- Dispatch in: `goods-receipts.service.ts` (after confirm, before return)

### RETURN_REGISTERED notification

- Fires when a goods return is created
- Recipients: buyer who emitted the OC (needs to contact supplier)
- Dispatch in: `goods-returns.service.ts` (createGoodsReturn)

### RETURN_RESOLVED notification

- Fires when goods return transitions to CONCLUIDA
- Recipients: FINANCIAL role users (needs to process credit/estorno)
- **Fix wrong type**: replace existing `GOODS_RETURN_APPROVED` dispatch with `RETURN_RESOLVED` at CONCLUIDA transition
- Dispatch in: `goods-returns.service.ts` (transitionGoodsReturn → CONCLUIDA)

### SC1 removed from scope

- RC_PENDENTE→RC_APROVADA already calls correct `POST /purchase-requests/{id}/approve` endpoint
- No code changes needed — verified by codebase scout

### Claude's Discretion

- Exact notification message content (title/body text) — follow existing pt-BR patterns
- Whether to add a PATCH /transition endpoint to purchase-orders or reuse/fix existing PUT /status
- Test coverage approach for the DnD fixes and notification wirings
- Error handling in moveCard for failed transitions

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Kanban DnD (Frontend)

- `apps/frontend/src/hooks/usePurchasingKanban.ts` — moveCard function (lines 80-138), VALID_TRANSITIONS map (line 33), broken transition calls at lines 120-125
- `apps/frontend/src/components/kanban/KanbanBoard.tsx` — handleDragEnd (lines 126-144), handleConfirm (lines 146-164), confirmation copy (lines 33-75)

### Notification Dispatch Points (Backend)

- `apps/backend/src/modules/notifications/notifications.types.ts` — All notification types defined (lines 3-19), including the 4 unwired types
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification function, shouldNotify pattern, fire-and-forget email
- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` — transitionPurchaseRequest APPROVE action (~line 467), budgetExceeded flag exists but no notification fired
- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` — confirmGoodsReceipt (~line 822), no PO_GOODS_RECEIVED dispatch
- `apps/backend/src/modules/goods-returns/goods-returns.service.ts` — createGoodsReturn (no RETURN_REGISTERED), transitionGoodsReturn CONCLUIDA (line 506, wrong type GOODS_RETURN_APPROVED at line 495)

### Purchase Order Endpoints (Backend)

- `apps/backend/src/modules/purchase-orders/purchase-orders.routes.ts` — Current PUT /status endpoint that needs to become PATCH /transition
- `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` — PO state machine, transition logic

### Notification Frontend (Already wired)

- `apps/frontend/src/hooks/useNotifications.ts` — Labels for all 14 types already defined (lines 20-35), polling works
- `apps/frontend/src/components/notifications/NotificationBell.tsx` — handleItemClick routes per type

### Phase 12 Context (Prior decisions)

- `.planning/phases/12-kanban-dashboard-e-notifica-es/12-CONTEXT.md` — Full kanban/notification architecture decisions
- `.planning/phases/12-kanban-dashboard-e-notifica-es/12-RESEARCH.md` — dnd-kit setup, notification infrastructure

### Requirements

- `.planning/REQUIREMENTS.md` — DASH-01 (kanban with DnD), DASH-03 (notifications per stage)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ConfirmModal`: Already used for all kanban transitions — reuse for the navigation redirect modal
- `createNotification` service: Full infrastructure ready (badge + email per preferences, fire-and-forget)
- `shouldNotify` helper: Checks user preferences before dispatching — use for all 4 new notifications
- `NOTIFICATION_TYPES` enum: All 4 types already defined, just need dispatch calls
- `useNotifications` hook: Labels already defined for all types — no frontend changes needed for notifications

### Established Patterns

- **Navigation-based transitions**: AGUARDANDO_ENTREGA→RECEBIDO navigates to `/goods-receipts?poId=` — reuse for EM_COTACAO→OC_EMITIDA
- **VALID_TRANSITIONS map**: Source of truth for DnD validation — frontend mirrors backend state machines
- **Notification dispatch in service layer**: createNotification called inside existing tx for BADGE, email via fire-and-forget
- **purchaseRequestId FK on Notification**: Direct relation for RC-related notifications

### Integration Points

- `usePurchasingKanban.ts` moveCard: Fix lines 120-125 (2 transitions)
- `KanbanBoard.tsx` confirmation copy: Update copy for EM_COTACAO→OC_EMITIDA transition
- `purchase-requests.service.ts`: Add BUDGET_EXCEEDED dispatch after budget check in APPROVE
- `purchase-orders.service.ts`: Add BUDGET_EXCEEDED dispatch at OC creation + expose PATCH /transition endpoint
- `goods-receipts.service.ts`: Add PO_GOODS_RECEIVED dispatch in confirmGoodsReceipt
- `goods-returns.service.ts`: Add RETURN_REGISTERED in create, fix RETURN_RESOLVED in CONCLUIDA transition

</code_context>

<specifics>
## Specific Ideas

- EM_COTACAO→OC_EMITIDA follows same redirect pattern as AGUARDANDO_ENTREGA→RECEBIDO — consistency is key
- All 4 notification dispatches use existing infrastructure — no new models, no new email templates needed
- GOODS_RETURN_APPROVED type at CONCLUIDA is a bug from Phase 11 — fix to RETURN_RESOLVED
- BUDGET_EXCEEDED duplo matches Phase 12 decision: capture both decision moments (requisitar vs comprometer)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 13-kanban-dnd-notification-wiring_
_Context gathered: 2026-03-19_
