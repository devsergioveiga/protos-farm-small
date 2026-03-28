---
phase: 26-par-metros-de-folha-e-motor-de-c-lculo
plan: '03'
subsystem: backend/payroll
tags: [rest-api, payroll, rubricas, legal-tables, rbac, integration-tests]
dependency_graph:
  requires: [plan-01-payroll-schema, plan-02-payroll-engine]
  provides: [payroll-rubricas-api, payroll-tables-api, payroll-params-rbac]
  affects: [plan-04-payroll-frontend]
tech_stack:
  added: []
  patterns: [module-colocation, rls-context, check-permission, supertest-integration-tests]
key_files:
  created:
    - apps/backend/src/modules/payroll-rubricas/payroll-rubricas.service.ts
    - apps/backend/src/modules/payroll-rubricas/payroll-rubricas.routes.ts
    - apps/backend/src/modules/payroll-rubricas/payroll-rubricas.routes.spec.ts
    - apps/backend/src/modules/payroll-tables/payroll-tables.service.ts
    - apps/backend/src/modules/payroll-tables/payroll-tables.routes.ts
    - apps/backend/src/modules/payroll-tables/payroll-tables.routes.spec.ts
  modified:
    - apps/backend/src/shared/rbac/permissions.ts
    - apps/backend/src/app.ts
decisions:
  - "Added 'write' action to PermissionAction type for payroll-params module (MANAGER gets read+write, FINANCIAL gets read)"
  - 'Route /effective registered before /:id to avoid Express param route shadowing'
  - 'Auto-seed of system rubricas triggered by hasRubricas check on GET list (avoids seeding on every request)'
metrics:
  duration: ~5 minutes
  completed_date: '2026-03-24'
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 2
---

# Phase 26 Plan 03: Payroll REST API — Rubricas and Legal Tables Summary

**One-liner:** REST CRUD API for payroll rubricas (with auto-seed of 18 system defaults and system-rubrica protection) and legal tables (with effectiveFrom-based effective-date lookup), 27 integration tests passing.

## Tasks Completed

| Task | Name                                                    | Commit   | Files                                                                                                    |
| ---- | ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| 1    | Payroll rubricas service + routes + tests               | 55649d62 | payroll-rubricas.service.ts, payroll-rubricas.routes.ts, payroll-rubricas.routes.spec.ts, permissions.ts |
| 2    | Payroll tables service + routes + tests + app.ts wiring | efc44d00 | payroll-tables.service.ts, payroll-tables.routes.ts, payroll-tables.routes.spec.ts, app.ts               |

## What Was Built

### Payroll Rubricas Module

**payroll-rubricas.service.ts** — Service object `payrollRubricasService`:

- `list(orgId, query)` — Paginated list with rubricaType/isActive/search filters, system rubricas shown first
- `getById(orgId, id)` — Single rubrica with org ownership validation
- `create(orgId, data, userId)` — Create custom rubrica with SYSTEM type block, PERCENTAGE rate validation, FORMULA baseFormula validation, code uniqueness check
- `update(orgId, id, data)` — Update with 403 block on system rubricas
- `deactivate(orgId, id)` — Soft deactivate with 403 block on system rubricas
- `seedSystemRubricas(orgId, userId)` — Idempotent seed of 18 default rubricas (INSS, IRRF, FGTS, SAL_FAMILIA, FUNRURAL, SALARIO_BASE, HE_50, HE_100, NOTURNO, INSALUBRIDADE, PERICULOSIDADE, VT, MORADIA, ALIMENTACAO, ADIANTAMENTO, FALTAS, PENSAO, COMISSAO)
- `hasRubricas(orgId)` — Check for existing rubricas (gates the auto-seed)

**payroll-rubricas.routes.ts** — Router `payrollRubricasRouter` at `/org/:orgId/payroll-rubricas`:

- `GET /` — List with auto-seed on first access, `payroll-params:read`
- `GET /:id` — Get by ID, `payroll-params:read`
- `POST /` — Create custom rubrica, `payroll-params:write`
- `PUT /:id` — Update (blocks system), `payroll-params:write`
- `PATCH /:id/deactivate` — Soft deactivate (blocks system), `payroll-params:write`

### Payroll Legal Tables Module

**payroll-tables.service.ts** — Service object `payrollTablesService`:

- `list(orgId, query)` — Org-specific tables via RLS + global tables (organizationId=null) merged, ordered effectiveFrom DESC
- `getEffective(orgId, tableType, competenceDate)` — Org-specific first, fallback to global; finds most recent table with `effectiveFrom <= competenceDate`
- `create(orgId, data, userId)` — Validates day=1, checks org+tableType+effectiveFrom uniqueness, creates with nested brackets and scalarValues
- `getById(orgId, id)` — Gets org-specific or global table by ID with brackets and scalars

**payroll-tables.routes.ts** — Router `payrollTablesRouter` at `/org/:orgId/payroll-tables`:

- `GET /effective` — Get effective table for competence date (registered before `/:id`)
- `GET /` — List with optional tableType/effectiveAt filters, `payroll-params:read`
- `GET /:id` — Get by ID with brackets and scalars, `payroll-params:read`
- `POST /` — Create org-specific table version, `payroll-params:write`

### RBAC Changes

**permissions.ts:**

- Added `'payroll-params'` to `PermissionModule` type and `ALL_MODULES`
- Added `'write'` to `PermissionAction` type and `ALL_ACTIONS` (needed for payroll-params)
- MANAGER: `payroll-params:read` + `payroll-params:write`
- FINANCIAL: `payroll-params:read` only

### App Wiring

**app.ts:**

- Import and register `payrollRubricasRouter` and `payrollTablesRouter` at `/api`

## Decisions Made

1. **Added 'write' to PermissionAction**: The plan specifies `payroll-params:write` as the permission for mutation operations, but the existing system only had `create|read|update|delete|manage|close`. Rather than forcing the payroll module to use non-intuitive combinations (e.g., `create+update`), we added `write` as a new action. This is backward-compatible since existing permission checks use explicit action names.

2. **Route /effective before /:id**: Express param routes would match `effective` as an ID value if `/:id` was registered first. Registering the static `/effective` path first ensures correct routing.

3. **Auto-seed gated by hasRubricas check**: Uses a direct `prisma.payrollRubrica.findFirst` (bypassing RLS) to check if org has any rubricas before triggering seed. This avoids calling `seedSystemRubricas` on every GET request while ensuring new orgs get defaults on first access.

## Test Coverage

| Test Suite                       | Tests  | Status   |
| -------------------------------- | ------ | -------- |
| payroll-rubricas.routes.spec.ts  | 14     | PASS     |
| payroll-tables.routes.spec.ts    | 13     | PASS     |
| payroll-engine.spec.ts (Plan 02) | 38     | PASS     |
| **Total payroll**                | **65** | **PASS** |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `write` action not in PermissionAction type**

- **Found during:** Task 1 — tests failing with 403 on MANAGER write endpoints
- **Issue:** `PermissionAction` only had `create|read|update|delete|manage|close` — no `write` action, so `payroll-params:write` was never a valid permission and the `checkPermission` guard always denied it
- **Fix:** Added `'write'` to `PermissionAction` type and `ALL_ACTIONS` array; updated MANAGER role grant from `modulePermissions('payroll-params')` to `p('payroll-params', 'read', 'write')`
- **Files modified:** `permissions.ts`
- **Commit:** 55649d62

## Known Stubs

None. This plan creates service and route layer only — no UI components.

## Self-Check: PASSED
