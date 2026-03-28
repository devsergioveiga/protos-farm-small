---
phase: 30-seguranca-trabalho-nr31
plan: '02'
subsystem: backend
tags: [epi, nr31, nr6, stock-integration, pdf, safety, crud]
dependency_graph:
  requires:
    - 30-01 (schema migration — EpiProduct, EpiDelivery, PositionEpiRequirement models + types)
  provides:
    - EPI product CRUD backend (epi-products module fully functional)
    - Position EPI requirements CRUD
    - EPI delivery with automatic stock deduction
    - EPI delivery deletion with stock restoration
    - NR-6 compliant Ficha de EPI PDF generation
  affects:
    - apps/backend/src/modules/epi-products/
    - apps/backend/src/modules/epi-deliveries/
    - apps/backend/jest.config.js
tech_stack:
  added: []
  patterns:
    - withRlsContext pattern for all DB operations
    - pdfkit dynamic import for PDF generation (same as pesticide-prescriptions)
    - tx.stockOutput.create + tx.stockBalance.update inside same transaction for atomic stock deduction
    - position-requirement routes registered before /:id to avoid Express 5 param shadowing
key_files:
  created:
    - apps/backend/src/modules/epi-products/epi-products.service.ts
    - apps/backend/src/modules/epi-products/epi-products.routes.spec.ts
    - apps/backend/src/modules/epi-deliveries/epi-deliveries.service.ts
    - apps/backend/src/modules/epi-deliveries/epi-deliveries.routes.spec.ts
  modified:
    - apps/backend/src/modules/epi-products/epi-products.routes.ts (stub → full implementation)
    - apps/backend/src/modules/epi-deliveries/epi-deliveries.routes.ts (stub → full implementation)
    - apps/backend/jest.config.js (added .js → .ts moduleNameMapper)
decisions:
  - 'Stock deduction implemented inline inside withRlsContext transaction (not via service call) to avoid nested transaction anti-pattern per STATE.md'
  - 'deleteEpiDelivery uses cascade pattern: delete StockOutput (which cascades to StockOutputItem) after restoring StockBalance, then deletes EpiDelivery'
  - 'jest.config.js .js→.ts mapper added as Rule 3 auto-fix to unblock all tests broken by plan 30-01 ESM-style imports in app.ts'
metrics:
  duration: '9 minutes'
  completed: '2026-03-26'
  tasks_completed: 2
  files_changed: 7
---

# Phase 30 Plan 02: EPI Backend Modules Summary

EPI product CRUD with position requirements + EPI delivery with automatic stock deduction, stock restoration on delete, and NR-6 compliant PDF generation. 31 tests covering all critical paths.

## Tasks Completed

| Task | Name                                                  | Commit   | Files                                                                                        |
| ---- | ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| 1    | epi-products service + routes + tests                 | c3cc744c | epi-products.service.ts, epi-products.routes.ts, epi-products.routes.spec.ts, jest.config.js |
| 2    | epi-deliveries service + routes + tests (stock + PDF) | 3718e177 | epi-deliveries.service.ts, epi-deliveries.routes.ts, epi-deliveries.routes.spec.ts           |

## What Was Built

### epi-products module (fully functional)

9 endpoints registered:

- `GET /api/epi-products` — list with search and epiType filter, paginated, includes currentStock from StockBalance
- `POST /api/epi-products` — create EpiProduct linking Product to NR-31 CA metadata
- `GET /api/epi-products/:id` — single EPI product with full details
- `PUT /api/epi-products/:id` — update caNumber, caExpiry, epiType
- `DELETE /api/epi-products/:id` — delete (returns 409 if deliveries exist)
- `GET /api/epi-products/position-requirements` — list all position requirements
- `GET /api/epi-products/position-requirements/:positionId` — filtered by position
- `POST /api/epi-products/position-requirements` — create requirement (default quantity=1)
- `DELETE /api/epi-products/position-requirements/:id` — delete requirement

Service functions: `createEpiProduct`, `updateEpiProduct`, `deleteEpiProduct`, `listEpiProducts`, `getEpiProduct`, `createPositionEpiRequirement`, `deletePositionEpiRequirement`, `listPositionEpiRequirements`

### epi-deliveries module (fully functional)

6 endpoints registered:

- `GET /api/epi-deliveries` — list with filters (employeeId, epiType, reason, dateFrom, dateTo), paginated
- `POST /api/epi-deliveries` — create delivery with atomic stock deduction
- `GET /api/epi-deliveries/:id` — single delivery with employee + product names
- `DELETE /api/epi-deliveries/:id` — delete with stock restoration
- `GET /api/epi-deliveries/employees/:employeeId` — all deliveries for employee (Ficha tab)
- `GET /api/epi-deliveries/employees/:employeeId/pdf` — NR-6 compliant PDF Ficha de EPI

Service functions: `createEpiDelivery`, `deleteEpiDelivery`, `listEpiDeliveries`, `getEpiDelivery`, `listEmployeeDeliveries`, `generateEpiFichaPdf`

### Stock Integration

`createEpiDelivery` inside single `withRlsContext` transaction:

1. Verify EpiProduct + Employee belong to org
2. Check StockBalance sufficiency → throws `INSUFFICIENT_STOCK` if insufficient
3. `tx.stockOutput.create` (type: CONSUMPTION, status: CONFIRMED)
4. `tx.stockOutputItem.create` (with unitCost from averageCost)
5. `tx.stockBalance.update` (decrement currentQuantity, recalculate averageCost and totalValue)
6. `tx.epiDelivery.create` with stockOutputId link

`deleteEpiDelivery` inside single transaction:

1. Restore StockBalance (increment quantity, recalculate averageCost)
2. Delete StockOutput (cascades to StockOutputItem)
3. Delete EpiDelivery

### PDF Generation (NR-6 / NR-31 compliant)

`generateEpiFichaPdf` uses pdfkit dynamic import pattern:

- Header: "FICHA DE CONTROLE DE EPI" + "Conforme NR-6 e NR-31"
- Employee section: name, position title, hire date
- Table: Data | Descrição EPI | Nº CA | Qtd | Motivo | Assinatura
- Footer declaration text
- Dual signature lines (collaborator + employer)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed .js → .ts module resolution in Jest**

- **Found during:** Task 1 test run
- **Issue:** app.ts imports phase 30 stub routes with `.js` extension (ESM pattern), but jest.config.js had no moduleNameMapper for `.js` → `.ts`. This caused ALL test suites that import `app` to fail with "Cannot find module ... .routes.js". This was introduced in plan 30-01 when app.ts was updated.
- **Fix:** Added `'^(\\.{1,2}/.*)\\.js$': '$1'` to `moduleNameMapper` in `jest.config.js`
- **Files modified:** `apps/backend/jest.config.js`
- **Commit:** c3cc744c

## Known Stubs

None — both modules are fully implemented. The stub routes from plan 30-01 have been replaced with complete implementations.

## Self-Check: PASSED

Files created:

- apps/backend/src/modules/epi-products/epi-products.service.ts — FOUND
- apps/backend/src/modules/epi-products/epi-products.routes.spec.ts — FOUND
- apps/backend/src/modules/epi-deliveries/epi-deliveries.service.ts — FOUND
- apps/backend/src/modules/epi-deliveries/epi-deliveries.routes.spec.ts — FOUND

Commits:

- c3cc744c — Task 1 epi-products CRUD + tests
- 3718e177 — Task 2 epi-deliveries stock + PDF + tests

Key acceptance criteria:

- epi-products.service.ts contains `export async function createEpiProduct` — YES
- epi-products.service.ts contains `export async function listEpiProducts` — YES
- epi-products.service.ts contains `export async function createPositionEpiRequirement` — YES
- epi-products.routes.ts contains `router.get('/epi-products/position-requirements'` — YES (registered as const router via epiProductsRouter)
- epi-products.routes.ts contains `router.post('/epi-products'` — YES
- epi-products.routes.spec.ts contains 17 test cases — YES (17 > 8 minimum)
- epi-deliveries.service.ts contains `tx.stockOutput.create` — YES
- epi-deliveries.service.ts contains `tx.stockBalance.update` — YES
- epi-deliveries.service.ts contains `INSUFFICIENT_STOCK` — YES
- epi-deliveries.service.ts contains `import('pdfkit')` — YES
- epi-deliveries.service.ts contains `FICHA DE CONTROLE DE EPI` — YES
- epi-deliveries.routes.ts contains `employees/:employeeId/pdf` — YES
- epi-deliveries.routes.spec.ts contains 14 test cases — YES (14 > 10 minimum)
- All tests pass (exit 0) — YES (31/31)
