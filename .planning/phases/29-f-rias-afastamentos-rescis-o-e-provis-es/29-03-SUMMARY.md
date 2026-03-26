---
phase: 29-ferias-afastamentos-rescisao-e-provisoes
plan: 03
subsystem: api
tags: [payroll, provisions, vacation, thirteenth-salary, employer-charges, accounting-entry, express, prisma, decimal.js]

requires:
  - phase: 29-01
    provides: Vacation schedules and employee absences backend — PayrollProvision Prisma model, RLS context pattern
  - phase: 28
    provides: Payroll engine, payroll tables service, per-employee transaction isolation pattern

provides:
  - Monthly vacation provision calculation: salary/12 * 4/3 (includes 1/3 constitutional bonus)
  - Monthly 13th salary provision calculation: salary/12
  - Employer charges calculation: provision * (0.20 INSS patronal + RAT + 0.08 FGTS)
  - Accounting entry JSON stubs: debit 6.1.01/6.1.02 (DRE), credit 2.2.01/2.2.02 (BP liability)
  - Batch provision calculation per organization per month (409 on duplicate)
  - Provision reversal (sets reversedAt + reversedBy, preserves audit trail)
  - Cost center report aggregation with CSV export
  - 5 REST endpoints: calculate, list, report, report/export, reverse

affects:
  - 29-04 (employee-terminations frontend — may reference provision data)
  - 29-05 (Phase 29 frontend integration)
  - Phase 32 (GL integration — accounting entry stubs ready for wiring)

tech-stack:
  added: []
  patterns:
    - Per-employee transaction isolation (not one big transaction) — consistent with Phase 28 payroll-runs
    - Route ordering: /report/export → /report → /calculate → /:id/reverse → / (prevents Express 5 param shadowing)
    - Pure calculation function (no DB) separate from service functions (with DB) — testable without mocks
    - PayrollProvisionError class for structured error codes and HTTP status codes

key-files:
  created:
    - apps/backend/src/modules/payroll-provisions/payroll-provisions.types.ts
    - apps/backend/src/modules/payroll-provisions/payroll-provisions.service.ts
    - apps/backend/src/modules/payroll-provisions/payroll-provisions.routes.spec.ts
    - apps/backend/src/modules/payroll-provisions/payroll-provisions.routes.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - "Route order: /report/export before /report before /:id prevents Express 5 param shadowing (same pattern as Phase 26)"
  - "Accounting entry stubs stored as JSON now (Phase 32 GL integration will wire them to real GL entries)"
  - "Reversal sets reversedAt+reversedBy but does NOT delete records (full audit trail)"
  - "Per-employee transactions, not one big transaction — consistent with Phase 28 payroll isolation decision"
  - "4/3 factor implemented as Decimal('1.333333') — 6-decimal precision sufficient for 2dp rounding"

patterns-established:
  - "Provision calculation: pure function with Decimal arithmetic, separate from DB service functions"
  - "Batch provision: per-employee tx with 409 guard for duplicate month"
  - "CSV export: inline aggregation then format, no third-party CSV library"

requirements-completed:
  - FERIAS-04

duration: 185min
completed: 2026-03-25
---

# Phase 29 Plan 03: Payroll Provisions Backend Summary

**Payroll provisions backend — batch vacation+13th salary calculation with employer charges (INSS 20%+RAT+FGTS 8%), accounting entry JSON stubs, per-employee reversal, and cost-center report with CSV export**

## Performance

- **Duration:** ~185 min (Task 1 started 13:30, Task 2 committed 16:35)
- **Started:** 2026-03-25T13:30:24-03:00
- **Completed:** 2026-03-25T16:35:20-03:00
- **Tasks:** 2 (Task 1 pre-completed as 71d7fb08, Task 2 in this session)
- **Files modified:** 5

## Accomplishments

- Implemented `calculateMonthlyProvision` pure function: salary/12*4/3 for vacation, salary/12 for 13th, charges = provision * (0.20+RAT+0.08), all rounded to 2dp with ROUND_HALF_UP
- Implemented batch `calculateMonthlyProvisions`: per-employee transactions, 409 on duplicate month, accounting entry JSON stubs (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02)
- Implemented `reverseProvision`: sets reversedAt+reversedBy without deleting (audit trail)
- Implemented `getProvisionReport` + `exportProvisionReport`: aggregates by cost center, CSV export
- 5 REST endpoints in `payrollProvisionsRouter` with correct route ordering to prevent Express 5 param shadowing
- Registered in app.ts after employeeAbsencesRouter
- 11 tests passing, TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Payroll provisions service — calculation, reversal, reporting** - `71d7fb08` (feat)
2. **Task 2: Payroll provisions routes and app.ts registration** - `154eeafd` (feat)

## Files Created/Modified

- `apps/backend/src/modules/payroll-provisions/payroll-provisions.types.ts` - Types: ProvisionCalcResult, CalculateProvisionsInput, ProvisionOutput, ProvisionReportRow, CalculateProvisionsSummary, AccountingEntryStub, PayrollProvisionError
- `apps/backend/src/modules/payroll-provisions/payroll-provisions.service.ts` - Pure calculation function + 5 service functions with DB access
- `apps/backend/src/modules/payroll-provisions/payroll-provisions.routes.spec.ts` - 11 unit tests for calculateMonthlyProvision
- `apps/backend/src/modules/payroll-provisions/payroll-provisions.routes.ts` - 5 REST endpoints with Express 5 param cast, correct route ordering
- `apps/backend/src/app.ts` - Added payrollProvisionsRouter import and registration

## Decisions Made

- Route order `/report/export` before `/report` before `/:id` — prevents Express 5 param shadowing (established pattern from Phase 26)
- Accounting entries stored as JSON stubs now — Phase 32 will wire to real GL entries (deferred integration)
- Reversal preserves records with reversedAt timestamp — audit trail requirement
- Per-employee transactions isolated — consistent with Phase 28 payroll engine decision

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Worktree was on its own branch (`worktree-agent-a4cd142d`) without the EPIC-16-rh-folha commits. Reset worktree to `feature/EPIC-16-rh-folha` to get Task 1 files before proceeding to Task 2.

## Known Stubs

- `accountingEntryJson` is stored as a JSON stub (not wired to real GL system) — intentional, Phase 32 will wire to actual GL integration. The stub structure (debitAccount, creditAccount, amount, referenceMonth, employeeId) is complete and documented in `AccountingEntryStub` interface.

## Next Phase Readiness

- Payroll provisions backend complete — ready for Phase 29 frontend integration (plan 29-05)
- Phase 32 GL integration can directly consume accountingEntryJson stubs
- employeeTerminationsRouter is created (plan 29-02 service file) but not yet registered in app.ts — needs routes file in plan 29-02 completion

---
*Phase: 29-ferias-afastamentos-rescisao-e-provisoes*
*Completed: 2026-03-25*
