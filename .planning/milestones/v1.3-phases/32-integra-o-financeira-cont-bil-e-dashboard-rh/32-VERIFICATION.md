---
phase: 32-integra-o-financeira-cont-bil-e-dashboard-rh
verified: 2026-03-26T21:00:00Z
status: passed
score: 15/15 must-haves verified
---

# Phase 32: Integração Financeira, Contábil e Dashboard RH — Verification Report

**Phase Goal:** Ao fechar a folha, o sistema lança automaticamente todas as contas a pagar correspondentes com vencimentos legais corretos e rateio por centro de custo, registra os lançamentos contábeis por regime de competência, e o gerente pode visualizar no dashboard RH os KPIs de custo de pessoal por fazenda, atividade e cultura — fechando o ciclo entre quem trabalhou, o que produziu e quanto custou
**Verified:** 2026-03-26T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Plan must_haves + Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | closeRun creates CPs for IRRF, VT, pension, sindical in addition to existing salary/INSS/FGTS | VERIFIED | payroll-runs.service.ts lines 806, 832, 871, 961: originTypes PAYROLL_EMPLOYEE_VT, PAYROLL_EMPLOYEE_PENSION, PAYROLL_EMPLOYEE_SINDICAL, PAYROLL_EMPLOYEE_IRRF |
| 2 | Each CP created by closeRun includes PayableCostCenterItem entries with correct percentage rateio | VERIFIED | buildCostCenterItems() at line 78 + payableCostCenterItem.createMany calls at lines 788, 811, 837, 876 |
| 3 | GET cp-preview returns dry-run list of CPs-to-be-created without writing to DB, including taxGuideItems for FUNRURAL | VERIFIED | Route GET /:id/cp-preview registered at line 140-151 of routes.ts; cpPreview() function in service; CpPreviewResponse type with taxGuideItems |
| 4 | revertRun cancels ALL payable originTypes including the new ones | VERIFIED | PAYROLL_ORIGIN_TYPES array of 7 types at lines 1075-1078 in payroll-runs.service.ts |
| 5 | Cost-center percentages always sum to exactly 100 | VERIFIED | Decimal rounding fix in buildCostCenterItems (last entry = 100 - sum(others)) documented in Plan 01 and present in service |
| 6 | Closing a payroll run creates 6 canonical accounting entries by regime de competencia | VERIFIED | createPayrollEntries in accounting-entries.service.ts creates PAYROLL_SALARY, PAYROLL_CHARGES, VACATION_PROVISION, THIRTEENTH_PROVISION, TAX_LIABILITY (5 at close) + SALARY_REVERSAL on payment |
| 7 | Accounting entry creation is non-blocking — failure does not abort payroll close | VERIFIED | try/catch blocks at lines 1047-1050 and 1118-1121 in payroll-runs.service.ts |
| 8 | Settling a payroll-origin payable creates a SALARY_REVERSAL accounting entry | VERIFIED | createReversalEntry called in payables.service.ts at line 479 after PAYROLL_ORIGIN_TYPES.includes() check at line 477 |
| 9 | Accounting entries can be listed with filters and exported to CSV | VERIFIED | 3 GET endpoints in accounting-entries.routes.ts; list, getById, exportCsv in service; route registered in app.ts line 327 |
| 10 | sourceType uses AccountingSourceType enum, not a plain string | VERIFIED | accounting-entries.types.ts line 5: `import type { AccountingEntryType, AccountingSourceType } from '@prisma/client'`; schema enum AccountingSourceType at line 8742 |
| 11 | GET /org/hr-dashboard returns headcount, cost, trend, composition, turnover, expirations, alerts | VERIFIED | hr-dashboard.service.ts 527 lines; all 7 sections wired from real Prisma queries (PayrollRun, Employee, EmployeeContract, EmployeeStatusHistory, TimeEntryActivity, Payable, Timesheet) |
| 12 | User clicks Fechar Folha and sees PayrollCpReviewModal with grouped CP preview before confirming | VERIFIED | PayrollRunsPage.tsx: showCpReview state + setShowCpReview(true) on button click; PayrollCpReviewModal rendered at line 647 |
| 13 | Estorno button uses ConfirmModal variant=danger with correct copy | VERIFIED | PayrollRunDetailModal.tsx line 246: ConfirmModal with variant="danger", title "Estornar fechamento da folha?" |
| 14 | AccountingEntriesPage shows filtered list with typed badges and drill-down accordion | VERIFIED | AccountingEntriesPage.tsx 421 lines; filters, ENTRY_TYPE_BADGE_COLORS, row expansion state for accordion; route /accounting-entries in App.tsx line 276 |
| 15 | HrDashboardPage shows 4 KPI cards, 12-month BarChart, PieChart, cost by activity table, expirations in 30/60/90 days, alerts — charts lazy-loaded | VERIFIED | HrDashboardPage.tsx 572 lines; React.lazy for PayrollCostTrendChart (line 16) and PayrollCompositionChart (line 19); all 4 KPI cards, upcomingContractExpirations with 30/60/90 bucketing, alerts section |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/backend/src/modules/payroll-runs/payroll-date-utils.ts` | VERIFIED | Exists, exports nthBusinessDay, imported in payroll-runs.service.ts |
| `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` | VERIFIED | 1521 lines; closeRun + revertRun + cpPreview + buildCostCenterItems all substantive |
| `apps/backend/src/modules/payroll-runs/payroll-runs.routes.ts` | VERIFIED | GET /:id/cp-preview registered before /:id to prevent param shadowing |
| `apps/backend/src/modules/accounting-entries/accounting-entries.types.ts` | VERIFIED | AccountingEntryType, AccountingSourceType, ACCOUNT_CODES exported |
| `apps/backend/src/modules/accounting-entries/accounting-entries.service.ts` | VERIFIED | 444 lines; createPayrollEntries, createReversalEntry, revertPayrollEntries, list, exportCsv |
| `apps/backend/src/modules/accounting-entries/accounting-entries.routes.ts` | VERIFIED | 3 GET endpoints, /export/csv before /:id, registered in app.ts |
| `apps/backend/src/modules/hr-dashboard/hr-dashboard.types.ts` | VERIFIED | HrDashboardResponse, HrDashboardQuery exported |
| `apps/backend/src/modules/hr-dashboard/hr-dashboard.service.ts` | VERIFIED | 527 lines; getHrDashboard aggregates from 8 data models |
| `apps/backend/src/modules/hr-dashboard/hr-dashboard.routes.ts` | VERIFIED | GET /org/hr-dashboard wired to getHrDashboard service |
| `apps/frontend/src/types/payroll-integration.ts` | VERIFIED | CpPreviewItem, TaxGuidePreviewItem, CpPreviewResponse interfaces |
| `apps/frontend/src/hooks/useCpPreview.ts` | VERIFIED | Fetches /org/:orgId/payroll-runs/:runId/cp-preview |
| `apps/frontend/src/components/payroll/PayrollCpReviewModal.tsx` | VERIFIED | 325 lines; grouped sections, reconciliation, taxGuideItems, ConfirmModal variant=danger wiring |
| `apps/frontend/src/types/accounting-entries.ts` | VERIFIED | AccountingEntryType/AccountingSourceType enums, ENTRY_TYPE_LABELS, ENTRY_TYPE_BADGE_COLORS |
| `apps/frontend/src/hooks/useAccountingEntries.ts` | VERIFIED | Fetches /org/:orgId/accounting-entries; exportCsv via blob URL download |
| `apps/frontend/src/pages/AccountingEntriesPage.tsx` | VERIFIED | 421 lines; filters, typed badges, accordion, mobile cards, CSV export |
| `apps/frontend/src/types/hr-dashboard.ts` | VERIFIED | HrDashboardQuery, HrDashboardResponse interfaces |
| `apps/frontend/src/hooks/useHrDashboard.ts` | VERIFIED | Fetches /org/hr-dashboard with year/month/farmId params |
| `apps/frontend/src/components/hr-dashboard/PayrollCostTrendChart.tsx` | VERIFIED | Recharts stacked BarChart, default export for React.lazy |
| `apps/frontend/src/components/hr-dashboard/PayrollCompositionChart.tsx` | VERIFIED | Recharts PieChart, default export for React.lazy |
| `apps/frontend/src/pages/HrDashboardPage.tsx` | VERIFIED | 572 lines; all KPI sections, lazy charts, 30/60/90 expirations, alerts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| payroll-runs.service.ts closeRun | tx.payable.create (4 new originTypes) | PAYROLL_EMPLOYEE_IRRF/VT/PENSION/SINDICAL | VERIFIED | Lines 806, 832, 871, 961 confirmed |
| payroll-runs.service.ts closeRun | tx.payableCostCenterItem.createMany | buildCostCenterItems helper | VERIFIED | Lines 788, 811, 837, 876 confirmed |
| payroll-runs.service.ts revertRun | tx.payable.updateMany (OR 7 originTypes) | PAYROLL_ORIGIN_TYPES array | VERIFIED | Lines 1075-1078, explicit array not string prefix |
| payroll-runs.service.ts closeRun | accounting-entries.service.ts createPayrollEntries | try/catch non-blocking AFTER transaction | VERIFIED | Lines 1047-1050 |
| payables.service.ts settlePayment | accounting-entries.service.ts createReversalEntry | try/catch after PAYROLL_ORIGIN_TYPES.includes() check | VERIFIED | Lines 467-479 |
| hr-dashboard.service.ts | PayrollRun.totalGross/Net/Charges | groupBy referenceMonth for 12-month trend | VERIFIED | prisma.payrollRun.findMany at line 244 |
| hr-dashboard.service.ts | EmployeeStatusHistory | count admissions/terminations for turnover | VERIFIED | employeeStatusHistory.count at lines 386, 393 |
| hr-dashboard.service.ts | EmployeeContract.endDate | findMany where endDate in [today, +90] | VERIFIED | employeeContract.findMany at line 432 |
| PayrollCpReviewModal | GET /org/:orgId/payroll-runs/:id/cp-preview | useCpPreview hook | VERIFIED | useCpPreview.ts line 23: api call confirmed |
| PayrollRunsPage Fechar Folha button | PayrollCpReviewModal | useState showCpReview + selectedRunIdForClose | VERIFIED | PayrollRunsPage.tsx lines 81, 136 |
| PayrollRunDetailModal Estornar button | ConfirmModal variant=danger | useState showEstornoConfirm | VERIFIED | PayrollRunDetailModal.tsx lines 246-252 |
| AccountingEntriesPage | GET /org/accounting-entries | useAccountingEntries hook | VERIFIED | useAccountingEntries.ts line 33 |
| HrDashboardPage | PayrollCostTrendChart (lazy) | React.lazy + Suspense | VERIFIED | HrDashboardPage.tsx lines 16-17, 413 |
| HrDashboardPage | PayrollCompositionChart (lazy) | React.lazy + Suspense | VERIFIED | HrDashboardPage.tsx lines 19-20, 428 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| HrDashboardPage | data (HrDashboardResponse) | GET /org/hr-dashboard via useHrDashboard → hr-dashboard.service.ts getHrDashboard | Yes — 8 Prisma queries on PayrollRun, Employee, EmployeeContract, EmployeeStatusHistory, TimeEntryActivity, Farm, Payable, Timesheet | FLOWING |
| PayrollCpReviewModal | data (CpPreviewResponse) | GET /:id/cp-preview via useCpPreview → payroll-runs.service.ts cpPreview() | Yes — dry-run computation from PayrollRun + items + TaxGuide | FLOWING |
| AccountingEntriesPage | entries (AccountingEntry[]) | GET /org/accounting-entries via useAccountingEntries → accounting-entries.service.ts list() | Yes — prisma.accountingEntry.findMany with filters | FLOWING |
| PayrollCostTrendChart | data (trend12Months array) | Passed from HrDashboardPage props, sourced from PayrollRun.totalGross/Net/Charges | Yes — real payroll run totals | FLOWING |
| PayrollCompositionChart | data (composition array) | Passed from HrDashboardPage props, sourced from PayrollRunItem aggregation | Yes — real item-level sums | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| payroll-runs tests (34 tests) | `npx jest --testPathPattern="payroll-runs" --no-coverage` | 3 suites, 34 tests PASS | PASS |
| accounting-entries tests (18 tests) | `npx jest --testPathPattern="accounting-entries" --no-coverage` | 1 suite, 18 tests PASS | PASS |
| hr-dashboard tests (15 tests) | `npx jest --testPathPattern="hr-dashboard" --no-coverage` | 1 suite, 15 tests PASS | PASS |
| Frontend TypeScript compilation | `cd apps/frontend && npx tsc --noEmit` | No output (no errors) | PASS |
| AccountingEntry model in schema | grep AccountingEntry prisma/schema.prisma | Model found at line 8833 with AccountingSourceType enum (line 8742) | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTEGR-01 | 32-01, 32-04 | CP generation at payroll close — 7 types, vencimentos legais, rateio CC, revisão pré-confirmação, estorno/rollback | SATISFIED | closeRun creates 7 CP types; PayrollCpReviewModal wired; ConfirmModal estorno; revertRun covers all 7 originTypes |
| INTEGR-02 | 32-02, 32-04 | Lançamentos contábeis por regime de competência — 5 entry types at close, SALARY_REVERSAL on payment, AccountingEntriesPage | SATISFIED | createPayrollEntries creates 5 entries non-blocking; createReversalEntry on settlePayment; AccountingEntriesPage with filters and CSV |
| INTEGR-03 | 32-03, 32-05 | Dashboard RH com KPIs — headcount, custo folha, custo/ha, evolução 12m, composição, custo/atividade, turnover, vencimentos safra, alertas | SATISFIED | hr-dashboard backend endpoint aggregates all KPIs; HrDashboardPage renders all sections with charts |

No orphaned requirements — REQUIREMENTS.md lines 107-109 confirm all 3 as Complete in Phase 32.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| hr-dashboard.service.ts | 342-343 | `return []` in `_emptyComposition()` | Info | Legitimate fallback helper for no-data state; not a stub — composition function calls this only when no PayrollRun found |

No blockers or warnings found. The single `return []` is a named fallback helper (`_emptyComposition`), not a stub — it is only invoked when there is genuinely no payroll run data for the month.

---

### Human Verification Required

#### 1. PayrollCpReviewModal UX Flow

**Test:** Navigate to a PayrollRun in CALCULATED status, click "Fechar Folha", verify the review modal opens with grouped CP sections, reconciliation row showing green check (or orange warning), and a "Guias e Tributos" section when FUNRURAL guides exist.
**Expected:** Modal opens with data loaded, sections collapsible via details/summary, "Confirmar Fechamento" button triggers actual close with success toast.
**Why human:** Visual layout, animation (300ms), skeleton loading appearance, and toast message cannot be verified programmatically.

#### 2. AccountingEntriesPage Badge Colors and Accordion

**Test:** Navigate to /accounting-entries, verify colored badges per entry type (PAYROLL_SALARY, PAYROLL_CHARGES, etc.), click a row to expand inline accordion showing debitLabel + creditLabel.
**Expected:** Badges match UI-SPEC color table; accordion expands with 200ms ease-out animation; ORIGEM column shows [FOLHA-YYYY-MM] pill.
**Why human:** Badge color correctness, animation behavior, and mobile card layout at 375px require visual inspection.

#### 3. HrDashboardPage Charts Lazy Load

**Test:** Navigate to /hr-dashboard, observe chart skeleton placeholders while charts load, verify stacked BarChart shows 3 series (Bruto/Liquido/Encargos) and PieChart shows composition breakdown with percentages.
**Expected:** Recharts charts render correctly with pt-BR month labels on X-axis; tooltip shows BRL-formatted values.
**Why human:** Chart rendering and tooltip formatting require visual verification in browser.

#### 4. farmId Filter Scoping

**Test:** With multiple farms, select a specific farm in the HrDashboardPage filter, verify all sections (headcount, cost, expirations, cost-by-activity) update to show farm-scoped data.
**Expected:** All 7 dashboard sections reflect only the selected farm's data.
**Why human:** Requires live database with multi-farm test data; filter behavior cannot be fully verified by unit tests alone.

---

### Gaps Summary

No gaps found. All 15 observable truths are verified at all four levels (exists, substantive, wired, data-flowing). The 67 backend tests (34 payroll-runs + 18 accounting-entries + 15 hr-dashboard) all pass. The frontend compiles clean with no TypeScript errors.

**Note on 32-05-SUMMARY.md:** The summary file was committed in commit `dcb16bda` but is absent from the working tree (lost in a subsequent merge conflict resolution in commit `07acdff8`). The code it documents — HrDashboardPage, PayrollCostTrendChart, PayrollCompositionChart, useHrDashboard, hr-dashboard types — is fully present, verified, and working. The missing SUMMARY.md is a documentation artifact only and does not affect goal achievement.

---

_Verified: 2026-03-26T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
