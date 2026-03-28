---
phase: 32-integra-o-financeira-cont-bil-e-dashboard-rh
plan: '03'
subsystem: backend
tags: [hr-dashboard, payroll, aggregation, kpi, rh]
dependency_graph:
  requires:
    - PayrollRun (pre-computed totalGross/totalNet/totalCharges)
    - PayrollRunItem (composition breakdown)
    - Employee + EmployeeFarm (headcount + farmId filter)
    - EmployeeContract (headcount by type, expirations)
    - EmployeeStatusHistory (turnover admissions/terminations)
    - TimeEntryActivity (cost by activity/operation type)
    - Farm.totalAreaHa (cost per hectare)
    - Payable category=PAYROLL status=OVERDUE (alerts)
    - Timesheet status=PENDING_RH (alerts)
  provides:
    - GET /org/hr-dashboard endpoint (INTEGR-03)
    - HrDashboardResponse interface for future frontend plan
  affects:
    - apps/backend/src/app.ts (new router registration)
tech_stack:
  added: []
  patterns:
    - Dashboard aggregation endpoint (same pattern as financial-dashboard)
    - Decimal.js for all monetary arithmetic
    - farmId filter via EmployeeFarm join
key_files:
  created:
    - apps/backend/src/modules/hr-dashboard/hr-dashboard.types.ts
    - apps/backend/src/modules/hr-dashboard/hr-dashboard.service.ts
    - apps/backend/src/modules/hr-dashboard/hr-dashboard.routes.ts
    - apps/backend/src/modules/hr-dashboard/hr-dashboard.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'Used farms:read permission (consistent with Phase 25 HR permission pattern)'
  - 'PayrollRun.totalGross/Net/Charges used for 12-month trend (Pitfall 4: no drill into items)'
  - 'composition built from PayrollRunItem fields available in schema (overtime50/100, inssPatronal, fgtsAmount, vtDeduction, foodDeduction, housingDeduction)'
  - 'Turnover rate: standard HR formula allows rehire double-counting — documented in code'
metrics:
  duration: '~15min'
  completed: '2026-03-26'
  tasks: 2
  files_created: 4
  files_modified: 1
  tests: 15
---

# Phase 32 Plan 03: HR Dashboard Backend Endpoint Summary

**One-liner:** Backend aggregation endpoint for HR KPI dashboard returning headcount, 12-month payroll trend, composition pie, turnover rate, contract expiration forecast and alerts — all read from existing payroll/HR data with farmId scoping.

## What Was Built

New `hr-dashboard` module with a single `GET /org/hr-dashboard` endpoint that aggregates all INTEGR-03 KPIs from pre-existing data. No new database models required — pure aggregation.

### Endpoint

`GET /api/org/hr-dashboard?year=&month=&farmId=`

- `year` and `month` are required (validated 2000–2100, 1–12)
- `farmId` is optional — scopes headcount, cost, expirations, cost-by-activity through EmployeeFarm join

### Response Sections

| Section                     | Source                                                                            | Notes                                                                                |
| --------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| headcount                   | Employee.groupBy(status) + EmployeeContract.groupBy(contractType)                 | Non-DESLIGADO employees only for status count                                        |
| currentMonthCost            | PayrollRun (COMPLETED, referenceMonth)                                            | avgPerEmployee = gross/headcount, costPerHectare requires Farm.totalAreaHa           |
| trend12Months               | PayrollRun.totalGross/Net/Charges last 12 COMPLETED runs                          | Pre-computed totals — no PayrollRunItem scan (Pitfall 4)                             |
| composition                 | PayrollRunItem aggregation for current run                                        | Salários / HE (overtime50+100) / Encargos (INSS+FGTS) / Benefícios (VT+food+housing) |
| costByActivity              | TimeEntryActivity.groupBy(operationType).sum(costAmount)                          | Filtered by farmId and referenceMonth                                                |
| turnover                    | EmployeeStatusHistory.count (toStatus=ATIVO vs DESLIGADO last 12m)                | Standard HR formula: (adm+term)/2/avgHeadcount\*100                                  |
| upcomingContractExpirations | EmployeeContract where endDate in [today, +90] for SEASONAL/CLT_DETERMINATE/TRIAL | Bucketed into 30/60/90 day windows                                                   |
| alerts                      | Payable(PAYROLL,OVERDUE) + Timesheet(PENDING_RH) + EmployeeContract(expired)      | Counts only                                                                          |

## Commits

| Task | Commit   | Description                                     |
| ---- | -------- | ----------------------------------------------- |
| 1    | 403bbea8 | feat(32-03): add HR dashboard types and service |
| 2    | f26b3a10 | feat(32-03): add HR dashboard routes and tests  |

## Test Coverage

15 tests in `hr-dashboard.routes.spec.ts`:

- Headcount structure validation
- currentMonthCost with COMPLETED run
- Null costPerHectare when no farm area
- trend12Months array length and shape
- composition percentages sum to ~100
- Turnover calculation with known admissions/terminations
- upcomingContractExpirations 30/60/90 bucket structure
- Alerts counts verification
- farmId filter passed through to service
- Empty/zero graceful state
- 400 on missing year, missing month, month out of range
- 401 when not authenticated
- 500 on service error

## Deviations from Plan

None — plan executed exactly as written.

**Design note on composition field mapping:** The plan referenced `overtimePay` and `mealAllowance` fields, which don't exist in the actual `PayrollRunItem` schema. Used the correct schema fields: `overtime50`, `overtime100` for overtime and `vtDeduction`, `foodDeduction`, `housingDeduction` for benefits. This is a documentation gap in the plan, not a deviation in intent.

## Known Stubs

None — all sections return real data from the database. Empty/zero values are the correct fallback when no data exists.

## Self-Check

- [x] `apps/backend/src/modules/hr-dashboard/hr-dashboard.types.ts` — FOUND
- [x] `apps/backend/src/modules/hr-dashboard/hr-dashboard.service.ts` — FOUND
- [x] `apps/backend/src/modules/hr-dashboard/hr-dashboard.routes.ts` — FOUND
- [x] `apps/backend/src/modules/hr-dashboard/hr-dashboard.routes.spec.ts` — FOUND
- [x] commit 403bbea8 — FOUND
- [x] commit f26b3a10 — FOUND
- [x] 15/15 tests PASS

## Self-Check: PASSED
