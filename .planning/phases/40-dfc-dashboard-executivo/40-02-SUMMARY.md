---
phase: 40-dfc-dashboard-executivo
plan: "02"
subsystem: financial-statements
tags: [accounting-dashboard, kpi, dre, balance-sheet, alerts, typescript, jest]
dependency_graph:
  requires:
    - financial-statements.service (getDre, getBalanceSheet)
    - financial-statements.types (FinancialStatementsError)
    - prisma (accountingPeriod, pendingJournalPosting, chartOfAccount, accountBalance)
  provides:
    - GET /org/:orgId/accounting-dashboard
    - AccountingDashboardOutput type
  affects:
    - app.ts (router registration)
tech_stack:
  added: []
  patterns:
    - Raw SQL via prisma.$queryRaw for 12-month chart (same as computeMarginRanking)
    - Alert suppression: only include alerts where count > 0
    - Delta calculation: (current - prior) / abs(prior) * 100, null if prior is 0
key_files:
  created:
    - apps/backend/src/modules/financial-statements/accounting-dashboard.types.ts
    - apps/backend/src/modules/financial-statements/accounting-dashboard.service.ts
    - apps/backend/src/modules/financial-statements/accounting-dashboard.routes.ts
    - apps/backend/src/modules/financial-statements/accounting-dashboard.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - "Cost composition groups expenses via SQL CASE on code prefix; duplicate labels (e.g. Despesas com Pessoal from 5.2.04 and 6.1.x) merged in TypeScript after query"
  - "accountingDashboardRouter placed immediately after financialStatementsRouter in app.ts — no route shadowing risk since paths differ (/accounting-dashboard vs /financial-statements/*)"
  - "12-month monthlyChart always returns all 12 months including zeros — frontend can render a full year chart without gaps"
metrics:
  duration_minutes: 30
  completed_date: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 12
  tests_total_after: 37
---

# Phase 40 Plan 02: Accounting Dashboard Backend Summary

**One-liner:** Single `GET /org/:orgId/accounting-dashboard` endpoint aggregating KPI cards, 12-month revenue/expense chart (raw SQL), cost composition donut, 4 BP indicators with sparklines, and zero-suppressed accounting alerts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create accounting dashboard types, service, route, and register | bc54127b | accounting-dashboard.types.ts, accounting-dashboard.service.ts, accounting-dashboard.routes.ts, app.ts |
| 2 | Add route integration tests for dashboard endpoint | c8f37f31 | accounting-dashboard.routes.spec.ts |

## What Was Built

### accounting-dashboard.types.ts
Exports: `AccountingDashboardFilters`, `AccountingDashboardOutput`, `DashboardKpiCard`, `MonthlyRevenueExpense`, `CostCompositionItem`, `BpIndicatorCard`, `AccountingAlert`.

### accounting-dashboard.service.ts
`getAccountingDashboard(organizationId, filters)` orchestrates:
1. **KPI Cards (4)**: Calls `getDre` for current + prior month (month-1). Builds Resultado Acumulado, Receita Total, Despesa Total, Margem Operacional. Delta = `(current-prior)/abs(prior)*100`; null if prior is 0.
2. **12-Month Chart**: Single `prisma.$queryRaw` on `account_balances JOIN chart_of_accounts` grouped by month for RECEITA/DESPESA — returns all 12 months with 0-filled gaps.
3. **Cost Composition**: Raw SQL CASE statement groups expenses by code prefix (CPV, Despesas Admin, etc.). Duplicate labels merged in JS. Percent calculated as `value / total * 100`.
4. **BP Indicators (4)**: Calls `getBalanceSheet`, extracts `liquidezCorrente`, `endividamentoGeral`, `roe`, `plPorHectare` with sparklines.
5. **Alerts**: Three parallel `prisma.count` calls. Only pushes alerts where `count > 0` — zero-count alerts are suppressed per D-07.

### accounting-dashboard.routes.ts
GET `/org/:orgId/accounting-dashboard?fiscalYearId=...&month=...`
- Validates fiscalYearId (required), month (required, 1-12)
- authenticate + checkPermission('financial:read')
- Returns 400 with codes MISSING_FISCAL_YEAR_ID, MISSING_MONTH, INVALID_MONTH

### accounting-dashboard.routes.spec.ts
12 tests covering: parameter validation (5 tests), response structure (6 tests), auth guard (1 test). Mocks service layer only.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data comes from real DB queries via the existing getDre/getBalanceSheet services and direct Prisma queries.

## Self-Check: PASSED

Files created:
- apps/backend/src/modules/financial-statements/accounting-dashboard.types.ts — FOUND
- apps/backend/src/modules/financial-statements/accounting-dashboard.service.ts — FOUND
- apps/backend/src/modules/financial-statements/accounting-dashboard.routes.ts — FOUND
- apps/backend/src/modules/financial-statements/accounting-dashboard.routes.spec.ts — FOUND

Commits:
- bc54127b — FOUND
- c8f37f31 — FOUND

Tests: 37 passed, 0 failed (3 suites: dfc.calculator.spec, financial-statements.routes.spec, accounting-dashboard.routes.spec)
