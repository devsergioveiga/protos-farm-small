---
phase: 12-kanban-dashboard-e-notifica-es
plan: '01'
subsystem: purchase-kanban
tags: [backend, kanban, purchase-requests, purchase-orders, aggregation]
dependency_graph:
  requires:
    - purchase-requests module
    - purchase-orders module
    - goods-receipts module
    - payables module
    - quotations module
  provides:
    - GET /api/org/purchase-kanban
    - POST /api/org/purchase-kanban/transition
  affects:
    - app.ts (router registration)
tech_stack:
  added: []
  patterns:
    - withRlsContext aggregation joining multiple P2P pipeline models
    - column assignment via recursive entity depth check
    - transition endpoint that delegates to domain services or returns instructional errors
key_files:
  created:
    - apps/backend/src/modules/purchase-kanban/purchase-kanban.types.ts
    - apps/backend/src/modules/purchase-kanban/purchase-kanban.service.ts
    - apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.ts
    - apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'Only RC_PENDENTE -> APROVADA is a direct kanban action; all other transitions return instructional 400 errors directing the user to the correct page to prevent kanban from bypassing domain validation'
  - 'Emergency POs (isEmergency=true, quotationId=null) appear starting at OC_EMITIDA column and receive urgency=EMERGENCIAL'
  - 'assignColumn checks deepest pipeline entity first: Payable (all installments PAID) -> GR CONFIRMADO -> PO with delivery statuses -> PO RASCUNHO -> Quotation -> RC APROVADA -> RC_PENDENTE'
  - 'daysInStage computed from updatedAt of the deepest entity present in the pipeline'
metrics:
  duration: '6min'
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_created_or_modified: 5
---

# Phase 12 Plan 01: Purchase Kanban Backend Aggregation Summary

Backend kanban module joining the full P2P pipeline (RC -> Cotacao -> OC -> RR -> CP) to produce pre-assigned column cards plus a transition endpoint dispatching real domain actions.

## What Was Built

### Task 1: Types and Aggregation Service

**`purchase-kanban.types.ts`** defines:

- `KANBAN_COLUMNS` tuple with 7 canonical columns
- `KanbanCard` interface with all required fields (id, column, number, type, requester, totalValue, urgency, daysInStage, isOverdue, and all pipeline foreign keys)
- `KanbanFilters` for farmId, urgency, category, supplierId, dateRange
- `ALLOWED_TRANSITIONS` state machine map
- `PurchaseKanbanError` class with statusCode

**`purchase-kanban.service.ts`** provides:

- `getKanbanCards(ctx, filters)`: Two Prisma queries — (1) all active PurchaseRequests with nested pipeline includes, (2) emergency POs without quotationId. Maps each to KanbanCard using `assignColumnFromRc` / `assignColumnFromEmergencyPo` helpers.
- `transitionCard(ctx, cardId, targetColumn)`: Loads current column, validates against ALLOWED_TRANSITIONS (403 if not allowed), then dispatches: APROVADA -> calls `transitionPurchaseRequest` with action APPROVE; all other targets -> instructional PurchaseKanbanError(400) directing user to the correct domain page.
- `assignColumnFromRc` walks from deepest entity: GR with all installments PAID -> PAGO; GR CONFIRMADO -> RECEBIDO; GR exists (not confirmed) or PO in delivery statuses -> AGUARDANDO_ENTREGA; PO in RASCUNHO -> OC_EMITIDA; Quotation exists -> EM_COTACAO; RC APROVADA -> APROVADA; else -> RC_PENDENTE.

### Task 2: Routes, app.ts Registration, Tests

**`purchase-kanban.routes.ts`** registers:

- `GET /org/purchase-kanban` (purchases:read): Parses query filters including date conversion, calls getKanbanCards, returns cards array.
- `POST /org/purchase-kanban/transition` (purchases:manage): Validates targetColumn against KANBAN_COLUMNS, calls transitionCard, returns { success: true }.

**`app.ts`**: purchaseKanbanRouter imported and registered after savingAnalysisRouter.

**`purchase-kanban.routes.spec.ts`**: 12 tests covering GET (response shape, required fields, farmId/urgency filter pass-through, 401, 403) and POST transition (invalid column 400, valid RC->APROVADA, disallowed transition 403, domain-page redirect 400, card not found 404, operator 403).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] TypeScript KanbanCard type assertion in test fixtures**

- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** Test fixture array inferred as `string` for the `column` field, not assignable to `KanbanColumn` union type
- **Fix:** Added `import type { KanbanCard }` to spec file and typed `VALID_KANBAN_CARDS` as `KanbanCard[]`
- **Files modified:** `purchase-kanban.routes.spec.ts`
- **Commit:** f28ba34

## Self-Check: PASSED

All created files exist:

- FOUND: apps/backend/src/modules/purchase-kanban/purchase-kanban.types.ts
- FOUND: apps/backend/src/modules/purchase-kanban/purchase-kanban.service.ts
- FOUND: apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.ts
- FOUND: apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.spec.ts

All commits verified:

- FOUND: 6d3e050 (Task 1)
- FOUND: f28ba34 (Task 2)
