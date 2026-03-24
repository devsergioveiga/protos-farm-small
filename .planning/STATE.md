---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: RH e Folha de Pagamento Rural
status: Defining requirements
stopped_at: ""
last_updated: "2026-03-23T21:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Defining requirements for v1.3 RH e Folha

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-23 — Milestone v1.3 started

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.2:

- **AssetAcquisition never routes through GoodsReceipt**: Separate module with originType = ASSET_ACQUISITION on CP
- **Decimal-only depreciation**: All depreciation arithmetic uses Decimal from decimal.js
- **OS accounting treatment is mandatory**: PATCH /work-orders/:id/close returns 400 if accountingTreatment absent
- **tx.payable.create used directly in transactions**: NOT payables.service.createPayable to avoid nested withRlsContext deadlocks

### Pending Todos

- Test react-spreadsheet-import React 19 compatibility before committing to bulk import stories
- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-23
Stopped at: Milestone v1.3 initialized, defining requirements
Resume file: None
Next action: Define requirements and create roadmap
