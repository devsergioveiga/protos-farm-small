---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Contabilidade e Demonstrações Financeiras
status: Defining requirements
stopped_at: null
last_updated: "2026-03-26"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Milestone v1.4 — Contabilidade e Demonstrações Financeiras

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-26 — Milestone v1.4 started

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.3:

- **PayrollRun state machine mirrors DepreciationRun**: PENDING → PROCESSING → COMPLETED | ERROR — same atomicity pattern
- **Payroll to Payables uses originType + originId upsert**: Prevents duplicate CPs on re-processing
- **tx.payable.create used directly in transactions**: NOT payables.service.createPayable to avoid nested withRlsContext deadlocks
- **eSocial events transmitted in strict order via BullMQ**: table events (S-1010) → cadastral events (S-2200) → periodic events (S-1200)
- **Accounting entry JSON stubs stored in v1.3**: Phase 32 created stubs (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02) — v1.4 will replace with real GL entries

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa
- Confirm eSocial sandbox credentials and endpoint URLs with client
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-26
Stopped at: Milestone v1.4 initialization
Resume file: None
Next action: Define requirements and create roadmap for v1.4
