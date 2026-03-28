---
phase: 28-processamento-da-folha-mensal
plan: 02
subsystem: salary-advances
tags: [payroll, hr, salary-advance, payables, pdf, batch]
dependency_graph:
  requires: [salary-advances.types.ts (plan 01 types)]
  provides: [salary-advances.service, salary-advances.routes]
  affects: [app.ts, payables (originType SALARY_ADVANCE)]
tech_stack:
  added: []
  patterns:
    [
      pdfkit PDF generation,
      withRlsContext transaction,
      batch processing with per-employee isolation,
    ]
key_files:
  created:
    - apps/backend/src/modules/salary-advances/salary-advances.types.ts
    - apps/backend/src/modules/salary-advances/salary-advances.service.ts
    - apps/backend/src/modules/salary-advances/salary-advances.routes.ts
    - apps/backend/src/modules/salary-advances/salary-advances.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - "Batch advance uses per-employee createAdvance calls (not one big tx) for isolation — a single failure doesn't abort the whole batch"
  - 'Unused prisma import in createBatchAdvances removed — uses withRlsContext throughout'
  - 'SalaryAdvanceError carries statusCode for proper HTTP responses (400/404)'
metrics:
  duration: 15min
  completed_date: '2026-03-24'
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  tests_added: 6
---

# Phase 28 Plan 02: Salary Advances Module Summary

Salary advances service with individual create (limit validation + CP creation), batch processing for all active employees, paginated listing, and receipt PDF generation — 4 REST endpoints registered in app.ts.

## What Was Built

### salary-advances.service.ts

Four exported functions:

**`createAdvance`** — Validates employee status (ATIVO), fetches current salary from EmployeeSalaryHistory or EmployeeContract, checks 40% limit, rejects duplicates for same referenceMonth, then creates SalaryAdvance + Payable (originType='SALARY_ADVANCE', category='PAYROLL') in a single `withRlsContext` transaction. Updates advance with payableId.

**`createBatchAdvances`** — Fetches all ATIVO employees for org, skips any with existing advance for the referenceMonth, calculates amount = salary \* percent / 100 (rounded to 2dp), calls `createAdvance` per employee individually (isolated failures), tags with batchId. Returns `{ batchId, count, advances }`.

**`listAdvances`** — Paginated query filtered by organizationId, optional referenceMonth (converted to first-day Date), optional employeeId. Includes employee name/cpf.

**`generateAdvanceReceiptPdf`** — Fetches advance with employee/org/position data, builds A4 PDF via pdfkit with: org header, title, employee data (name, CPF, cargo), competência, value (pt-BR currency format), declaration text, and signature line.

### salary-advances.routes.ts

4 REST endpoints at `/org/:orgId/salary-advances`:

| Method | Path         | Permission           | Action            |
| ------ | ------------ | -------------------- | ----------------- |
| POST   | /            | payroll-params:write | Create individual |
| POST   | /batch       | payroll-params:write | Create batch      |
| GET    | /            | payroll-params:read  | List with filters |
| GET    | /:id/receipt | payroll-params:read  | Download PDF      |

`/batch` registered BEFORE `/:id/receipt` to prevent Express 5 param shadowing (per Phase 26 pattern).

## Tests

6 integration tests in `salary-advances.routes.spec.ts`:

1. POST individual — creates advance and returns 201
2. POST individual — returns 401 when unauthenticated
3. POST batch — creates batch advances and returns count + batchId
4. GET list — filters by referenceMonth, returns paginated data
5. GET receipt — returns PDF with application/pdf content-type
6. GET receipt — returns 404 for nonexistent advance

All 6 tests passing (`pnpm jest salary-advances --no-coverage`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 01 types file not created yet**

- **Found during:** Task 1 setup
- **Issue:** salary-advances.types.ts did not exist (Plan 01 not yet executed)
- **Fix:** Created types file as first action of Task 1 (it was in Plan 02's must_haves as a prerequisite)
- **Files modified:** apps/backend/src/modules/salary-advances/salary-advances.types.ts
- **Commit:** e768e0c5

**2. [Rule 2 - Missing Critical] SalaryAdvanceError statusCode field**

- **Found during:** Task 1 implementation
- **Issue:** Plan spec showed SalaryAdvanceError with just message+code; routes need HTTP status codes
- **Fix:** Added optional `statusCode` parameter (default 400) to SalaryAdvanceError constructor
- **Files modified:** salary-advances.types.ts, salary-advances.routes.ts
- **Commit:** e768e0c5

## Known Stubs

None — all functions fully implemented with real Prisma queries.

## Self-Check: PASSED
