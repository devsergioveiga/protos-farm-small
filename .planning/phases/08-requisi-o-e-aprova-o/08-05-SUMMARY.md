---
phase: 08-requisi-o-e-aprova-o
plan: 05
subsystem: ui
tags: [react, typescript, approval-workflow, notifications, css-custom-properties]

# Dependency graph
requires:
  - phase: 08-02
    provides: approval rules backend endpoints at /api/org/approval-rules
  - phase: 08-03
    provides: RC transition endpoint POST /api/org/purchase-requests/:id/transition
  - phase: 08-04
    provides: PurchaseRequest types, usePurchaseRequestForm hook, PurchaseRequestsPage

provides:
  - PurchaseRequestDetailModal with approval timeline, items, attachments, action bar
  - ApprovalRulesPage with card layout, drag-to-reorder, delegation banner
  - ApprovalRuleModal create/edit (640px, double-approval toggle, value ranges)
  - DelegationModal (540px, active/past delegation list, date validation)
  - NotificationBell in AppLayout header with unread badge and 30s polling dropdown
  - useApprovalRules hook for CRUD + reorder + delegations
  - useNotifications hook with 30s polling and mark-read

affects: [09-cotacao, 10-recebimento, frontend-approval-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Timeline built as semantic <ol>/<li> with colored dots inline via className
    - Notification dropdown uses position:absolute + click-outside + Escape key
    - useInterval via useRef+setInterval for 30s background polling
    - Drag-and-drop via HTML5 native drag events (no library)
    - Collapsible fields via max-height CSS transition (same pattern as PurchaseRequestModal)

key-files:
  created:
    - apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.tsx
    - apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.css
    - apps/frontend/src/components/purchase-requests/PurchaseRequestModal.css
    - apps/frontend/src/pages/ApprovalRulesPage.tsx
    - apps/frontend/src/pages/ApprovalRulesPage.css
    - apps/frontend/src/components/approval-rules/ApprovalRuleModal.tsx
    - apps/frontend/src/components/approval-rules/ApprovalRuleModal.css
    - apps/frontend/src/components/approval-rules/DelegationModal.tsx
    - apps/frontend/src/components/approval-rules/DelegationModal.css
    - apps/frontend/src/components/notifications/NotificationBell.tsx
    - apps/frontend/src/components/notifications/NotificationBell.css
    - apps/frontend/src/hooks/useApprovalRules.ts
    - apps/frontend/src/hooks/useNotifications.ts
  modified:
    - apps/frontend/src/components/layout/AppLayout.tsx

key-decisions:
  - 'NotificationBell uses click-outside mousedown handler + Escape key — no library needed for simple dropdown'
  - 'ApprovalRulesPage uses HTML5 native drag events for reorder — avoids adding dnd library for single use case'
  - 'useApprovalRules.fetchAll uses refreshCounter in useCallback deps — triggers re-fetch without useEffect dependency array juggling'
  - 'DelegationModal deactivate uses separate ConfirmModal state — consistent with plan pattern, no inline confirm'

patterns-established:
  - 'Notification dropdown: position:relative wrapper + position:absolute panel + z-index:1050'
  - 'Background poll: useRef<ReturnType<typeof setInterval>> + clearInterval in cleanup'
  - 'Rule cards: <ol> semantic list with priority badge, drag handle, approver chain chips'

requirements-completed: [REQC-01, REQC-03]

# Metrics
duration: 45min
completed: 2026-03-17
---

# Phase 08 Plan 05: RC Approval UI, Rules Config, and Notification Bell Summary

**RC detail modal with approval timeline and action bar, approval rules card config page with delegation management, and NotificationBell in header with 30s polling badge**

## Performance

- **Duration:** 45 min
- **Started:** 2026-03-17T21:00:00Z
- **Completed:** 2026-03-17T21:45:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- PurchaseRequestDetailModal fetches RC on open, shows read-only items table and approval timeline as `<ol>` with colored dots per action type (created/submitted/approved/rejected/returned/cancelled)
- Approval action bar (Aprovar/Devolver/Rejeitar) with inline comment textarea; reject requires ConfirmModal variant="danger"; return requires comment; approve comment optional
- ApprovalRulesPage with priority-ordered rule cards (drag-to-reorder via HTML5), active/inactive toggle, edit/delete per card, delegation banner when user has active delegation
- ApprovalRuleModal (640px) with double-approval collapsible, value range with "sem limite" checkbox, priority 1-99 and overlap warning
- DelegationModal (540px) with date validation (start >= today, end > start), active/past delegation list with deactivate ConfirmModal
- NotificationBell in AppLayout header: unread red badge, 30s polling via setInterval, dropdown with type-specific icons (CheckCircle/XCircle/RotateCcw/Clock/ShoppingCart), "Tudo em dia!" empty state, mark-all-read
- Vite build succeeds (exit 0)

## Task Commits

1. **Task 1: PurchaseRequestDetailModal + ApprovalRulesPage + hooks** — committed in `095c621` (by prior session, included in docs(08-04))
2. **Task 2: NotificationBell + AppLayout** — `12ec1c6` (feat)

## Files Created/Modified

- `apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.tsx` - RC detail with timeline + approval actions
- `apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.css` - `.prdm-*` classes, timeline track
- `apps/frontend/src/components/purchase-requests/PurchaseRequestModal.css` - `.prcm-*` classes for create/edit modal
- `apps/frontend/src/pages/ApprovalRulesPage.tsx` - Card layout, drag-to-reorder, delegation banner
- `apps/frontend/src/pages/ApprovalRulesPage.css` - `.arp-*` classes, rule card layout
- `apps/frontend/src/components/approval-rules/ApprovalRuleModal.tsx` - Create/edit rule, double-approval toggle
- `apps/frontend/src/components/approval-rules/ApprovalRuleModal.css` - `.arm-*` classes, 640px max-width
- `apps/frontend/src/components/approval-rules/DelegationModal.tsx` - Delegation CRUD, active/past list
- `apps/frontend/src/components/approval-rules/DelegationModal.css` - `.dlgm-*` classes, 540px max-width
- `apps/frontend/src/components/notifications/NotificationBell.tsx` - Bell, badge, dropdown, 30s polling
- `apps/frontend/src/components/notifications/NotificationBell.css` - badge-pulse animation, dropdown-enter
- `apps/frontend/src/hooks/useApprovalRules.ts` - CRUD + reorder + delegation management
- `apps/frontend/src/hooks/useNotifications.ts` - 30s interval polling, mark read/all-read
- `apps/frontend/src/components/layout/AppLayout.tsx` - NotificationBell added before separator

## Decisions Made

- NotificationBell uses click-outside mousedown handler + Escape key — no library needed for simple dropdown
- HTML5 native drag events for rule reorder — avoids adding dnd library for a single use case
- useApprovalRules.fetchAll uses refreshCounter in useCallback deps — triggers re-fetch on mutation without violating exhaustive-deps
- DelegationModal deactivate uses separate ConfirmModal state — consistent with plan pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed Escape handler to call onClose instead of handleClose**

- **Found during:** Task 1 (ApprovalRuleModal)
- **Issue:** handleClose showed unsaved-changes confirm on Escape — wrong UX; plan says Escape closes. ESLint also flagged the eslint-disable comment for a rule not in config
- **Fix:** Changed Escape handler to call `onClose()` directly; removed eslint-disable comment
- **Files modified:** ApprovalRuleModal.tsx
- **Committed in:** 095c621

**2. [Rule 1 - Bug] Fixed ApprovalRulesPage user.id -> user.userId**

- **Found during:** Task 1 TypeScript compile
- **Issue:** AuthContext User interface uses `userId` not `id` — TS2339 error
- **Fix:** Changed `user?.id` to `user?.userId` in delegation banner check
- **Files modified:** ApprovalRulesPage.tsx
- **Committed in:** 095c621

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both necessary for correctness. No scope creep.

## Issues Encountered

- Task 1 files (ApprovalRulesPage, ApprovalRuleModal, DelegationModal, useApprovalRules) were committed by the previous session continuation as part of `docs(08-04)` metadata commit — no re-commit needed; Task 2 committed cleanly in 12ec1c6

## Next Phase Readiness

- Full Phase 08 approval workflow UI complete: RC creation (Plan 04), detail/approval (Plan 05), rules config (Plan 05), notifications (Plan 05)
- Phase 09 (Cotacao) can use PurchaseRequest types and approval patterns established in Phase 08
- No blockers

---

_Phase: 08-requisi-o-e-aprova-o_
_Completed: 2026-03-17_
