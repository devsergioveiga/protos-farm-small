---
phase: 27-controle-de-ponto-e-jornada
plan: '02'
subsystem: time-calculations
tags: [tdd, pure-functions, decimal, labor-law, rural]
dependency_graph:
  requires: []
  provides: [time-calculations-engine]
  affects: [27-03-time-entries-api, 27-04-timesheets]
tech_stack:
  added: []
  patterns:
    - Pure function TDD with Jest
    - Decimal.js for all labor arithmetic (no float)
    - date-holidays lazy cache per locale key
    - date-fns differenceInMinutes for gap calculation
key_files:
  created:
    - apps/backend/src/modules/time-calculations/time-calculations.types.ts
    - apps/backend/src/modules/time-calculations/time-calculations.service.ts
    - apps/backend/src/modules/time-calculations/time-calculations.spec.ts
  modified: []
decisions:
  - "calcDailyWork accepts optional previousClockOut + clockIn pair for interjornada — avoids coupling to caller's clock-in data model"
  - 'Holiday cache keyed by BR-state-city — ensures single Holidays instance per locale across test runs'
  - 'Absence defined as zero total worked minutes (regular + overtime50 + overtime100 = 0)'
metrics:
  duration_minutes: 12
  completed_date: '2026-03-24'
  tasks_completed: 2
  files_created: 3
  tests_passing: 23
---

# Phase 27 Plan 02: Time Calculations Engine Summary

**One-liner:** Pure TDD calculation engine for Brazilian rural overtime (50%/100%), night premium (21h-5h, 25%, hora reduzida 52m30s), interjornada (<11h alert), and monthly aggregation — all Decimal arithmetic, no float.

## What Was Built

Three files implementing the computation core for the controle-de-ponto-e-jornada phase:

- `time-calculations.types.ts` — TypeScript interfaces: `DailyWorkInput`, `DailyWorkResult`, `RuralNightResult`, `MonthlyTotals`
- `time-calculations.service.ts` — 5 pure exported functions with no database access
- `time-calculations.spec.ts` — 23 Jest tests covering all Brazilian rural labor edge cases

## Functions Exported

| Function                | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `calcDailyWork`         | Breaks worked minutes into regular/overtime50/overtime100; captures interjornada |
| `calcRuralNightPremium` | Converts real night minutes to contractual hours via 60/52.5 factor, 25% premium |
| `isHolidayOrSunday`     | date-holidays BR + Sunday detection with lazy per-locale cache                   |
| `calcInterjornada`      | Gap between shifts; alert when < 660 minutes (11 hours)                          |
| `calcMonthlyTotals`     | Aggregates DailyWorkResult array; counts zero-minute days as absences            |

## Key Brazilian Labor Rules Implemented

- **Adicional noturno rural:** 21h–5h (not urban 22h–5h), 25% rate (not 20%), hora reduzida = 52m30s per Lei 5.889/73
- **Horas extras dominicais:** All hours on Sundays/holidays are overtime100, zero regular minutes
- **Interjornada:** CLT art. 66 minimum 11-hour gap between shifts; alert flag set when below threshold
- **Decimal-only arithmetic:** `Decimal(60).div(Decimal('52.5'))` factor, never float division

## Test Coverage

```
23 tests passing
- calcDailyWork: 9 tests (normal/dayoff/absence/interjornada)
- calcRuralNightPremium: 3 tests (full shift, zero, partial)
- isHolidayOrSunday: 5 tests (Christmas, New Year, Tuesday, Sunday, Tiradentes)
- calcInterjornada: 3 tests (exact 11h, 10h alert, null previous)
- calcMonthlyTotals: 3 tests (mixed data, empty, 30-day full)
```

## Deviations from Plan

**1. [Rule 2 - Missing functionality] calcDailyWork signature extended with clockIn parameter**

- **Found during:** RED phase test writing
- **Issue:** Plan spec showed `previousClockOut` as only parameter but tests require `currentClockIn` to compute the gap
- **Fix:** Added optional `clockIn?: Date` as third parameter; interjornada only computed when both params present
- **Impact:** Non-breaking — callers without interjornada data pass no extra args

None other — plan executed as written.

## Self-Check: PASSED

Files exist:

- FOUND: apps/backend/src/modules/time-calculations/time-calculations.types.ts
- FOUND: apps/backend/src/modules/time-calculations/time-calculations.service.ts
- FOUND: apps/backend/src/modules/time-calculations/time-calculations.spec.ts

Commits:

- FOUND: 89cad2a2 (test(27-02): failing tests RED)
- FOUND: 7fb6e9cd (feat(27-02): implementation GREEN)

Tests: 23/23 passing — verified via jest --testPathPattern="time-calculations"
