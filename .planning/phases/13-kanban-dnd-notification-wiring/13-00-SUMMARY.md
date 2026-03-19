---
phase: 13-kanban-dnd-notification-wiring
plan: 00
subsystem: testing
tags: [vitest, react-testing-library, kanban, dnd-kit, tdd, red-phase]

# Dependency graph
requires:
  - phase: 12-kanban-dashboard-e-notifica-es
    provides: usePurchasingKanban hook and KanbanBoard component under test
provides:
  - Failing test suite for usePurchasingKanban moveCard DnD behaviors (4 tests, 3 failing)
  - Failing test suite for KanbanBoard EM_COTACAO->OC_EMITIDA copy and navigation (3 tests, all failing)
affects: [13-01-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Mutable ref pattern for DnD handler capture: const dndHandlerRef = {} assigned on each render to avoid stale closure in useCallback deps'
    - 'simulateDrag two-step pattern: await act(dragStart) then await act(dragEnd) to allow React re-render between steps, ensuring useCallback closure sees updated state'

key-files:
  created:
    - apps/frontend/src/hooks/usePurchasingKanban.spec.ts
    - apps/frontend/src/components/kanban/KanbanBoard.spec.tsx
  modified: []

key-decisions:
  - 'mutable dndHandlerRef object (not window.__handler) used to capture fresh DnD handlers after each React re-render — solves stale closure issue with useCallback deps [activeCard, activeColumnId]'
  - 'Two separate act() calls for dragStart + dragEnd (not combined) — required so React processes setActiveCard state update between steps'
  - "Test 2 (EM_COTACAO->OC_EMITIDA no patch/put) intentionally passes — current code calls api.post not patch/put, so mockPatch/mockPut not-called assertions are correct; after Plan 13-01 api.post also won't be called so all 4 tests will pass"

patterns-established:
  - 'TDD RED scaffold: write spec files with behavior-contract tests before implementing fixes; tests target the EXPECTED corrected behavior, not current broken behavior'

requirements-completed: [DASH-01]

# Metrics
duration: 15min
completed: 2026-03-19
---

# Phase 13 Plan 00: Wave 0 Test Scaffolds Summary

**TDD RED phase: two failing spec files covering usePurchasingKanban DnD transition behaviors and KanbanBoard EM_COTACAO->OC_EMITIDA copy+navigation, unblocking Plan 13-01 fixes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-19T09:23:24Z
- **Completed:** 2026-03-19T09:38:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `usePurchasingKanban.spec.ts` created with 4 tests: 3 fail against current code (correct RED state)
- `KanbanBoard.spec.tsx` created with 3 tests: all 3 fail against current code (correct RED state)
- Solved DnD mock stale-closure problem using mutable ref + two-step act() simulation

## Task Commits

1. **Task 1: Create usePurchasingKanban.spec.ts** - `d1ea512f` (test)
2. **Task 2: Create KanbanBoard.spec.tsx** - `e1fd951a` (test)

## Files Created/Modified

- `apps/frontend/src/hooks/usePurchasingKanban.spec.ts` - 4 tests for moveCard DnD behaviors; tests EM_COTACAO->OC_EMITIDA (no api.post) and OC_EMITIDA->AGUARDANDO_ENTREGA (api.patch /transition not api.put /status)
- `apps/frontend/src/components/kanban/KanbanBoard.spec.tsx` - 3 tests for confirmation copy and navigation; verifies EM_COTACAO->OC_EMITIDA shows "Aprovar cotacao vencedora?" title, navigates to /quotations, and does not show "Emitir pedido?"

## Decisions Made

- **Mutable ref for DnD handlers**: `const dndHandlerRef: DnDHandlers = {}` is mutated on each DndContext render (via vi.mock factory function). This solves the stale closure problem where `handleDragEnd` captures `activeCard = null` at creation time. After `await act(dragStart)`, React re-renders and DndContext re-assigns fresh handlers, so the subsequent `await act(dragEnd)` gets the handler with correct `activeCard`.
- **Two separate act() calls**: Splitting dragStart and dragEnd into separate `await act(async () => {...})` calls is required. React must process `setActiveCard()` state update between the two events. A combined single `act()` would call `handleDragEnd` before the state update is flushed.
- **Test 2 passes intentionally**: The test "EM_COTACAO->OC_EMITIDA does not call any API (no patch, no put)" passes even before Plan 13-01 because current code calls `api.post` (not patch/put) for that transition. After Plan 13-01 removes the `api.post` call too, all 4 tests will pass.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **DnD simulation stale closure**: Initial attempt using `window.__testOnDragEnd` failed because the stored reference was the handler from the first render (with `activeCard = null`). After `handleDragStart` called `setActiveCard`, React re-rendered and created a new `handleDragEnd` closure — but we had the old reference. Fixed by using a mutable object `dndHandlerRef` assigned during each render, so `simulateDrag` always reads the latest reference.

## Next Phase Readiness

- Plan 13-01 can now run `pnpm test -- usePurchasingKanban KanbanBoard` to verify fixes are correct
- 6 tests failing, all failing for the right reasons (testing behaviors Plan 13-01 must fix)
- No production code changed — usePurchasingKanban.ts and KanbanBoard.tsx are untouched

---

_Phase: 13-kanban-dnd-notification-wiring_
_Completed: 2026-03-19_
