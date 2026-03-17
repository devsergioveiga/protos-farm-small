---
phase: 02-n-cleo-ap-ar
plan: 06
subsystem: receivables-frontend
tags:
  [
    receivables,
    contas-a-receber,
    funrural,
    aging,
    installments,
    rateio,
    receipt,
    renegotiation,
    frontend,
    react,
  ]

# Dependency graph
requires:
  - phase: 02-n-cleo-ap-ar
    plan: 03
    provides: Receivables (CR) backend module — 10 endpoints under /org/receivables, FUNRURAL, aging, settle, renegotiate

provides:
  - ReceivablesPage with Titulos and Aging tabs
  - useReceivables and useReceivablesAging hooks
  - ReceivableModal with FUNRURAL auto-calculation, NF-e key, installments, cost-center rateio, recurrence
  - ReceiptModal with juros/multa/glosa and FUNRURAL expected-net hint
  - RenegotiateModal creating new CR from overdue original
  - Route /receivables registered in App.tsx
  - Sidebar entry under FINANCEIRO

affects:
  - App.tsx (route added)
  - Sidebar.tsx (FINANCEIRO nav entry added)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ReceivablesPage uses tab pattern (Titulos/Aging) consistent with PayablesPage
    - refetchTrigger counter pattern: parent increments, TitlesTab useEffect re-fetches
    - AgingTab onBucketClick switches to Titulos tab with agingBucket filter
    - ReceivableModal.css shared by all 3 modals (ReceivableModal, ReceiptModal, RenegotiateModal)
    - FUNRURAL calculated live in ReceivableModal (rate * totalAmount / 100)
    - ReceiptModal shows expected net = totalAmount - funruralAmount as hint

key-files:
  created:
    - apps/frontend/src/hooks/useReceivables.ts
    - apps/frontend/src/pages/ReceivablesPage.tsx
    - apps/frontend/src/pages/ReceivablesPage.css
    - apps/frontend/src/components/receivables/ReceivableModal.tsx
    - apps/frontend/src/components/receivables/ReceivableModal.css
    - apps/frontend/src/components/receivables/ReceiptModal.tsx
    - apps/frontend/src/components/receivables/RenegotiateModal.tsx
  modified:
    - apps/frontend/src/App.tsx (ReceivablesPage lazy import + /receivables route)
    - apps/frontend/src/components/layout/Sidebar.tsx (ReceiptText icon + /receivables nav item)

key-decisions:
  - 'useReceivables refetch triggered by refetchTrigger counter (parent increments) — useEffect in TitlesTab detects change and calls refetch'
  - 'Aging tab onBucketClick switches to Titulos tab and sets agingBucket filter — drill-down without full navigation'
  - 'ReceivableModal.css shared by ReceivableModal, ReceiptModal, RenegotiateModal — consistent modal styling with cr-modal__ and cr-receipt__ prefixes'
  - 'FUNRURAL recalculated live from funruralRateDisplay * parseBRL(totalAmountDisplay) / 100 — stored at submit time'

patterns-established:
  - 'Tab-based CR page: Titulos (table + mobile cards) + Aging (7 buckets with overdue highlight)'
  - 'FUNRURAL section collapsed by default, toggle to show rate input and live amount preview'
  - 'NF-e 44-char validation: char count hint + error only when filled and != 44'
  - 'RenegotiateModal enforces future date (> today) for new due date'

requirements-completed: [FN-11, FN-12]

# Metrics
duration: 45min
completed: 2026-03-16
---

# Phase 02 Plan 06: Receivables (CR) Frontend Summary

**ReceivablesPage with Titulos+Aging tabs, useReceivables+useReceivablesAging hooks, ReceivableModal with FUNRURAL/NF-e/installments/rateio, ReceiptModal with juros/multa/glosa, and RenegotiateModal for overdue CR renegotiation**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-16
- **Completed:** 2026-03-16
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 2

## Accomplishments

### Task 1: ReceivablesPage, hooks

- `useReceivables(query)` — GET /org/receivables with all filters (status, category, farmId, dates, search, agingBucket, pagination)
- `useReceivablesAging(farmId?)` — GET /org/receivables/aging with 7-bucket AgingResponse
- `ReceivablesPage` with 2 tabs:
  - **Titulos tab:** table with FUNRURAL column (rate% + R$ amount), NF-e truncated key with tooltip, status badges, action buttons (edit, settle, renegotiate, reverse, delete), mobile card view
  - **Aging tab:** 7-bucket table (OVERDUE highlighted in red), summary cards with inadimplencia total, click row to filter Titulos tab
- Filter toolbar: status, categoria rural, fazenda, date range, search, bucket chip

### Task 2: Modals

- `ReceivableModal`: create/edit with FUNRURAL collapsible section (live amount preview), NF-e key 44-char input with counter, installments table (auto-generated + editable), cost-center rateio (percentage or fixed), recurrence (frequency + end date), produtor rural emitente dropdown
- `ReceiptModal`: data recebimento, valor recebido, conta bancária destino, juros/multa/glosa inputs, valor efetivo live calculation, FUNRURAL expected-net hint
- `RenegotiateModal`: nova data vencimento (must be future), novo valor (default = original), observações, days-in-arrears display, informational note about old/new CR flow

## Task Commits

1. **Task 1: ReceivablesPage with list, aging, and hooks** — feat(02-n-cleo-ap-ar-06)
2. **Task 2: Modals** — feat(02-n-cleo-ap-ar-06)

## Files Created/Modified

- `apps/frontend/src/hooks/useReceivables.ts` — useReceivables, useReceivablesAging, types (Receivable, ReceivableStatus, ReceivableCategory, AgingBucket, AgingBucketResult, AgingResponse)
- `apps/frontend/src/pages/ReceivablesPage.tsx` — TitlesTab, AgingTab, main ReceivablesPage with filter toolbar and tab switcher
- `apps/frontend/src/pages/ReceivablesPage.css` — table, aging, filters, mobile cards, badges, actions
- `apps/frontend/src/components/receivables/ReceivableModal.tsx` — create/edit form with FUNRURAL, NF-e, installments, cost-center
- `apps/frontend/src/components/receivables/ReceivableModal.css` — shared modal styles + cr-receipt** + cr-renegotiate** blocks
- `apps/frontend/src/components/receivables/ReceiptModal.tsx` — settlement with effective amount calculation
- `apps/frontend/src/components/receivables/RenegotiateModal.tsx` — renegotiation with future-date validation
- `apps/frontend/src/App.tsx` — added ReceivablesPage lazy import + /receivables route
- `apps/frontend/src/components/layout/Sidebar.tsx` — added ReceiptText icon + /receivables nav item under FINANCEIRO

## Decisions Made

- refetchTrigger counter in parent page, useEffect in TitlesTab detects change and calls refetch — avoids passing setters through the component hierarchy
- Aging bucket click switches tab to Titulos and sets agingBucket filter — direct drill-down UX
- ReceivableModal.css is shared by all 3 modals using `.cr-modal__` prefix for common elements and `.cr-receipt__`/`.cr-renegotiate__` for modal-specific sections

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken prevTrigger pattern in TitlesTab**

- **Found during:** Task 1 (self-review before commit)
- **Issue:** Used `useState(refetchTrigger)[0]` to compare trigger — this always returns the initial value, not previous render value, making refetch never trigger on parent-initiated refreshes
- **Fix:** Replaced with `useEffect([refetchTrigger])` that calls `refetch()` when trigger changes
- **Files modified:** ReceivablesPage.tsx

---

**Total deviations:** 1 auto-fixed
**Impact on plan:** Bug fix essential for correct CRUD refresh behavior.

## User Setup Required

None — uses existing `/org/receivables` backend endpoints (plan 02-03).

## Next Phase Readiness

- CR frontend complete with full CRUD, settle, renegotiate, aging
- Ready for integration with cash flow dashboard (02-07)
- FUNRURAL displayed for fiscal visibility

---

_Phase: 02-n-cleo-ap-ar_
_Completed: 2026-03-16_
