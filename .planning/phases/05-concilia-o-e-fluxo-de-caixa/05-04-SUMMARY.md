---
phase: 05-concilia-o-e-fluxo-de-caixa
plan: 04
subsystem: ui
tags: [reconciliation, ofx, csv, react, hooks, modal, accessibility, brl, lucide-react]

# Dependency graph
requires:
  - phase: 05-concilia-o-e-fluxo-de-caixa
    plan: 01
    provides: Import endpoints (POST /preview, POST /imports, GET /imports, GET /imports/:id)
  - phase: 05-concilia-o-e-fluxo-de-caixa
    plan: 02
    provides: Matching engine endpoints (lines, confirm, reject, link, ignore, search, report)

provides:
  - ReconciliationPage with import history view and reconciliation session view via URL query param
  - ImportHistoryTable with accessible table, skeleton, empty state, mobile cards
  - ImportPreviewModal multi-step (CSV column mapping + line selection, OFX auto-detect)
  - ReconciliationLineList grouped by EXATO/PROVAVEL/SEM_MATCH with accept/reject/link/ignore actions
  - ManualLinkModal with debounced search, N:N multi-select, floating-point safe sum validation
  - useReconciliation hooks: useImportHistory, useImportLines, useReconciliationActions
  - /reconciliation route in App.tsx

affects: [phase-05-05, phase-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'useSearchParams for deep-link to reconciliation session (?importId=xxx)'
    - 'Optimistic confidence-section grouping: each line assigned to EXATO/PROVAVEL/SEM_MATCH based on topMatch.confidence'
    - 'FormData multipart upload via direct fetch() (not api service) — same pattern as CnabRetornoModal'
    - 'Floating-point safe N:N sum: Math.abs(selectedSum - statementAmount) < 0.01'
    - 'Inline ignore confirmation replaces action buttons (proportional risk, no modal)'

key-files:
  created:
    - apps/frontend/src/hooks/useReconciliation.ts
    - apps/frontend/src/pages/ReconciliationPage.tsx
    - apps/frontend/src/pages/ReconciliationPage.css
    - apps/frontend/src/components/reconciliation/ImportHistoryTable.tsx
    - apps/frontend/src/components/reconciliation/ImportPreviewModal.tsx
    - apps/frontend/src/components/reconciliation/ReconciliationLineList.tsx
    - apps/frontend/src/components/reconciliation/ReconciliationLineList.css
    - apps/frontend/src/components/reconciliation/ManualLinkModal.tsx
    - apps/frontend/src/components/reconciliation/ReconciliationModal.css
  modified:
    - apps/frontend/src/App.tsx

key-decisions:
  - 'ReconciliationPage uses URL query param ?importId=xxx for deep-link — keeps router state; useSearchParams from react-router-dom'
  - 'ImportPreviewModal calls uploadPreview on advance, not on file select — avoids double upload and respects 5000-line limit check'
  - 'useBankAccounts (existing hook) reused inside ImportPreviewModal — no need for a new useBankAccountsForSelect abstraction'
  - 'N:N sum validation: Math.abs(selectedSum - statementAmount) < 0.01 — tolerance avoids floating-point false negatives vs Money.equals()'
  - 'ReconciliationLineList groups all lines by topMatch.confidence including reconciled/ignored — preserves visual grouping after action'

patterns-established:
  - 'Confidence section collapse/expand: useState(false) per section, button with aria-expanded, ChevronDown/Up icon'
  - 'Inline ignore confirm: Set<lineId> for ignoreConfirms state, replaces action buttons in that row'
  - 'Report download: direct fetch() returning blob, URL.createObjectURL + a.click() pattern'

requirements-completed:
  - FN-06

# Metrics
duration: 17min
completed: 2026-03-17
---

# Phase 05 Plan 04: Reconciliation Frontend Summary

**Reconciliation page with multi-step OFX/CSV import modal, confidence-grouped line list (EXATO/PROVAVEL/SEM_MATCH) with accept/reject/link actions, and N:N manual link modal with floating-point safe sum validation**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-17T08:31:39Z
- **Completed:** 2026-03-17T08:48:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Full reconciliation workflow: import history table -> select import -> line-by-line conciliation session
- Multi-step ImportPreviewModal: OFX skips CSV column mapping step, 5000-line limit enforced before submit
- ReconciliationLineList: 3 collapsible confidence sections, optimistic accept/reject/link/ignore, inline ignore confirm
- ManualLinkModal: debounced 300ms search, N:N multi-select, floating-point safe sum validation with role="alert"
- All interactive elements have 48px minimum touch targets, accessible aria-labels, semantic HTML

## Task Commits

1. **Task 1: Hooks + page + import history table** - `54a81ef` (feat)
2. **Task 2: Import preview modal + line list + manual link modal** - `575a510` (feat)

## Files Created/Modified

- `apps/frontend/src/hooks/useReconciliation.ts` — useImportHistory, useImportLines, useReconciliationActions with FormData upload helpers
- `apps/frontend/src/pages/ReconciliationPage.tsx` — Page with breadcrumb, history/session views, URL deep-link via useSearchParams
- `apps/frontend/src/pages/ReconciliationPage.css` — Confidence badges (EXATO/PROVAVEL/SEM_MATCH), status badges, skeleton, mobile cards
- `apps/frontend/src/components/reconciliation/ImportHistoryTable.tsx` — Accessible table with th scope, skeleton rows 56px, FileSearch empty state
- `apps/frontend/src/components/reconciliation/ImportPreviewModal.tsx` — Multi-step modal, CSV mapping dropdowns, line selection table
- `apps/frontend/src/components/reconciliation/ReconciliationLineList.tsx` — Confidence sections, action buttons with aria-labels, report download
- `apps/frontend/src/components/reconciliation/ManualLinkModal.tsx` — Search, multi-select, sum validation role="alert"
- `apps/frontend/src/components/reconciliation/ReconciliationModal.css` — Shared modal + manual link styles
- `apps/frontend/src/components/reconciliation/ReconciliationLineList.css` — Section, row, action button, summary bar styles
- `apps/frontend/src/App.tsx` — /reconciliation route added

## Decisions Made

- URL deep-link via `?importId=xxx` query param — useSearchParams from react-router-dom keeps browser history consistent
- `uploadPreview` called on "Avançar" click (not on file select) — avoids double upload, respects 5000-line limit gate
- Reused existing `useBankAccounts` hook in ImportPreviewModal for bank account selection fallback on OFX
- Floating-point tolerance `Math.abs(diff) < 0.01` for N:N sum — avoids false negatives from JS float arithmetic
- Confidence grouping includes reconciled/ignored lines — visual grouping preserved after actions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused formatBRL in ImportHistoryTable**

- **Found during:** Task 1 (commit attempt — ESLint pre-commit hook)
- **Issue:** `formatBRL` was defined but never used — ESLint `@typescript-eslint/no-unused-vars` error
- **Fix:** Removed unused function
- **Files modified:** `apps/frontend/src/components/reconciliation/ImportHistoryTable.tsx`
- **Committed in:** `54a81ef`

**2. [Rule 1 - Bug] Removed unused manualLink in ReconciliationLineList**

- **Found during:** Task 2 (commit attempt — ESLint pre-commit hook)
- **Issue:** `manualLink` destructured from hook but never called — ManualLinkModal calls it internally
- **Fix:** Removed from useReconciliationActions destructure in ReconciliationLineList
- **Files modified:** `apps/frontend/src/components/reconciliation/ReconciliationLineList.tsx`
- **Committed in:** `575a510`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — unused variable lint errors caught by pre-commit hook)
**Impact on plan:** No scope change; both fixes were trivial cleanup.

## Issues Encountered

- ESLint pre-commit hook caught two unused variable errors across two separate commit attempts. Fixed inline before re-commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ReconciliationPage complete; all import/reconciliation endpoints (from plans 05-01/05-02) now have UI coverage
- Phase 05 frontend complete: CashflowPage (05-05), BankAccountsPage (existing), ReconciliationPage (this plan)
- Phase 06 can begin

---

_Phase: 05-concilia-o-e-fluxo-de-caixa_
_Completed: 2026-03-17_

## Self-Check: PASSED

- FOUND: apps/frontend/src/hooks/useReconciliation.ts
- FOUND: apps/frontend/src/pages/ReconciliationPage.tsx
- FOUND: apps/frontend/src/pages/ReconciliationPage.css
- FOUND: apps/frontend/src/components/reconciliation/ImportHistoryTable.tsx
- FOUND: apps/frontend/src/components/reconciliation/ImportPreviewModal.tsx
- FOUND: apps/frontend/src/components/reconciliation/ReconciliationLineList.tsx
- FOUND: apps/frontend/src/components/reconciliation/ManualLinkModal.tsx
- FOUND: apps/frontend/src/components/reconciliation/ReconciliationModal.css
- FOUND: apps/frontend/src/components/reconciliation/ReconciliationLineList.css
- FOUND: Commit 54a81ef
- FOUND: Commit 575a510
