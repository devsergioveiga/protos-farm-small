---
phase: 12-kanban-dashboard-e-notifica-es
plan: '03'
subsystem: frontend/kanban
tags: [kanban, dnd-kit, purchasing, frontend, react]
dependency_graph:
  requires: [12-01]
  provides: [purchasing-kanban-ui, dnd-purchasing-flow]
  affects: [App.tsx, Sidebar.tsx]
tech_stack:
  added:
    - '@dnd-kit/core ^6'
    - '@dnd-kit/sortable ^8'
    - '@dnd-kit/utilities ^3'
    - '@dnd-kit/modifiers ^7'
  patterns:
    - 'useSortable + useDroppable for drag-and-drop columns'
    - 'Optimistic update with snapshot rollback in usePurchasingKanban'
    - 'ConfirmModal with transition-specific copy per DnD drop'
key_files:
  created:
    - apps/frontend/src/hooks/usePurchasingKanban.ts
    - apps/frontend/src/components/kanban/KanbanCard.tsx
    - apps/frontend/src/components/kanban/KanbanCard.css
    - apps/frontend/src/components/kanban/KanbanColumn.tsx
    - apps/frontend/src/components/kanban/KanbanColumn.css
    - apps/frontend/src/components/kanban/KanbanFilters.tsx
    - apps/frontend/src/components/kanban/KanbanFilters.css
    - apps/frontend/src/components/kanban/KanbanBoard.tsx
    - apps/frontend/src/pages/PurchasingKanbanPage.tsx
    - apps/frontend/src/pages/PurchasingKanbanPage.css
  modified:
    - apps/frontend/package.json
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - 'KanbanFilters type renamed to KanbanFiltersState in page to avoid collision with KanbanFilters component import'
  - 'overColumnId state removed from KanbanBoard — valid/invalid targets computed from activeColumnId + KANBAN_VALID_DROPS map, no need to track over column separately'
  - 'AGUARDANDO_ENTREGA->RECEBIDO transition uses navigate() instead of API call — redirects to /goods-receipts?poId=...'
  - 'Columns3 icon from lucide-react used for kanban sidebar entry'
metrics:
  duration: '10min'
  completed: '2026-03-18'
  tasks_completed: 2
  files_created: 10
  files_modified: 3
---

# Phase 12 Plan 03: Frontend Kanban Board with dnd-kit Summary

**One-liner:** Interactive purchasing kanban with @dnd-kit drag-and-drop, optimistic updates, and 5 transition-specific ConfirmModal variants at /purchasing-kanban.

## What Was Built

A complete 7-column kanban board frontend for the purchasing flow, including:

- `usePurchasingKanban` hook with optimistic moveCard (snapshot/rollback) and full filter support
- `KanbanCard` component using `useSortable`, article element with aria-label, urgency badges (NORMAL/URGENTE/EMERGENCIAL), overdue red border + AlertCircle icon
- `KanbanColumn` component using `useDroppable` + `SortableContext`, visual valid/invalid target states during drag
- `KanbanFilters` with farm selector, urgency select, search input — all with visible labels and 48px touch targets
- `KanbanBoard` with `DndContext`, `DragOverlay`, 5 transition-specific `ConfirmModal` copy variants, and `restrictToHorizontalAxis` modifier
- `PurchasingKanbanPage` with skeleton loading (7 columns), error with retry, empty state, and dismissible filter-preset banner from dashboard drill-down (`?filter=overdue_po|pending_approval`)
- Route `/purchasing-kanban` added to App.tsx; "Kanban" entry added to COMPRAS sidebar group

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Naming collision — KanbanFilters type vs component**

- **Found during:** Task 2
- **Issue:** `PurchasingKanbanPage.tsx` imported both the `KanbanFilters` type and the `KanbanFilters` component, causing TS2300 duplicate identifier error
- **Fix:** Renamed type import alias to `KanbanFiltersState` in page file
- **Files modified:** apps/frontend/src/pages/PurchasingKanbanPage.tsx

**2. [Rule 1 - Bug] Unused overColumnId state — ESLint no-unused-vars**

- **Found during:** Task 2 commit
- **Issue:** `overColumnId` state was set in handlers but never read (valid/invalid targets computed from `activeColumnId` directly)
- **Fix:** Removed `overColumnId` state and `DragOverEvent` import; simplified `handleDragOver` callback
- **Files modified:** apps/frontend/src/components/kanban/KanbanBoard.tsx

## Deferred Items

Pre-existing TypeScript errors in spec files (unrelated to this plan):

- `apps/frontend/src/components/farm-selector/FarmSelector.spec.tsx` — `registrations` field mismatch
- `apps/frontend/src/pages/FarmsPage.spec.tsx` — same
- `apps/frontend/src/stores/FarmContext.spec.tsx` — same
  Logged to `.planning/phases/12-kanban-dashboard-e-notifica-es/deferred-items.md`.

## Self-Check: PASSED

All 10 created files found on disk. Both task commits (6ff57c1, 4c36771) verified in git log.
