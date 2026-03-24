---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: RH e Folha de Pagamento Rural
status: Ready to execute
stopped_at: Completed 28-04-PLAN.md
last_updated: "2026-03-24T21:45:30.393Z"
progress:
  total_phases: 26
  completed_phases: 21
  total_plans: 98
  completed_plans: 97
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 28 — processamento-da-folha-mensal

## Current Position

Phase: 28 (processamento-da-folha-mensal) — EXECUTING
Plan: 6 of 6

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

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa before implementing Phase 26
- Confirm eSocial sandbox credentials and endpoint URLs with client before Phase 31 begins
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS) before Phase 31 — infrastructure decision
- Confirm whether regional minimum wage table per state is needed or federal minimum is acceptable for v1.3 (affects moradia/alimentação deduction caps)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-24T21:45:30.389Z
Stopped at: Completed 28-04-PLAN.md
Resume file: None
Next action: Run /gsd:plan-phase 25 to plan Cadastro de Colaboradores e Contratos
