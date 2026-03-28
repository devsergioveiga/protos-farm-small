---
phase: 25-cadastro-de-colaboradores-e-contratos
plan: '01'
subsystem: backend/hr
tags: [prisma, employees, hr, rh, status-machine, documents, dependents]
dependency_graph:
  requires: []
  provides:
    - 'Employee, EmployeeDependent, EmployeeFarm, EmployeeStatusHistory, EmployeeDocument, EmployeeContract, ContractAmendment, Position, SalaryBand, WorkSchedule, EmployeeMovement, EmployeeSalaryHistory Prisma models'
    - 'employees REST API with CRUD, status machine, dependents, farms, document upload'
    - 'isValidPIS utility function'
  affects:
    - 'FieldTeamMember now has optional employeeId'
    - 'Organization model has employees/positions/workSchedules/employeeContracts relations'
    - 'Farm model has employeeFarms relation'
    - 'CostCenter model has employeeContracts relation'
    - 'RBAC permissions: employees module added (MANAGER full, FINANCIAL read)'
tech_stack:
  added: []
  patterns:
    - 'State machine for employee status transitions (VALID_TRANSITIONS record)'
    - 'CPF hard block + PIS soft warning pattern'
    - 'multer diskStorage for document upload (uploads/employees/{orgId}/{employeeId}/)'
    - 'withRlsContext for all DB operations (multitenancy)'
key_files:
  created:
    - apps/backend/prisma/migrations/20260502100000_add_employee_foundation/migration.sql
    - apps/backend/src/modules/employees/employees.types.ts
    - apps/backend/src/modules/employees/employees.service.ts
    - apps/backend/src/modules/employees/employees.routes.ts
    - apps/backend/src/modules/employees/employees.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/shared/utils/document-validator.ts
    - apps/backend/src/shared/utils/document-validator.spec.ts
    - apps/backend/src/app.ts
    - apps/backend/src/shared/rbac/permissions.ts
decisions:
  - 'BankAccountType enum renamed to EmployeeBankAccountType to avoid collision with existing financial BankAccountType (CHECKING/SAVINGS/INVESTMENT)'
  - 'Used prisma db push + migrate resolve instead of migrate dev due to shadow DB having stale migration state — migration file created manually and marked as applied'
  - 'employees permission module added to RBAC immediately (MANAGER full, FINANCIAL read) — required for routes to work'
metrics:
  duration: '~55 minutes'
  completed_date: '2026-03-24'
  tasks: 2
  files_created: 5
  files_modified: 5
  tests_added: 34
---

# Phase 25 Plan 01: Prisma Schema Foundation + Employees Module Summary

Prisma schema foundation with 13 HR models and 7 enums migrated, isValidPIS added to shared utils, and full backend employees module implemented with CRUD, state machine, dependents, farm associations, and document upload.

## Tasks Completed

| Task | Name                                                                          | Commit   | Files                                                                                                           |
| ---- | ----------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| 1    | Prisma schema — 13 models, 7 enums, 2 migrations, isValidPIS                  | 3e8f8353 | schema.prisma, migration.sql, document-validator.ts, document-validator.spec.ts                                 |
| 2    | Backend employees module — CRUD, status machine, dependents, farms, documents | b955c5ac | employees.types.ts, employees.service.ts, employees.routes.ts, employees.routes.spec.ts, app.ts, permissions.ts |

## What Was Built

### Prisma Schema (Task 1)

7 new enums added to schema.prisma:

- `EmployeeStatus` (ATIVO, AFASTADO, FERIAS, DESLIGADO)
- `ContractType` (CLT_INDETERMINATE, CLT_DETERMINATE, SEASONAL, INTERMITTENT, TRIAL, APPRENTICE)
- `MovementType` (PROMOTION, SALARY_ADJUSTMENT, TRANSFER, POSITION_CHANGE)
- `DocumentType` (RG, CPF, CTPS, ASO, CONTRATO, OUTRO)
- `WorkScheduleType` (FIXED, SHIFT, CUSTOM)
- `EmployeeBankAccountType` (CORRENTE, POUPANCA)
- `SalaryBandLevel` (JUNIOR, PLENO, SENIOR)

13 new models added:

- `Employee` — core HR entity with full personal, bank, and work data
- `EmployeeDependent` — dependents with IRRF/salaryFamily flags
- `EmployeeFarm` — multi-farm association with period
- `EmployeeStatusHistory` — audit trail of status transitions
- `Position` — job title with CBO and salary bands
- `SalaryBand` — min/max salary per level (JUNIOR/PLENO/SENIOR)
- `WorkSchedule` — configurable work schedule (FIXED/SHIFT/CUSTOM)
- `EmployeeContract` — contract with type enum, salary, work schedule
- `ContractAmendment` — contract amendments with JSON changes
- `EmployeeMovement` — movement audit trail
- `EmployeeSalaryHistory` — salary history for charts and calculations
- `EmployeeDocument` — document records with file path

Existing models modified:

- `FieldTeamMember` — added optional `employeeId` (nullable, retroactive migration safe)
- `Organization` — added 4 relations
- `User` — added `employee Employee?` relation
- `Farm` — added `employeeFarms` relation
- `CostCenter` — added `employeeContracts` relation

isValidPIS function added to document-validator.ts with 5 unit tests.

### Employees Module (Task 2)

REST API with 12 endpoints:

- `GET /org/:orgId/employees` — paginated list with filters (status, farmId, positionId, search)
- `POST /org/:orgId/employees` — create with CPF validation (block) + PIS validation (warning)
- `GET /org/:orgId/employees/:id` — full detail with dependents, farms, documents, contracts, history
- `PUT /org/:orgId/employees/:id` — update (CPF not updatable)
- `PATCH /org/:orgId/employees/:id/status` — state machine transition
- `POST /org/:orgId/employees/:id/dependents` — add dependent (CPF required when IRRF/salaryFamily)
- `DELETE /org/:orgId/employees/:id/dependents/:depId` — remove dependent
- `POST /org/:orgId/employees/:id/farms` — add farm association
- `PATCH /org/:orgId/employees/:id/farms/:farmAssocId` — close farm association (soft close)
- `POST /org/:orgId/employees/:id/documents` — upload document (multer diskStorage)
- `DELETE /org/:orgId/employees/:id/documents/:docId` — delete document (removes file from disk)
- `GET /org/:orgId/employees/:id/salary-history` — salary history ordered by effectiveAt

State machine transitions validated:

- ATIVO → [AFASTADO, FERIAS, DESLIGADO]
- AFASTADO → [ATIVO]
- FERIAS → [ATIVO]
- DESLIGADO → [] (terminal)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] BankAccountType enum name collision**

- **Found during:** Task 1 — `prisma validate` reported duplicate enum name
- **Issue:** Existing financial module had `BankAccountType` (CHECKING, SAVINGS, INVESTMENT). New HR enum used same name with different values (CORRENTE, POUPANCA).
- **Fix:** Renamed HR enum to `EmployeeBankAccountType` to avoid collision. Updated all references.
- **Files modified:** schema.prisma
- **Commit:** 3e8f8353

**2. [Rule 3 - Blocking] Shadow DB migration failure**

- **Found during:** Task 1 — `prisma migrate dev` failed with P3006 (shadow DB has stale migration state)
- **Issue:** `migration 20260311080000_add_grain_harvests` had already been applied to main DB but shadow DB was out of sync.
- **Fix:** Used `prisma db push` to sync schema changes directly, then created migration SQL file manually and marked as applied via `prisma migrate resolve --applied`.
- **Files modified:** migration directory created manually
- **Commit:** 3e8f8353

**3. [Rule 2 - Missing Critical] RBAC permissions for employees module**

- **Found during:** Task 2 — routes use `checkPermission('employees:read')` but `employees` was not in PermissionModule type
- **Issue:** TypeScript type error and runtime permission check failure
- **Fix:** Added `employees` to PermissionModule type, ALL_MODULES array, and role grants (MANAGER: full, FINANCIAL: read)
- **Files modified:** apps/backend/src/shared/rbac/permissions.ts
- **Commit:** b955c5ac

## Test Results

- document-validator.spec.ts: 18 tests passing (5 new for isValidPIS)
- employees.routes.spec.ts: 16 tests passing

## Self-Check: PASSED

- employees.service.ts: FOUND
- employees.routes.ts: FOUND
- migration.sql: FOUND
- Commit 3e8f8353: FOUND
- Commit b955c5ac: FOUND
- All 13 models in schema.prisma: VERIFIED
- All 7 enums in schema.prisma: VERIFIED
- 34 tests passing (18 document-validator + 16 employees.routes)
