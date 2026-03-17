---
phase: 08-requisi-o-e-aprova-o
plan: 02
subsystem: api
tags: [purchase-requests, crud, sequential-numbering, multer, rbac, express, prisma]

requires:
  - phase: 08-01
    provides: PurchaseRequest Prisma models, purchase-requests.types.ts with RC_TYPES/RC_URGENCY_LEVELS/RC_STATUSES/PurchaseRequestError/input interfaces
  - phase: 07-cadastro-de-fornecedores
    provides: suppliersRouter pattern for routes, RBAC purchases:manage/purchases:read permissions

provides:
  - RC CRUD service with 5 exported functions (createPurchaseRequest, getPurchaseRequestById, listPurchaseRequests, updatePurchaseRequest, deletePurchaseRequest)
  - Sequential numbering (RC-YYYY/NNNN) generated inside Prisma transaction
  - REST endpoints at /org/purchase-requests (6 total)
  - Multer disk-storage attachment upload at POST /org/purchase-requests/:id/attachments
  - purchaseRequestsRouter registered in app.ts

affects:
  - 08-03 (approval workflow will call updatePurchaseRequest / status transitions)
  - 08-04 (frontend will consume all 6 endpoints)

tech-stack:
  added: []
  patterns:
    - RC sequential numbering via findFirst+startsWith prefix scoped to organizationId+year inside transaction
    - Service functions accept RlsContext & userId for create, plain RlsContext for read/update/delete
    - Routes mock service layer in spec using jest.mock; auth mocked via verifyAccessToken

key-files:
  created:
    - apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
    - apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts
    - apps/backend/src/modules/purchase-requests/purchase-requests.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'createPurchaseRequest context type extended to RlsContext & { userId: string } — createdBy field must be persisted in the RC row'
  - 'req.params.id cast to string as Express types return string | string[] in strict mode'
  - 'Attachment upload uses multer diskStorage with uploads/purchase-requests/{orgId}/{rcId}/ structure for multi-tenant isolation'

patterns-established:
  - "Sequential numbering: findFirst with startsWith RC-YYYY/, parse last 4-digit suffix, increment, padStart(4,'0')"
  - 'Status guard before edit: check RASCUNHO|DEVOLVIDA, throw PurchaseRequestError(400) otherwise'
  - 'Soft delete guard: check RASCUNHO only, throw PurchaseRequestError(400) otherwise'

requirements-completed: [REQC-01]

duration: 4min
completed: 2026-03-17
---

# Phase 08 Plan 02: RC CRUD Backend Summary

**RC CRUD service with RC-YYYY/NNNN sequential numbering in Prisma transaction, 6 REST endpoints, Multer attachment upload, and 18 passing integration tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T19:34:12Z
- **Completed:** 2026-03-17T19:38:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- RC service with 5 functions: sequential numbering via atomic transaction, item management, urgency/justification validation, status guards for edit and delete
- 6 REST endpoints registered at `/org/purchase-requests` with RBAC (purchases:manage for writes, purchases:read for reads)
- Multer disk storage for file attachments (10MB limit, per-org/per-RC directory structure)
- 18 integration tests — all passing — covering create, list, get, update, delete, auth guards, and status validation

## Task Commits

Each task was committed atomically:

1. **Task 1: RC service with sequential numbering and CRUD** - `d9cabdf` (feat)
2. **Task 2: RC routes, app.ts registration, and integration tests** - `9121e69` (feat)

## Files Created/Modified

- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` — 5 exported service functions with RLS context, sequential numbering, validation
- `apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts` — 6 Express routes with Multer, RBAC, error handling
- `apps/backend/src/modules/purchase-requests/purchase-requests.routes.spec.ts` — 18 integration tests
- `apps/backend/src/app.ts` — purchaseRequestsRouter import and registration

## Decisions Made

- `createPurchaseRequest` context type is `RlsContext & { userId: string }` — the `createdBy` field in the PurchaseRequest model requires the user ID at create time, so it needs to be threaded through the context rather than passed as a separate argument (consistent with how creator is tracked in other modules)
- `req.params.id` cast to `string as string` in TypeScript strict mode — Express router params type is `string | string[]` but dynamic param routes always produce single string values
- Multer directory structure `uploads/purchase-requests/{orgId}/{rcId}/` provides multi-tenant isolation at the filesystem level

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- TypeScript strict mode flagged `req.params.id` as `string | string[]` in multer destination and route handlers — fixed with `as string` casts (Rule 1 auto-fix inline, no separate commit needed)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 (approval workflow) can import `updatePurchaseRequest` and add status transition logic on top
- Plan 04 (frontend) has all 6 API endpoints ready to consume with consistent pagination shape `{ data, total, page, limit, totalPages }`
- RC sequential numbering is org-scoped and year-scoped — cross-year rollover handled automatically

---

_Phase: 08-requisi-o-e-aprova-o_
_Completed: 2026-03-17_
