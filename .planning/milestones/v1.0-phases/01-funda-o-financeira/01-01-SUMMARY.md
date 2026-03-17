---
phase: 01-funda-o-financeira
plan: 01
subsystem: database
tags: [decimal.js, money, prisma, febraban, bank-accounts, financial]

# Dependency graph
requires: []
provides:
  - Money class (decimal.js-backed) with ROUND_HALF_UP, toBRL(), fromPrismaDecimal()
  - FEBRABAN_BANKS constant (40+ banks) and FEBRABAN_BANK_MAP lookup
  - Prisma models: BankAccount, BankAccountFarm, BankAccountBalance, FinancialTransaction
  - BankAccountType enum (CHECKING, SAVINGS, INVESTMENT, RURAL_CREDIT)
  - Migration 20260378100000_add_bank_accounts applied
affects:
  - All subsequent financial plans (use Money type for arithmetic)
  - Plan 01-02 (bank account CRUD service will build on these models)
  - Plan 01-03 onwards (all monetary calculations depend on Money class)

# Tech tracking
tech-stack:
  added:
    - decimal.js (packages/shared + apps/backend)
  patterns:
    - Money factory function pattern (callable without `new`, carries static methods)
    - BankAccountBalance aggregate (mirrors existing StockBalance pattern)
    - FEBRABAN_BANK_MAP = new Map(list.map(b => [b.code, b])) for O(1) lookup

key-files:
  created:
    - packages/shared/src/types/money.ts
    - packages/shared/src/types/__tests__/money.spec.ts
    - packages/shared/src/constants/febraban-banks.ts
    - packages/shared/src/constants/__tests__/febraban-banks.spec.ts
    - apps/backend/prisma/migrations/20260378100000_add_bank_accounts/migration.sql
  modified:
    - packages/shared/package.json (decimal.js added)
    - packages/shared/src/index.ts (Money, IMoney, MoneyFactory, FEBRABAN_* exported)
    - apps/backend/package.json (decimal.js added)
    - apps/backend/prisma/schema.prisma (4 new models, 1 enum, reverse relations)

key-decisions:
  - 'Money implemented as factory function (not class with new) so Money(100) syntax works in tests and production code'
  - 'BankAccount.producerId is nullable — org-level accounts have no producer, rural producer accounts have FK'
  - 'BankAccountFarm junction table enables N:N — one account can be linked to multiple fazendas'
  - 'FinancialTransaction uses String type field for credit/debit — avoids enum coupling to early schema'
  - 'Migration created manually (db push + migrate resolve) because shadow database has stale cultivar issue'

patterns-established:
  - 'Money factory: moneyFactory(value) delegates to MoneyImpl internally, static methods attached to factory'
  - 'Prisma aggregate pattern: BankAccountBalance mirrors StockBalance (unique FK, currentBalance field)'
  - 'FEBRABAN deduplication: splice-in-place after filter to keep FEBRABAN_BANKS array reference stable'

requirements-completed:
  - FN-01

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 1 Plan 01: Financial Foundation Summary

**Money class (decimal.js, ROUND_HALF_UP) + 40-bank FEBRABAN list + Prisma BankAccount/BankAccountFarm/BankAccountBalance/FinancialTransaction schema with migration applied**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T00:04:09Z
- **Completed:** 2026-03-16T00:10:47Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Money class with safe decimal arithmetic (0.1 + 0.2 = 0.3), immutable operations, ROUND_HALF_UP, and pt-BR currency formatting
- FEBRABAN_BANKS with 40 entries (BB, Bradesco, Itaú, Caixa, Sicoob, Sicredi, Nubank, Inter, C6, PagBank and more) with O(1) lookup map
- Prisma schema with 4 new models and enum, all with proper indexes and FK constraints, migration applied and Prisma client generated

## Task Commits

Each task was committed atomically:

1. **Task 1: Money type and FEBRABAN bank list** - `d8b2ead` (feat)
2. **Task 2: Prisma schema and migration for bank accounts** - `8b20eea` (feat)

## Files Created/Modified

- `packages/shared/src/types/money.ts` - Money factory function wrapping decimal.js, immutable arithmetic, toBRL(), fromPrismaDecimal()
- `packages/shared/src/types/__tests__/money.spec.ts` - 24 tests covering float safety, formatting, comparison, statics
- `packages/shared/src/constants/febraban-banks.ts` - 40+ FEBRABAN banks, FebrabanBank interface, FEBRABAN_BANK_MAP
- `packages/shared/src/constants/__tests__/febraban-banks.spec.ts` - 9 tests covering count, codes, lookup, deduplication
- `packages/shared/src/index.ts` - Exports Money, IMoney, MoneyFactory, FEBRABAN_BANKS, FEBRABAN_BANK_MAP, FebrabanBank
- `packages/shared/package.json` - Added decimal.js dependency
- `apps/backend/package.json` - Added decimal.js dependency
- `apps/backend/prisma/schema.prisma` - BankAccountType enum, BankAccount, BankAccountFarm, BankAccountBalance, FinancialTransaction; reverse relations on Organization/Farm/Producer
- `apps/backend/prisma/migrations/20260378100000_add_bank_accounts/migration.sql` - DDL for all 4 tables, indexes, FKs

## Decisions Made

- Money implemented as a factory function (not class) so `Money(100)` works without `new`. Internal `MoneyImpl` class handles all arithmetic.
- BankAccount.producerId is nullable (String?) per the architectural decision — org-level accounts have no producer FK, rural producer accounts point to a specific producer.
- FinancialTransaction.type is `String` (not an enum) to avoid tight coupling in the early schema — values will be validated at service layer.
- Migration created manually via `db push` + `migrate resolve --applied` because the shadow database has a stale cultivar table issue (pre-existing, not caused by this plan).

## Deviations from Plan

None - plan executed exactly as written. The shadow database issue with `migrate dev` required using `db push` + `migrate resolve` as a workaround, but this is a pre-existing infrastructure issue unrelated to the plan's scope.

## Issues Encountered

- `prisma migrate dev` failed due to shadow database having a stale `cultivars` table reference from an old migration. Resolved by using `db push` (which applied changes to main DB) followed by `migrate resolve --applied` to register the migration in the `_prisma_migrations` table. The migration SQL file was created manually matching what Prisma would have generated.

## User Setup Required

None - no external service configuration required. Database was already running.

## Next Phase Readiness

- Money class importable from `@protos-farm/shared` for all financial calculations
- FEBRABAN_BANK_MAP available for bank selection UIs and validation
- BankAccount, BankAccountFarm, BankAccountBalance, FinancialTransaction Prisma types available from `@prisma/client`
- Ready for Plan 01-02: Bank account CRUD service (create, list, activate/deactivate, link to farms)

---

_Phase: 01-funda-o-financeira_
_Completed: 2026-03-16_
