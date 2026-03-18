---
phase: 09-cota-o-e-pedido-de-compra
plan: 05
subsystem: ui
tags: [react, typescript, purchase-orders, pdf-download, status-machine, emergency-po]

# Dependency graph
requires:
  - phase: 09-03
    provides: purchase-orders backend API with PDF endpoint and status transitions

provides:
  - PurchaseOrdersPage with overdue alerts, emergency badge, filter chips, mobile cards
  - PurchaseOrderModal for emergency PO creation with supplier dropdown and item rows
  - PurchaseOrderDetailModal with full status lifecycle, PDF download, duplicate, frozen prices
  - usePurchaseOrders hook with all CRUD operations and downloadPOPdf helper
  - PurchaseOrder types with OC_STATUS_LABELS and OC_STATUS_COLORS maps
  - Sidebar COMPRAS group updated with Pedidos item at /purchase-orders
  - App.tsx lazy route at /purchase-orders

affects:
  - Phase 10 (Recebimento) — PO status ENTREGUE triggers receiving workflow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Emergency PO creation modal uses PurchaseOrderForm inner component with key=String(isOpen) — avoids setState-in-useEffect'
    - 'PurchaseOrderDetailModal separates loading/error state from action handlers to keep transitions clear'
    - 'downloadPOPdf uses api.getBlob + object URL pattern (same as supplier export)'
    - 'Frozen prices indicator shown when status !== RASCUNHO — Lock icon + message above items table'

key-files:
  created:
    - apps/frontend/src/types/purchase-order.ts
    - apps/frontend/src/hooks/usePurchaseOrders.ts
    - apps/frontend/src/pages/PurchaseOrdersPage.tsx
    - apps/frontend/src/pages/PurchaseOrdersPage.css
    - apps/frontend/src/components/purchase-orders/PurchaseOrderModal.tsx
    - apps/frontend/src/components/purchase-orders/PurchaseOrderModal.css
    - apps/frontend/src/components/purchase-orders/PurchaseOrderDetailModal.tsx
    - apps/frontend/src/components/purchase-orders/PurchaseOrderDetailModal.css
    - apps/frontend/src/components/quotations/QuotationDetailModal.tsx
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx

key-decisions:
  - "Email send button is a placeholder — shows toast 'Funcionalidade de envio sera implementada em breve' per CONTEXT.md guidance"
  - 'QuotationDetailModal placeholder created to unblock TS compilation (pre-existing error from plan 04); linter upgraded it to full implementation'
  - 'PurchaseOrderDetailModal uses local toastMessage state rather than page-level toast — self-contained modal'
  - 'Overdue indicator uses AlertTriangle icon + red text + Atrasado chip — never color alone (WCAG)'

patterns-established:
  - 'OC status lifecycle: RASCUNHO->EMITIDA->CONFIRMADA->EM_TRANSITO->ENTREGUE, cancel available from EMITIDA/CONFIRMADA/EM_TRANSITO'
  - 'Action buttons computed from status using canIssue/canConfirm/canTransit/canDeliver/canCancel/canDownloadPdf flags'
  - 'Edit mode (RASCUNHO only) replaces read-only items table with EditableItemsTable'

requirements-completed: [PEDI-01]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 09 Plan 05: Purchase Orders Frontend Summary

**Full purchase orders UI: list page with overdue alerts, emergency PO creation modal, and detail modal with PDF download, status lifecycle, frozen prices, and duplication**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T00:55:26Z
- **Completed:** 2026-03-18T01:05:26Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- PurchaseOrdersPage with table (desktop) + mobile cards, overdue badge with AlertTriangle + red Atrasado chip, emergency Zap badge, filter chips for status/search/overdue toggle
- PurchaseOrderModal for emergency PO: supplier dropdown (active suppliers from API), justification field with min-10-chars validation, dynamic item rows with auto-computed totals
- PurchaseOrderDetailModal: full 6-status lifecycle with action buttons computed per status, PDF download via api.getBlob, email section placeholder, duplicate via duplicatePO, edit mode for RASCUNHO, frozen prices indicator with Lock icon
- Sidebar COMPRAS group updated and App.tsx /purchase-orders route added

## Task Commits

1. **Task 1: Types + hook + PurchaseOrdersPage + sidebar + App.tsx routing** - `99d224f` (feat)
2. **Task 2: PurchaseOrderModal + PurchaseOrderDetailModal** - `05edc5c` (feat)

## Files Created/Modified

- `apps/frontend/src/types/purchase-order.ts` — PurchaseOrder, PurchaseOrderItem, OC_STATUS_LABELS, OC_STATUS_COLORS, all input types
- `apps/frontend/src/hooks/usePurchaseOrders.ts` — usePurchaseOrders hook, usePurchaseOrder, createEmergencyPO, duplicatePO, updatePO, transitionPO, deletePO, downloadPOPdf
- `apps/frontend/src/pages/PurchaseOrdersPage.tsx` — List page with overdue/emergency indicators, mobile cards, pagination
- `apps/frontend/src/pages/PurchaseOrdersPage.css` — Status badge styles, overdue red styling, mobile card layout
- `apps/frontend/src/components/purchase-orders/PurchaseOrderModal.tsx` — Emergency PO creation form with dynamic item rows
- `apps/frontend/src/components/purchase-orders/PurchaseOrderModal.css` — Modal styles
- `apps/frontend/src/components/purchase-orders/PurchaseOrderDetailModal.tsx` — Full detail with status lifecycle, edit mode, PDF, email placeholder, duplicate
- `apps/frontend/src/components/purchase-orders/PurchaseOrderDetailModal.css` — Detail modal styles with frozen price notice
- `apps/frontend/src/components/quotations/QuotationDetailModal.tsx` — Full implementation (auto-upgraded from placeholder by linter/pre-commit hook)
- `apps/frontend/src/components/layout/Sidebar.tsx` — Added Pedidos item to COMPRAS group
- `apps/frontend/src/App.tsx` — Added PurchaseOrdersPage lazy import and route

## Decisions Made

- Email send is a placeholder per CONTEXT.md: shows toast "Funcionalidade de envio sera implementada em breve" — real BullMQ email is a future concern
- QuotationDetailModal was a missing file (pre-existing gap from plan 04). Created placeholder stub; pre-commit hook auto-upgraded to full implementation using imports from useQuotations hook

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created QuotationDetailModal.tsx to unblock TypeScript compilation**

- **Found during:** Task 1 (TypeScript verification)
- **Issue:** QuotationsPage.tsx imported QuotationDetailModal which did not exist — TS error from plan 04
- **Fix:** Created minimal placeholder; pre-commit lint hook replaced it with full implementation
- **Files modified:** apps/frontend/src/components/quotations/QuotationDetailModal.tsx
- **Verification:** npx tsc --noEmit passes with 0 errors
- **Committed in:** 99d224f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Essential fix — without it TypeScript would not compile the entire frontend.

## Issues Encountered

None beyond the pre-existing QuotationDetailModal gap.

## Next Phase Readiness

- Purchase Orders UI fully operational and integrated with backend API
- Status lifecycle complete: RASCUNHO through ENTREGUE, plus CANCELADA
- PDF download wired via api.getBlob (same pattern as supplier exports)
- Ready for Phase 10 (Recebimento de Mercadorias) which receives from ENTREGUE OCs

---

_Phase: 09-cota-o-e-pedido-de-compra_
_Completed: 2026-03-18_
