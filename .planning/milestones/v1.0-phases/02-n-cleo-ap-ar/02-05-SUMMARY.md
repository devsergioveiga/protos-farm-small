---
phase: 02-n-cleo-ap-ar
plan: 05
subsystem: ui
tags: [react, typescript, frontend, payables, contas-a-pagar, aging, calendar, cnab]

# Dependency graph
requires:
  - phase: 02-n-cleo-ap-ar
    provides: CP backend endpoints (payables CRUD, settle, batch-settle, CNAB retorno, aging, calendar, overdue-count)
  - phase: 01-funda-o-financeira
    provides: BankAccountsPage patterns (hooks, CSS, modal structure) used as reference

provides:
  - PayablesPage with 3-tab UI (Títulos/Aging/Calendário)
  - usePayables, usePayablesAging, usePayableCalendar, useOverdueCount hooks
  - PayableModal (create/edit with installments and cost center rateio)
  - PaymentModal (settlement with juros/multa/desconto, effective amount)
  - BatchPaymentModal (bordero with per-item adjustments)
  - CnabRetornoModal (3-step upload/preview/confirm)
  - Sidebar integration with overdue badge at /payables route

affects:
  - 02-06 (receivables page, same pattern)
  - future phases consuming payables UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - usePayables hook family (useState+useEffect+useCallback, no React Query)
    - 3-tab page layout with tab state inside single route (max 3 nav levels)
    - Custom CSS calendar grid (7-col CSS grid, no external calendar library)
    - Row actions dropdown with outside-click close via useRef+addEventListener
    - CnabRetornoModal multi-step upload/preview/confirm pattern
    - Overdue badge in sidebar via lightweight polling hook

key-files:
  created:
    - apps/frontend/src/hooks/usePayables.ts
    - apps/frontend/src/pages/PayablesPage.tsx
    - apps/frontend/src/pages/PayablesPage.css
    - apps/frontend/src/components/payables/PayableModal.tsx
    - apps/frontend/src/components/payables/PayableModal.css
    - apps/frontend/src/components/payables/PaymentModal.tsx
    - apps/frontend/src/components/payables/BatchPaymentModal.tsx
    - apps/frontend/src/components/payables/CnabRetornoModal.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx

key-decisions:
  - 'useOverdueCount hook polled at sidebar mount — lightweight, no global state store needed'
  - 'CnabRetornoModal uses direct fetch() with FormData for multipart upload (api service only handles JSON)'
  - 'Aging bucket click redirects to Títulos tab with pre-set status filter rather than separate route'
  - 'Calendar custom-built with CSS grid 7 columns — no external library to keep bundle lean'
  - 'Installment sum mismatch shows warning but does not block form submission (user may intentionally round)'

patterns-established:
  - 'Payable modals all share PayableModal.css (single CSS file for 4 modal variants)'
  - 'Effective amount display in PaymentModal: paidAmount + juros + multa - desconto, live update'
  - 'Tab layout within single route: activeTab state + conditional section rendering'

requirements-completed:
  - FN-07
  - FN-08
  - FN-10

# Metrics
duration: 35min
completed: 2026-03-16
---

# Phase 02 Plan 05: Payables Frontend Summary

**PayablesPage with 3-tab CP management UI (list+filters+table, aging 7-faixas, custom calendar), 4 modals (create/edit with installments+rateio, settlement, bordero, CNAB retorno 3-step), and sidebar overdue badge**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-16T14:40:00Z
- **Completed:** 2026-03-16T15:15:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- PayablesPage with tabs: Títulos (filter toolbar, selectable table, pagination, bulk actions), Aging (7-faixa clickable table with overdue highlight), Calendário (custom month grid with dots and popovers)
- 4 modal components: PayableModal (installment editing + cost center rateio %), PaymentModal (juros/multa/desconto + effective amount), BatchPaymentModal (bordero), CnabRetornoModal (drag-drop upload → preview → confirm)
- Sidebar Contas a pagar entry with red badge showing overdue count via useOverdueCount hook
- tsc clean, ESLint clean, all CLAUDE.md design rules followed (fonts, spacing, WCAG AA, mobile cards)

## Task Commits

Each task was committed atomically:

1. **Task 1: PayablesPage with list, aging, calendar, and hooks** - `b274dcf` (feat)
2. **Task 2: PayableModal, PaymentModal, BatchPaymentModal, CnabRetornoModal** - `1903222` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/frontend/src/hooks/usePayables.ts` — 4 hooks: usePayables, usePayablesAging, usePayableCalendar, useOverdueCount
- `apps/frontend/src/pages/PayablesPage.tsx` — Main page with 3 tabs, row-action dropdown, delete confirm
- `apps/frontend/src/pages/PayablesPage.css` — Full CSS: table, aging, calendar, popover, skeleton, mobile cards
- `apps/frontend/src/components/payables/PayableModal.tsx` — Create/edit modal with parcelamento and rateio
- `apps/frontend/src/components/payables/PayableModal.css` — Shared CSS for all 4 payable modals
- `apps/frontend/src/components/payables/PaymentModal.tsx` — Settlement modal with effective amount
- `apps/frontend/src/components/payables/BatchPaymentModal.tsx` — Bordero for bulk settlement
- `apps/frontend/src/components/payables/CnabRetornoModal.tsx` — 3-step CNAB retorno import
- `apps/frontend/src/App.tsx` — Added /payables route with lazy import
- `apps/frontend/src/components/layout/Sidebar.tsx` — Added Contas a pagar nav item + overdue badge

## Decisions Made

- useOverdueCount hook polled at sidebar mount — lightweight, no global state store needed
- CnabRetornoModal uses direct fetch() with FormData for multipart upload (api service only handles JSON)
- Aging bucket click switches to Títulos tab with pre-set status filter (no separate route — stays within 3-level nav depth)
- Calendar custom-built with CSS grid 7 columns — no external library to keep bundle lean
- Installment sum mismatch shows inline warning but does not block form submission (user may intentionally round)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ReceiptText import in Sidebar**

- **Found during:** Task 2 commit (pre-commit ESLint)
- **Issue:** ReceiptText was imported but removed, then pre-commit linter re-added it because /receivables route already existed in Sidebar (from plan 02-06 previous work)
- **Fix:** Kept ReceiptText import since it is used by the /receivables nav item that already existed
- **Files modified:** apps/frontend/src/components/layout/Sidebar.tsx
- **Committed in:** 1903222 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (linter/import cleanup)
**Impact on plan:** No scope change. Plan executed as specified.

## Issues Encountered

None — tsc passed clean on both tasks after fixing the ReceiptText import.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PayablesPage complete with all CPs: FN-07, FN-08, FN-10 delivered
- Same pattern ready for ReceivablesPage (plan 02-06)
- Sidebar overdue badge for AR will use same useOverdueCount-style hook

---

_Phase: 02-n-cleo-ap-ar_
_Completed: 2026-03-16_
