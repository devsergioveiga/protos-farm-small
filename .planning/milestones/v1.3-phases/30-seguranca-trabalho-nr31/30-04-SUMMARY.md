---
phase: 30-seguranca-trabalho-nr31
plan: "04"
subsystem: backend
tags: [medical-exams, safety-compliance, aso, nr31, pdf, csv, dashboard]
dependency_graph:
  requires:
    - 30-01 (schema + types foundation)
  provides:
    - ASO CRUD with auto-calculated nextExamDate and expiry alerts
    - Safety compliance dashboard aggregation (EPI + training + ASO merged)
    - CSV and PDF compliance reports
  affects:
    - apps/backend/src/modules/medical-exams/
    - apps/backend/src/modules/safety-compliance/
    - apps/backend/src/app.ts (route registration order fixed)
tech_stack:
  added: []
  patterns:
    - withRlsContext CRUD pattern (same as all backend modules)
    - 5-query batch compliance engine (no N+1 queries)
    - classifyExpiryAlert() shared pure function from safety-compliance.types
    - pdfkit dynamic import pattern (same as pesticide-prescriptions)
    - CSV string builder pattern (same as other modules)
key_files:
  created:
    - apps/backend/src/modules/medical-exams/medical-exams.service.ts
    - apps/backend/src/modules/medical-exams/medical-exams.routes.spec.ts
    - apps/backend/src/modules/safety-compliance/safety-compliance.service.ts
    - apps/backend/src/modules/safety-compliance/safety-compliance.routes.spec.ts
  modified:
    - apps/backend/src/modules/medical-exams/medical-exams.routes.ts (stub → full implementation)
    - apps/backend/src/modules/medical-exams/medical-exams.types.ts (MedicalExamError: code→statusCode)
    - apps/backend/src/modules/safety-compliance/safety-compliance.routes.ts (stub → full implementation)
    - apps/backend/src/modules/safety-compliance/safety-compliance.types.ts (SafetyComplianceError: code→statusCode)
    - apps/backend/src/app.ts (Phase 30 routers reordered before employeesRouter)
decisions:
  - "Phase 30 routers registered before employeesRouter in app.ts — GET /org/medical-exams/employees/:employeeId conflicts with GET /org/:orgId/employees/:id (employees module)"
  - "MedicalExamError and SafetyComplianceError: changed code:string to statusCode:number to match standard pattern used by all other modules"
  - "Compliance engine uses 6 batch queries (employees, epiReqs, epiDeliveries, trainingReqs, globalTrainingTypes, medicalExams) to avoid N+1 per employee"
  - "listNonCompliantEmployees returns ALL employees when pendingType is specified, only non-compliant when pendingType is not specified"
metrics:
  duration: "30 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 9
---

# Phase 30 Plan 04: ASO Management + Safety Compliance Dashboard Backend — Summary

ASO CRUD with auto-calculated nextExamDate from Position.asoPeriodicityMonths, and unified compliance dashboard aggregating EPI + training + ASO data per employee with CSV/PDF reports.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | medical-exams service + routes + tests | dc0af502 | service.ts, routes.ts (filled), routes.spec.ts, types.ts fixed, app.ts reordered |
| 2 | safety-compliance service + routes + tests | 0433047d | service.ts, routes.ts (filled), routes.spec.ts, types.ts fixed |

## What Was Built

### medical-exams module (SEGUR-03 backend)

**medical-exams.service.ts** — Full CRUD + auto-calculated nextExamDate:
- `createMedicalExam`: verifies employee belongs to org, reads `Position.asoPeriodicityMonths` from active contract, auto-calculates `nextExamDate = examDate + periodicityMonths` using `setMonth()`, defaults to 12 months if position not found
- `classifyExpiryAlert(nextExamDate)`: imported from `safety-compliance.types` — returns OK/YELLOW/RED/EXPIRED
- `listMedicalExams`: paginated with in-app `expiryStatus` filter (fetch all, compute, filter, paginate)
- `getEmployeeExams`, `getMedicalExam`, `updateMedicalExam`, `deleteMedicalExam`

**Routes:** `GET /org/medical-exams`, `GET /org/medical-exams/:id`, `POST`, `PUT`, `DELETE`, `GET /org/medical-exams/employees/:employeeId` (registered BEFORE `/:id`)

**Tests:** 11 test cases covering CP5 (nextExamDate auto-calc), CP6 (alert levels YELLOW/RED/EXPIRED), CRUD, APTO_COM_RESTRICAO restrictions text, authentication

### safety-compliance module (compliance dashboard + reports)

**safety-compliance.service.ts** — Read-only aggregation layer:

5-query batch engine avoids N+1 queries:
1. Active employees (with optional farmId filter via EmployeeFarm)
2. PositionEpiRequirements for positions of active employees
3. EpiDeliveries for those employees
4. PositionTrainingRequirements + isGlobal TrainingTypes (deduplicated by typeId)
5. EmployeeTrainingRecords for those employees
6. Latest MedicalExam per employee (grouped in-memory)

`computeEmployeeCompliance()` — merges all 6 data sources per employee into EPI/training/ASO compliance status

**Routes:** `GET /org/safety-compliance/summary`, `GET /org/safety-compliance/employees`, `GET /org/safety-compliance/employees/:employeeId`, `GET /org/safety-compliance/report/csv`, `GET /org/safety-compliance/report/pdf`

**Tests:** 10 test cases covering CP7 (merged compliance totals), pendingType filters (EPI/TRAINING/ASO), CSV content-type, PDF content-type, authentication

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MedicalExamError and SafetyComplianceError constructor signature**
- **Found during:** Task 1 implementation
- **Issue:** Plan 01 used `code: string` as second parameter. All other modules use `statusCode: number`. The route handlers couldn't reference `err.statusCode` correctly.
- **Fix:** Changed both error classes to `statusCode: number = 400` to match the standard pattern.
- **Files modified:** medical-exams.types.ts, safety-compliance.types.ts
- **Commit:** dc0af502

**2. [Rule 1 - Bug] Fixed `.js` extension imports in app.ts**
- **Found during:** Task 1 test run (all tests failing with "Cannot find module")
- **Issue:** Plan 01 added 6 Phase 30 router imports with `.js` extensions (ESM pattern), but all other imports use no extension. Jest couldn't resolve `.js` → `.ts`.
- **Fix:** Removed `.js` extensions from all 6 Phase 30 router imports in app.ts.
- **Files modified:** apps/backend/src/app.ts
- **Commit:** dc0af502

**3. [Rule 1 - Bug] Fixed route registration order in app.ts to prevent employees router conflict**
- **Found during:** Task 1 test run (`GET /org/medical-exams/employees/:employeeId` returning 400)
- **Issue:** The employees module's route `GET /org/:orgId/employees/:id` was registered before `medicalExamsRouter`. Express matched `/api/org/medical-exams/employees/emp-1` with `:orgId=medical-exams, :id=emp-1`, intercepting before the medical-exams route could handle it.
- **Fix:** Moved all 6 Phase 30 routers (medicalExamsRouter, safetyComplianceRouter, epiProductsRouter, epiDeliveriesRouter, trainingTypesRouter, trainingRecordsRouter) to register BEFORE `employeesRouter` in app.ts.
- **Files modified:** apps/backend/src/app.ts
- **Commit:** dc0af502

## Test Results

| Module | Tests | Pass | Fail |
|--------|-------|------|------|
| medical-exams | 11 | 11 | 0 |
| safety-compliance | 10 | 10 | 0 |
| **Total** | **21** | **21** | **0** |

## Known Stubs

None — all 2 modules are fully implemented with working tests.

## Self-Check: PASSED

Files created:
- apps/backend/src/modules/medical-exams/medical-exams.service.ts — FOUND
- apps/backend/src/modules/medical-exams/medical-exams.routes.spec.ts — FOUND
- apps/backend/src/modules/safety-compliance/safety-compliance.service.ts — FOUND
- apps/backend/src/modules/safety-compliance/safety-compliance.routes.spec.ts — FOUND

Commits:
- dc0af502 — Task 1: medical-exams service + routes + tests
- 0433047d — Task 2: safety-compliance dashboard + reports
