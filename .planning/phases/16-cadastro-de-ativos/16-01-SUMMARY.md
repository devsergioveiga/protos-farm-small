---
phase: 16-cadastro-de-ativos
plan: '01'
subsystem: backend
tags: [prisma, assets, crud, rbac, postgis, photo-upload, migration]

requires:
  - 16-cadastro-de-ativos/16-00
provides:
  - 'Asset entity with full CRUD API at /api/org/:orgId/assets'
  - 'Sequential tag generation PAT-NNNNN with atomic transaction'
  - 'PostGIS geoPoint for BENFEITORIA type'
  - 'Photo upload endpoint storing files under uploads/assets/'
  - 'Asset summary endpoint for dashboard totals'
affects:
  - 16-cadastro-de-ativos/16-02
  - 16-cadastro-de-ativos/16-03
  - 16-cadastro-de-ativos/16-04

tech-stack:
  added: []
  patterns:
    - 'Sequential tag PAT-NNNNN generated in $transaction with findFirst(orderBy: desc) + padStart(5)'
    - 'PostGIS geoPoint written via $executeRawUnsafe after record creation (Prisma Unsupported field limitation)'
    - 'Photo upload with multer diskStorage under uploads/assets/{orgId}/{assetId}/ served via static /api/uploads'
    - "costCenterMode stored as String @default('FIXED') to avoid conflict with existing CostCenterAllocMode enum"

key-files:
  created:
    - apps/backend/prisma/migrations/20260412200000_add_asset_models/migration.sql
    - apps/backend/src/modules/assets/assets.types.ts
    - apps/backend/src/modules/assets/assets.service.ts
    - apps/backend/src/modules/assets/assets.routes.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/shared/rbac/permissions.ts
    - apps/backend/src/app.ts
    - apps/backend/src/modules/assets/assets.routes.spec.ts

key-decisions:
  - 'costCenterMode stored as String instead of CostCenterAllocMode enum to avoid conflict with existing Payable allocation enum — values: FIXED, PERCENTAGE, DYNAMIC'
  - 'Migration created manually (prisma migrate dev blocked by shadow DB issue with out-of-sync cultivars table) and applied via prisma migrate deploy'
  - 'CostCenterAllocMode duplicate removed from Asset models — existing enum at line 5475 has PERCENTAGE/FIXED_VALUE only, incompatible values'
  - 'BENFEITORIA geoPoint written via raw SQL after Prisma create() due to Unsupported type limitation'

requirements-completed:
  - ATIV-01
  - ATIV-02

duration: 30min
completed: '2026-03-19'
---

# Phase 16 Plan 01: Cadastro de Ativos — Backend Foundation Summary

**Asset entity backend: Prisma schema with CPC classification, PostGIS geometry, sequential PAT-NNNNN tag, full CRUD service+routes, photo upload, and 24 passing integration tests**

## Performance

- **Duration:** 30 min
- **Started:** 2026-03-19T21:30:56Z
- **Completed:** 2026-03-19T22:01:00Z
- **Tasks:** 2
- **Files modified:** 8 (4 created + 4 modified)

## Accomplishments

### Task 1: Prisma schema + migration + types + RBAC

- Added Asset, FuelRecord, MeterReading, AssetDocument models to schema.prisma
- Added enums: AssetType (5 values), AssetClassification (4 values), AssetStatus (5 values), AssetDocumentType (8 values)
- Added reverse relations to Organization, Farm, Supplier, CostCenter models
- Created migration `20260412200000_add_asset_models` and applied via `prisma migrate deploy`
- Generated Prisma client with new types
- Created `assets.types.ts` with CreateAssetInput, UpdateAssetInput, ListAssetsQuery, AssetError
- Added `'assets'` to PermissionModule union and ALL_MODULES array
- Added assets permissions: ADMIN/MANAGER = modulePermissions, OPERATOR = read+update, FINANCIAL = read

### Task 2: Asset CRUD service + routes + photo upload + tests

- Created `assets.service.ts` with 8 functions: createAsset, listAssets, getAsset, updateAsset, deleteAsset, getAssetSummary, uploadAssetPhoto, removeAssetPhoto
- PAT-NNNNN tag generation in atomic $transaction (first tag = PAT-00001)
- TERRA assets auto-classified as NON_DEPRECIABLE_CPC27
- IMPLEMENTO validation: parent must be MAQUINA
- BENFEITORIA: geoPoint stored via $executeRawUnsafe (PostGIS Unsupported type)
- Created `assets.routes.ts` with 8 endpoints at /api/org/:orgId/assets
- Registered assetsRouter in app.ts
- Replaced 23 it.todo() stubs in assets.routes.spec.ts with full mock-based tests
- 24 tests passing, 2 todos remaining (export endpoints for plan 16-02)

## Task Commits

1. **Task 1 + Task 2: Asset backend foundation** - `90368dff` (feat)

## Files Created/Modified

- `apps/backend/prisma/schema.prisma` — Asset + related models + reverse relations
- `apps/backend/prisma/migrations/20260412200000_add_asset_models/migration.sql` — DDL for 4 tables + indexes + FK constraints
- `apps/backend/src/modules/assets/assets.types.ts` — Input types + AssetError class
- `apps/backend/src/modules/assets/assets.service.ts` — CRUD service with PAT tag, geoPoint, photo management
- `apps/backend/src/modules/assets/assets.routes.ts` — Express router at /api/org/:orgId/assets
- `apps/backend/src/modules/assets/assets.routes.spec.ts` — 24 passing + 2 todo integration tests
- `apps/backend/src/shared/rbac/permissions.ts` — assets module added to PermissionModule + permissions matrix
- `apps/backend/src/app.ts` — assetsRouter registered

## Decisions Made

1. `costCenterMode` stored as `String @default('FIXED')` instead of `CostCenterAllocMode` enum — existing enum has incompatible values (PERCENTAGE, FIXED_VALUE) used by Payable model. Assets needs FIXED/PERCENTAGE/DYNAMIC.

2. Migration created manually and applied with `prisma migrate deploy` — `prisma migrate dev` blocked by shadow DB issue (cultivars table missing in shadow DB, pre-existing issue).

3. BENFEITORIA geoPoint written via `$executeRawUnsafe` after record creation — Prisma's `Unsupported` type cannot be set via the standard `.create()` data object.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate CostCenterAllocMode enum**

- **Found during:** Task 1 (prisma validate)
- **Issue:** Plan spec listed CostCenterAllocMode with FIXED/PERCENTAGE/DYNAMIC values but an identical-name enum already exists in schema with different values (PERCENTAGE/FIXED_VALUE) used by Payable model
- **Fix:** Used `String @default('FIXED')` for costCenterMode field instead of the conflicting enum
- **Files modified:** apps/backend/prisma/schema.prisma

**2. [Rule 3 - Blocking] Created migration manually**

- **Found during:** Task 1 (prisma migrate dev failure)
- **Issue:** `prisma migrate dev` fails with P3006 error — shadow DB missing cultivars table (pre-existing DB issue)
- **Fix:** Created migration SQL manually, applied via `prisma migrate deploy`
- **Files modified:** apps/backend/prisma/migrations/20260412200000_add_asset_models/migration.sql

## Issues Encountered

None beyond the auto-fixed deviations above.

## Next Phase Readiness

- Asset CRUD API is fully functional — Plans 16-02 through 16-05 can build on this foundation
- FuelRecord, MeterReading, AssetDocument tables exist and are accessible via Prisma client
- Photo upload infrastructure is working at /api/uploads/assets/{orgId}/{assetId}/
- 2 remaining todos in spec (export CSV/PDF) to be implemented in Plan 16-02

## Self-Check: PASSED

Files exist:

- FOUND: apps/backend/prisma/migrations/20260412200000_add_asset_models/migration.sql
- FOUND: apps/backend/src/modules/assets/assets.types.ts
- FOUND: apps/backend/src/modules/assets/assets.service.ts
- FOUND: apps/backend/src/modules/assets/assets.routes.ts
- FOUND: apps/backend/src/modules/assets/assets.routes.spec.ts

Commits exist:

- FOUND: 90368dff — feat(16-01): implement Asset entity backend foundation

---

_Phase: 16-cadastro-de-ativos_
_Completed: 2026-03-19_
