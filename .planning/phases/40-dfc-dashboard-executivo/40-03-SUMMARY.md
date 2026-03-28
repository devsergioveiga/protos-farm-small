---
phase: 40-dfc-dashboard-executivo
plan: "03"
subsystem: frontend
tags: [dfc, financial-statements, react, typescript, hooks, components]
dependency_graph:
  requires: ["40-01"]
  provides: ["DfcPage at /dfc", "useDfc hook", "useAccountingDashboard hook", "DfcTable component"]
  affects: ["40-04"]
tech_stack:
  added: []
  patterns: ["lazy-loaded page route", "hidden-attribute tabs", "useFiscalYears pattern", "semantic HTML table"]
key_files:
  created:
    - apps/frontend/src/hooks/useDfc.ts
    - apps/frontend/src/hooks/useAccountingDashboard.ts
    - apps/frontend/src/components/financial-statements/DfcTable.tsx
    - apps/frontend/src/components/financial-statements/DfcTable.css
    - apps/frontend/src/pages/DfcPage.tsx
    - apps/frontend/src/pages/DfcPage.css
  modified:
    - apps/frontend/src/types/financial-statements.ts
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - "Tabs use hidden attribute (not conditional render) per Phase 37 decision — preserves panel state on switch"
  - "useDfc and useAccountingDashboard follow useDre pattern exactly for consistency"
  - "DfcTable uses semantic <table> with <caption>, <th scope>, tfoot for cash summary rows"
  - "DFC route /dfc registered with lazy loading in App.tsx and ArrowLeftRight icon in Sidebar CONTABILIDADE group"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 3
---

# Phase 40 Plan 03: DFC Frontend Types, Hooks, and Page Summary

**One-liner:** DFC frontend with DfcTable semantic component, useDfc/useAccountingDashboard hooks, and DfcPage at /dfc with Direto/Indireto tab switching via hidden attribute.

## What Was Built

- Extended `financial-statements.ts` with all DFC types (`DfcOutput`, `DfcSection`, `DfcSectionRow`, `DfcCashSummary`, `DfcMethodOutput`) and all Accounting Dashboard types (`AccountingDashboardOutput`, `DashboardKpiCard`, `MonthlyRevenueExpense`, `CostCompositionItem`, `BpIndicatorCard`, `AccountingAlert`)
- Created `useDfc` hook: fetches from `/org/:orgId/financial-statements/dfc?fiscalYearId=&month=`, follows `useDre` pattern exactly
- Created `useAccountingDashboard` hook: fetches from `/org/:orgId/accounting-dashboard?fiscalYearId=&month=`, ready for Plan 04
- Created `DfcTable` component: semantic `<table>` with `<caption>`, `<th scope="col">` headers, section header rows with background, subtotal rows, `<tfoot>` for cash summary (saldo inicial, variacao liquida, saldo final)
- Created `DfcPage`: fiscal year + month selectors auto-trigger fetch, Metodo Direto/Metodo Indireto tabs using `hidden` attribute, empty state, error state, Export CSV button, breadcrumb, accessible tablist
- Wired `/dfc` route in App.tsx with lazy loading
- Added DFC entry to CONTABILIDADE sidebar group (ArrowLeftRight icon)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Frontend types and data hooks | 63175426 | financial-statements.ts, useDfc.ts, useAccountingDashboard.ts |
| 2 | DfcTable component and DfcPage with tabs | 40892675 | DfcTable.tsx, DfcTable.css, DfcPage.tsx, DfcPage.css, App.tsx, Sidebar.tsx |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- Export CSV button in DfcPage is disabled but has no click handler wired (no backend CSV export endpoint defined in Plan 01 scope). Button renders and shows correct disabled state but does not download anything. Plan 04 or a future plan can wire the actual download.

## Self-Check: PASSED
