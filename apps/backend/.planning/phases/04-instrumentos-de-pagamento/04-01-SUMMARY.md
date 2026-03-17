---
phase: 04-instrumentos-de-pagamento
plan: 01
subsystem: payments
tags: [prisma, migrations, transfers, double-entry-ledger, bank-accounts, credit-cards, checks]

# Dependency graph
requires:
  - phase: 01-fundacao-financeira
    provides: BankAccount, BankAccountBalance, FinancialTransaction models and atomic balance update patterns
  - phase: 02-nucleo-ap-ar
    provides: Payable model with PayableCategory enum, withRlsContext pattern

provides:
  - AccountTransfer model with fromAccount/toAccount relations and mirrored FinancialTransaction pattern
  - CreditCard, CreditCardBill, CreditCardExpense models for Phase 4 plans 02+
  - Check model with state machine fields for Phase 4 plan 03
  - CARTAO_CREDITO PayableCategory enum value for bill closing in plan 02
  - transfers backend module: POST/GET/DELETE /org/transfers with atomic double-entry bookkeeping
  - TransferType enum (INTERNA, TED, APLICACAO, RESGATE)

affects: [04-02-credit-cards, 04-03-checks, 04-04-dashboard-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Double-entry ledger via createMany FinancialTransactions (DEBIT origin + CREDIT destination) in single withRlsContext transaction'
    - 'Atomic balance update via Prisma increment/decrement (never read-modify-write)'
    - 'Permission actions are create/read/update/delete — not write; mutations use financial:create, deletes use financial:delete'
    - 'Shadow DB issue on migrate dev: use db push + migrate resolve with manual migration folder'

key-files:
  created:
    - apps/backend/src/modules/transfers/transfers.types.ts
    - apps/backend/src/modules/transfers/transfers.service.ts
    - apps/backend/src/modules/transfers/transfers.routes.ts
    - apps/backend/src/modules/transfers/transfers.routes.spec.ts
    - apps/backend/prisma/migrations/20260402100000_add_payment_instruments/migration.sql
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/payables/payables.types.ts
    - apps/backend/src/app.ts

key-decisions:
  - 'Permission actions are create/read/update/delete (not write) — TransferError route uses financial:create for POST, financial:delete for DELETE, financial:read for GET'
  - 'Migration applied via db push + migrate resolve due to shadow database stale cultivar issue (established pattern from Phase 1)'
  - 'TRANSFER_FEE as separate referenceType from TRANSFER — enables filtering fee transactions from principal ledger entries'
  - 'deleteTransfer reverses balance atomically and removes FinancialTransactions — preserves BankAccountBalance integrity'

patterns-established:
  - 'Double-entry ledger pattern: createMany with [DEBIT on fromAccount, CREDIT on toAccount] + two BankAccountBalance updates in single withRlsContext'
  - 'Fee pattern: optional 3rd FinancialTransaction with referenceType TRANSFER_FEE + additional balance decrement on fromAccount'
  - 'Transfer deletion: reverse all balance changes + deleteMany FinancialTransactions by referenceId'

requirements-completed: [FN-04]

# Metrics
duration: 10min
completed: 2026-03-16
---

# Phase 04 Plan 01: Payment Instruments Schema + Transfers Backend Summary

**Prisma schema with AccountTransfer, CreditCard, CreditCardBill, CreditCardExpense, Check models plus transfers REST API with atomic double-entry ledger entries and fee support**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-16T23:00:06Z
- **Completed:** 2026-03-16T23:10:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- All Phase 4 Prisma models added in single migration: AccountTransfer, CreditCard, CreditCardBill, CreditCardExpense, Check + 5 new enums (TransferType, CardBrand, BillStatus, CheckType, CheckStatus) + CARTAO_CREDITO in PayableCategory
- Full transfers backend module: CRUD endpoints, mirrored DEBIT/CREDIT FinancialTransactions, atomic BankAccountBalance updates, optional fee creates 3rd transaction, same-account validation, balance reversal on delete
- 11 tests pass covering all behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema migration** - `07bb6c7` (feat)
2. **Task 2: RED - failing tests** - `aed2d9e` (test)
3. **Task 2: GREEN - transfers module** - `3e5d09b` (feat)

**Plan metadata:** TBD (docs commit)

_Note: TDD task has separate test (RED) and implementation (GREEN) commits_

## Files Created/Modified

- `apps/backend/prisma/schema.prisma` - Added 5 enums + 5 new models + reverse relations to Organization, BankAccount, Farm, Payable
- `apps/backend/prisma/migrations/20260402100000_add_payment_instruments/migration.sql` - Placeholder (schema applied via db push)
- `apps/backend/src/modules/payables/payables.types.ts` - Added CARTAO_CREDITO to PAYABLE_CATEGORY_LABELS
- `apps/backend/src/modules/transfers/transfers.types.ts` - TransferError, CreateTransferInput, ListTransfersQuery, TransferOutput, TRANSFER_TYPE_LABELS
- `apps/backend/src/modules/transfers/transfers.service.ts` - createTransfer, listTransfers, getTransfer, deleteTransfer
- `apps/backend/src/modules/transfers/transfers.routes.ts` - REST endpoints under /api/org/transfers
- `apps/backend/src/modules/transfers/transfers.routes.spec.ts` - 11 tests covering all behaviors
- `apps/backend/src/app.ts` - Registered transfersRouter

## Decisions Made

- `financial:create` for POST, `financial:delete` for DELETE, `financial:read` for GET — permission action vocabulary is create/read/update/delete (no write)
- Migration via `db push` + `migrate resolve` due to persistent shadow DB issue with stale cultivar migration (same pattern used in Phase 1)
- TRANSFER and TRANSFER_FEE as separate referenceTypes — cleaner filtering in statements and dashboard queries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong permission action key**

- **Found during:** Task 2 (transfers routes + tests)
- **Issue:** Routes used `financial:write` which doesn't exist; permission actions are create/read/update/delete only
- **Fix:** Changed POST/DELETE to `financial:create` and `financial:delete` respectively
- **Files modified:** apps/backend/src/modules/transfers/transfers.routes.ts
- **Verification:** 6 previously failing tests now pass
- **Committed in:** 3e5d09b (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Permission key fix was required for tests to pass. No scope creep.

## Issues Encountered

- Shadow DB issue with `prisma migrate dev` — resolved via established db push + migrate resolve pattern (same as Phase 1)

## Next Phase Readiness

- All Phase 4 Prisma models exist and are generated in the client — plans 02 (credit cards), 03 (checks), and 04 (dashboard) can proceed
- AccountTransfer + FinancialTransaction + BankAccountBalance integration pattern established and verified
- CARTAO_CREDITO enum value ready for plan 02 bill closing

---

_Phase: 04-instrumentos-de-pagamento_
_Completed: 2026-03-16_
