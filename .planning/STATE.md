---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: RH e Folha de Pagamento Rural
status: Ready to plan
stopped_at: Phase 34 context gathered
last_updated: "2026-03-26T22:35:23.471Z"
progress:
  total_phases: 28
  completed_phases: 27
  total_plans: 121
  completed_plans: 121
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 33 — wire-employee-data-safety-pages

## Current Position

Phase: 34
Plan: Not started

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.2:

- **AssetAcquisition never routes through GoodsReceipt**: Separate module with originType = ASSET_ACQUISITION on CP
- **Decimal-only depreciation**: All depreciation arithmetic uses Decimal from decimal.js
- **OS accounting treatment is mandatory**: PATCH /work-orders/:id/close returns 400 if accountingTreatment absent
- **tx.payable.create used directly in transactions**: NOT payables.service.createPayable to avoid nested withRlsContext deadlocks

Key decisions for v1.3:

- **PayrollRun state machine mirrors DepreciationRun**: PENDING → PROCESSING → COMPLETED | ERROR — same atomicity pattern
- **Payroll to Payables uses originType + originId upsert**: Prevents duplicate CPs on re-processing — schema constraint added in Phase 25 schema migration
- **EmployeeSalaryHistory is mandatory from day one**: Provisions and termination calculations require history, not just current salary
- **Time entries locked by payrollRunId**: When a run reaches CALCULATED state, attendance records become immutable — mobile offline sync checks lock before applying edits
- **INSS is progressive (bracket accumulation), not flat-rate**: Unit tests against official Receita Federal 2026 tables are required before any payroll run
- **Rural labor rules diverge from urban CLT**: Night shift 21h-5h at 25% (not 22h-5h at 20%), safra termination has no 40% FGTS penalty, FUNRURAL is farm-level annual election
- **eSocial events transmitted in strict order via BullMQ**: table events (S-1010) → cadastral events (S-2200) → periodic events (S-1200) — separate named queues enforce ordering
- **New npm dependencies for v1.3**: xmlbuilder2@^4.0.3 (eSocial XML), xml-crypto@^6.1.2 (ICP-Brasil signing), pdfkit-table@^0.1.99 (payslip tables), date-holidays@^3.26.11 (holiday calendars for DSR/overtime)
- [Phase 25]: BankAccountType renamed to EmployeeBankAccountType for HR module to avoid collision with financial module's existing BankAccountType enum
- [Phase 25]: prisma db push + migrate resolve used for employee foundation migration due to shadow DB being out of sync — migration SQL created manually and marked as applied
- [Phase 25]: CONTRACT_EXPIRY notification type added to NOTIFICATION_TYPES for cron alerts
- [Phase 25]: HR endpoints use farms:read permission (hr module not yet in PermissionModule type)
- [Phase 25]: Frontend hooks follow useState+useCallback pattern (no SWR) matching existing useAnimals pattern
- [Phase 25]: Bulk preview uses two-level validation: ERROR blocks confirm, WARNING allows confirm
- [Phase 26]: Used prisma db push + migrate resolve for Phase 26 Plan 01 (shadow DB out of sync — same pattern as Phase 25)
- [Phase 26]: FUNRURAL 2026 implemented as two PayrollLegalTable rows (Jan-Mar effectiveFrom 2026-01-01 and Apr-Dec effectiveFrom 2026-04-01)
- [Phase 26]: INSS uses upTo-boundary approach to avoid 1-cent discrepancy at bracket boundaries; total rounding per Portaria MPS/MF nº 13/2026
- [Phase 26]: IRRF exemption sets redutor=grossTax (transparent tracking of exemption mechanism via 2026 Lei 15.079/2024 redutor)
- [Phase 26]: Added 'write' to PermissionAction type for payroll-params module — MANAGER gets read+write, FINANCIAL gets read
- [Phase 26]: Route /effective registered before /:id in payroll-tables routes to prevent Express param route shadowing
- [Phase 26]: Removed sonner dependency from payroll hooks — using error/successMessage state return pattern instead
- [Phase 27]: calcDailyWork accepts optional previousClockOut + clockIn pair for interjornada — avoids coupling to caller's clock-in data model
- [Phase 27]: Holiday cache keyed by BR-state-city — ensures single Holidays instance per locale across test runs
- [Phase 27-controle-de-ponto-e-jornada]: TimeEntry.payrollRunId as immutable lock — set once when payroll run processes the entry
- [Phase 27-controle-de-ponto-e-jornada]: Timesheet unique constraint on (employeeId, referenceMonth) — one timesheet per employee per month
- [Phase 27-controle-de-ponto-e-jornada]: TimeEntryError/TimesheetError custom error classes added to types files for consistent error handling in routes
- [Phase 27-controle-de-ponto-e-jornada]: APPROVE_MANAGER auto-advances to PENDING_RH in state machine per RESEARCH.md pattern
- [Phase 27-04]: api.getBlob used for PDF export in useTimesheet — api.get only takes one argument
- [Phase 28]: Batch advance uses per-employee createAdvance calls (not one big tx) for isolation — a single failure doesn't abort the whole batch
- [Phase 28]: UTC date methods used in pro-rata (getUTCFullYear/Month/Date) to prevent timezone off-by-one on ISO date strings
- [Phase 28]: EngineParams interface encapsulates legal table values — callers load from DB once and pass to pure calculation functions
- [Phase 28]: THIRTEENTH runs skip timesheet gate — 13th salary calculation does not require an approved timesheet
- [Phase 28]: SalaryAdvanceModal uses no-arg useSalaryAdvances (useAuth internally) matching project hook pattern
- [Phase 28]: BatchAdvanceInput.percentOfSalary matches backend — linter rewrote with advances array but was reverted
- [Phase 28-processamento-da-folha-mensal]: ConfirmDeleteModal reused for estorno typing confirmation — matches high-criticality pattern from CLAUDE.md
- [Phase 29]: calcPaymentDueDate skips weekends only (no holiday lib) — CLT Art. 145 minimum requirement met
- [Phase 29]: Absence overlap check uses returnDate=null (open absence) not date-range — correct for Brazilian labor law
- [Phase 29]: getAbsenceImpactForMonth accepts TxClient directly — called from payroll engine inside transactions
- [Phase 29-ferias-afastamentos-rescisao-e-provisoes]: Route order: /report/export before /report before /:id prevents Express 5 param shadowing (payroll-provisions)
- [Phase 29-ferias-afastamentos-rescisao-e-provisoes]: Accounting entry JSON stubs stored now, Phase 32 will wire to real GL entries (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02)
- [Phase 29-02]: FGTS penalty rates: WITHOUT_CAUSE=40%, MUTUAL_AGREEMENT=20% (Lei 13.467/2017), others=0% — single source of truth in FGTS_PENALTY constant
- [Phase 29-02]: fgtsBalanceOverride field allows manual override for actual CAIXA FGTS statement; otherwise estimates from 8% x gross payroll items
- [Phase 29]: All column headers rendered ALL CAPS per design system — acceptance criterion verified case-insensitively
- [Phase 29]: VacationScheduleModal Step 3 shows estimated calculation — definitive values computed server-side on confirm
- [Phase 29]: ConfirmModal variant=danger for rescisao (medium criticality), variant=warning for estorno (reversible)
- [Phase 30-seguranca-trabalho-nr31]: TrainingType.organizationId is nullable for system-global NR-31 types; classifyExpiryAlert() shared helper in safety-compliance.types.ts
- [Phase 30-seguranca-trabalho-nr31]: findFirst+create for NR-31 seed: Postgres null!=null in unique constraints with nullable organizationId
- [Phase 30-seguranca-trabalho-nr31]: Training routes use employees:read/employees:manage (no hr: module in PermissionModule)
- [Phase 30-seguranca-trabalho-nr31]: Stock deduction inline in withRlsContext transaction (not via service call) to avoid nested transaction anti-pattern
- [Phase 30-seguranca-trabalho-nr31]: jest.config.js .js→.ts moduleNameMapper added to unblock all tests after plan 30-01 ESM-style app.ts imports
- [Phase 30-seguranca-trabalho-nr31]: Phase 30 routers registered before employeesRouter in app.ts — GET /org/medical-exams/employees/:employeeId conflicts with GET /org/:orgId/employees/:id
- [Phase 30-seguranca-trabalho-nr31]: ComplianceStatusBadge in components/shared/ (reused by EPI, training, ASO); placeholder pages for plans 06/07
- [Phase 30]: ComplianceStatusBadge shared between training and ASO expiry tracking
- [Phase 30]: Multi-step modal for TrainingRecordModal (Step 1 data, Step 2 participants); hours warning does not block save
- [Phase 30]: SafetyKpiCard in components/shared/ (not payroll/) for reuse; exportPdf opens blob URL in new tab with 10s revoke
- [Phase 31]: FunruralBasis defaults to PAYROLL on Organization — rural employers who opted for payroll-based FUNRURAL (more common in small farms)
- [Phase 31]: EsocialStatus uses Portuguese values (PENDENTE/EXPORTADO/ACEITO/REJEITADO) per eSocial specification naming
- [Phase 31-obriga-es-acess-rias-e-esocial]: Permission strings use payroll-params:read/write (not payroll:read/manage) matching existing enum
- [Phase 31-obriga-es-acess-rias-e-esocial]: FUNRURAL rate from PayrollLegalTable FUNRURAL type scalarValues[key=rate], fallback 2.7%
- [Phase 31-obriga-es-acess-rias-e-esocial]: xmlbuilder2 for all eSocial XML generation — never string concatenation; @xmldom/xmldom for XSD structural validation via JS-translated constraint records
- [Phase 31-obriga-es-acess-rias-e-esocial]: Auto-trigger hooks wrapped in try/catch — eSocial generation failures logged but never propagate to fail primary operations (createEmployee, confirmTermination, closeRun, createMedicalExam)
- [Phase 31-obriga-es-acess-rias-e-esocial]: Used payroll-params:read/write permissions for income-statements routes — payroll:read/manage not in RBAC enum
- [Phase 31-obriga-es-acess-rias-e-esocial]: downloadEvent uses raw fetch to distinguish XML blob from XSD validation JSON error by Content-Type inspection
- [Phase 31-obriga-es-acess-rias-e-esocial]: Used body (not message) for Notification.create per schema
- [Phase 31-obriga-es-acess-rias-e-esocial]: EsocialEventsPage and IncomeStatementsPage created in plan-05 (missing from plan-04 disk)
- [Phase 32]: IRRF is aggregated per run (one CP), not per employee — simplifies reconciliation
- [Phase 32]: revertRun uses PAYROLL_ORIGIN_TYPES const array covering all 7 types in a single OR filter
- [Phase 32-integra-o-financeira-cont-bil-e-dashboard-rh]: HR dashboard uses farms:read permission (Phase 25 pattern); PayrollRun pre-computed totals used for 12-month trend to avoid PayrollRunItem scan
- [Phase 32]: PAYROLL_PROVISION entries use runId as sourceId for easy revert by run; revertPayrollEntries makes 2 deleteMany calls to cover all 5 entry types
- [Phase 32-integra-o-financeira-cont-bil-e-dashboard-rh]: ConfirmModal variant=danger replaces ConfirmDeleteModal for payroll estorno (medium criticality, reversible)
- [Phase 32-integra-o-financeira-cont-bil-e-dashboard-rh]: CONTABILIDADE sidebar group added (separate from RH) for accounting entries
- [Phase 32-integra-o-financeira-cont-bil-e-dashboard-rh]: HrDashboardPage uses inline year+month selects (not period picker) to match backend hr-dashboard explicit year+month params
- [Phase 33]: employeeOptions useMemo mapping uses farms[0].position for flat shape — matches existing modal prop contracts
- [Phase 33]: listEmployees position select extended with asoPeriodicityMonths only — getEmployee detail method left unchanged

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa before implementing Phase 26
- Confirm eSocial sandbox credentials and endpoint URLs with client before Phase 31 begins
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS) before Phase 31 — infrastructure decision
- Confirm whether regional minimum wage table per state is needed or federal minimum is acceptable for v1.3 (affects moradia/alimentação deduction caps)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-26T22:35:23.462Z
Stopped at: Phase 34 context gathered
Resume file: .planning/phases/34-wire-absence-impact-payroll-engine/34-CONTEXT.md
Next action: Run /gsd:plan-phase 25 to plan Cadastro de Colaboradores e Contratos
