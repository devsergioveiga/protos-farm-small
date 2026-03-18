---
phase: 10-recebimento-de-mercadorias
plan: '02'
subsystem: goods-receipts-backend
tags: [backend, service, routes, tests, state-machine, divergence, multer]
dependency_graph:
  requires: [10-01]
  provides: [goods-receipts-api]
  affects: [app.ts, purchase-orders]
tech_stack:
  added: []
  patterns:
    [
      withRlsContext,
      RLS,
      sequential-numbering,
      state-machine,
      multer-diskStorage,
      jest-mock-service,
    ]
key_files:
  created:
    - apps/backend/src/modules/goods-receipts/goods-receipts.service.ts
    - apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts
    - apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - goodsReceiptsRouter registered in app.ts after purchaseOrdersRouter with /pending before /:id to prevent Express collision
  - CONFIRMADO transition blocked in transitionGoodsReceipt — Plan 03 handles the atomic StockEntry+Payable integration
  - divergencePct = abs(received-ordered)/ordered, hasDivergence = pct > 0.05 (5% threshold)
  - multer diskStorage at uploads/goods-receipts/{orgId}/{grId}/ with 10MB limit, single field 'photo'
metrics:
  duration: 296s
  completed: '2026-03-18'
  tasks: 2
  files: 4
---

# Phase 10 Plan 02: Goods Receipts Backend Service and Routes Summary

**One-liner:** Express goods-receipts API with sequential REC-YYYY/NNNN numbering, PENDENTE→EM_CONFERENCIA→CONFERIDO state machine, 5% divergence auto-flagging, and multer photo upload — 19 tests passing.

## What Was Built

### Task 1: Service (goods-receipts.service.ts)

Seven exported functions covering the full receiving workflow:

- `createGoodsReceipt` — validates EMERGENCIAL rules (requires justification, forbids PO link), verifies PO exists and is in CONFIRMADA or EM_TRANSITO, generates REC-YYYY/NNNN sequential number, calculates `divergencePct = Math.abs(received - ordered) / ordered` and sets `hasDivergence = pct > 0.05`, sets `isProvisional = true` for NF_ANTECIPADA, creates GoodsReceipt with items and divergences in single nested write
- `listGoodsReceipts` — paginated with filters (status, receivingType, supplierId, purchaseOrderId, search), excludes soft-deleted, orders by createdAt desc
- `getGoodsReceiptById` — full detail with items, divergences, supplier, purchaseOrder, creator
- `transitionGoodsReceipt` — enforces GR_VALID_TRANSITIONS map, sets timestamps (receivedAt on EM_CONFERENCIA, conferredAt on CONFERIDO, rejectedAt on REJEITADO), requires rejectionReason for REJEITADO, blocks CONFIRMADO (Plan 03)
- `listPendingDeliveries` — queries POs in CONFIRMADA/EM_TRANSITO with at least one item where receivedQuantity < quantity, computes isOverdue
- `updateGoodsReceiptDivergencePhoto` — updates photoUrl and photoFileName on divergence record after multer upload
- Helper formatters: `formatGoodsReceipt`, `formatGoodsReceiptListItem`, `formatDivergence`, `formatItem` with `Number()` casts on all Decimal fields

### Task 2: Routes + Tests (goods-receipts.routes.ts, goods-receipts.routes.spec.ts, app.ts)

Six endpoints registered in correct order:

| Method | Path                                                    | Permission       |
| ------ | ------------------------------------------------------- | ---------------- |
| GET    | /org/goods-receipts/pending                             | purchases:read   |
| GET    | /org/goods-receipts                                     | purchases:read   |
| GET    | /org/goods-receipts/:id                                 | purchases:read   |
| POST   | /org/goods-receipts                                     | purchases:manage |
| PUT    | /org/goods-receipts/:id/transition                      | purchases:manage |
| POST   | /org/goods-receipts/:id/divergences/:divergenceId/photo | purchases:manage |

/pending registered before /:id (prevents Express treating 'pending' as ID parameter — Phase 7 pattern).

Multer diskStorage at `uploads/goods-receipts/{orgId}/{grId}/` with 10MB fileSize limit, single field 'photo'.

app.ts: `goodsReceiptsRouter` imported and registered after `purchaseOrdersRouter`.

19 test cases: creation (STANDARD, EMERGENCIAL, NF_ANTECIPADA, PARCIAL), validation errors (missing justification, invalid PO), divergence flagging (>5% hasDivergence=true, <5% hasDivergence=false), state transitions (valid and invalid), REJEITADO with/without reason, pending deliveries, auth guards.

## Acceptance Criteria Verification

- File goods-receipts.service.ts: created
- `export async function createGoodsReceipt(`: present
- `export async function listGoodsReceipts(`: present
- `export async function getGoodsReceiptById(`: present
- `export async function transitionGoodsReceipt(`: present
- `export async function listPendingDeliveries(`: present
- `getNextGrSequentialNumber`: present
- `REC-${year}/`: present
- `canGrTransition` call: present
- `divergencePct` calculation with `Math.abs`: present
- `hasDivergence` assignment with `> 0.05`: present
- `isProvisional` check for NF_ANTECIPADA: present
- CONFIRMADO transition NOT in service: confirmed (blocked with error)
- File goods-receipts.routes.ts: created
- `/org/goods-receipts/pending` before `/:id`: confirmed
- Multer import and diskStorage: present
- `requirePermission('purchases:manage')` and `purchases:read`: present
- app.ts has goodsReceiptsRouter: present
- 19 test cases passing: confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- apps/backend/src/modules/goods-receipts/goods-receipts.service.ts: created (commit 45bb2bb)
- apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts: created (commit 16fb21d)
- apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts: created (commit 16fb21d)
- apps/backend/src/app.ts: modified (commit 16fb21d)
- 19 tests: all passing

## Self-Check: PASSED
