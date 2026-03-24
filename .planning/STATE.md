---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: RH e Folha de Pagamento Rural
status: Phase complete — ready for verification
stopped_at: Completed 25-04-PLAN.md — Phase 25 complete, human verification approved
last_updated: "2026-03-24T08:34:20.050Z"
progress:
  total_phases: 26
  completed_phases: 19
  total_plans: 82
  completed_plans: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 25 — cadastro-de-colaboradores-e-contratos

## Current Position

Phase: 25 (cadastro-de-colaboradores-e-contratos) — COMPLETE
Plan: 4 of 4 (all plans complete, human verification approved)

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

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa before implementing Phase 26
- Confirm eSocial sandbox credentials and endpoint URLs with client before Phase 31 begins
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS) before Phase 31 — infrastructure decision
- Confirm whether regional minimum wage table per state is needed or federal minimum is acceptable for v1.3 (affects moradia/alimentação deduction caps)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-24T08:34:20.046Z
Stopped at: Completed 25-04-PLAN.md — Phase 25 complete, human verification approved
Resume file: None
Next action: Run /gsd:plan-phase 25 to plan Cadastro de Colaboradores e Contratos
