---
phase: 20-alienacao-baixa-ativos
plan: "02"
subsystem: backend
tags: [assets, farm-transfers, inventory, reconciliation]
dependency_graph:
  requires: ["20-00"]
  provides: ["DISP-04", "DISP-05"]
  affects: ["asset-farm-transfers", "asset-inventory", "app.ts"]
tech_stack:
  added: []
  patterns: ["prisma.$transaction direct (no withRlsContext)", "DRAFT->COUNTING->RECONCILED state machine", "same-org guard on destination farm"]
key_files:
  created:
    - apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.service.ts
    - apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.routes.ts
    - apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.routes.spec.ts
    - apps/backend/src/modules/asset-inventory/asset-inventory.service.ts
    - apps/backend/src/modules/asset-inventory/asset-inventory.routes.ts
    - apps/backend/src/modules/asset-inventory/asset-inventory.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - "prisma.$transaction used directly in both modules (consistent with asset-acquisitions pattern to avoid nested withRlsContext deadlocks)"
  - "divergenceCount computed in-memory from items where physicalStatus != ENCONTRADO and physicalStatus is not null"
  - "createInventory loads ATIVO, INATIVO, EM_MANUTENCAO assets (excludes ALIENADO and EM_ANDAMENTO)"
metrics:
  duration: 259s
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
  tests_added: 16
---

# Phase 20 Plan 02: Asset Farm Transfers + Inventory Reconciliation Summary

**One-liner:** Farm transfer with same-org guard + DRAFT->COUNTING->RECONCILED inventory state machine, both with full integration tests wired in app.ts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Asset farm transfers service + routes + tests | 3ae00cfa | 3 created + app.ts |
| 2 | Asset inventory service + routes + tests + app.ts wiring | 17e1a152 | 3 created |

## What Was Built

### Task 1: Asset Farm Transfers (DISP-04)

**Service** (`asset-farm-transfers.service.ts`):
- `createTransfer`: atomic `prisma.$transaction` — finds asset (404 if missing), guards ALIENADO (400), validates destination farm same-org (400), guards same-farm transfer, creates `AssetFarmTransfer` record, updates `asset.farmId` and `asset.costCenterId`
- `listTransfers`: paginated query ordered by `transferDate desc`, includes farm names

**Routes** (`asset-farm-transfers.routes.ts`):
- `POST /org/:orgId/asset-farm-transfers/:assetId/transfer` — `assets:update` permission
- `GET /org/:orgId/asset-farm-transfers/:assetId/transfers` — `assets:read` permission

**Tests** (7 passing):
1. Creates transfer + returns 201
2. Updates costCenterId when toCostCenterId provided
3. Rejects destination farm from different org
4. Rejects ALIENADO asset
5. Rejects non-existent asset (404)
6. Lists transfer history
7. Returns empty array for asset with no transfers

### Task 2: Asset Inventory (DISP-05)

**Service** (`asset-inventory.service.ts`):
- `createInventory`: creates DRAFT, auto-loads ATIVO/INATIVO/EM_MANUTENCAO assets (excludes ALIENADO), optional farmId filter
- `countItems`: DRAFT->COUNTING transition on first count, rejects RECONCILED/CANCELLED
- `reconcileInventory`: COUNTING->RECONCILED, sets `reconciledAt`+`reconciledBy`, rejects DRAFT with "Realize a contagem antes de conciliar"
- `getInventory`: full detail with computed `itemCount`, `countedCount`, `divergenceCount`
- `listInventories`: paginated with status/farmId filters

**Routes** (`asset-inventory.routes.ts`):
- `POST /org/:orgId/asset-inventories` — creates inventory
- `GET /org/:orgId/asset-inventories` — list
- `GET /org/:orgId/asset-inventories/:id` — detail
- `PATCH /org/:orgId/asset-inventories/:id/count` — count items
- `POST /org/:orgId/asset-inventories/:id/reconcile` — reconcile

**Tests** (9 passing):
1. Creates DRAFT inventory with ATIVO assets
2. farmId filter works
3. Count transitions to COUNTING
4. Count rejects RECONCILED
5. Reconcile transitions to RECONCILED with timestamp
6. Reconcile rejects DRAFT
7. GET detail returns items
8. GET list paginated
9. divergenceCount correctly counts non-ENCONTRADO items

## Deviations from Plan

None — plan executed exactly as written.

Note: During app.ts wiring, the linter auto-added `assetDisposalsRouter` import (pre-existing requirement from Phase 20-01 work). This was an automatic fix, not a deviation.

## Self-Check: PASSED

All 6 created files exist. Both commits verified: `3ae00cfa` and `17e1a152`.
Combined test suite: 16/16 tests passing (2 test suites).
