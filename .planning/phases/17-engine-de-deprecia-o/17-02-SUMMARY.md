---
phase: 17-engine-de-deprecia-o
plan: '02'
subsystem: depreciation-backend
tags: [depreciation, batch, cron, rbac, api]
dependency_graph:
  requires: [17-01]
  provides: [depreciation-api, depreciation-batch, depreciation-cron]
  affects: [app.ts, permissions.ts, main.ts]
tech_stack:
  added: []
  patterns:
    [
      per-asset-transactions,
      redis-distributed-lock,
      idempotent-p2002-catch,
      cc-reconciliation-assertion,
    ]
key_files:
  created:
    - apps/backend/src/modules/depreciation/depreciation.service.ts
    - apps/backend/src/modules/depreciation/depreciation-batch.service.ts
    - apps/backend/src/modules/depreciation/depreciation.routes.ts
    - apps/backend/src/shared/cron/depreciation.cron.ts
  modified:
    - apps/backend/src/modules/depreciation/depreciation-batch.spec.ts
    - apps/backend/src/modules/depreciation/depreciation.routes.spec.ts
    - apps/backend/src/shared/rbac/permissions.ts
    - apps/backend/src/app.ts
    - apps/backend/src/main.ts
decisions:
  - Per-asset transactions (not one big transaction) to avoid timeout per Research pitfall 2
  - Null-safety guards for nullable acquisitionValue/acquisitionDate before calling computeDepreciation
  - disposalDate not in schema — pass null to engine (future work if disposal date tracking added)
  - FINANCIAL role gets depreciation read+update (accountants need to configure and run)
metrics:
  duration: 627s
  completed: '2026-03-20'
  tasks: 3
  files: 9
requirements: [DEPR-01, DEPR-02, CCPA-01, CCPA-02]
---

# Phase 17 Plan 02: Depreciation Backend API Summary

**One-liner:** Full depreciation backend: config CRUD + idempotent batch with per-asset transactions + CC distribution + monthly cron with Redis lock + 9 REST endpoints + 35 tests.

## What Was Built

### Task 1: Config CRUD service + batch processor + reversal + batch tests

**`depreciation.service.ts`** — Config CRUD + report query:

- `createConfig`: validates asset depreciability (rejects NON_DEPRECIABLE_CPC27/FAIR_VALUE_CPC29)
- `getConfig`, `updateConfig`, `deleteConfig`
- `getReport`: paginated entries with optional `assetId` filter for per-asset view
- `exportReport`: CSV or XLSX (ExcelJS) with currency-formatted columns
- `getLastRun`: latest DepreciationRun for period

**`depreciation-batch.service.ts`** — Batch processing + reversal:

- `runDepreciationBatch`: per-asset individual transactions (avoids large-transaction timeout), P2002 catch for idempotence, CC distribution with reconciliation assertion, all-org enumeration for empty `organizationId` (cron mode)
- `reverseEntry`: creates negative entry, marks original with `reversedAt`, deletes CC items

**`depreciation-batch.spec.ts`** — 14 tests covering all batch and reversal behaviors.

### Task 2: Routes + integration tests

**`depreciation.routes.ts`** — 9 Express endpoints:

- `POST /config` → createConfig (create)
- `GET /config/:assetId` → getConfig (read)
- `PATCH /config/:assetId` → updateConfig (update)
- `DELETE /config/:assetId` → deleteConfig (update)
- `POST /run` → runDepreciationBatch (update) — returns 202
- `POST /entries/:entryId/reverse` → reverseEntry (update)
- `GET /report/export` → exportReport (read) — CSV/XLSX with Content-Disposition
- `GET /report` → getReport (read) — paginated, optional assetId filter
- `GET /last-run` → getLastRun (read)

**`depreciation.routes.spec.ts`** — 21 integration tests using mock services.

**`permissions.ts`** — `depreciation` added to PermissionModule union and ALL_MODULES:

- ADMIN/MANAGER: full module permissions
- FINANCIAL: read + update (configure and run)
- OPERATOR: read only

**`app.ts`** — `depreciationRouter` registered at `/api/org/:orgId/depreciation`.

### Task 3: Cron + wiring

**`depreciation.cron.ts`** — Monthly cron (schedule `0 2 1 * *`):

- Redis distributed lock (`cron:depreciation:YYYY-M`, 600s TTL)
- Enumerates all organizations
- Processes both FISCAL and MANAGERIAL tracks per org
- Per-org error isolation (one org failure doesn't stop others)
- Timezone: America/Sao_Paulo

**`main.ts`** — `startDepreciationCron()` called after digest cron.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Null-safety for nullable Asset fields**

- **Found during:** Task 3 TypeScript compilation
- **Issue:** `asset.acquisitionValue` is `Decimal?` and `asset.acquisitionDate` is `DateTime?` in schema (both nullable). `asset.disposalDate` does not exist on Asset model.
- **Fix:** Added null-safety guard: skip asset if `acquisitionValue` or `acquisitionDate` is null. Pass `disposalDate: null` to engine (disposal date tracking not in current schema).
- **Files modified:** `depreciation-batch.service.ts`
- **Commit:** 32c7b896

## Test Coverage

| File                        | Tests  | Status              |
| --------------------------- | ------ | ------------------- |
| depreciation-engine.spec.ts | 21     | Pass (from Plan 01) |
| depreciation-batch.spec.ts  | 14     | Pass                |
| depreciation.routes.spec.ts | 21     | Pass                |
| **Total**                   | **56** | **All pass**        |

## Key Links Implemented

| From                          | To                             | Via                               |
| ----------------------------- | ------------------------------ | --------------------------------- |
| depreciation-batch.service.ts | depreciation-engine.service.ts | `import computeDepreciation`      |
| depreciation-batch.service.ts | prisma.depreciationEntry       | `create with P2002 catch`         |
| depreciation.routes.ts        | app.ts                         | `depreciationRouter` registration |
| depreciation.cron.ts          | main.ts                        | `startDepreciationCron()`         |

## Self-Check: PASSED

All created files verified present. All commits verified in git log:

- 9937a1fb: Task 1 (service + batch)
- 62557809: Task 2 (routes + RBAC)
- 32c7b896: Task 3 (cron + wiring)
