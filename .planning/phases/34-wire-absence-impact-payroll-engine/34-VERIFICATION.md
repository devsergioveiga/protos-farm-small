---
phase: 34-wire-absence-impact-payroll-engine
verified: 2026-03-26T03:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 34: Wire Absence Impact Payroll Engine — Verification Report

**Phase Goal:** Wire the absence/suspension impact into the payroll engine so that `getAbsenceImpactForMonth` is called during payroll processing and `fgtsBase` is displayed on the payslip PDF.
**Verified:** 2026-03-26T03:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | INSS-paid absence days generate a DESCONTO rubrica with correct proportional deduction | VERIFIED | `payroll-calculation.service.ts` lines 454-462: code `0900` "Afastamento INSS" pushed when `absenceInssDeduction > 0`; test at spec line 228 asserts value `967.74` (10/31 * 3000) |
| 2 | Suspension days generate a DESCONTO rubrica with correct proportional deduction | VERIFIED | `payroll-calculation.service.ts` lines 464-472: code `0910` "Suspensão Disciplinar" pushed when `suspensionDeduction > 0`; test at spec line 242 asserts value `290.32` (3/31 * 3000) |
| 3 | INSS/IRRF base is reduced by absence and suspension deductions (D-04) | VERIFIED | `payroll-calculation.service.ts` lines 138 and 250-258: `salaryForInssBase = adjustedSalary - absenceInssDeduction - suspensionDeduction`; `inssIrrfBase` built from `salaryForInssBase`; `calculateINSS(inssIrrfBase, ...)` at line 261 |
| 4 | FGTS uses full baseSalary when fgtsFullMonth=true (D-07) | VERIFIED | `payroll-calculation.service.ts` lines 319-322: `fgtsBase = absenceData?.fgtsFullMonth ? baseSalary + OT components : grossSalary`; test at spec line 261 asserts `fgtsBase = 3000`, `fgtsAmount = 240.00` |
| 5 | Admission mid-month + INSS absence = cumulative pro-rata (D-02) | VERIFIED | Step 1b applied to `adjustedSalary` (post-prorata, line 125); test at spec line 274 asserts `proRataDays=16` and `absenceInssDeduction=249.74` |
| 6 | Suspension reduces DSR proportionally (D-10) | VERIFIED | `payroll-calculation.service.ts` lines 177-186: DSR reduction block using `suspendedDays / workDaysCount`; test at spec line 286 asserts `dsrValue < noSuspResult.dsrValue` |
| 7 | No absence data = zero deductions, behavior unchanged (regression) | VERIFIED | `absenceData` destructured with optional chaining; `if (absenceData)` guard at line 120; test at spec line 299 asserts both deductions `0.00` |
| 8 | Net salary floors at zero when deductions exceed gross (Pitfall 5) | VERIFIED | `payroll-calculation.service.ts` line 314: `netSalary = Decimal.max(netSalary, new Decimal(0))`; test at spec line 318 asserts `netSalary >= 0` |
| 9 | Payroll engine calls getAbsenceImpactForMonth inside the tx and passes result to calculateEmployeePayroll | VERIFIED | `payroll-runs.service.ts` line 35: import; line 356: `const absenceData = await getAbsenceImpactForMonth(employee.id, referenceMonth, tx)`; line 379: `absenceData,` in `payrollInput` object |
| 10 | Payslip PDF shows Base FGTS correctly when fgtsFullMonth=true | VERIFIED | `payroll-pdf.service.ts` line 258: rodape renders `Base FGTS: ${formatCurrency(data.fgtsBase)}`; `fgtsBase` in `PayslipData` interface at line 32 |
| 11 | PayslipData includes fgtsBase field for PDF rendering | VERIFIED | `payroll-pdf.service.ts` line 32: `fgtsBase: number` in `PayslipData` interface; both `payroll-runs.service.ts` call sites (lines 1006-1008 and 1479-1481) derive `fgtsBase` from `fgtsAmount / 0.08` |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/src/modules/payroll-runs/payroll-runs.types.ts` | `absenceData` on EmployeePayrollInput; `absenceInssDeduction`, `suspensionDeduction`, `fgtsBase` on EmployeePayrollResult | VERIFIED | All four fields confirmed at lines 51, 80-82. Import of `AbsencePayrollImpact` at line 4. |
| `apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts` | Absence/suspension deduction logic in `calculateEmployeePayroll` | VERIFIED | Steps 1b, 1c, 1d, 4b, 8b, 13, 14, 16 all present with real Decimal arithmetic; both `calculateEmployeePayroll` and `calculateThirteenthSalary` return all three new fields |
| `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` | 9 unit tests for absence scenarios | VERIFIED | `describe('absence impact')` at line 222 with 9 tests covering D-01 through D-10 and Pitfall 5 |
| `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` | Orchestrator wiring of absence data into payroll input | VERIFIED | Import at line 35; call at line 356 inside MONTHLY branch; `absenceData` in `payrollInput` at line 379 |
| `apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts` | Updated PayslipData with fgtsBase; rodape rendering | VERIFIED | `fgtsBase: number` at line 32; rodape text at line 258 includes `Base FGTS:` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `payroll-calculation.service.ts` | `payroll-runs.types.ts` | `input.absenceData` | WIRED | Line 89 destructures `absenceData` from input; used at lines 120, 177, 319, 458, 468 |
| `payroll-runs.service.ts` | `employee-absences.service.ts` | import and call `getAbsenceImpactForMonth` | WIRED | Import line 35; call line 356 with `(employee.id, referenceMonth, tx)` |
| `payroll-runs.service.ts` | `payroll-calculation.service.ts` | `absenceData` field in `payrollInput` | WIRED | Line 379: `absenceData,` in payrollInput object literal |
| `payroll-pdf.service.ts` | `payroll-runs.service.ts` | `fgtsBase` in PayslipData | WIRED | Both PDF call sites in `payroll-runs.service.ts` (lines 1006-1008 and 1479-1481) populate `fgtsBase`; interface field confirmed in `payroll-pdf.service.ts` line 32 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `payroll-calculation.service.ts` | `absenceInssDeduction` | `absenceData.inssPaidDays / totalDays * adjustedSalary` (line 122-125) | Yes — computed from real input values | FLOWING |
| `payroll-calculation.service.ts` | `suspensionDeduction` | `absenceData.suspendedDays / totalDays * adjustedSalary` (line 130-133) | Yes — computed from real input values | FLOWING |
| `payroll-calculation.service.ts` | `fgtsBase` | conditional on `absenceData?.fgtsFullMonth` (line 319-321) | Yes — either `baseSalary + OT components` or `grossSalary` | FLOWING |
| `payroll-runs.service.ts` | `absenceData` passed to `payrollInput` | `getAbsenceImpactForMonth(employee.id, referenceMonth, tx)` (line 356) | Yes — async DB call inside transaction | FLOWING |
| `payroll-pdf.service.ts` | `data.fgtsBase` in rodape | derived from `item.fgtsAmount / 0.08` at call site (lines 1006-1008) | Yes — computed from stored FGTS amount | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 43 payroll-module tests pass | `npx jest src/modules/payroll-runs/ --passWithNoTests --no-coverage --silent` | 3 suites, 43 tests, 0 failures, 0.753s | PASS |
| 9 absence-impact tests exist and pass | Covered by above run; `describe('absence impact')` at spec line 222 | 9 tests in suite | PASS |
| `fgtsBase` field in PayslipData mock | `payroll-pdf.service.spec.ts` line 37: `fgtsBase: 3000` | Present and typed | PASS |
| PDF rodape contains `Base FGTS:` | `payroll-pdf.service.ts` line 258 | String confirmed | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FERIAS-02 | 34-01-PLAN.md, 34-02-PLAN.md | Gerente pode registrar afastamentos com impacto automático na folha | SATISFIED | Absence data fetched via `getAbsenceImpactForMonth`, flows through `EmployeePayrollInput.absenceData` into calculation engine; INSS-leave and suspension deductions applied; FGTS full-month override; payslip PDF shows Base FGTS. REQUIREMENTS.md traceability table maps FERIAS-02 → Phase 34 as Complete (line 98). |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `payroll-runs.service.ts` | 1006-1008, 1479-1481 | `fgtsBase` derived from `fgtsAmount / 0.08` (documented assumption) | Info | Both call sites read from stored DB item where live `result.fgtsBase` is not available. The derivation is documented with the 8% CLT rate assumption (Lei 8.036/90) and a note about apprentices. Functionally correct for all current employee types. Not a stub — the value is computed and flows to the PDF. |

No blockers or stub patterns found.

---

### Human Verification Required

#### 1. PDF rodape visual layout with Base FGTS

**Test:** Generate a payslip PDF for an employee with a WORK_ACCIDENT or INSS_LEAVE absence in the reference month (so `fgtsFullMonth=true`). Download and open the PDF.
**Expected:** The rodape line shows four values: `Base INSS: R$X    Base IRRF: R$X    Base FGTS: R$X    FGTS do Mês: R$X`. The `Base FGTS` value should equal the full baseSalary (not the prorated gross), confirming D-07.
**Why human:** PDF layout and visual rendering cannot be verified programmatically.

#### 2. End-to-end payroll run with active absence records in DB

**Test:** Create an employee with an active INSS_LEAVE absence spanning part of the current month, then run `POST /payroll-runs` → `POST /payroll-runs/:id/process`. Retrieve the generated payslip.
**Expected:** The holerite PDF shows the `Afastamento INSS` deduction rubrica (code 0900) with the correct proportional value, and the Base FGTS reflects the full salary (not the prorated gross).
**Why human:** Requires live DB with employee + absence records; integration path from `employee-absences` module through payroll run cannot be tested without a running server and seeded data.

---

### Gaps Summary

No gaps found. All 11 must-have truths are verified across all four levels (exists, substantive, wired, data flowing). The test suite passes at 43/43 with full absence-impact coverage.

---

_Verified: 2026-03-26T03:30:00Z_
_Verifier: Claude (gsd-verifier)_
