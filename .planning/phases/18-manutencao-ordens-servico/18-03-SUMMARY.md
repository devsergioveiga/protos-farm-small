---
phase: 18-manutencao-ordens-servico
plan: '03'
status: complete
started: '2026-03-21'
completed: '2026-03-21'
---

## Summary

Spare parts compatibility and maintenance provisions backend: CRUD for part-asset compatibility (SparePartAssetCompat join table), provision configuration (per-asset or fleet-level monthly amounts), monthly cron for provision entries, and reconciliation report (provisioned vs actual cost by period and asset).

## Key Files

### Created
- `apps/backend/src/modules/maintenance-provisions/maintenance-provisions.service.ts`
- `apps/backend/src/modules/maintenance-provisions/maintenance-provisions.routes.ts`
- `apps/backend/src/modules/spare-parts/spare-parts.service.ts`
- `apps/backend/src/modules/spare-parts/spare-parts.routes.ts`
- `apps/backend/src/shared/cron/maintenance-provision.cron.ts`

### Modified
- `apps/backend/src/modules/maintenance-provisions/maintenance-provisions.routes.spec.ts`
- `apps/backend/src/app.ts`

## Commits
- `9d682146` feat(18-03): spare parts compatibility + maintenance provisions service and routes

## Self-Check: PASSED
