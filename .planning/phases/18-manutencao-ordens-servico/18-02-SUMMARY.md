---
phase: 18-manutencao-ordens-servico
plan: '02'
status: complete
started: '2026-03-21'
completed: '2026-03-21'
---

## Summary

Work orders backend: full OS lifecycle service (open → EM_ANDAMENTO → AGUARDANDO_PECA → ENCERRADA/CANCELADA) with sequential numbering per org, parts management (add/remove with totalPartsCost recalculation), close with mandatory accounting treatment (DESPESA/CAPITALIZACAO/DIFERIMENTO), stock deduction via createConsumptionOutput, cost center distribution, and maintenance dashboard endpoint (availability, MTBF, MTTR, cost YTD, byStatus, costByAsset).

## Key Files

### Created
- `apps/backend/src/modules/work-orders/work-orders.service.ts`
- `apps/backend/src/modules/work-orders/work-orders.routes.ts`

### Modified
- `apps/backend/src/modules/work-orders/work-orders.routes.spec.ts`
- `apps/backend/src/app.ts`

## Commits
- `b5f7d38f` feat(18-02): work orders service — CRUD + close + dashboard

## Self-Check: PASSED
