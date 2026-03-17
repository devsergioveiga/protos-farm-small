---
phase: 02-n-cleo-ap-ar
plan: 01
subsystem: database
tags:
  [
    prisma,
    postgresql,
    ap-ar,
    contas-a-pagar,
    contas-a-receber,
    cnab,
    parcelamento,
    rateio,
    decimal-js,
  ]

requires:
  - phase: 01-funda-o-financeira
    provides: BankAccount, BankAccountBalance, FinancialTransaction models; Money type in @protos-farm/shared; CostCenter model

provides:
  - Prisma models: Payable, PayableInstallment, PayableCostCenterItem, Receivable, ReceivableInstallment, ReceivableCostCenterItem
  - Enums: PayableStatus, ReceivableStatus, RecurrenceFrequency, PayableCategory, ReceivableCategory, CostCenterAllocMode
  - BankAccount CNAB fields: convenioCode, carteira, variacao
  - Shared utility: generateInstallments (first-installment residual rule)
  - Shared utility: validateCostCenterItems (PERCENTAGE and FIXED_VALUE modes)
  - 18 tests in packages/shared covering installment rounding and cost center rateio validation

affects:
  - 02-02 (payables backend service will import these models and utilities)
  - 02-03 (receivables backend service symmetric to payables)
  - future CNAB plan (BankAccount CNAB fields used by CnabAdapter)

tech-stack:
  added: []
  patterns:
    - 'generateInstallments: cent residual goes to FIRST installment — Money.divide(count).toDecimalPlaces(2, ROUND_DOWN), then residual = total - (base * count) added to index 0'
    - 'validateCostCenterItems: guard on empty array, mixed modes, then mode-specific sum check with 0.01% tolerance for PERCENTAGE'
    - 'AP/AR migrations: db push + migrate resolve pattern (no shadow DB) consistent with Phase 1'

key-files:
  created:
    - packages/shared/src/utils/installments.ts
    - packages/shared/src/utils/__tests__/installments.spec.ts
    - apps/backend/prisma/migrations/20260401100000_add_payables_receivables/migration.sql
    - apps/backend/prisma/migrations/20260401200000_bank_account_cnab_fields/migration.sql
  modified:
    - packages/shared/src/index.ts
    - apps/backend/prisma/schema.prisma

key-decisions:
  - 'Cent residual on FIRST installment: ROUND_DOWN base then residual = total - (base * count) added to index i===0 — confirmed by CONTEXT.md decision'
  - 'UTC date methods in generateInstallments (setUTCMonth/getUTCMonth) to avoid timezone-shift bug when base date is midnight UTC'
  - 'PERCENTAGE tolerance 0.01% in validateCostCenterItems to handle floating-point near-100 sums'

patterns-established:
  - 'Installment date arithmetic: clone firstDueDate via new Date(firstDueDate), then setUTCMonth(getUTCMonth() + i * freq)'
  - 'Cost center validation: throw descriptive pt-BR error on each failure case'

requirements-completed:
  - FN-07
  - FN-11

duration: 9min
completed: 2026-03-16
---

# Phase 02 Plan 01: AP/AR Foundation (Schema + Shared Utilities) Summary

**Prisma schema with 6 AP/AR models, 6 enums, 2 migrations applied, CNAB fields on BankAccount, and shared `generateInstallments`/`validateCostCenterItems` utilities with 18 tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-16T11:18:36Z
- **Completed:** 2026-03-16T11:28:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Prisma schema extended with 6 models (Payable, PayableInstallment, PayableCostCenterItem, Receivable, ReceivableInstallment, ReceivableCostCenterItem) and 6 enums; composite indexes on `(organizationId, status, dueDate)` for aging queries; self-referencing relation for recurrence templates
- BankAccount model extended with CNAB convenience fields (convenioCode, carteira, variacao — all optional)
- `generateInstallments` utility: divides totalAmount into N installments using Money arithmetic, cent residual on FIRST installment per locked CONTEXT.md decision, 10 tests covering edge cases including exact sum invariant
- `validateCostCenterItems` utility: validates PERCENTAGE (sum 100±0.01%) and FIXED_VALUE (sum equals totalAmount) modes with mixed-mode guard and empty array guard, 8 tests
- Two migrations applied via db push + migrate resolve pattern; `prisma generate` and `tsc --noEmit` both clean

## Task Commits

1. **Task 1: Shared installment generator and cost center rateio validator** - `ea7e920` (feat — TDD: RED then GREEN)
2. **Task 2: Prisma schema and migrations for AP/AR models + CNAB fields** - `263879a` (feat)

## Files Created/Modified

- `packages/shared/src/utils/installments.ts` — `generateInstallments` and `validateCostCenterItems` with `CostCenterItemInput` and `Installment` interfaces
- `packages/shared/src/utils/__tests__/installments.spec.ts` — 18 tests covering rounding invariants, date arithmetic, and rateio validation
- `packages/shared/src/index.ts` — added exports for new utilities and interfaces
- `apps/backend/prisma/schema.prisma` — 6 new models, 6 enums, reverse relations on Organization/Farm/Producer/BankAccount/CostCenter, CNAB fields on BankAccount
- `apps/backend/prisma/migrations/20260401100000_add_payables_receivables/migration.sql` — all AP/AR tables, enums, indexes, foreign keys
- `apps/backend/prisma/migrations/20260401200000_bank_account_cnab_fields/migration.sql` — ALTER TABLE for 3 CNAB columns

## Decisions Made

- UTC date methods (`setUTCMonth`/`getUTCMonth`) in `generateInstallments` to prevent timezone-shift bug — `new Date('2025-01-01')` is UTC midnight, which becomes Dec 31 in negative-offset zones with local `setMonth`.
- PERCENTAGE tolerance set at 0.01 (not stricter) to handle floating-point near-100 sums without rejecting valid inputs like 99.999+0.001=100.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed date arithmetic to use UTC methods**

- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** `setMonth` with UTC midnight base date caused month shift in non-zero TZ offsets; tests for month increments failed
- **Fix:** Changed to `setUTCMonth(getUTCMonth() + i * freq)` and updated tests to use `getUTCMonth()`
- **Files modified:** `packages/shared/src/utils/installments.ts`, `packages/shared/src/utils/__tests__/installments.spec.ts`
- **Verification:** All 62 shared tests pass
- **Committed in:** ea7e920 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix for correct date arithmetic. No scope creep.

## Issues Encountered

None beyond the UTC date bug auto-fixed above.

## User Setup Required

None - no external service configuration required. Migrations were applied to the development database automatically.

## Next Phase Readiness

- All 6 Prisma models are available in the generated client and type-safe via tsc
- `generateInstallments` and `validateCostCenterItems` are exported from `@protos-farm/shared` and ready for use in payables/receivables backend services
- Phase 02 Plan 02 (payables backend) can proceed immediately

---

_Phase: 02-n-cleo-ap-ar_
_Completed: 2026-03-16_
