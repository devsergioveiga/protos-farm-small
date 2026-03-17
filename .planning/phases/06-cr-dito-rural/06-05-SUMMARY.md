---
phase: 06-cr-dito-rural
plan: '05'
subsystem: frontend-shell
tags: [rural-credit, sidebar, routing, financial-dashboard]
dependency_graph:
  requires: [06-04]
  provides: [rural-credit-navigation, rural-credit-dashboard-card]
  affects: [Sidebar.tsx, App.tsx, FinancialDashboardPage.tsx, financial-dashboard.service.ts]
tech_stack:
  added: []
  patterns: [lazy-route, alert-badge, dashboard-card]
key_files:
  created: []
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/hooks/useFinancialDashboard.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.types.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts
    - apps/frontend/src/pages/FinancialDashboardPage.tsx
    - apps/frontend/src/pages/FinancialDashboardPage.css
decisions:
  - App.tsx and Sidebar.tsx already had lazy routes and nav entry pre-built; only badge hook wiring, backend aggregation, and dashboard card required new work
  - ruralCredit field added as optional (?) in both backend FinancialDashboardOutput and frontend FinancialDashboardData to avoid breaking existing consumers
  - FinancialDashboardData (frontend hook) mirrors FinancialDashboardOutput (backend types) — both updated in sync
metrics:
  duration: 8min
  completed_date: '2026-03-17'
  tasks_completed: 1
  tasks_total: 2
  files_modified: 6
---

# Phase 6 Plan 5: Application Shell Integration Summary

Rural credit wired into app shell: sidebar alert badge via `useRuralCreditAlertCount`, lazy routes confirmed present, and financial dashboard extended with `ruralCredit` aggregation card showing total contracted, outstanding balance, active contracts, and next payment.

## Tasks Completed

| #   | Name                                               | Status                      | Commit  |
| --- | -------------------------------------------------- | --------------------------- | ------- |
| 1   | Add sidebar entry, lazy routes, and dashboard card | Done                        | 3d9b946 |
| 2   | Human verification of complete rural credit flow   | Checkpoint — awaiting human | —       |

## What Was Built

### Sidebar alert badge

- Imported `useRuralCreditAlertCount` from `@/hooks/useRuralCredit`
- Called hook alongside `useOverdueCount` and `useCheckAlertCount`
- Added `showRuralCreditBadge` conditional rendering with red pill badge (matching overdue pattern)

### Lazy routes in App.tsx

- Both `RuralCreditPage` and `RuralCreditDetailPage` lazy imports and routes (`/rural-credit`, `/rural-credit/:id`) were already present from prior planning — no change needed

### Backend: dashboard aggregation

- Added `ruralCredit?:` field to `FinancialDashboardOutput` interface
- Added `ruralCreditContract.aggregate` query for ATIVO contracts by org/farm
- Added `payableInstallment.findFirst` to find earliest PENDING installment with `originType: 'RURAL_CREDIT'`

### Frontend: dashboard card

- Added `ruralCredit?:` field to `FinancialDashboardData` hook interface
- Replaced "Endividamento: crédito rural disponível na Fase 6" placeholder with actual `<section>` card
- Card shows: total contratado, saldo devedor (red if > 0), contratos ativos, próxima parcela
- Empty state: "Nenhum contrato ativo" + link to `/rural-credit`
- Added BEM CSS for the card in `FinancialDashboardPage.css`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing type] Added ruralCredit to frontend FinancialDashboardData interface**

- **Found during:** Task 1
- **Issue:** Plan specified updating `financial-dashboard.types.ts` (backend) but not the mirrored frontend type `FinancialDashboardData` in `useFinancialDashboard.ts`; TypeScript reported 10 errors on the new card
- **Fix:** Added matching `ruralCredit?:` shape to `FinancialDashboardData` in `apps/frontend/src/hooks/useFinancialDashboard.ts`
- **Files modified:** `apps/frontend/src/hooks/useFinancialDashboard.ts`
- **Commit:** 3d9b946

## Self-Check: PASSED

- Sidebar.tsx: FOUND
- financial-dashboard.types.ts: FOUND
- FinancialDashboardPage.tsx: FOUND
- Commit 3d9b946: FOUND (verified via git log)
