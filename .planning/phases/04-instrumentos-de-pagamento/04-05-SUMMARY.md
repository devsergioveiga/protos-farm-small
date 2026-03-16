---
phase: 04-instrumentos-de-pagamento
plan: 05
subsystem: payments
tags: [checks, state-machine, bank-accounts, financial-transactions, prisma, express]

# Dependency graph
requires:
  - phase: 04-instrumentos-de-pagamento
    provides: Check model + CheckType/CheckStatus enums in Prisma schema, BankAccountBalance, FinancialTransaction patterns

provides:
  - Checks CRUD API with EMITIDO/RECEBIDO types
  - State machine enforcing valid transitions with 422 on invalid attempts
  - Compensation flow creating FinancialTransaction and updating BankAccountBalance atomically
  - Re-presentation flow (DEVOLVIDO -> A_COMPENSAR)
  - Alert count endpoint for sidebar badge (A_COMPENSAR + DEVOLVIDO)
  - Accounting balance endpoint (pendingEmitidos, pendingRecebidos)

affects:
  - phase 05 (cash flow forecasting uses pending check data)
  - frontend sidebar badge integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VALID_TRANSITIONS map for explicit state machine definition
    - validateTransition helper throwing CheckError 422 on invalid state changes
    - Compensation uses withRlsContext transaction: create FinancialTransaction + increment/decrement BankAccountBalance atomically
    - Route ordering: static paths (/alert-count, /accounting-balance) registered before /:id

key-files:
  created:
    - apps/backend/src/modules/checks/checks.types.ts
    - apps/backend/src/modules/checks/checks.service.ts
    - apps/backend/src/modules/checks/checks.routes.ts
    - apps/backend/src/modules/checks/checks.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - "Route ordering: /alert-count and /accounting-balance registered before /:id to avoid Express param capture"
  - "compensateCheck uses single withRlsContext transaction for FinancialTransaction creation + BankAccountBalance update atomicity"
  - "EMITIDO check compensation = DEBIT (we paid); RECEBIDO check compensation = CREDIT (we received) — referenceType CHECK_COMPENSATION"

patterns-established:
  - "Pattern: VALID_TRANSITIONS map + validateTransition helper for state machines — reuse in future entities with status workflows"
  - "Pattern: Static sub-paths before /:id in route files — always register /alert-count, /summary, /export etc. first"

requirements-completed: [FN-09]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 4 Plan 05: Checks Module Summary

**Checks backend with 10-endpoint API, VALID_TRANSITIONS state machine enforcing 422 on invalid status changes, atomic compensation creating FinancialTransaction + updating BankAccountBalance, and 25-test suite covering full lifecycle**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T20:13:38Z
- **Completed:** 2026-03-16T20:18:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Full checks module: CRUD + 6 state transition endpoints
- Atomic compensation: FinancialTransaction (CHECK_COMPENSATION) + BankAccountBalance increment/decrement inside withRlsContext transaction
- 25 tests passing: state machine paths, re-presentation flow, invalid transition 422s, alert count, accounting balance

## Task Commits

Each task was committed atomically:

1. **Task 1: Checks types + service (CRUD + state machine + compensation)** - `1aa37e7` (feat)
2. **Task 2: Checks routes + app registration + tests** - `cba0159` (feat)

## Files Created/Modified

- `apps/backend/src/modules/checks/checks.types.ts` - CheckError, CreateCheckInput, CheckOutput, VALID_TRANSITIONS map
- `apps/backend/src/modules/checks/checks.service.ts` - Full CRUD + 6 state transition functions + getAlertCount + getAccountingBalanceData
- `apps/backend/src/modules/checks/checks.routes.ts` - 10 endpoints under /org/checks with input validation
- `apps/backend/src/modules/checks/checks.routes.spec.ts` - 25 tests covering full state machine lifecycle
- `apps/backend/src/app.ts` - Registered checksRouter

## Decisions Made

- Route ordering: `/alert-count` and `/accounting-balance` registered before `/:id` to avoid Express param capture — same pattern established in bank-accounts routes
- Compensation atomicity: single `withRlsContext` call creates FinancialTransaction AND updates BankAccountBalance together — mirrors pattern from bank-accounts and payables settlement
- EMITIDO compensation = DEBIT (we issued and paid); RECEBIDO compensation = CREDIT (we received payment) — referenceType `CHECK_COMPENSATION` distinguishes from other transaction types in statement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused import ESLint error in checks.routes.ts**
- **Found during:** Task 2 (route creation)
- **Issue:** `withRlsContext` imported but not directly used in routes (service handles RLS internally)
- **Fix:** Removed `withRlsContext` import from checks.routes.ts, kept only `RlsContext` type import
- **Files modified:** apps/backend/src/modules/checks/checks.routes.ts
- **Verification:** ESLint passes, pre-commit hook succeeds
- **Committed in:** cba0159 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed `toHaveBeenCalledOnce` unavailable in Jest version**
- **Found during:** Task 2 (test execution)
- **Issue:** Jest version in project does not support `toHaveBeenCalledOnce()` matcher
- **Fix:** Replaced with `toHaveBeenCalledTimes(1)` which is standard Jest
- **Files modified:** apps/backend/src/modules/checks/checks.routes.spec.ts
- **Verification:** All 25 tests pass
- **Committed in:** cba0159 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for compilation/tests. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `transfers.routes.ts` (string | string[] type mismatch) — out of scope, logged to deferred items

## Next Phase Readiness

- Checks API fully functional and tested
- Alert count endpoint ready for frontend sidebar badge integration
- Accounting balance endpoint ready for cash flow dashboard integration
- Phase 04 plan 06+ can build frontend check management UI

---
*Phase: 04-instrumentos-de-pagamento*
*Completed: 2026-03-16*

## Self-Check: PASSED

- checks.types.ts: FOUND
- checks.service.ts: FOUND
- checks.routes.ts: FOUND
- checks.routes.spec.ts: FOUND
- commit 1aa37e7: FOUND (git log confirmed)
- commit cba0159: FOUND (git log confirmed)
