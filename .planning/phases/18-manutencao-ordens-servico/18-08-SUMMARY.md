---
phase: 18-manutencao-ordens-servico
plan: '08'
subsystem: work-orders
tags: [testing, integration-tests, work-orders, maintenance]
dependency_graph:
  requires: []
  provides: [work-orders integration test coverage]
  affects: [work-orders module]
tech_stack:
  added: []
  patterns:
    [supertest integration testing, jest.mock service pattern, role-based permission testing]
key_files:
  created: []
  modified:
    - apps/backend/src/modules/work-orders/work-orders.routes.spec.ts
decisions:
  - 'Used CONSULTANT role for 403 test because OPERATOR has work-orders:create permission by default'
metrics:
  duration: 8min
  completed_date: '2026-03-21'
  tasks_completed: 1
  files_modified: 1
---

# Phase 18 Plan 08: Work Orders Integration Tests Summary

**One-liner:** 35 real integration tests replacing all it.todo() stubs in work-orders.routes.spec.ts, covering all 9 route groups including the critical closeWorkOrder path with all 3 accounting treatments.

## What Was Built

Implemented full integration test coverage for the work orders module — the most complex module in Phase 18. All 35 `it.todo()` stubs were replaced with real tests that mock the service layer and verify HTTP behavior end-to-end.

### Test Coverage

| Route Group                           | Tests | Key Scenarios                                                                                                                                                  |
| ------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /work-orders                     | 6     | Create, sequential number, PREVENTIVA+plan, SOLICITACAO+geo, 400, 403                                                                                          |
| GET /work-orders                      | 5     | Pagination, filter by status/assetId/type/date range                                                                                                           |
| GET /work-orders/:id                  | 2     | Full response with parts/ccItems/asset, 404                                                                                                                    |
| PATCH /work-orders/:id                | 3     | Status EM_ANDAMENTO, AGUARDANDO_PECA, title+description                                                                                                        |
| POST /work-orders/:id/parts           | 2     | Add part + cost update, 400 product not found                                                                                                                  |
| DELETE /work-orders/:id/parts/:partId | 1     | Remove part + cost recalculation                                                                                                                               |
| PATCH /work-orders/:id/close          | 10    | 400 no treatment, DESPESA, CAPITALIZACAO, DIFERIMENTO+months, 400 no months, stock deduction, CC inherit, CC override, CC amount precision, plan recalculation |
| PATCH /work-orders/:id/cancel         | 2     | Cancel success, 400 already closed                                                                                                                             |
| GET /work-orders/dashboard            | 4     | Full dashboard, null MTBF/MTTR, byStatus, costByAsset                                                                                                          |

**Total: 35 tests, 787 lines**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used CONSULTANT role instead of OPERATOR for 403 test**

- **Found during:** Task 1 (test execution)
- **Issue:** The 403 test used `OPERATOR_PAYLOAD` but OPERATOR role has `work-orders:create` permission in `DEFAULT_ROLE_PERMISSIONS`, so the test got 201 instead of 403
- **Fix:** Changed to CONSULTANT role which only has `farms:read`, `producers:read`, `animals:read`, `operations:read`, `purchases:read`, `reports:read` — no work-orders permissions
- **Files modified:** `work-orders.routes.spec.ts`
- **Commit:** 417628de

## Self-Check: PASSED

- FOUND: `apps/backend/src/modules/work-orders/work-orders.routes.spec.ts` (787 lines)
- FOUND: commit `417628de` — test(18-08): implement all 35 work order integration tests
