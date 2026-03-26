---
phase: 33-wire-employee-data-safety-pages
plan: 01
subsystem: frontend-safety
tags: [employees, safety, training, medical-exams, segur-02, segur-03]
dependency_graph:
  requires: []
  provides: [real-employee-data-in-training-records, real-employee-data-in-medical-exams]
  affects: [TrainingRecordsPage, MedicalExamsPage, MedicalExamModal, TrainingRecordModal]
tech_stack:
  added: []
  patterns: [useEmployees-hook, useMemo-mapping, wave-0-test-stubs]
key_files:
  created:
    - apps/frontend/src/pages/TrainingRecordsPage.spec.tsx
    - apps/frontend/src/pages/MedicalExamsPage.spec.tsx
  modified:
    - apps/backend/src/modules/employees/employees.service.ts
    - apps/frontend/src/types/employee.ts
    - apps/frontend/src/pages/TrainingRecordsPage.tsx
    - apps/frontend/src/pages/MedicalExamsPage.tsx
decisions:
  - "employeeOptions useMemo mapping uses farms[0].position for flat shape — matches existing TrainingRecordModal and MedicalExamModal prop contracts"
  - "listEmployees position select extended with asoPeriodicityMonths only — getEmployee detail method left unchanged (uses include, already returns all fields)"
metrics:
  duration: 254s
  completed: "2026-03-26"
  tasks: 4
  files_modified: 6
---

# Phase 33 Plan 01: Wire Employee Data to Safety Pages Summary

**One-liner:** Replaced MOCK_EMPLOYEES empty-array stubs in TrainingRecordsPage and MedicalExamsPage with real active employees via useEmployees hook, including asoPeriodicityMonths from backend position select.

## What Was Built

Closes SEGUR-02 and SEGUR-03 gaps from the v1.3 audit. Both NR-31 training and ASO exam pages now fetch real ATIVO employees from the API instead of showing empty selectors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Create Wave 0 test stubs | baba516f | TrainingRecordsPage.spec.tsx, MedicalExamsPage.spec.tsx |
| 1 | Add asoPeriodicityMonths to backend + frontend type | d164aa8d | employees.service.ts, employee.ts |
| 2 | Wire real employees into TrainingRecordsPage (SEGUR-02) | fbffb121 | TrainingRecordsPage.tsx |
| 3 | Wire real employees into MedicalExamsPage (SEGUR-03) | 81c000cb | MedicalExamsPage.tsx |

## Verification Results

All 4 spec tests pass GREEN:
- `TrainingRecordsPage — SEGUR-02 employee wiring > calls useEmployees with status ATIVO`
- `TrainingRecordsPage — SEGUR-02 employee wiring > does not contain MOCK_EMPLOYEES stub`
- `MedicalExamsPage — SEGUR-03 employee wiring > calls useEmployees with status ATIVO`
- `MedicalExamsPage — SEGUR-03 employee wiring > does not contain MOCK_EMPLOYEES stub — asoPeriodicityMonths flows from hook`

No `MOCK_EMPLOYEES` references remain in production files. Both pages import `useEmployees`.

Backend: `employees.service.ts` listEmployees position select now includes `asoPeriodicityMonths: true`.

## Decisions Made

1. **employeeOptions useMemo mapping uses farms[0].position for flat shape** — TrainingRecordModal expects `{ id, name, positionName }` and MedicalExamModal expects `{ id, name, positionName, asoPeriodicityMonths }`. The useMemo flattens `emp.farms?.[0]?.position` into this shape, preserving null-safety with `?? null`.

2. **listEmployees position select extended only** — The `getEmployee` detail method uses `include` (not `select`) and already returns all fields. Only `listEmployees` needed the explicit `asoPeriodicityMonths: true` addition. No migration needed — field already existed with `@default(12)`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both pages now use real API data. Employee selectors in modals will populate with actual ATIVO employees from the organization.

## Self-Check: PASSED
