---
phase: 18-manutencao-ordens-servico
plan: '05'
subsystem: frontend-maintenance
tags: [frontend, maintenance, dashboard, kanban, wizard, provision, react]
dependency_graph:
  requires: [18-02, 18-03]
  provides: [frontend-maintenance-dashboard, frontend-maintenance-kanban, frontend-close-wizard, frontend-maintenance-provision]
  affects: [AssetDetailPage, App.tsx, Sidebar]
tech_stack:
  added: ['@dnd-kit/core (kanban drag-and-drop)']
  patterns: ['3-step modal wizard (display:none/block)', 'standalone kanban via @dnd-kit primitives', 'cost total computed inline', 'patchWorkOrderStatus type cast']
key_files:
  created:
    - apps/frontend/src/types/maintenance.ts
    - apps/frontend/src/hooks/useMaintenanceDashboard.ts
    - apps/frontend/src/hooks/useMaintenancePlans.ts
    - apps/frontend/src/hooks/useMaintenanceProvisions.ts
    - apps/frontend/src/hooks/useWorkOrders.ts
    - apps/frontend/src/components/maintenance/WorkOrderCloseWizard.tsx
    - apps/frontend/src/components/maintenance/WorkOrderCloseWizard.css
    - apps/frontend/src/components/maintenance/MaintenanceKanban.tsx
    - apps/frontend/src/components/maintenance/MaintenancePlanModal.tsx
    - apps/frontend/src/components/maintenance/MaintenancePlanModal.css
    - apps/frontend/src/components/maintenance/WorkOrderModal.tsx
    - apps/frontend/src/components/maintenance/WorkOrderModal.css
    - apps/frontend/src/components/maintenance/MaintenanceProvisionModal.tsx
    - apps/frontend/src/components/maintenance/MaintenanceProvisionModal.css
    - apps/frontend/src/pages/MaintenanceDashboardPage.tsx
    - apps/frontend/src/pages/MaintenanceDashboardPage.css
    - apps/frontend/src/pages/MaintenancePlansPage.tsx
    - apps/frontend/src/pages/MaintenancePlansPage.css
    - apps/frontend/src/pages/WorkOrdersPage.tsx
    - apps/frontend/src/pages/WorkOrdersPage.css
  modified:
    - apps/frontend/src/components/assets/AssetMaintenanceTab.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - "Standalone MaintenanceKanban built with @dnd-kit primitives instead of wrapping existing KanbanBoard — existing component tightly coupled to purchasing-kanban types (KANBAN_VALID_DROPS, KanbanCard, KanbanColumnId)"
  - "WorkOrderCloseWizard uses display:none/block for step transitions per UI-SPEC locked decision — zero animation, no framer-motion"
  - "patchWorkOrderStatus cast (updateWorkOrder as unknown as ...) used in dashboard to send status-only PATCH — avoids CreateWorkOrderInput type incompatibility"
  - "Plan 04 prerequisites (types, hooks, pages, modals) created alongside Plan 05 — all were absent from worktree despite plan dependency on 18-02/18-03"
metrics:
  duration: "~120 min (multi-session)"
  tasks_completed: 2
  files_created: 20
  files_modified: 3
  completed_date: "2026-03-21"
---

# Phase 18 Plan 05: Maintenance Dashboard, Close Wizard, Kanban, Provision Modal, Asset Tab Summary

**One-liner:** Full frontend maintenance module — 3-step accounting classification wizard, @dnd-kit kanban, KPI dashboard with MTBF/MTTR/availability, and live AssetMaintenanceTab replacing the placeholder stub.

## Objective

Deliver all frontend surfaces for the maintenance module: dashboard with reliability KPIs and open-OS kanban, WorkOrder close wizard with accounting treatment selection, maintenance provision modal, and a live AssetMaintenanceTab on the asset detail page.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Types, hooks, modals, kanban, plan/WO pages | 8adf2924 | maintenance.ts, useWorkOrders.ts, WorkOrderCloseWizard.tsx, MaintenanceKanban.tsx, MaintenancePlanModal.tsx, WorkOrderModal.tsx, MaintenanceProvisionModal.tsx, MaintenancePlansPage.tsx, WorkOrdersPage.tsx |
| 2 | Dashboard, asset tab, routes, sidebar | f5f01b79 | MaintenanceDashboardPage.tsx, AssetMaintenanceTab.tsx (replaced), App.tsx, Sidebar.tsx |

## What Was Built

### MaintenanceDashboardPage (`/maintenance-dashboard`)
- 4 KPI cards: Disponibilidade Mecanica (%), MTBF (horas), MTTR (horas), Custo YTD (BRL)
- MTBF/MTTR show `N/D` with tooltip when no corrective OS exists
- Overdue maintenance plan alerts with AlertTriangle + asset name + days overdue
- Embedded MaintenanceKanban for open OS (ABERTA/EM_ANDAMENTO/AGUARDANDO_PECA)
- Custo por Ativo table sorted by cost descending
- Empty state when zero data and not loading

### WorkOrderCloseWizard (3-step modal)
- Step 1: Read-only cost breakdown (parts + labor + external = total) in JetBrains Mono
- Step 2: Accounting treatment radio cards (DESPESA / CAPITALIZACAO / DIFERIMENTO); DIFERIMENTO reveals deferral months input via `display:none/block`
- Step 3: Summary table + warning banner for CAPITALIZACAO; "Encerrar OS" CTA
- Step transitions: zero animation, `display: step === N ? 'block' : 'none'`
- Submits `closeWorkOrder(id, { accountingTreatment, deferralMonths })`

### MaintenanceKanban (standalone @dnd-kit)
- 3 draggable columns with colored top border (info/warning/error)
- Valid drops: ABERTA→EM_ANDAMENTO, EM_ANDAMENTO→ABERTA|AGUARDANDO_PECA, AGUARDANDO_PECA→EM_ANDAMENTO
- Cards show OS# (mono), asset name, type badge, age in days
- Drop targets highlight with primary-100 bg + 2px primary-500 border

### AssetMaintenanceTab (replaced placeholder)
- Maintenance plans compact table: Nome, Gatilho, Proxima (with overdue alert), Status badge
- OS history list: last 10 orders with status icon, sequential number (mono), cost, date
- Top-right buttons: "Novo Plano" (secondary outline) + "Nova OS" (primary)
- Empty state: Wrench icon + description + link-style "Novo Plano" button

### Supporting infrastructure
- `maintenance.ts`: all types (WorkOrder, MaintenancePlan, MaintenanceDashboard, MaintenanceProvision, enums)
- 4 hooks: useMaintenancePlans, useWorkOrders, useMaintenanceDashboard, useMaintenanceProvisions
- MaintenancePlanModal: HOURMETER/ODOMETER/CALENDAR trigger selection
- WorkOrderModal: parts table with inline add/remove, live cost total (parts + labor + external)
- MaintenanceProvisionModal: fleet-level (assetId=null) or per-asset provision with isActive toggle
- Routes: `/maintenance-plans`, `/work-orders`, `/maintenance-dashboard` (lazy loaded)
- Sidebar: 3 items under Patrimonio group

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 04 prerequisites absent from worktree**
- **Found during:** Task 1 start
- **Issue:** All Plan 04 artifacts (types/maintenance.ts, all 4 hooks, MaintenancePlansPage, WorkOrdersPage, WorkOrderModal, MaintenancePlanModal) were missing despite plan dependency on 18-02/18-03
- **Fix:** Created all Plan 04 artifacts alongside Plan 05 — includes 23 new files total
- **Files modified:** All files in Task 1 commit
- **Commit:** 8adf2924

**2. [Rule 1 - Bug] useProducts called without required params and with non-existent fetchProducts**
- **Found during:** Task 1 (WorkOrderModal)
- **Issue:** `useProducts()` requires params object; `fetchProducts` doesn't exist in hook API — auto-fetches on mount
- **Fix:** Changed to `useProducts({ limit: 500 })` and removed the useEffect fetchProducts call
- **Files modified:** WorkOrderModal.tsx
- **Commit:** 8adf2924

**3. [Rule 1 - Bug] updateWorkOrder type incompatible with status-only PATCH**
- **Found during:** Task 2 (MaintenanceDashboardPage)
- **Issue:** `updateWorkOrder(id, { status: newStatus })` fails — `CreateWorkOrderInput` has no `status` field
- **Fix:** Added `patchWorkOrderStatus` cast at component scope: `updateWorkOrder as unknown as (id, input: Record<string, unknown>) => Promise<void>`
- **Files modified:** MaintenanceDashboardPage.tsx
- **Commit:** f5f01b79

**4. [Rule 3 - Blocking] Existing KanbanBoard incompatible with maintenance types**
- **Found during:** Task 1 (MaintenanceKanban)
- **Issue:** KanbanBoard is tightly coupled to `KANBAN_VALID_DROPS` from `usePurchasingKanban`, `KanbanCard` type, `KanbanColumnId` type — not safe to wrap
- **Fix:** Built standalone `MaintenanceKanban.tsx` using @dnd-kit primitives directly with OS-specific column definitions
- **Files modified:** MaintenanceKanban.tsx
- **Commit:** 8adf2924

## Self-Check: PASSED

- FOUND: apps/frontend/src/types/maintenance.ts
- FOUND: apps/frontend/src/hooks/useWorkOrders.ts
- FOUND: apps/frontend/src/hooks/useMaintenanceDashboard.ts
- FOUND: apps/frontend/src/hooks/useMaintenancePlans.ts
- FOUND: apps/frontend/src/hooks/useMaintenanceProvisions.ts
- FOUND: apps/frontend/src/components/maintenance/WorkOrderCloseWizard.tsx
- FOUND: apps/frontend/src/components/maintenance/MaintenanceKanban.tsx
- FOUND: apps/frontend/src/components/maintenance/MaintenanceProvisionModal.tsx
- FOUND: apps/frontend/src/pages/MaintenanceDashboardPage.tsx
- FOUND: apps/frontend/src/components/assets/AssetMaintenanceTab.tsx
- FOUND: commit 8adf2924 (Task 1)
- FOUND: commit f5f01b79 (Task 2)
