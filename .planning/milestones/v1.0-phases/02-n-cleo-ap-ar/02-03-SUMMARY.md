---
phase: 02-n-cleo-ap-ar
plan: 03
subsystem: payments
tags:
  [
    receivables,
    contas-a-receber,
    funrural,
    aging,
    installments,
    rateio,
    bank-accounts,
    financial-transactions,
    prisma,
    express,
  ]

# Dependency graph
requires:
  - phase: 02-n-cleo-ap-ar
    plan: 01
    provides: Prisma schema (Receivable, ReceivableInstallment, ReceivableCostCenterItem models), generateInstallments, validateCostCenterItems shared utilities
  - phase: 01-funda-o-financeira
    provides: BankAccountBalance, FinancialTransaction models, bankAccountsRouter pattern, withRlsContext pattern

provides:
  - Receivables (CR) backend module with 10 endpoints under /org/receivables
  - FUNRURAL rate and amount stored at creation time (not computed at runtime)
  - Settlement atomically credits BankAccountBalance + creates CREDIT FinancialTransaction
  - Estorno atomically decrements BankAccountBalance + creates DEBIT FinancialTransaction
  - Renegotiation workflow: original marked RENEGOTIATED, new CR created with new due date and optional new amount
  - Aging report with 7 buckets (overdue, 7d, 15d, 30d, 60d, 90d, >90d) + drill-down by bucket
  - 30 Jest tests covering all endpoints, FUNRURAL, NF-e validation, installments, rateio, settlement, estorno, renegotiation, aging

affects:
  - 02-04 (bank-accounts frontend, will show AR credits)
  - 02-06 (cash flow, consumes AR data for forecasting)
  - frontend CR screens (future)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Symmetric to payables: same withRlsContext, same Money.fromPrismaDecimal, same route ordering (aging before /:id)
    - FUNRURAL stored at creation time as decimal on Receivable row — never computed at runtime
    - Settlement = INCREMENT BankAccountBalance (opposite of payables DECREMENT)
    - Renegotiation creates new CR preserving FUNRURAL recalculation from original rate

key-files:
  created:
    - apps/backend/src/modules/receivables/receivables.types.ts
    - apps/backend/src/modules/receivables/receivables.service.ts
    - apps/backend/src/modules/receivables/receivables.routes.ts
    - apps/backend/src/modules/receivables/receivables.routes.spec.ts
  modified:
    - apps/backend/src/app.ts (receivablesRouter registered — done in prior commit)

key-decisions:
  - 'Receivables module files (types/service/routes) were committed in prior payables commit (8032fdc) — only spec was missing'
  - 'Aging computed application-side (JS bucketing) matching payables pattern — not raw SQL; acceptable for current data volumes'
  - 'FUNRURAL recalculated in renegotiation from original funruralRate field, preserving the stored-at-creation invariant'

patterns-established:
  - 'CR settlement = bank balance INCREMENT (CREDIT) vs CP settlement = bank balance DECREMENT (DEBIT)'
  - 'Route ordering: /aging and /aging/:bucket registered BEFORE /:id to avoid Express param capture'
  - 'Spec fixtures typed with explicit ReceivableOutput/ReceivableInstallmentOutput/ReceivableCostCenterItemOutput to satisfy strict TSC'

requirements-completed: [FN-11, FN-12]

# Metrics
duration: 20min
completed: 2026-03-16
---

# Phase 02 Plan 03: Receivables (CR) Backend Module Summary

**Complete Contas a Receber backend with FUNRURAL stored at creation, atomic settlement crediting bank balance, renegotiation workflow, and 7-bucket aging report — 10 endpoints, 30 tests**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-16T14:09:21Z
- **Completed:** 2026-03-16T14:29:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Verified and completed receivables module (types + service + routes) committed by prior agent in payables commit (8032fdc)
- Created `receivables.routes.spec.ts` with 30 Jest tests covering all 10 endpoints
- TypeScript strict-mode compliance: all fixtures explicitly typed with `ReceivableOutput`, `ReceivableInstallmentOutput`, `ReceivableCostCenterItemOutput`, `AgingResponse`
- Fixed ESLint `no-explicit-any` violation in spec before commit (pre-commit hook caught it)

## Task Commits

Each task was committed atomically:

1. **Task 1: Receivables CRUD module** — `8032fdc` (feat — committed by prior agent in payables commit)
2. **Task 2: Receivables tests and aging** — `bbe9686` (test)

**Plan metadata:** TBD (docs commit below)

## Files Created/Modified

- `apps/backend/src/modules/receivables/receivables.types.ts` — ReceivableError, CreateReceivableInput, SettleReceivableInput, RenegotiateInput, ListReceivablesQuery, ReceivableOutput, ReceivableInstallmentOutput, ReceivableCostCenterItemOutput, AgingBucket, AgingBucketResult, AgingResponse
- `apps/backend/src/modules/receivables/receivables.service.ts` — 10 functions: createReceivable, listReceivables, getReceivable, updateReceivable, deleteReceivable, settleReceivable (INCREMENT bank balance), reverseReceivable (DECREMENT bank balance), renegotiateReceivable (RENEGOTIATED + new CR), getReceivablesAging (7 buckets), getReceivablesByBucket (drill-down)
- `apps/backend/src/modules/receivables/receivables.routes.ts` — 10 endpoints with financial:\* RBAC; aging routes ordered before /:id
- `apps/backend/src/modules/receivables/receivables.routes.spec.ts` — 30 Jest tests, all passing
- `apps/backend/src/app.ts` — receivablesRouter registered (in prior commit)

## Decisions Made

- Receivables module files (types/service/routes) were committed in the prior payables commit (8032fdc) — only `receivables.routes.spec.ts` was missing and needed to be created
- Aging is computed application-side via JS date bucketing (not raw SQL), matching the payables aging pattern — acceptable for current data volumes
- FUNRURAL amount is recalculated in renegotiation using the original `funruralRate` field from the source CR, preserving the "stored at creation" invariant for the new CR

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] TypeScript strict typing for spec fixtures**

- **Found during:** Task 2 (test creation)
- **Issue:** Spread-based fixtures inferred as `string` for union types (`ReceivableCategory`, `ReceivableStatus`, `AgingBucket`), causing TSC errors
- **Fix:** Added explicit TypeScript annotations (`ReceivableOutput`, `ReceivableInstallmentOutput`, `ReceivableCostCenterItemOutput`, `AgingResponse`) to all fixtures
- **Files modified:** receivables.routes.spec.ts
- **Verification:** `tsc --noEmit` passes cleanly
- **Committed in:** bbe9686

**2. [Rule 2 - Missing Critical] Fixed ESLint no-explicit-any in spec**

- **Found during:** Task 2 (pre-commit hook failure)
- **Issue:** `(b: any)` in aging bucket find call blocked commit via Husky pre-commit hook
- **Fix:** Replaced with explicit `{ bucket: string; count: number }[]` cast
- **Files modified:** receivables.routes.spec.ts
- **Verification:** `eslint --fix` passes, commit succeeded
- **Committed in:** bbe9686

---

**Total deviations:** 2 auto-fixed (both TypeScript/ESLint compliance)
**Impact on plan:** Both essential for code quality. No scope creep.

## Issues Encountered

- Prior agent had committed receivables.types.ts, receivables.service.ts, and receivables.routes.ts inside the payables commit (8032fdc) — noted in the objective. Verified content matched plan requirements. Only the test file was missing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CR module fully tested and registered in app.ts
- Ready for 02-04 (bank accounts frontend) to integrate CR settlement display
- Ready for 02-06 (cash flow) to consume AR aging data
- FUNRURAL stored correctly for fiscal reporting

---

_Phase: 02-n-cleo-ap-ar_
_Completed: 2026-03-16_
