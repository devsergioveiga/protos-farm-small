---
phase: 07-cadastro-de-fornecedores
plan: 01
subsystem: backend/suppliers
tags: [suppliers, rbac, prisma, crud, purchases]
dependency_graph:
  requires: []
  provides: [suppliers-api, suppliers-rbac]
  affects: [app.ts, permissions.ts, schema.prisma]
tech_stack:
  added: []
  patterns: [withRlsContext, SupplierError, module-colocation, soft-delete]
key_files:
  created:
    - apps/backend/prisma/migrations/20260406100000_add_suppliers_module/migration.sql
    - apps/backend/src/modules/suppliers/suppliers.types.ts
    - apps/backend/src/modules/suppliers/suppliers.service.ts
    - apps/backend/src/modules/suppliers/suppliers.routes.ts
    - apps/backend/src/modules/suppliers/suppliers.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/shared/rbac/permissions.ts
    - apps/backend/src/app.ts
decisions:
  - 'Used db push + migrate resolve due to pre-existing shadow DB failure (cultivars table missing); migration file created manually and marked as applied'
  - 'Prisma.SupplierWhereInput used instead of Record<string, unknown> for type-safe where clause in listSuppliers'
  - 'Soft delete via deletedAt: all queries filter with deletedAt: null'
metrics:
  duration: 7 minutes
  completed_date: '2026-03-17'
  tasks_completed: 2
  files_changed: 8
---

# Phase 7 Plan 01: Suppliers Backend — Summary

Supplier CRUD API with CNPJ/CPF validation, org-scoped data, duplicate detection, and RBAC purchases module. 20 integration tests passing.

## What Was Built

### Task 1: Prisma Schema + Migration + Types + RBAC

**Schema additions** to `schema.prisma`:

- `Supplier` model with all fields including `categories SupplierCategory[]`, `deletedAt`, and `@@unique([document, organizationId])`
- `SupplierDocument` and `SupplierRating` related models
- `SupplierType`, `SupplierStatus`, `SupplierCategory`, `SupplierDocumentType` enums
- `suppliers Supplier[]` relation added to `Organization`

**Migration**: `20260406100000_add_suppliers_module` — created manually and applied via `prisma db push` + `migrate resolve` due to shadow database failure (pre-existing issue).

**Types** (`suppliers.types.ts`): `SupplierError`, `CreateSupplierInput`, `UpdateSupplierInput`, `ListSuppliersQuery`, `CreateRatingInput`, `SUPPLIER_CATEGORIES`, `SUPPLIER_CATEGORY_LABELS`, `PAYMENT_TERMS_SUGGESTIONS`.

**RBAC** (`permissions.ts`): `purchases` added to `PermissionModule` union and `ALL_MODULES`. Granted to roles: ADMIN/SUPER_ADMIN (full via allPermissions), MANAGER (modulePermissions), FINANCIAL/AGRONOMIST/CONSULTANT (read only).

### Task 2: Service + Routes + Tests

**Service** (`suppliers.service.ts`):

- `createSupplier` — validates CNPJ/CPF via `isValidCNPJ`/`isValidCPF` with `cleanDocument`, checks duplicate by `(document, organizationId)`, validates categories
- `getSupplierById` — includes documents and ratings, computes `averageRating` and `ratingCount`
- `listSuppliers` — paginated (default 20, max 100), filters: search (name/tradeName/document), status, category (Prisma array `has`), city (contains insensitive), state
- `updateSupplier` — validates new document and checks duplicate excluding self
- `deleteSupplier` — soft delete via `deletedAt: new Date()`

**Routes** (`suppliers.routes.ts`): Express Router at `/org/suppliers` with 5 CRUD endpoints, `checkPermission('purchases:manage')` for writes, `checkPermission('purchases:read')` for reads.

**app.ts**: `suppliersRouter` imported and registered after `ruralCreditRouter`.

**Tests** (`suppliers.routes.spec.ts`): 20 passing tests covering auth guards, CRUD, RBAC enforcement, error cases (400/404/409).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shadow database migration failure**

- **Found during:** Task 1
- **Issue:** `prisma migrate dev` failed with P3006 — shadow database couldn't apply `20260311080000_add_grain_harvests` (cultivars table missing). Pre-existing environment issue.
- **Fix:** Used `prisma db push` to apply schema changes to the actual database, then created the migration SQL file manually and ran `prisma migrate resolve --applied` to record it in migration history.
- **Files modified:** `prisma/migrations/20260406100000_add_suppliers_module/migration.sql`
- **Commit:** 4d82da1

## Self-Check: PASSED

Files exist:

- apps/backend/prisma/migrations/20260406100000_add_suppliers_module/migration.sql: FOUND
- apps/backend/src/modules/suppliers/suppliers.types.ts: FOUND
- apps/backend/src/modules/suppliers/suppliers.service.ts: FOUND
- apps/backend/src/modules/suppliers/suppliers.routes.ts: FOUND
- apps/backend/src/modules/suppliers/suppliers.routes.spec.ts: FOUND

Commits exist:

- 4d82da1: FOUND (Task 1)
- 96876de: FOUND (Task 2)

Tests: 20/20 passing
