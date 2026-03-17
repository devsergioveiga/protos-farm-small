---
phase: 04-instrumentos-de-pagamento
plan: 07
subsystem: financial-dashboard
tags: [dashboard, saldo-contabil, checks, credit-cards, alerts]
dependency_graph:
  requires: [04-02, 04-04, 04-06]
  provides: [dashboard-accounting-balance, payment-instrument-alerts]
  affects: [financial-dashboard-page]
tech_stack:
  added: []
  patterns: [inline-rls-transaction, conditional-tooltip, warning-alerts]
key_files:
  created: []
  modified:
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.types.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts
    - apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.spec.ts
    - apps/frontend/src/hooks/useFinancialDashboard.ts
    - apps/frontend/src/pages/FinancialDashboardPage.tsx
    - apps/frontend/src/pages/FinancialDashboardPage.css
decisions:
  - Accounting balance computed inline within withRlsContext transaction to avoid nested RLS context calls — getAccountingBalanceData uses its own withRlsContext, so inlining the check query avoids double-wrap
  - Tooltip implemented with local useState + onMouseEnter/onFocus handlers — no external library needed for single tooltip instance
  - openBillsCount query uses expenses: { some: {} } filter to count only bills with actual expenses (not empty bills)
  - checksNearCompensation uses todayUtc <= expectedCompensationDate <= sevenDaysFromNow to include today's checks
requirements: [FN-09]
metrics:
  duration: 4min
  completed: 2026-03-16
  tasks_completed: 1
  tasks_total: 2
  files_changed: 6
---

# Phase 4 Plan 07: Dashboard Saldo Contabil and Payment Instrument Alerts Summary

Dashboard updated to distinguish real balance from accounting balance and surface payment instrument alerts from checks and credit cards.

## What Was Built

### Backend (financial-dashboard.service.ts + types)

Added 5 new fields to `FinancialDashboardOutput`:

- `accountingBalance` — saldo real minus A_COMPENSAR EMITIDO checks plus A_COMPENSAR RECEBIDO checks
- `pendingEmitidos` / `pendingRecebidos` — raw amounts for checks pending compensation
- `openBillsCount` — count of OPEN credit card bills with expenses
- `checksNearCompensation` — count of A_COMPENSAR checks with `expectedCompensationDate` within 7 days

Accounting balance logic runs inline within the existing `withRlsContext` transaction to avoid nesting RLS contexts. The `creditCardBill` OPEN count filters for bills with at least one expense (`expenses: { some: {} }`).

### Frontend (FinancialDashboardPage.tsx + .css + hook)

- KPI 1 card ("Saldo bancário real") now shows a secondary line with `Saldo contábil:` value (gray, mono font)
- Negative accounting balance renders in `--color-error-500` with `AlertCircle` icon
- Info button with `aria-describedby="accounting-tooltip"` triggers hover/focus tooltip explaining the difference between saldo real and saldo contábil
- Tooltip: `role="tooltip"`, absolute positioning above button, max-width 320px
- New warning alerts in the alerts panel: CreditCard icon for open bills, CheckSquare icon for checks near compensation
- "All clear" message only shown when all 4 alert conditions are false (includes new 2 conditions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test spec fixture with missing fields**

- **Found during:** Task 1 verification
- **Issue:** `financial-dashboard.routes.spec.ts` mock fixture `DASHBOARD_OUTPUT` missing the 5 new fields added to `FinancialDashboardOutput`, causing TypeScript type errors in the spec
- **Fix:** Added `accountingBalance: 47000, pendingEmitidos: 5000, pendingRecebidos: 2000, openBillsCount: 1, checksNearCompensation: 2` to fixture
- **Files modified:** `financial-dashboard.routes.spec.ts`
- **Commit:** 9511463

**2. [Out of scope - deferred] Pre-existing TS errors in checks.routes.ts and transfers.routes.ts**

- `req.params.id` typed as `string | string[]` passed to functions expecting `string` — existed before this plan
- Logged to deferred-items.md (not fixed, out of scope)

## Self-Check: PASSED

- FOUND: financial-dashboard.types.ts
- FOUND: financial-dashboard.service.ts
- FOUND: FinancialDashboardPage.tsx
- FOUND: 04-07-SUMMARY.md
- FOUND: commit 9511463 (feat(04-07): dashboard saldo contabil...)
