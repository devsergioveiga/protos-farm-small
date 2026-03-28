---
phase: 18-manutencao-ordens-servico
plan: '04'
subsystem: ui
tags: [react, typescript, maintenance, work-orders, lucide-react, css-custom-properties]

# Dependency graph
requires:
  - phase: 18-01
    provides: Maintenance Plans backend (CRUD endpoints, types)
  - phase: 18-02
    provides: Work Orders backend (CRUD, parts, close, cancel, dashboard endpoints)
provides:
  - Frontend types for MaintenancePlan, WorkOrder, WorkOrderPart, MaintenanceDashboard
  - useMaintenancePlans hook (fetchPlans, createPlan, updatePlan, deletePlan, toggleActive)
  - useWorkOrders hook (fetchWorkOrders, createWorkOrder, addPart, removePart, closeWorkOrder, cancelWorkOrder, fetchDashboard)
  - MaintenancePlansPage with table, filters, overdue highlighting, skeleton loading, empty state
  - WorkOrdersPage with status badges, OS# in JetBrains Mono, tabs Lista/Kanban stub, mobile cards
  - MaintenancePlanModal with trigger type radio, asset selector, onBlur validation
  - WorkOrderModal with parts inline table, live cost summary, photo upload (drag-drop, max 5)
  - Sidebar PATRIMONIO group expanded with Planos de Manutencao and Ordens de Servico
  - Lazy routes /maintenance-plans and /work-orders registered in App.tsx
affects:
  - 18-05 (WorkOrderCloseWizard will extend WorkOrderModal pattern)
  - 18-06 (MaintenanceDashboardPage will consume useWorkOrders.fetchDashboard)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useXxx hook pattern with fetchX/createX/updateX/deleteX following useAssets.ts shape
    - CSS BEM-like naming with page-scoped prefixes (maint-plans__, wo-page__, mp-modal__, wo-modal__)
    - Status badge pattern — always icon + text + color, never color alone (WCAG 1.4.1)
    - Mobile-first responsive tables — display:none for .cards@>=768 and .table-wrapper at <768
    - Parts inline table pattern in modal with live total computation via useMemo

key-files:
  created:
    - apps/frontend/src/types/maintenance.ts
    - apps/frontend/src/hooks/useMaintenancePlans.ts
    - apps/frontend/src/hooks/useWorkOrders.ts
    - apps/frontend/src/pages/MaintenancePlansPage.tsx
    - apps/frontend/src/pages/MaintenancePlansPage.css
    - apps/frontend/src/pages/WorkOrdersPage.tsx
    - apps/frontend/src/pages/WorkOrdersPage.css
    - apps/frontend/src/components/maintenance/MaintenancePlanModal.tsx
    - apps/frontend/src/components/maintenance/MaintenancePlanModal.css
    - apps/frontend/src/components/maintenance/WorkOrderModal.tsx
    - apps/frontend/src/components/maintenance/WorkOrderModal.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx

key-decisions:
  - 'Wrench icon for Planos de Manutencao, ClipboardList (already imported) for Ordens de Servico in Sidebar'
  - 'WorkOrdersPage Kanban tab shows placeholder text referencing Plan 05 — no stub component added'
  - 'Parts inline table in WorkOrderModal uses local PartRow state (not API calls) so unsaved OS can have parts previewed before save'
  - 'Photo upload in WorkOrderModal stores File[] locally; actual upload to storage is deferred (no storage service in scope for Plan 04)'

patterns-established:
  - 'useMaintenancePlans / useWorkOrders: onSuccess callback param for create/update operations'
  - 'Status badges: STATUS_CONFIG record keyed on status enum with icon+className, renders role=status span'
  - 'Overdue detection: isOverdue(dateStr) helper used in both table and mobile card'

requirements-completed:
  - MANU-01
  - MANU-02

# Metrics
duration: 90min
completed: 2026-03-21
---

# Phase 18 Plan 04: Maintenance Frontend Summary

**React pages and modals for maintenance plans and work orders — 2 list pages with filters/tables/empty states, 2 modals with parts inline table + live cost summary + photo upload, hooks, types, sidebar navigation, and lazy routes**

## Performance

- **Duration:** 90 min
- **Started:** 2026-03-21T11:11:07Z
- **Completed:** 2026-03-21T12:41:35Z
- **Tasks:** 2
- **Files modified:** 13 (11 created, 2 modified)

## Accomplishments

- Full frontend type system for maintenance domain (MaintenancePlan, WorkOrder, WorkOrderPart, MaintenanceDashboard) mirroring backend output types
- Two custom hooks (useMaintenancePlans, useWorkOrders) following useAssets.ts pattern with full CRUD + fetchDashboard + closeWorkOrder
- MaintenancePlansPage with active/trigger/farm filters, overdue next-due date in error color, toggle active/inactive with ConfirmModal, skeleton loading, mobile card layout
- WorkOrdersPage with 5-status badge system (icon+text+color, WCAG compliant), OS# in JetBrains Mono, Lista/Kanban tabs (Kanban is Plan 05 stub), cancel flow
- WorkOrderModal with parts inline table (live total via useMemo), labor/external cost, drag-drop photo upload (max 5, JPEG/PNG/WEBP), JetBrains Mono cost summary row
- MaintenancePlanModal with trigger type radio (HOURMETER/ODOMETER/CALENDAR) and dynamic interval/alert labels, onBlur validation
- Sidebar PATRIMONIO group now has Wrench (Planos) and ClipboardList (Ordens de Servico) entries
- /maintenance-plans and /work-orders lazy routes registered in App.tsx

## Task Commits

1. **Task 1: Frontend types + hooks + sidebar + routes** - `7e436aec` (feat)
2. **Task 2: Pages + modals** - `56d9dc79` (feat)

## Files Created/Modified

- `apps/frontend/src/types/maintenance.ts` — Full type system for maintenance domain
- `apps/frontend/src/hooks/useMaintenancePlans.ts` — CRUD hook for maintenance plans
- `apps/frontend/src/hooks/useWorkOrders.ts` — CRUD + close + dashboard hook for work orders
- `apps/frontend/src/pages/MaintenancePlansPage.tsx` — List page with filters, table, mobile cards
- `apps/frontend/src/pages/MaintenancePlansPage.css` — Page CSS with var(--token) only
- `apps/frontend/src/pages/WorkOrdersPage.tsx` — List page with status badges, tabs, table
- `apps/frontend/src/pages/WorkOrdersPage.css` — Page CSS with status badge color classes
- `apps/frontend/src/components/maintenance/MaintenancePlanModal.tsx` — Create/edit modal (max-width 560px)
- `apps/frontend/src/components/maintenance/MaintenancePlanModal.css` — Modal CSS
- `apps/frontend/src/components/maintenance/WorkOrderModal.tsx` — Create/edit modal with parts table and photo upload (max-width 720px)
- `apps/frontend/src/components/maintenance/WorkOrderModal.css` — Modal CSS
- `apps/frontend/src/components/layout/Sidebar.tsx` — Added Wrench + ClipboardList to PATRIMONIO group
- `apps/frontend/src/App.tsx` — Added 2 lazy routes

## Decisions Made

- WorkOrdersPage Kanban tab shows placeholder referencing Plan 05 — avoids blank tab while keeping tab nav structure ready for Plan 05 to fill
- Parts inline table uses local state (PartRow[]) inside WorkOrderModal — allows OS draft with parts preview before save; actual addPart API calls can be wired when WO is saved (out of scope for Plan 04 create flow)
- Photo upload stores File[] locally — no storage service wired (Plan 04 scope only covers UI structure)
- ClipboardList already imported in Sidebar for other uses; no alias needed — used as-is for Ordens de Servico

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Routes /maintenance-plans and /work-orders are live and functional against Plan 18-01/18-02 backend endpoints
- WorkOrderCloseWizard (Plan 05) can use the WorkOrderModal pattern for the 3-step close flow
- MaintenanceDashboardPage (Plan 06) can consume useWorkOrders.fetchDashboard which returns MaintenanceDashboard type

---

_Phase: 18-manutencao-ordens-servico_
_Completed: 2026-03-21_
