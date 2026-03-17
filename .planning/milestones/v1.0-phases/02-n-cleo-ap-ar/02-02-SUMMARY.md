---
phase: 02-n-cleo-ap-ar
plan: 02
subsystem: backend
tags:
  [
    express,
    prisma,
    contas-a-pagar,
    parcelamento,
    rateio,
    settlement,
    bordero,
    estorno,
    recorrencia,
    financial-transactions,
  ]

requires:
  - phase: 02-n-cleo-ap-ar
    plan: 01
    provides: Payable, PayableInstallment, PayableCostCenterItem Prisma models; generateInstallments, validateCostCenterItems shared utilities; BankAccountBalance, FinancialTransaction integration points

provides:
  - payables.service.ts: createPayable, listPayables, getPayable, updatePayable, deletePayable, settlePayment, batchSettlePayments, reversePayment, generateRecurrence
  - payables.routes.ts: 9 endpoints under /org/payables (GET /, GET /:id, POST /, PUT /:id, DELETE /:id, POST /:id/settle, POST /batch-settle, POST /:id/reverse, POST /generate-recurrence)
  - payables.types.ts: PayableError, all input/output interfaces
  - 23 Jest tests covering all endpoints and scenarios

affects:
  - 02-03 (receivables symmetric to payables — same patterns)
  - 02-04 (aging view for CP — uses listPayables with date filters)
  - 02-05 (frontend PayablesPage — calls all these endpoints)

tech-stack:
  added: []
  patterns:
    - 'settlePayment: atomic Prisma tx — payable.update(PAID) + bankAccountBalance.update(decrement) + financialTransaction.create(DEBIT)'
    - 'batchSettlePayments: single Prisma tx for all items; cumulates totalEffective then single balance decrement; one FinancialTransaction with referenceType PAYABLE_BATCH'
    - 'reversePayment: atomic tx — payable.update(PENDING, clear settlement) + payableInstallment.updateMany(PENDING) + bankAccountBalance.update(increment) + financialTransaction.create(CREDIT, PAYABLE_REVERSAL)'
    - 'generateRecurrence: checks last child dueDate + frequency, only creates if nextDueDate <= now, copies costCenterItems from template'
    - 'Route ordering: batch-settle and generate-recurrence registered BEFORE /:id to prevent Express param capture'
    - 'deletePayable: soft delete via status=CANCELLED (not hard delete), PENDING only'
    - 'effectiveAmount = amount + interestAmount + fineAmount - discountAmount (Money arithmetic throughout)'

key-files:
  created:
    - apps/backend/src/modules/payables/payables.types.ts
    - apps/backend/src/modules/payables/payables.service.ts
    - apps/backend/src/modules/payables/payables.routes.ts
    - apps/backend/src/modules/payables/payables.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'effectiveAmount for settlement is amount + interest + fine - discount (gross payment including charges), not just face value — ensures bank balance reflects actual cash outflow'
  - 'batchSettlePayments creates one FinancialTransaction for entire batch (referenceType PAYABLE_BATCH) rather than per-payable transactions — simpler ledger, bordero is a single event'
  - 'reversePayment uses PAYABLE_REVERSAL referenceType (not PAYABLE) to distinguish estorno transactions in statement views'
  - 'generateRecurrence only generates when nextDueDate <= now — prevents pre-generating future CP; scheduler or manual trigger drives generation'

requirements-completed:
  - FN-07
  - FN-08

duration: 21min
completed: 2026-03-16
---

# Phase 02 Plan 02: Payables (CP) Backend Module Summary

**Payables backend with 9 endpoints covering CRUD, installment generation, cost center rateio, individual/batch settlement updating bank balance atomically, estorno, and recurrence generation — 23 tests passing**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-16T11:31:51Z
- **Completed:** 2026-03-16T11:52:31Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- `payables.types.ts` with `PayableError`, all input DTOs (`CreatePayableInput`, `UpdatePayableInput`, `SettlePaymentInput`, `BatchSettleInput`), query and output interfaces including paginated list
- `payables.service.ts` with 9 exported functions: `createPayable` validates rateio via `validateCostCenterItems`, generates installments via `generateInstallments` (first-installment residual from shared utility), creates Payable + PayableInstallment[] + PayableCostCenterItem[] in one Prisma transaction; `settlePayment` atomically updates payable status, decrements `BankAccountBalance.currentBalance` by effectiveAmount, creates `FinancialTransaction(DEBIT)`; `batchSettlePayments` wraps all settle operations in single transaction with cumulative balance decrement and single batch `FinancialTransaction`; `reversePayment` resets status to PENDING, re-opens installments, increments balance, creates CREDIT estorno transaction; `generateRecurrence` creates child payables from templates when nextDueDate is due
- `payables.routes.ts` with 9 endpoints under `/org/payables`; `batch-settle` and `generate-recurrence` registered before `/:id` to avoid Express param capture; all routes use `checkPermission('financial:*')`
- `app.ts` updated with `payablesRouter` registration
- 23 tests in `payables.routes.spec.ts` covering all endpoints, error cases, auth, installment residual assertion, batch all-or-nothing, and estorno

## Task Commits

1. **Task 1: Payables CRUD with installments, rateio, and recurrence** - `8032fdc`

## Files Created/Modified

- `apps/backend/src/modules/payables/payables.types.ts` — PayableError, input/output interfaces, PAYABLE_CATEGORY_LABELS
- `apps/backend/src/modules/payables/payables.service.ts` — 9 service functions with atomic Prisma transactions
- `apps/backend/src/modules/payables/payables.routes.ts` — Express router, 9 endpoints, proper route ordering
- `apps/backend/src/modules/payables/payables.routes.spec.ts` — 23 tests (mocked service + real Express app)
- `apps/backend/src/app.ts` — payablesRouter registration added

## Decisions Made

- `effectiveAmount = amount + interest + fine - discount` for bank balance update — represents actual cash outflow including charges, not just the face value of the CP
- Batch settle creates one `FinancialTransaction` with `referenceType='PAYABLE_BATCH'` for the whole bordero, cumulating total effective into single balance decrement — simpler ledger, bordero is semantically one event
- `reversePayment` uses `referenceType='PAYABLE_REVERSAL'` (distinct from `'PAYABLE'`) — allows statement views to distinguish estornos from payments
- `generateRecurrence` only generates when `nextDueDate <= now` — prevents future CP pre-generation; requires scheduled job or manual POST call to trigger

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing lint errors in receivables.routes.ts**

- **Found during:** Task 1 (commit hook)
- **Issue:** `receivables.routes.ts` had two `as any` type casts (lines 87-88) that ESLint ESLint caught during pre-commit. The receivables module was already staged from a prior session.
- **Fix:** ESLint auto-fixed the `as any` casts to proper type assertions (`as ListReceivablesQuery['status']` and `as ListReceivablesQuery['category']`)
- **Files modified:** `apps/backend/src/modules/receivables/receivables.routes.ts`
- **Committed in:** 8032fdc (same commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking)
**Impact on plan:** No scope change. Fix was one-line auto-resolution.

## Issues Encountered

None beyond the receivables lint fix.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 9 payable endpoints are registered and tested; `tsc --noEmit` clean
- `settlePayment` and `reversePayment` atomically maintain `BankAccountBalance` — Phase 2 Plan 03 (receivables) can use the same pattern
- Receivables module was already partially present; lint was fixed as part of this plan

---

_Phase: 02-n-cleo-ap-ar_
_Completed: 2026-03-16_

## Self-Check: PASSED

- payables.types.ts — FOUND
- payables.service.ts — FOUND
- payables.routes.ts — FOUND
- payables.routes.spec.ts — FOUND
- 02-02-SUMMARY.md — FOUND
- Commit 8032fdc — FOUND (verified via `git log --oneline -5`)
