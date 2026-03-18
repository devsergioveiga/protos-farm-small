---
phase: 11-devolu-o-or-amento-e-saving
plan: '03'
subsystem: api
tags: [purchase-budgets, budget-control, execution-aggregation, non-blocking-flag, prisma]

requires:
  - phase: 11-01
    provides: PurchaseBudget model, types, and DB migration

provides:
  - purchase-budgets CRUD service (createPurchaseBudget, updatePurchaseBudget, listPurchaseBudgets, getPurchaseBudgetById, deletePurchaseBudget)
  - getBudgetExecution: real-time aggregation of requisitado/comprado/pago per budget
  - getDeviationReport: rows where percentUsed > 100
  - checkBudgetExceeded: non-blocking budget flag injected into RC approval and OC EMITIDA transition
  - purchaseBudgetsRouter with 7 endpoints under /org/purchase-budgets

affects:
  - purchase-requests service (budgetExceeded flag on APPROVE action)
  - purchase-orders service (budgetExceeded flag on EMITIDA transition)
  - frontend budget management page (phase 11)

tech-stack:
  added: []
  patterns:
    - Non-blocking budget exceeded flag — set on RC/OC record but never prevents the operation
    - checkBudgetExceeded injected as service function inside existing transaction clients
    - SupplierCategory and PayableCategory imported from @prisma/client for type-safe enum casts
    - /execution and /deviations routes registered BEFORE /:id to prevent Express ID collision

key-files:
  created:
    - apps/backend/src/modules/purchase-budgets/purchase-budgets.service.ts
    - apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.ts
    - apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.spec.ts
  modified:
    - apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
    - apps/backend/src/modules/purchase-orders/purchase-orders.service.ts
    - apps/backend/src/app.ts

key-decisions:
  - 'checkBudgetExceeded accepts a TxClient (any) and is called inside the existing withRlsContext transaction — never starts its own transaction'
  - 'PurchaseOrder has no farmId field — budget check for OC uses farmId: null regardless of RC origin'
  - 'Requisitado aggregation uses only APROVADA status since PurchaseRequestStatus enum does not include EM_COTACAO or COMPRADA'
  - 'PayableStatus is PAID (not PAGA) — Portuguese labels only in display, not in DB enum values'
  - 'mapSupplierCategoryToPayable maps INSUMO_AGRICOLA/PECUARIO -> INPUTS, PECAS -> MAINTENANCE, SERVICOS -> SERVICES, others -> OTHER'

requirements-completed: [FINC-02]

duration: 18min
completed: 2026-03-18
---

# Phase 11 Plan 03: Purchase Budgets Backend Summary

**CRUD budget management with real-time execution aggregation (requisitado/comprado/pago) and non-blocking budget check injection into RC approval and OC issuance flows**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-18T09:00:00Z
- **Completed:** 2026-03-18T09:18:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Purchase budgets CRUD service with overlap validation and period date checks
- getBudgetExecution aggregates requisitado (RC items with APROVADA status), comprado (OC items via purchaseRequestItemId chain), and pago (Payable PAID status) in real-time per budget
- getDeviationReport filters execution rows where percentUsed > 100
- checkBudgetExceeded injected into transitionPurchaseRequest (APPROVE action) and transitionPO (EMITIDA transition) — sets budgetExceeded flag but never blocks the operation
- 20 integration tests covering CRUD, execution, deviations, non-blocking behavior

## Task Commits

1. **Task 1: Purchase Budgets service, routes, and budget check injection** - `0865aac` (feat)
2. **Task 2: Purchase Budgets integration tests** - `e320e3f` (feat)

## Files Created/Modified

- `apps/backend/src/modules/purchase-budgets/purchase-budgets.service.ts` - Full CRUD + execution aggregation + checkBudgetExceeded
- `apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.ts` - 7 Express endpoints (GET list, GET execution, GET deviations, POST, GET /:id, PUT /:id, DELETE /:id)
- `apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.spec.ts` - 20 integration tests
- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` - checkBudgetExceeded injected in APPROVE action
- `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` - checkBudgetExceeded injected in EMITIDA transition
- `apps/backend/src/app.ts` - purchaseBudgetsRouter registered

## Decisions Made

- PurchaseOrder has no farmId field, so budget check for OC emission always passes `null` as farmId — RC-linked budgets by farm are only checked during RC approval
- PurchaseRequestStatus enum only has APROVADA (not EM_COTACAO/COMPRADA) — execution requisitado only counts APROVADA RCs
- PayableStatus uses English enum values (PAID not PAGA) — map was corrected during implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed checkPermission call signature**

- **Found during:** Task 1 (routes file)
- **Issue:** checkPermission called with two args `('purchases', 'read')` but signature requires single combined string `'purchases:read'`
- **Fix:** Updated all checkPermission calls to use combined format matching existing routes pattern
- **Files modified:** apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** 0865aac (Task 1 commit)

**2. [Rule 1 - Bug] Fixed invalid PurchaseRequestStatus enum values**

- **Found during:** Task 1 (service file)
- **Issue:** getBudgetExecution used 'EM_COTACAO' and 'COMPRADA' in status filter but those are not valid PurchaseRequestStatus enum values
- **Fix:** Simplified to only 'APROVADA' which is the correct approved state
- **Files modified:** apps/backend/src/modules/purchase-budgets/purchase-budgets.service.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** 0865aac (Task 1 commit)

**3. [Rule 1 - Bug] Fixed PayableStatus value (PAID not PAGA)**

- **Found during:** Task 1 (service file)
- **Issue:** pago calculation used 'PAGA' but PayableStatus enum uses English values (PAID)
- **Fix:** Changed status filter to 'PAID' with PayableStatus type cast
- **Files modified:** apps/backend/src/modules/purchase-budgets/purchase-budgets.service.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** 0865aac (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for type safety and correct DB queries. No scope creep.

## Issues Encountered

None beyond the auto-fixed type errors above.

## Next Phase Readiness

- Purchase budgets backend fully operational
- Frontend budget management page can now call /org/purchase-budgets endpoints
- Budget execution and deviation report ready for dashboard integration

---

_Phase: 11-devolu-o-or-amento-e-saving_
_Completed: 2026-03-18_
