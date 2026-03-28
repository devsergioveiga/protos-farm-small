---
phase: 37-regras-e-lan-amentos-autom-ticos
plan: 01
subsystem: accounting
tags: [prisma, typescript, jest, express, double-entry, auto-posting, accounting-rules]

# Dependency graph
requires:
  - phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
    provides: JournalEntry model with posting engine, AccountingPeriod, AccountBalance, LedgerSide enum
  - phase: 35-plano-de-contas-e-per-odos-cont-beis
    provides: ChartOfAccount model, FiscalYear, AccountingPeriod
provides:
  - AccountingRule + AccountingRuleLine models (CRUD + seed)
  - PendingJournalPosting state machine (PENDING→PROCESSING→COMPLETED|ERROR)
  - AutoPostingSourceType enum (12 source types), PendingPostingStatus enum
  - AUTOMATIC added to JournalEntryType enum
  - sourceType/sourceId on JournalEntry with UNIQUE constraint (idempotency)
  - auto-posting service: process(), retry(), retryBatch(), listPending(),
    getPendingCounts(), listRules(), getRule(), updateRule(), previewRule(),
    seedAccountingRules(), EXTRACTORS map
  - REST API: 8 endpoints at /api/org/:orgId/auto-posting/
affects:
  - 37-02-PLAN: hook integration into payroll, depreciation, stock, payables/receivables
  - 37-03-PLAN: frontend UI for Regras e Lancamentos Automaticos tab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DataExtractor pattern: each AutoPostingSourceType has a dedicated async extractor"
    - "State machine pattern: PendingJournalPosting PENDING→PROCESSING→COMPLETED|ERROR"
    - "Idempotency via UNIQUE(sourceType, sourceId) on both JournalEntry and PendingJournalPosting"
    - "seedAccountingRules(): upsert pattern — safe to call multiple times"
    - "Route order: /pending/counts + /pending/retry-batch before /pending/:id (Express 5 param shadowing)"

key-files:
  created:
    - apps/backend/prisma/migrations/20260370100000_add_auto_posting_models/migration.sql
    - apps/backend/src/modules/auto-posting/auto-posting.types.ts
    - apps/backend/src/modules/auto-posting/auto-posting.service.ts
    - apps/backend/src/modules/auto-posting/auto-posting.service.spec.ts
    - apps/backend/src/modules/auto-posting/auto-posting.routes.ts
    - apps/backend/src/modules/auto-posting/auto-posting.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts

key-decisions:
  - "D-17: Idempotency enforced via UNIQUE(sourceType, sourceId) on both PendingJournalPosting and JournalEntry — calling process() twice returns silently"
  - "D-18: No active rule → silent return without creating PendingJournalPosting (not an error)"
  - "D-25: Closed period → update PendingJournalPosting to ERROR with 'Periodo contabil fechado' — no exception thrown, downstream can retry"
  - "prisma migrate diff + PGPASSWORD psql deploy pattern: shadow DB missing tables from earlier migrations, so we use diff from live DB to generate SQL, apply directly"
  - "EXTRACTORS map keyed on AutoPostingSourceType: each module's data extractor is co-located in the auto-posting service for simplicity (no cross-module imports)"

patterns-established:
  - "process(sourceType, sourceId, orgId): single entry point called by all module hooks in Phase 37-02"
  - "seedAccountingRules(orgId): must be called after COA is seeded (accounts are resolved by code prefix)"

requirements-completed: [LANC-01, LANC-02, LANC-06]

# Metrics
duration: 30min
completed: 2026-03-27
---

# Phase 37 Plan 01: Auto-Posting Engine Foundation Summary

**Auto-posting engine with AccountingRule CRUD, PendingJournalPosting state machine, 12-source-type EXTRACTORS map, and 8 REST endpoints — 23 unit tests passing**

## Performance

- **Duration:** 30 min
- **Started:** 2026-03-27T19:53:08Z
- **Completed:** 2026-03-27T20:23:00Z
- **Tasks:** 3 (Task 0 + Task 1 + Task 2)
- **Files modified:** 8

## Accomplishments

- Prisma schema extended with AutoPostingSourceType (12 values), PendingPostingStatus, AUTOMATIC journal entry type, and 3 new models (AccountingRule, AccountingRuleLine, PendingJournalPosting) with proper idempotency constraints
- Auto-posting service fully functional: process() enforces idempotency (D-17), silent no-op on missing rule (D-18), ERROR status on closed period (D-25), retry() for ERROR postings, retryBatch(), seedAccountingRules() for 12 default rules
- 8 REST endpoints mounted at /api/org/:orgId/auto-posting — ready for wiring by Phase 37-02 hooks and Phase 37-03 frontend

## Task Commits

1. **Task 0: Wave-0 stub tests** - `b68bff03` (test)
2. **Task 1: Schema + types + service + 8 tests** - `265df5c3` (feat)
3. **Task 2: Routes + 15 route tests** - `df5f84fd` (feat)

## Files Created/Modified

- `apps/backend/prisma/schema.prisma` - Added AutoPostingSourceType, PendingPostingStatus enums, AUTOMATIC to JournalEntryType, sourceType/sourceId + @@unique on JournalEntry, AccountingRule, AccountingRuleLine, PendingJournalPosting models
- `apps/backend/prisma/migrations/20260370100000_add_auto_posting_models/migration.sql` - Migration SQL applied directly to DB
- `apps/backend/src/modules/auto-posting/auto-posting.types.ts` - All interfaces + SOURCE_TYPE_LABELS
- `apps/backend/src/modules/auto-posting/auto-posting.service.ts` - Full service with EXTRACTORS map for all 12 source types
- `apps/backend/src/modules/auto-posting/auto-posting.service.spec.ts` - 8 unit tests (idempotency, no-rule, closed-period, retry, list, update, preview)
- `apps/backend/src/modules/auto-posting/auto-posting.routes.ts` - 8 REST endpoints
- `apps/backend/src/modules/auto-posting/auto-posting.routes.spec.ts` - 15 route tests
- `apps/backend/src/app.ts` - Mounted autoPostingRouter

## Decisions Made

- **prisma migrate diff → psql direct apply**: Shadow DB was missing tables from earlier migrations (same pattern as Phase 35). Used `prisma migrate diff --from-config-datasource --to-schema` to generate SQL, then `prisma migrate resolve --applied` + `PGPASSWORD psql -f migration.sql` to apply.
- **EXTRACTORS co-located in auto-posting service**: avoids cross-module import cycles. Each extractor queries its source table directly via prisma.
- **UNIQUE([sourceType, sourceId]) on PendingJournalPosting AND JournalEntry**: belt-and-suspenders idempotency per D-17/LANC-06. PendingJournalPosting prevents duplicate processing; JournalEntry prevents duplicate GL entries even if PendingJournalPosting constraint is bypassed.

## Deviations from Plan

None - plan executed exactly as specified. The prisma shadow DB workaround was documented in STATE.md from Phase 35 and applied as expected.

## Issues Encountered

- **Test: AutoPostingError instanceof check in route tests**: The mocked service module has a different `AutoPostingError` class than `jest.requireActual`. Fixed by using `service.AutoPostingError` (the mocked version) to construct test errors so `instanceof` check in the handler works correctly.

## Known Stubs

None — all extractors are fully implemented. seedAccountingRules() will produce empty rule lines if COA hasn't been seeded yet (silently skips), which is the correct behavior since seeding is a separate operation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Auto-posting engine is complete and ready for hook integration in Phase 37-02
- All 12 source types have extractors — hooks only need to call `process(sourceType, sourceId, orgId)`
- seedAccountingRules(orgId) should be called after COA seeding during org onboarding

## Self-Check: PASSED

All 7 key files found. All 3 task commits verified in git log.

---

_Phase: 37-regras-e-lan-amentos-autom-ticos_
_Completed: 2026-03-27_
