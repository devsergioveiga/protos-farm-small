---
phase: 08-requisi-o-e-aprova-o
plan: '04'
subsystem: frontend-purchase-requests
tags: [frontend, react, purchase-requests, modal, routing]
dependency_graph:
  requires: [08-02, 08-03]
  provides:
    [PurchaseRequestsPage, PurchaseRequestModal, usePurchaseRequests, usePurchaseRequestForm]
  affects: [Sidebar, App.tsx]
tech_stack:
  added: []
  patterns:
    - key-remount pattern for modal form initialization (avoids setState-in-effect)
    - useLayoutEffect + ref for stable keyboard handler without stale closures
    - AbortController in paginated list hook for cancellation
key_files:
  created:
    - apps/frontend/src/types/purchase-request.ts
    - apps/frontend/src/hooks/usePurchaseRequests.ts
    - apps/frontend/src/hooks/usePurchaseRequestForm.ts
    - apps/frontend/src/pages/PurchaseRequestsPage.tsx
    - apps/frontend/src/pages/PurchaseRequestsPage.css
    - apps/frontend/src/pages/ApprovalRulesPage.tsx
    - apps/frontend/src/components/purchase-requests/PurchaseRequestModal.tsx
    - apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.tsx
    - apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - 'Key-remount pattern used for PurchaseRequestModal form initialization instead of useEffect setState'
  - 'PurchaseRequestDetailModal left as stub — full detail view deferred to plan 08-05'
  - 'ApprovalRulesPage stub only — full approval rules implementation deferred to plan 08-06'
metrics:
  duration_minutes: 90
  completed_date: '2026-03-17'
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 2
---

# Phase 08 Plan 04: Purchase Requests Frontend Summary

Frontend listing page and create/edit modal for purchase requests using React + TypeScript with CSS custom properties.

## What Was Built

### Task 1: Types, Hooks, Routing, Sidebar (commit a23401e)

- `purchase-request.ts` types: `PurchaseRequestStatus`, `PurchaseRequestUrgency` unions, `RC_STATUS_LABELS`, `RC_URGENCY_LABELS` record maps, all required interfaces
- `usePurchaseRequests` hook: paginated list with `status`/`search` filters, `AbortController` for request cancellation, `refresh()` counter pattern
- `usePurchaseRequestForm` hook: `create`, `update`, `remove`, `submit`, `transition`, `uploadAttachment` mutations
- `Sidebar.tsx`: added COMPRAS group with ShoppingCart (Requisicoes) and Settings2 (Alcadas) items
- `App.tsx`: lazy routes for `/purchase-requests` and `/approval-rules`
- `ApprovalRulesPage.tsx`: stub with breadcrumb and empty state

### Task 2: Page, Modal, CSS (commit 8b26b88)

- `PurchaseRequestsPage.tsx`: full listing with status badges (6 variants), urgency chips (3 variants), EMERGENCIAL pulse dot, SLA indicator, skeleton loading, mobile card layout, desktop table, status/urgency filter chips, search, pagination
- `PurchaseRequestsPage.css`: `rcp-*` prefix, responsive table-to-card at 768px, `@keyframes pulse-dot`, `prefers-reduced-motion` guard
- `PurchaseRequestModal.tsx`: 2-section modal (Dados Gerais + Itens), urgency radio group with collapsible EMERGENCIAL justification, editable items table with add/remove, save-as-draft + submit-for-approval footer, ConfirmModal on discard
- `PurchaseRequestDetailModal.tsx`: stub (full detail view in plan 08-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint: react-hooks/set-state-in-effect in PurchaseRequestModal**

- **Found during:** Task 2 commit
- **Issue:** Form initialization useEffect called multiple setState functions synchronously, triggering cascading renders per the ESLint rule
- **Fix:** Refactored using key-remount pattern: extracted form body into `PurchaseRequestForm` inner component; outer `PurchaseRequestModal` renders it with `key={formKey}` that changes when `rc.id` or `rc.updatedAt` changes, causing clean remount with initial values derived directly from props
- **Files modified:** `PurchaseRequestModal.tsx`
- **Commit:** 8b26b88

**2. [Rule 1 - Bug] ESLint: refs-in-render for keyboard handler**

- **Found during:** Task 2 ESLint fix iteration
- **Issue:** Direct `handleCloseRef.current = handleClose` assignment during render blocked by `react-hooks/refs` rule
- **Fix:** Wrapped assignment in `useLayoutEffect(() => { handleCloseRef.current = handleClose; })` — runs after render synchronously, keeping ref current without triggering render loops
- **Files modified:** `PurchaseRequestModal.tsx`
- **Commit:** 8b26b88

**3. [Rule 1 - Bug] ESLint: variable-before-declaration in PurchaseRequestModal**

- **Found during:** Task 2 ESLint fix iteration
- **Issue:** `handleClose` called `doClose()` but `doClose` was declared after it
- **Fix:** Reordered declarations: `doClose` first, then `handleClose`
- **Files modified:** `PurchaseRequestModal.tsx`
- **Commit:** 8b26b88

**4. [Rule 1 - Bug] CSS prefix mismatch**

- **Found during:** Task 2 — existing PurchaseRequestsPage.tsx used `rcp-*` prefix
- **Issue:** Written CSS used `rc-page__*` and `rc-table*` but TSX used `rcp-page__*` and `rcp-table*`
- **Fix:** Bulk-replaced prefixes in CSS file
- **Files modified:** `PurchaseRequestsPage.css`
- **Commit:** 8b26b88

## Self-Check: PASSED

Files verified present:

- apps/frontend/src/types/purchase-request.ts — FOUND
- apps/frontend/src/hooks/usePurchaseRequests.ts — FOUND
- apps/frontend/src/hooks/usePurchaseRequestForm.ts — FOUND
- apps/frontend/src/pages/PurchaseRequestsPage.tsx — FOUND
- apps/frontend/src/pages/PurchaseRequestsPage.css — FOUND
- apps/frontend/src/components/purchase-requests/PurchaseRequestModal.tsx — FOUND
- apps/frontend/src/components/purchase-requests/PurchaseRequestDetailModal.tsx — FOUND

Commits verified:

- a23401e feat(08-04): add purchase request types, hooks, routing, and sidebar
- 8b26b88 feat(08-04): purchase requests page, modal, and approval rules stub

Build: `vite build` passed with 0 errors.
