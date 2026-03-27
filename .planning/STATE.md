---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Contabilidade e Demonstrações Financeiras
status: Ready to execute
stopped_at: Completed 35-01-PLAN.md
last_updated: "2026-03-27T09:56:13.435Z"
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 35 — plano-de-contas-e-periodos-fiscais

## Current Position

Phase: 35 (plano-de-contas-e-periodos-fiscais) — EXECUTING
Plan: 2 of 4

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.3:

- **PayrollRun state machine mirrors DepreciationRun**: PENDING → PROCESSING → COMPLETED | ERROR — same atomicity pattern
- **Payroll to Payables uses originType + originId upsert**: Prevents duplicate CPs on re-processing
- **tx.payable.create used directly in transactions**: NOT payables.service.createPayable to avoid nested withRlsContext deadlocks
- **eSocial events transmitted in strict order via BullMQ**: table events (S-1010) → cadastral events (S-2200) → periodic events (S-1200)
- **Accounting entry JSON stubs stored in v1.3**: Phase 32 created stubs (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02) — v1.4 will replace with real GL entries
- [Phase 35]: Used prisma migrate diff + deploy instead of migrate dev: shadow DB was missing tables from earlier migrations; diff generates correct SQL from live DB state
- [Phase 35]: rateio remainder goes to largest-percentage share for predictability when equal percentages exist

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa
- Confirm eSocial sandbox credentials and endpoint URLs with client
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-27T09:56:13.432Z
Stopped at: Completed 35-01-PLAN.md
Resume file: None
Next action: Define requirements and create roadmap for v1.4
