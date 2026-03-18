---
phase: 09-cota-o-e-pedido-de-compra
plan: '01'
subsystem: backend/schema
tags: [prisma, schema, state-machine, types, quotation, purchase-order]
dependency_graph:
  requires: [Phase 8 schema (PurchaseRequest, Notification, Supplier)]
  provides:
    [
      Quotation model,
      PurchaseOrder model,
      QuotationStatus enum,
      PurchaseOrderStatus enum,
      SC_VALID_TRANSITIONS,
      OC_VALID_TRANSITIONS,
    ]
  affects: [Phase 9 Plans 02 (quotations service), 03 (purchase-orders service)]
tech_stack:
  added: []
  patterns:
    [cuid() IDs, VALID_TRANSITIONS state machine, db push + migrate resolve, named User relations]
key_files:
  created:
    - apps/backend/prisma/migrations/20260409100000_add_quotations_purchase_orders/migration.sql
    - apps/backend/src/modules/quotations/quotations.types.ts
    - apps/backend/src/modules/purchase-orders/purchase-orders.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
decisions:
  - 'QuotationItemSelection model added for per-item split supplier selection (quotationId + purchaseRequestItemId unique constraint)'
  - 'All 7 new models use cuid() IDs per Phase 8+ standard'
  - 'db push + migrate resolve pattern used (shadow DB not available)'
  - 'Named User relations used: QuotationCreator, QuotationApprover, POCreator'
metrics:
  duration: '4min'
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_changed: 4
---

# Phase 9 Plan 01: Schema Foundation and Type Definitions Summary

Prisma schema extended with 7 new models and 2 enums for Phase 9's quotation and purchase order modules, plus type-safe state machines in two new module directories.

## What Was Built

**Task 1 — Prisma schema + migration:**

Added 2 enums (`QuotationStatus`, `PurchaseOrderStatus`) and 7 models to `schema.prisma`:

- `Quotation` — org-scoped SC document linked to PurchaseRequest, sequential SC-YYYY/NNNN numbering, soft delete
- `QuotationSupplier` — invited supplier per SC, unique(quotationId, supplierId)
- `QuotationProposal` — 1:1 with QuotationSupplier, freight/tax/payment terms, file upload fields
- `QuotationProposalItem` — per-item prices with 4-decimal precision, unique(proposalId, purchaseRequestItemId)
- `QuotationItemSelection` — split selection model: item X sourced from supplier Y, unique(quotationId, purchaseRequestItemId)
- `PurchaseOrder` — org-scoped OC with optional quotationId (null for emergency), price-snapshot items, sequential OC-YYYY/NNNN
- `PurchaseOrderItem` — snapshot fields (productName, unitName) frozen at issuance

Reverse relations added to: Organization, User (3 named relations), Supplier, PurchaseRequest, PurchaseRequestItem.

Migration applied via `db push` + `migrate resolve` pattern (no shadow DB). Prisma client regenerated.

**Task 2 — Type definition files:**

- `quotations/quotations.types.ts`: `SC_VALID_TRANSITIONS`, `canScTransition`, `QuotationError`, `CreateQuotationInput`, `RegisterProposalInput`, `ApproveQuotationInput`, `ListQuotationsQuery`, `ComparativeMapData`
- `purchase-orders/purchase-orders.types.ts`: `OC_VALID_TRANSITIONS`, `canOcTransition`, `PurchaseOrderError`, `CreateEmergencyPOInput`, `DuplicatePOInput`, `UpdatePOInput`, `TransitionPOInput`, `ListPurchaseOrdersQuery`

State machine keys match schema enum values exactly (verified by grep).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `apps/backend/prisma/schema.prisma` contains all 7 models and 2 enums
- [x] `apps/backend/prisma/migrations/20260409100000_add_quotations_purchase_orders/migration.sql` exists
- [x] `apps/backend/src/modules/quotations/quotations.types.ts` exists with all required exports
- [x] `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` exists with all required exports
- [x] `npx prisma validate` exits 0
- [x] `npx prisma generate` exits 0
- [x] All new model IDs use `@default(cuid())`

## Self-Check: PASSED
