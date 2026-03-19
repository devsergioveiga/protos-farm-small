---
phase: 13-kanban-dnd-notification-wiring
plan: 01
subsystem: ui
tags: [react, kanban, dnd-kit, vitest, purchasing-flow]

# Dependency graph
requires:
  - phase: 13-kanban-dnd-notification-wiring
    plan: 00
    provides: Wave 0 failing test specs for usePurchasingKanban and KanbanBoard
  - phase: 12-kanban-dashboard-e-notifica-es
    provides: usePurchasingKanban hook and KanbanBoard component being fixed
provides:
  - Fixed usePurchasingKanban.ts: EM_COTACAO->OC_EMITIDA returns null (navigation), OC_EMITIDA->AGUARDANDO_ENTREGA uses api.patch /transition
  - Fixed KanbanBoard.tsx: updated confirmation copy and navigation case for EM_COTACAO->OC_EMITIDA
affects: [13-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Kanban navigation-return pattern: moveCard returns null for navigation transitions; board component handles navigate() call instead of API call'
    - 'PATCH /transition endpoint for PO state machine: uses { status: EM_TRANSITO } payload matching TransitionPOInput interface'

key-files:
  created: []
  modified:
    - apps/frontend/src/hooks/usePurchasingKanban.ts
    - apps/frontend/src/components/kanban/KanbanBoard.tsx

key-decisions:
  - 'EM_COTACAO->OC_EMITIDA returns null from moveCard (mirrors AGUARDANDO_ENTREGA->RECEBIDO pattern) — board handles navigation to /quotations?purchaseRequestId= instead of API call'
  - 'OC_EMITIDA->AGUARDANDO_ENTREGA uses api.patch /transition with { status: EM_TRANSITO } — matches actual TransitionPOInput backend interface (not action: CONFIRM_SHIPMENT)'
  - 'purchaseRequestId query param used for /quotations navigation — card.id in EM_COTACAO column is the RC id, not a quotation id'

patterns-established:
  - 'Navigation-return pattern: moveCard returns null early for transitions that require page navigation; KanbanBoard.handleConfirm checks from/to and calls navigate()'

requirements-completed: [DASH-01]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 13 Plan 01: Kanban DnD Fixes Summary

**Fixed two broken Kanban DnD transitions: EM_COTACAO->OC_EMITIDA now navigates to /quotations instead of creating emergency PO; OC_EMITIDA->AGUARDANDO_ENTREGA now calls PATCH /transition with { status: EM_TRANSITO } instead of PUT /status — all 7 Wave 0 tests GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-19T09:43:09Z
- **Completed:** 2026-03-19T09:46:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `usePurchasingKanban.ts` moveCard: removed emergency PO creation (api.post /purchase-orders) for EM_COTACAO, added null-return pattern; fixed OC_EMITIDA transition from api.put /status to api.patch /transition with correct payload
- `KanbanBoard.tsx`: updated EM_COTACAO->OC_EMITIDA confirmation copy to "Aprovar cotacao vencedora?" / "Ir para Cotacoes"; added navigation case in handleConfirm routing to /quotations?purchaseRequestId=
- All 7 Wave 0 tests (4 hook + 3 component) pass GREEN; TypeScript compiles cleanly

## Task Commits

1. **Task 1: Fix usePurchasingKanban moveCard DnD transitions** - `07bc9dab` (fix)
2. **Task 2: Fix KanbanBoard EM_COTACAO->OC_EMITIDA copy and navigation** - `b0e65bf6` (fix)

## Files Created/Modified

- `apps/frontend/src/hooks/usePurchasingKanban.ts` - EM_COTACAO branch returns null; OC_EMITIDA branch uses api.patch /transition with { status: 'EM_TRANSITO' }
- `apps/frontend/src/components/kanban/KanbanBoard.tsx` - Updated getTransitionCopy for EM_COTACAO->OC_EMITIDA; added navigation case in handleConfirm

## Decisions Made

- Used `purchaseRequestId` as the query param for /quotations navigation (card.id in EM_COTACAO column is the RC id, not a quotation id — see RESEARCH.md Pitfall 2)
- Used `{ status: 'EM_TRANSITO' }` payload for PATCH /transition (not `{ action: 'CONFIRM_SHIPMENT' }` — backend TransitionPOInput reads `input.status`, see RESEARCH.md Pitfall 1)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 13-02 can proceed — all Wave 0 tests green, production code correct
- TypeScript compiles cleanly, no type errors introduced

---

_Phase: 13-kanban-dnd-notification-wiring_
_Completed: 2026-03-19_
