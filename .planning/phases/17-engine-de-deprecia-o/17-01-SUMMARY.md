---
phase: 17-engine-de-deprecia-o
plan: '01'
subsystem: database
tags: [prisma, depreciation, decimal.js, arithmetic, tdd, migration]

requires:
  - phase: 16-cadastro-de-ativos/16-01
    provides: Asset model with AssetType, AssetClassification, AssetStatus enums and CostCenter relation

provides:
  - 'DepreciationConfig, DepreciationEntry, DepreciationRun, DepreciationEntryCCItem Prisma models'
  - 'DepreciationMethod and DepreciationTrack enums in schema'
  - 'Migration 20260420100000_add_depreciation_models applied'
  - 'depreciation-engine.service.ts: pure arithmetic with daysInMonth, getProRataDays, computeDepreciation'
  - 'depreciation.types.ts: EngineInput, EngineOutput, DepreciationError, DEFAULT_RFB_RATES, DepreciationReportQuery'
  - '21 passing unit tests covering all 4 depreciation methods, pro-rata-die, residual clamping'

affects:
  - 17-engine-de-deprecia-o/17-02
  - 17-engine-de-deprecia-o/17-03

tech-stack:
  added: []
  patterns:
    - 'Pure arithmetic service pattern: no Prisma imports in engine service — all computation is side-effect free'
    - 'UTC-safe date comparison: use getUTCFullYear/getUTCMonth/getUTCDate instead of local getDate() for dates sourced from Prisma DateTime fields (UTC midnight)'
    - 'Decimal.set({ rounding: Decimal.ROUND_HALF_UP }) at module level — all monetary rounding uses ROUND_HALF_UP throughout the module'
    - 'Residual value clamping before residual check — if remaining <= 0, skip before computing monthly amount'

key-files:
  created:
    - apps/backend/prisma/migrations/20260420100000_add_depreciation_models/migration.sql
    - apps/backend/src/modules/depreciation/depreciation.types.ts
    - apps/backend/src/modules/depreciation/depreciation-engine.service.ts
    - apps/backend/src/modules/depreciation/depreciation-engine.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma

key-decisions:
  - 'UTC-safe date extraction in getProRataDays: new Date(ISO string) creates UTC midnight; comparing with getDate() (local) caused off-by-one in non-UTC timezones. Fix: use getUTCDate/getUTCMonth/getUTCFullYear'
  - 'HOURS_OF_USE and UNITS_OF_PRODUCTION skip pro-rata-die: these methods are driven by actual usage, not calendar days — no time-based pro-rata applied'
  - 'ACCELERATED uses openingBookValue * rate * factor / 12 (not depreciableValue): reflects double-declining balance convention on book value, not acquisition cost'
  - 'DepreciationReportQuery includes optional assetId: supports per-asset filtering for the AssetDrawer tab in Plan 17-03'

patterns-established:
  - 'Engine returns EngineOutput with skipped=true + skipReason instead of throwing for graceful batch processing'
  - 'Fiscal/managerial dual-track: engine reads config.track to select the correct rate (fiscal vs managerial annual rate)'

requirements-completed: [DEPR-01, DEPR-02]

duration: 7min
completed: 2026-03-20
---

# Phase 17 Plan 01: Depreciation Engine Summary

**4 Prisma depreciation models with migration applied, pure arithmetic engine supporting 4 methods (STRAIGHT_LINE, ACCELERATED, HOURS_OF_USE, UNITS_OF_PRODUCTION) with pro-rata-die and residual clamping, validated by 21 unit tests**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-20T08:44:36Z
- **Completed:** 2026-03-20T08:51:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added 4 Prisma models (DepreciationConfig, DepreciationEntry, DepreciationRun, DepreciationEntryCCItem) with correct unique constraints and indexes
- Created and applied migration `20260420100000_add_depreciation_models`, regenerated Prisma client
- Implemented pure arithmetic depreciation engine (`depreciation-engine.service.ts`) — zero database dependencies
- All 4 depreciation methods implemented with residual value clamping and pro-rata-die adjustment
- 21 unit tests replacing Wave 0 `it.todo` stubs — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema — 4 new models, 2 new enums, migration** - `65d1fca6` (feat)
2. **Task 2: Types + depreciation engine service + unit tests** - `7dc70e3a` (feat)

## Files Created/Modified

- `apps/backend/prisma/schema.prisma` - Added DepreciationMethod, DepreciationTrack enums; 4 models; reverse relations on Asset, Organization, CostCenter
- `apps/backend/prisma/migrations/20260420100000_add_depreciation_models/migration.sql` - DDL for all 4 tables with FKs, indexes, unique constraints
- `apps/backend/src/modules/depreciation/depreciation.types.ts` - EngineInput, EngineOutput, DepreciationError, CreateDepreciationConfigInput, RunDepreciationInput, DepreciationReportQuery (with assetId), DEFAULT_RFB_RATES, RlsContext
- `apps/backend/src/modules/depreciation/depreciation-engine.service.ts` - daysInMonth, getProRataDays (UTC-safe), computeDepreciation
- `apps/backend/src/modules/depreciation/depreciation-engine.spec.ts` - 21 tests for all methods, pro-rata, residual clamping

## Decisions Made

- **UTC-safe date extraction** — `new Date('2025-01-15')` creates UTC midnight; using `getDate()` in non-UTC timezone gives wrong day. Fixed by using `getUTCDate/getUTCMonth/getUTCFullYear` throughout `getProRataDays`.
- **HOURS_OF_USE/UNITS_OF_PRODUCTION skip pro-rata** — usage-based methods are driven by actual periodic consumption, not calendar days.
- **ACCELERATED uses openingBookValue, not depreciableValue** — matches double-declining balance convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UTC timezone off-by-one in getProRataDays date comparisons**

- **Found during:** Task 2 (GREEN phase unit test run)
- **Issue:** `new Date('2025-01-15')` creates UTC midnight; `getDate()` in local timezone (e.g. UTC-5) returns Jan 14, causing off-by-one in pro-rata day count (returned 18 instead of 17 for Jan 15 acquisition)
- **Fix:** Added `toCalendarDate()` helper using `getUTCFullYear/getUTCMonth/getUTCDate` for consistent UTC-based calendar date extraction
- **Files modified:** `apps/backend/src/modules/depreciation/depreciation-engine.service.ts`
- **Verification:** All 21 tests pass including pro-rata tests
- **Committed in:** `7dc70e3a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Critical correctness fix — without it, pro-rata calculation would be wrong in non-UTC timezones. No scope creep.

## Issues Encountered

- `prisma migrate deploy` requires datasource URL but schema.prisma has no `url` property — project uses `prisma.config.ts` with `defineConfig`. Fixed by running from `apps/backend/` with `--config prisma.config.ts`.

## Next Phase Readiness

- Schema and engine ready for Plan 17-02 (batch runner service)
- `computeDepreciation` is the stable API: takes `EngineInput`, returns `EngineOutput` — no changes anticipated
- `DepreciationReportQuery.assetId` field added proactively for Plan 17-03 AssetDrawer tab

## Self-Check: PASSED

- migration.sql: FOUND
- depreciation.types.ts: FOUND
- depreciation-engine.service.ts: FOUND
- depreciation-engine.spec.ts: FOUND
- SUMMARY.md: FOUND
- Commit 65d1fca6 (Task 1): FOUND in git log
- Commit 7dc70e3a (Task 2): FOUND in git log

---

_Phase: 17-engine-de-deprecia-o_
_Completed: 2026-03-20_
