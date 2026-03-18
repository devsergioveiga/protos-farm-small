---
phase: 09-cota-o-e-pedido-de-compra
plan: '03'
subsystem: backend
tags: [purchase-orders, pdf-generation, state-machine, emergency-po, typescript, express]
dependency_graph:
  requires: [09-01-PLAN, schema.prisma PurchaseOrder model]
  provides: [purchase-orders API, PDF generation endpoint, OC state machine]
  affects: [app.ts router registration, purchase-orders module]
tech_stack:
  added: [pdfkit (static import for PDF generation)]
  patterns:
    [
      OC-YYYY/NNNN sequential numbering,
      state machine via canOcTransition,
      soft delete via deletedAt,
      streaming PDF to response,
    ]
key_files:
  created:
    - apps/backend/src/modules/purchase-orders/purchase-orders.service.ts
    - apps/backend/src/modules/purchase-orders/purchase-orders.routes.ts
    - apps/backend/src/modules/purchase-orders/purchase-orders.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - purchaseOrdersRouter registered after quotationsRouter in app.ts (Plan 02 had already added quotationsRouter)
  - /duplicate and /:id/pdf routes registered BEFORE /:id to prevent Express matching literal strings as ID params
  - generatePurchaseOrderPdf streams directly to Response object — service handles Content-Type/Content-Disposition headers
  - checkOverduePOs uses prisma.$transaction for each PO to atomically create notification + set overdueNotifiedAt
  - Static PDFDocument import used (import PDFDocument from pdfkit) rather than dynamic import
metrics:
  duration: 10min
  completed: '2026-03-17'
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 09 Plan 03: Purchase Orders Backend Module Summary

Complete Purchase Orders backend module implementing the formal procurement document (OC) with CRUD, PDF generation, state machine transitions, emergency PO creation, and overdue detection.

## What Was Built

**purchase-orders.service.ts** — 9 exported functions:

- `createEmergencyPO`: Creates OC with isEmergency=true, validates supplier is ACTIVE, requires non-empty justification, generates OC-YYYY/NNNN sequential number
- `duplicatePO`: Loads source PO with items, creates new RASCUNHO copy with new sequential number and optional notes override
- `listPurchaseOrders`: Paginated listing with status/supplierId/isEmergency/overdue filters, computed `isOverdue` field, search by sequential number or supplier name
- `getPurchaseOrderById`: Full include of supplier, items, quotation (with purchaseRequest), creator
- `updatePO`: Blocked after RASCUNHO status; supports full item replacement via delete+createMany
- `transitionPO`: Uses `canOcTransition` state machine guard; sets `issuedAt`/`confirmedAt`/`cancelledAt` timestamps per target status
- `deletePO`: Soft delete (deletedAt = now()) for RASCUNHO only
- `generatePurchaseOrderPdf`: Streams professional PDF to Express Response with org header, supplier block, items table with Decimal casting via `Number()`, totals, conditions, footer
- `checkOverduePOs`: Finds POs past expectedDeliveryDate in active statuses, creates PO_OVERDUE notification per PO, sets overdueNotifiedAt atomically

**purchase-orders.routes.ts** — 8 REST endpoints at `/org/purchase-orders`:

- `GET /` — list with pagination and filters (purchases:read)
- `POST /` — create emergency PO (purchases:manage)
- `POST /duplicate` — duplicate existing PO (purchases:manage) — registered BEFORE `/:id`
- `GET /:id/pdf` — stream PDF (purchases:read) — registered BEFORE `/:id`
- `GET /:id` — get by ID (purchases:read)
- `PATCH /:id/transition` — state transition (purchases:manage)
- `PATCH /:id` — update RASCUNHO fields (purchases:manage)
- `DELETE /:id` — soft delete (purchases:manage)

**purchase-orders.routes.spec.ts** — 21 integration tests covering all endpoints, error cases, and auth guards.

**app.ts** — Added import and registration of `purchaseOrdersRouter` after `quotationsRouter`.

## Tasks Completed

| Task | Name                    | Commit  | Files                                                             |
| ---- | ----------------------- | ------- | ----------------------------------------------------------------- |
| 1    | Purchase Orders service | 78d393b | purchase-orders.service.ts                                        |
| 2    | Routes, app.ts, tests   | 3997bfa | purchase-orders.routes.ts, purchase-orders.routes.spec.ts, app.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/backend/src/modules/purchase-orders/purchase-orders.service.ts
- FOUND: apps/backend/src/modules/purchase-orders/purchase-orders.routes.ts
- FOUND: apps/backend/src/modules/purchase-orders/purchase-orders.routes.spec.ts
- FOUND: Task 1 commit 78d393b
- FOUND: Task 2 commit 3997bfa
- TypeScript: 0 errors (npx tsc --noEmit)
- Tests: 21/21 passing
