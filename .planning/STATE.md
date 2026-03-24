---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: RH e Folha de Pagamento Rural
status: planning
stopped_at: Phase 25 context gathered
last_updated: "2026-03-24T01:22:54.264Z"
last_activity: 2026-03-23 — Roadmap v1.3 created (Phases 25-32, 27 requirements mapped)
progress:
  total_phases: 26
  completed_phases: 18
  total_plans: 78
  completed_plans: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** v1.3 RH e Folha de Pagamento Rural — Phase 25 is next (Cadastro de Colaboradores e Contratos)

## Current Position

Phase: 25 — Cadastro de Colaboradores e Contratos (not started)
Plan: —
Status: Roadmap created, ready to plan Phase 25
Last activity: 2026-03-23 — Roadmap v1.3 created (Phases 25-32, 27 requirements mapped)

Progress bar: [........] 0/8 phases complete

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

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa before implementing Phase 26
- Confirm eSocial sandbox credentials and endpoint URLs with client before Phase 31 begins
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS) before Phase 31 — infrastructure decision
- Confirm whether regional minimum wage table per state is needed or federal minimum is acceptable for v1.3 (affects moradia/alimentação deduction caps)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-24T01:22:54.251Z
Stopped at: Phase 25 context gathered
Resume file: .planning/phases/25-cadastro-de-colaboradores-e-contratos/25-CONTEXT.md
Next action: Run /gsd:plan-phase 25 to plan Cadastro de Colaboradores e Contratos
