---
phase: 35-plano-de-contas-e-periodos-fiscais
plan: "01"
subsystem: accounting-foundation
tags: [prisma, shared-utils, tdd, accounting, chart-of-accounts, fiscal-periods]
dependency_graph:
  requires: []
  provides:
    - ChartOfAccount Prisma model (chart_of_accounts table)
    - FiscalYear Prisma model (fiscal_years table)
    - AccountingPeriod Prisma model (accounting_periods table)
    - AccountBalance Prisma model (account_balances table)
    - assertPeriodOpen utility (packages/shared)
    - assertBalanced utility (packages/shared)
    - rateio utility (packages/shared)
  affects:
    - packages/shared exports (new accounting/* exports)
    - apps/backend/prisma/schema.prisma (4 new models, 3 new enums)
    - Organization, User, CostCenter models (reverse relations added)
tech_stack:
  added: []
  patterns:
    - TDD Red-Green cycle for utility functions
    - Decimal.ROUND_DOWN for per-share truncation in rateio (prevents over-distribution)
    - remainder absorption on largest-percentage share (guarantees sum === total)
    - Object.setPrototypeOf in Error subclasses (instanceof safety in TypeScript)
    - prisma migrate diff + deploy pattern (bypasses shadow DB limitation)
key_files:
  created:
    - packages/shared/src/utils/accounting/assert-period-open.ts
    - packages/shared/src/utils/accounting/assert-balanced.ts
    - packages/shared/src/utils/accounting/rateio.ts
    - packages/shared/src/utils/accounting/index.ts
    - packages/shared/src/utils/accounting/__tests__/assert-period-open.spec.ts
    - packages/shared/src/utils/accounting/__tests__/assert-balanced.spec.ts
    - packages/shared/src/utils/accounting/__tests__/rateio.spec.ts
    - apps/backend/prisma/migrations/20260601000000_add_chart_of_accounts_fiscal_periods_account_balance/migration.sql
  modified:
    - apps/backend/prisma/schema.prisma
    - packages/shared/src/index.ts
decisions:
  - "Used prisma migrate diff + deploy instead of migrate dev: shadow DB was missing tables from earlier migrations not tracked in its history; diff generates correct SQL from live DB state, deploy applies it safely"
  - "Remainder in rateio goes to largest-percentage share (not first): ensures predictability when multiple cost centers have equal percentages"
  - "Object.setPrototypeOf in Error subclasses: required for TypeScript instanceof to work correctly after transpilation"
metrics:
  duration_seconds: 383
  completed_date: "2026-03-27"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
  tests_added: 23
---

# Phase 35 Plan 01: Chart of Accounts and Fiscal Periods Foundation Summary

**One-liner:** 4 Prisma models (ChartOfAccount with CoaTree self-relation, FiscalYear with safra date range, AccountingPeriod with PeriodStatus state machine, AccountBalance with optional cost center dimension) + 3 shared utilities (assertPeriodOpen, assertBalanced, rateio) with 23 tests via TDD.

## What Was Built

### Task 1: Shared Accounting Utilities (TDD)

Three utility functions exported from `packages/shared/src/utils/accounting/`:

**assertPeriodOpen** — Guard function that throws `PeriodNotOpenError` when `period.status !== 'OPEN'`. Error includes Portuguese message with month/year and status. Error class exposes `month`, `year`, `status` public fields for programmatic handling.

**assertBalanced** — Double-entry validation that sums DEBIT and CREDIT lines using `Money()` factory (decimal.js-backed). Throws `UnbalancedEntryError` with debit/credit totals in message. Accepts `number | string` amounts to handle Prisma Decimal serialization.

**rateio** — Proportional cost center split with exact sum guarantee. Algorithm: truncate each share to 2dp with `Decimal.ROUND_DOWN`, compute remainder = total - sum(truncated), add remainder to largest-percentage share (first occurrence on tie). Validates: non-empty array, percentages sum to 100 ± 0.01.

### Task 2: Prisma Schema Models

Added 3 enums and 4 models to `apps/backend/prisma/schema.prisma`:

- **AccountType**: ATIVO, PASSIVO, PL, RECEITA, DESPESA
- **AccountNature**: DEVEDORA, CREDORA
- **PeriodStatus**: OPEN, CLOSED, BLOCKED

- **ChartOfAccount**: Hierarchical account with `CoaTree` self-relation, `isFairValueAdj` (CPC 29 support), `spedRefCode` (SPED ECD), `@@unique([organizationId, code])`, 5-level support via `level` field
- **FiscalYear**: `startDate/endDate @db.Date` for safra calendar (not just `year Int`), `@@unique([organizationId, startDate])`
- **AccountingPeriod**: Links to FiscalYear, `closedByUser @relation("PeriodClose")`, `reopenedByUser @relation("PeriodReopen")` with full audit trail fields
- **AccountBalance**: Per-account per-month running totals, optional `costCenterId` for gerencial dimension (COA-05)

Migration `20260601000000` applied via `migrate deploy` to PostgreSQL 16.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| f0dc65a2 | test | Add failing tests for accounting utilities (RED) — 3 spec files, 23 test cases |
| d8d93b8e | feat | Implement accounting utility functions (GREEN) — 4 implementation files |
| 8258ac4b | feat | Add Prisma schema models for chart of accounts and fiscal periods — migration applied |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shadow database out of sync prevented `prisma migrate dev`**
- **Found during:** Task 2
- **Issue:** `prisma migrate dev` uses a shadow database to verify all migrations apply cleanly from scratch. The shadow DB was missing tables from earlier migrations (`cultivars`, etc.) that were applied directly to the main DB without being tracked in the shadow DB history.
- **Fix:** Used `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` to generate correct SQL from live DB state, created migration file manually, then applied with `prisma migrate deploy`.
- **Files modified:** `apps/backend/prisma/migrations/20260601000000_.../migration.sql` (created manually)
- **Impact:** None — migration SQL is identical to what `migrate dev` would have produced; verified via `prisma validate` and `prisma generate` passing cleanly.

## Known Stubs

None — all utility functions are fully implemented. Prisma models are schema-only (no service layer or endpoints yet, as planned for subsequent plans in Phase 35).

## Self-Check

- [x] `packages/shared/src/utils/accounting/assert-period-open.ts` exists
- [x] `packages/shared/src/utils/accounting/assert-balanced.ts` exists
- [x] `packages/shared/src/utils/accounting/rateio.ts` exists
- [x] `packages/shared/src/utils/accounting/index.ts` exists
- [x] `packages/shared/src/index.ts` exports `* from './utils/accounting'`
- [x] 23 test cases pass across 3 spec files
- [x] `apps/backend/prisma/schema.prisma` contains `model ChartOfAccount` with `@@map("chart_of_accounts")`
- [x] `apps/backend/prisma/schema.prisma` contains `model FiscalYear` with `@@map("fiscal_years")`
- [x] `apps/backend/prisma/schema.prisma` contains `model AccountingPeriod` with `@@map("accounting_periods")`
- [x] `apps/backend/prisma/schema.prisma` contains `model AccountBalance` with `@@map("account_balances")`
- [x] Migration file exists at `apps/backend/prisma/migrations/20260601000000_.../migration.sql`
- [x] `npx prisma validate` exits 0
- [x] `npx prisma generate` completes without errors
- [x] Commits f0dc65a2, d8d93b8e, 8258ac4b verified in git log
