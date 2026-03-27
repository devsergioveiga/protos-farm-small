---
phase: 33-wire-employee-data-safety-pages
verified: 2026-03-26T22:30:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 33: Wire Employee Data to Safety Pages — Verification Report

**Phase Goal:** Wire employee data to safety pages — replace MOCK_EMPLOYEES stubs with real API data
**Verified:** 2026-03-26
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TrainingRecordsPage shows real employees from the API in the participant multi-select | ✓ VERIFIED | `useEmployees({ status: 'ATIVO', limit: 200 })` called at line 61; `employeeOptions` passed to `TrainingRecordModal` at line 366 |
| 2 | MedicalExamsPage shows real employees from the API in the employee combobox | ✓ VERIFIED | `useEmployees({ status: 'ATIVO', limit: 200 })` called at line 90; `employeeOptions` passed to `MedicalExamModal` at line 349 |
| 3 | MedicalExamModal receives asoPeriodicityMonths per employee for auto-calculating next exam date | ✓ VERIFIED | `asoPeriodicityMonths: emp.farms?.[0]?.position?.asoPeriodicityMonths ?? null` mapped at MedicalExamsPage.tsx:98 |
| 4 | Only active (ATIVO) employees appear in both safety page selectors | ✓ VERIFIED | Both pages call `useEmployees({ status: 'ATIVO', limit: 200 })`; hook passes `status` query param to API at useEmployees.ts:59 |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/modules/employees/employees.service.ts` | listEmployees returns asoPeriodicityMonths in position select | ✓ VERIFIED | Line 219: `position: { select: { id: true, name: true, asoPeriodicityMonths: true } }` |
| `apps/frontend/src/types/employee.ts` | EmployeeFarm.position includes asoPeriodicityMonths | ✓ VERIFIED | Line 77: `position?: { name: string; asoPeriodicityMonths?: number }` |
| `apps/frontend/src/pages/TrainingRecordsPage.tsx` | Real employee data via useEmployees hook | ✓ VERIFIED | Imports `useEmployees` at line 10; no MOCK_EMPLOYEES constant present |
| `apps/frontend/src/pages/TrainingRecordsPage.spec.tsx` | Tests verifying real employees are wired into TrainingRecordsPage | ✓ VERIFIED | Contains `useEmployees` mock with 2 describe/it blocks targeting SEGUR-02 |
| `apps/frontend/src/pages/MedicalExamsPage.tsx` | Real employee data via useEmployees hook with asoPeriodicityMonths mapping | ✓ VERIFIED | Imports `useEmployees` at line 11; maps asoPeriodicityMonths at line 98; no MOCK_EMPLOYEES present |
| `apps/frontend/src/pages/MedicalExamsPage.spec.tsx` | Tests verifying real employees and asoPeriodicityMonths are wired into MedicalExamsPage | ✓ VERIFIED | Contains `useEmployees` mock; mock employees include `asoPeriodicityMonths: 6` and `asoPeriodicityMonths: 12` in position |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TrainingRecordsPage.tsx` | `useEmployees.ts` | `useEmployees({ status: 'ATIVO', limit: 200 })` | ✓ WIRED | Line 61 matches pattern `useEmployees.*ATIVO` |
| `MedicalExamsPage.tsx` | `useEmployees.ts` | `useEmployees({ status: 'ATIVO', limit: 200 })` | ✓ WIRED | Line 90 matches pattern `useEmployees.*ATIVO` |
| `MedicalExamsPage.tsx` | `employees.service.ts` | `asoPeriodicityMonths` flows from backend position select through API response to modal prop | ✓ WIRED | Backend returns field (service.ts:219) → type exposes it (employee.ts:77) → page maps it (MedicalExamsPage.tsx:98) → passed to modal (MedicalExamsPage.tsx:349) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TrainingRecordsPage.tsx` | `employees` | `useEmployees` hook → `api.get('/org/:orgId/employees?status=ATIVO&limit=200')` | Yes — hook fetches from live API with RLS context | ✓ FLOWING |
| `MedicalExamsPage.tsx` | `employees` + `asoPeriodicityMonths` | `useEmployees` hook → backend `listEmployees` with position select | Yes — backend queries DB and returns `asoPeriodicityMonths` field | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — pages require a running frontend + backend server to observe rendered output. The wiring is fully verified statically. Human verification section covers the interactive test cases.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEGUR-02 | 33-01-PLAN.md | Técnico pode gerenciar treinamentos NR-31 com registro (data, carga horária, instrutor, lista presença)... | ✓ SATISFIED | TrainingRecordsPage now fetches real ATIVO employees; TrainingRecordModal receives `employeeOptions` with real name and positionName; spec verifies hook called with `status: 'ATIVO'` |
| SEGUR-03 | 33-01-PLAN.md | Gerente pode controlar ASOs com registro (médico CRM, resultado apto/inapto, exames), periodicidade configurável... | ✓ SATISFIED | MedicalExamsPage now fetches real ATIVO employees with asoPeriodicityMonths; MedicalExamModal receives `employeeOptions` including position-specific periodicity; spec verifies asoPeriodicityMonths flows through |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps SEGUR-02 and SEGUR-03 to Phase 33 only. Both are accounted for by this plan. No orphaned requirements.

---

### Anti-Patterns Found

Scan of the 6 modified files:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No MOCK_EMPLOYEES, no TODOs, no placeholder returns | — | None found |

No empty-array stubs, no `return null`, no hardcoded empty props, no TODO/FIXME comments found in production files. Both spec files correctly use `vi.fn()` and `vi.mock()` without blocking the component rendering.

One observation: `TrainingRecordsPage.spec.tsx` test "does not contain MOCK_EMPLOYEES stub" asserts the hook was called rather than directly inspecting rendered employee names (the modal is closed by default). This is a valid test strategy — it proves the data path is wired without requiring modal interaction in a unit test. Not a defect.

---

### Human Verification Required

#### 1. Employee Names Render in TrainingRecordModal Participant Multi-Select

**Test:** Open the app, navigate to Registros de Treinamento, click "Registrar Treinamento", advance to Step 2 (Participantes).
**Expected:** The participant multi-select shows real employee names from the organization (not empty).
**Why human:** Requires a running app with seeded employees; modal Step 2 render cannot be verified statically.

#### 2. Employee Combobox in MedicalExamModal Populates

**Test:** Open the app, navigate to ASOs, click "Registrar ASO", observe the employee combobox.
**Expected:** Dropdown shows real active employees from the organization.
**Why human:** Requires a running app with seeded ATIVO employees.

#### 3. asoPeriodicityMonths Auto-Calculates Next Exam Date

**Test:** In MedicalExamModal, select an employee whose position has `asoPeriodicityMonths` set (e.g., 6 months). Enter exam date 2026-01-01.
**Expected:** "Próximo exame" date field auto-fills to approximately 2026-07-01 (6 months later).
**Why human:** Auto-calculation logic lives inside MedicalExamModal component; verifying it uses the `asoPeriodicityMonths` prop requires visual confirmation in a running app.

---

## Gaps Summary

No gaps. All 4 must-have truths are VERIFIED:

1. TrainingRecordsPage calls `useEmployees({ status: 'ATIVO', limit: 200 })` and passes the mapped result to `TrainingRecordModal` as `employees={employeeOptions}`.
2. MedicalExamsPage calls `useEmployees({ status: 'ATIO', limit: 200 })` and passes the mapped result including `asoPeriodicityMonths` to `MedicalExamModal`.
3. Backend `listEmployees` now includes `asoPeriodicityMonths: true` in the position select, closing the data gap from root to leaf.
4. Frontend `EmployeeFarm.position` type extended with `asoPeriodicityMonths?: number`, ensuring TypeScript type safety through the full data path.
5. Both spec files exist, mock `useEmployees`, and assert the hook is called with `status: 'ATIVO'`.
6. No `MOCK_EMPLOYEES` references remain in any production file.

SEGUR-02 and SEGUR-03 gaps from the v1.3 audit are closed. Phase 33 goal is achieved.

---

_Verified: 2026-03-26_
_Verifier: Claude (gsd-verifier)_
