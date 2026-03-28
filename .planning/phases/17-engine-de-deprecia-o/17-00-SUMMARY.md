---
phase: 17-engine-de-deprecia-o
plan: '00'
subsystem: depreciation
tags: [tdd, wave-0, test-stubs, depreciation]
dependency_graph:
  requires: []
  provides: [depreciation-engine.spec.ts, depreciation-batch.spec.ts, depreciation.routes.spec.ts]
  affects: []
tech_stack:
  added: []
  patterns: [TDD Wave 0 — it.todo stubs define behavioral contract before implementation]
key_files:
  created:
    - apps/backend/src/modules/depreciation/depreciation-engine.spec.ts
    - apps/backend/src/modules/depreciation/depreciation-batch.spec.ts
    - apps/backend/src/modules/depreciation/depreciation.routes.spec.ts
  modified: []
decisions:
  - "it.todo() stubs chosen over it('...', () => { expect(true).toBe(false) }) — Jest reports todo items distinctly, making Wave 0 intent explicit without false 'failing' noise"
metrics:
  duration: 86s
  completed_date: '2026-03-20'
  tasks_completed: 1
  tasks_total: 1
  files_created: 3
  files_modified: 0
---

# Phase 17 Plan 00: Depreciation Module — Wave 0 TDD Stubs Summary

**One-liner:** Three spec files with 49 `it.todo()` stubs defining the full behavioral contract for depreciation engine arithmetic, batch processor, and API routes before any implementation begins.

## Tasks Completed

| #   | Task                                             | Commit   | Files                                                                                |
| --- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| 1   | Create Wave 0 test stubs for depreciation module | 60306e8c | depreciation-engine.spec.ts, depreciation-batch.spec.ts, depreciation.routes.spec.ts |

## What Was Built

### depreciation-engine.spec.ts (12 stubs)

Covers three pure-function groups:

- `daysInMonth` — leap year, February, 31-day, 30-day months
- `getProRataDays` — full month, mid-month acquisition, disposal scenarios
- `computeDepreciation` — STRAIGHT_LINE (rate and usefulLifeMonths), pro-rata, residual clamping, fully-depreciated skip, ACCELERATED, HOURS_OF_USE (with/without periodicHours), UNITS_OF_PRODUCTION skip

### depreciation-batch.spec.ts (14 stubs)

Covers two service-level behaviors:

- `runDepreciationBatch` — eligible asset filtering, EM_ANDAMENTO skip, missing config skip, P2002 idempotency, DepreciationRun creation, CC item creation, reconciliation, duplicate rejection, force re-run, multi-org query
- `reverseEntry` — negative amount reversal, reversedAt marking, double-reversal rejection, CC item cleanup

### depreciation.routes.spec.ts (23 stubs)

Covers all API endpoints under `/api/org/:orgId/depreciation`:

- Config CRUD (POST, GET, PATCH, DELETE)
- Batch trigger POST /run (202, 409, force re-run)
- Entry reversal POST /entries/:entryId/reverse
- Report GET /report (pagination, empty state, assetId filter)
- Last run GET /last-run
- Export GET /report/export (CSV, XLSX)

## Verification

```
PASS src/modules/depreciation/depreciation-engine.spec.ts
PASS src/modules/depreciation/depreciation.routes.spec.ts
PASS src/modules/depreciation/depreciation-batch.spec.ts

Test Suites: 3 passed, 3 total
Tests:       49 todo, 49 total
Time:        0.45 s
```

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

- **it.todo() vs failing stubs**: Used `it.todo()` (not `it('...', () => { expect(true).toBe(false) })`). Jest treats `it.todo` as a distinct status — clearly communicates Wave 0 intent, not a broken test. Plans 01 and 02 will replace these with real implementations.

## Self-Check: PASSED

Files created:

- FOUND: apps/backend/src/modules/depreciation/depreciation-engine.spec.ts
- FOUND: apps/backend/src/modules/depreciation/depreciation-batch.spec.ts
- FOUND: apps/backend/src/modules/depreciation/depreciation.routes.spec.ts

Commits:

- FOUND: 60306e8c (test(17-00): add Wave 0 TDD stubs for depreciation module)
