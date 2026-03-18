---
phase: 09-cota-o-e-pedido-de-compra
plan: 02
subsystem: api
tags: [quotations, purchase-orders, prisma, express, multer, state-machine]

requires:
  - phase: 09-01
    provides: quotations.types.ts, purchase-orders.types.ts, Prisma schema models (Quotation, QuotationSupplier, QuotationProposal, QuotationProposalItem, QuotationItemSelection, PurchaseOrder)
  - phase: 08-requisi-o-e-aprova-o
    provides: purchase-requests.service.ts getNextSequentialNumber pattern, createNotification function signature
  - phase: 07-cadastro-de-fornecedores
    provides: suppliers.service.ts getTop3ByCategory, Supplier model with status/categories

provides:
  - quotations.service.ts with 8 exported functions covering full SC lifecycle
  - quotations.routes.ts with 8 REST endpoints at /org/quotations
  - 19 integration tests in quotations.routes.spec.ts
  - notifications.types.ts extended with QUOTATION_PENDING_APPROVAL, QUOTATION_APPROVED, PO_OVERDUE, QUOTATION_DEADLINE_NEAR

affects: [09-03, 09-04, phase-10-recebimento]

tech-stack:
  added: []
  patterns:
    - 'SC-YYYY/NNNN sequential numbering using findFirst+startsWith+padStart (same as RC pattern)'
    - 'OC-YYYY/NNNN sequential numbering inside single Prisma transaction during approve'
    - 'Comparative route registered BEFORE /:id route to prevent Express ambiguity'
    - 'Fire-and-forget notification after transaction commit via void IIFE'
    - 'canScTransition state machine guard before all status mutations'
    - 'req.params.id cast as string to satisfy Express TypeScript strict mode'

key-files:
  created:
    - apps/backend/src/modules/quotations/quotations.service.ts
    - apps/backend/src/modules/quotations/quotations.routes.ts
    - apps/backend/src/modules/quotations/quotations.routes.spec.ts
  modified:
    - apps/backend/src/modules/notifications/notifications.types.ts
    - apps/backend/src/app.ts

key-decisions:
  - 'approveQuotation reads prices from DB inside transaction — never from request body (security)'
  - 'Justification required only when selected supplier is NOT lowest price for ANY item'
  - 'Auto-transition SC to EM_ANALISE when all suppliers submit proposals'
  - 'Per-supplier PurchaseOrder creation in single $transaction, then SC transitioned to FECHADA'
  - 'lastPricePaid lookup queries PurchaseOrderItem filtered to EMITIDA/CONFIRMADA/EM_TRANSITO/ENTREGUE statuses'

requirements-completed: [COTA-01, COTA-02, COTA-03]

duration: 10min
completed: 2026-03-18
---

# Phase 09 Plan 02: Quotations Backend Module Summary

**SC lifecycle API with state-machine guard, per-supplier comparative map, and atomic OC generation per winning supplier in single Prisma transaction**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T00:42:23Z
- **Completed:** 2026-03-18T00:52:28Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Complete quotations service with 8 functions: createQuotation, listQuotations, getQuotationById, registerProposal, getComparativeMap, approveQuotation, transitionQuotation, deleteQuotation
- 8 REST endpoints at `/org/quotations` with RBAC (purchases:read for GET, purchases:manage for mutations)
- 19 passing integration tests covering all endpoints, error cases, auth guard
- Atomic OC generation: for each winning supplier, a PO is created with frozen prices from proposal, then SC transitions to FECHADA

## Task Commits

1. **Task 1: Quotations service** - `916f7f3` (feat)
2. **Task 2: Routes + app.ts + tests** - `17ba5b0` (feat)
3. **Auto-fix: TypeScript req.params cast** - `6101bb2` (fix)

## Files Created/Modified

- `apps/backend/src/modules/quotations/quotations.service.ts` - 8 exported functions, full SC lifecycle
- `apps/backend/src/modules/quotations/quotations.routes.ts` - 8 REST endpoints with multer, RBAC
- `apps/backend/src/modules/quotations/quotations.routes.spec.ts` - 19 integration tests
- `apps/backend/src/modules/notifications/notifications.types.ts` - Extended with 4 new notification types
- `apps/backend/src/app.ts` - quotationsRouter imported and registered

## Decisions Made

- Prices are never accepted from request body during approval — all pricing data read from DB inside transaction (security)
- Justification required only when ANY selected item uses a supplier whose price is NOT the minimum for that item
- Auto-transition to EM_ANALISE fires only when the last supplier submits their proposal (checked after upsert)
- Fire-and-forget notification after transaction via `void (async () => { ... })()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript errors for req.params.id (string | string[])**

- **Found during:** Task 2 verification (TypeScript check)
- **Issue:** Express types `req.params` as `Record<string, string | string[]>`, causing TS2345 errors when passing to service functions expecting `string`
- **Fix:** Added `as string` cast at all call sites: getComparativeMap, getQuotationById, transitionQuotation, registerProposal, approveQuotation, deleteQuotation
- **Files modified:** apps/backend/src/modules/quotations/quotations.routes.ts
- **Verification:** `npx tsc --noEmit` returns 0 errors in quotations files; 19 tests still pass
- **Committed in:** 6101bb2 (fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** TypeScript strict mode compliance fix, no behavior change.

## Issues Encountered

None beyond the TypeScript req.params cast (handled as auto-fix above).

## Next Phase Readiness

- Quotations API fully operational: buyer can create SC from approved RC, suppliers can submit proposals, manager can approve with atomic OC generation
- purchaseOrdersRouter was already registered in app.ts by Plan 01 (linter preserved this)
- Phase 09-03 (purchase orders management) can use the PurchaseOrder rows created by approveQuotation

---

_Phase: 09-cota-o-e-pedido-de-compra_
_Completed: 2026-03-18_
