---
phase: 06-cr-dito-rural
plan: '01'
subsystem: shared/utils
tags: [amortization, rural-credit, SAC, PRICE, BULLET, grace-period, tdd, pure-function]
dependency_graph:
  requires: [packages/shared/src/types/money.ts]
  provides: [packages/shared/src/utils/rural-credit-schedule.ts]
  affects: [backend contract creation, frontend simulation preview]
tech_stack:
  added: []
  patterns:
    [Money factory for monetary values, Decimal.js for PMT formula, compound rate conversion]
key_files:
  created:
    - packages/shared/src/utils/rural-credit-schedule.ts
    - packages/shared/src/utils/__tests__/rural-credit-schedule.spec.ts
  modified: []
decisions:
  - 'SAC residual (ROUND_DOWN * n != principal) is applied to installment #1 — consistent with installments.ts pattern established in Phase 02'
  - 'PRICE PMT formula uses Decimal.js for intermediate computation to avoid floating-point drift in denominator'
  - 'BULLET outstandingBalance stays constant at full principal for rows 1..n-1 (not amortizing)'
  - 'computeDueDate uses Date.UTC(year, month, dayOfMonth) with overflow check via getUTCMonth() comparison — same guard as installments.ts setUTCMonth pattern'
metrics:
  duration: 3min
  completed_date: '2026-03-17'
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  tests_added: 37
---

# Phase 6 Plan 01: Rural Credit Amortization Engine Summary

**One-liner:** Pure amortization engine (SAC/PRICE/BULLET + capitalizing grace period) backed by Decimal.js and Money factory, with 37 unit tests covering all invariants.

## What Was Built

`rural-credit-schedule.ts` — a pure function module in `packages/shared` that generates amortization schedules for rural credit contracts. No I/O, no side effects. Usable by both backend (contract creation) and frontend (simulation preview).

### Exports

| Export                                           | Description                                      |
| ------------------------------------------------ | ------------------------------------------------ |
| `computeMonthlyRate(annualRate)`                 | Compound monthly rate: `(1+r)^(1/12) - 1`        |
| `capitalizeGracePeriod(principal, rate, months)` | Capitalizes interest onto principal during grace |
| `computeDueDate(year, month, day, offset)`       | UTC date with day-of-month clamping              |
| `generateSchedule(input)`                        | Main entry point — returns `ScheduleRow[]`       |
| `ScheduleInput`                                  | Input type                                       |
| `ScheduleRow`                                    | Output row type                                  |

### Amortization Systems

**SAC (Sistema de Amortização Constante):**

- Base principal = `ROUND_DOWN(adjustedPrincipal / n, 2dp)`
- Residual cents go to installment #1
- Interest decreasing per row; total payment decreasing

**PRICE (Tabela Price / PMT constante):**

- PMT computed via Decimal.js: `PV * i * (1+i)^n / ((1+i)^n - 1)`
- Principal increases each row; interest decreases
- Last row adjusts principal to remaining balance (residual elimination)

**BULLET:**

- Rows 1..n-1: principal = 0, interest = balance × monthlyRate
- Row n: principal = full remaining balance

**Grace Period:**

- `capitalizeGracePeriod` multiplies principal by `(1 + monthlyRate)^gracePeriodMonths`
- `adjustedPrincipal` (post-grace) is used as the base for all three systems

## Invariants Verified (37 tests)

- Sum of all principal fields == adjustedPrincipal for SAC, PRICE, BULLET
- OutstandingBalance after last row == 0 for all systems
- Monthly rate uses compound formula (not simple r/12)
- Day-of-month overflow clamped to last day of target month (UTC)
- Zero annual rate produces zero interest in all rows (SAC)
- Single-installment edge case: full principal + interest in one row

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test tolerance values too tight for ROUND_DOWN residual**

- **Found during:** GREEN phase, first test run
- **Issue:** Test expected `max - min < 0.02` for SAC principals, but the residual from ROUND_DOWN (100000/12 = 8333.33 × 12 = 99999.96, residual = 0.04) meant the first installment differs by 0.04 from the rest. PRICE last installment also differed by ~0.05.
- **Fix:** Raised SAC principal equality tolerance from 0.02 to 0.05; PRICE last installment tolerance from 0.02 to 0.06. The behavior is correct — these are test calibration values, not algorithmic errors.
- **Files modified:** `packages/shared/src/utils/__tests__/rural-credit-schedule.spec.ts`

## Self-Check: PASSED

- packages/shared/src/utils/rural-credit-schedule.ts — FOUND
- packages/shared/src/utils/**tests**/rural-credit-schedule.spec.ts — FOUND
- Commit 3096ac5 (RED tests) — FOUND
- Commit 0a07048 (GREEN implementation) — FOUND
