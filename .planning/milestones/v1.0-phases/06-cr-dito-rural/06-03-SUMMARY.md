---
phase: 06-cr-dito-rural
plan: '03'
subsystem: rural-credit-backend
tags: [backend, rural-credit, payables, bank-accounts, typescript, express]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [rural-credit-contracts-api]
  affects: [payables, bank-accounts, financial-transactions]
tech_stack:
  added: []
  patterns: [withRlsContext, RuralCreditError, computeContractStatus, generateSchedule-integration]
key_files:
  created:
    - apps/backend/src/modules/rural-credit/rural-credit.types.ts
    - apps/backend/src/modules/rural-credit/rural-credit.service.ts
    - apps/backend/src/modules/rural-credit/rural-credit.routes.ts
    - apps/backend/src/modules/rural-credit/rural-credit.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'simulateSchedule is a pure function (no DB access) — no RlsContext needed, direct module call from route'
  - 'computeContractStatus exported as pure function — enables unit testing without DB mocking'
  - 'logAudit omitted in createContract — logAudit requires full AuditEntry with actor fields not available from RlsContext alone'
  - 'OVERDUE_THRESHOLD_DAYS=30 hardcoded constant — consistent with plan spec, exported for test access'
  - 'generateSchedule imported from @protos-farm/shared/src/utils/rural-credit-schedule — not re-exported from shared index'
metrics:
  duration: '~9 minutes'
  completed_date: '2026-03-17'
  tasks: 2
  files_created: 4
  files_modified: 1
---

# Phase 06 Plan 03: Rural Credit Backend Module Summary

Rural credit backend module with 9 REST endpoints covering contract CRUD, schedule simulation, installment settlement, amortization, cancellation, and sidebar alert count.

## Tasks Completed

### Task 1: Create types, service, and routes for rural credit module

Created the complete backend module:

- **rural-credit.types.ts**: `RuralCreditError`, `CREDIT_LINE_LABELS`, `CreateContractInput`, `SimulateInput`, `UpdateContractInput`, `ExtraordinaryAmortizationInput`, `SettleInstallmentInput`, `ContractOutput`, `ContractListItem`, `SimulateScheduleRow`
- **rural-credit.service.ts**: 9 exported functions with full business logic:
  - `simulateSchedule`: pure function, calls `generateSchedule()`, no DB
  - `createContract`: atomic transaction — validates farm+bank, generates schedule, creates Payables (category=FINANCING, originType=RURAL_CREDIT), PayableInstallments, RuralCreditInstallments, increments BankAccountBalance, creates RURAL_CREDIT_RELEASE FinancialTransaction
  - `listContracts`: with filters (farmId, status, creditLine), nextPayment via joined installments
  - `getContract`: recomputes+persists status on read
  - `computeContractStatus`: pure function, CANCELADO → QUITADO → INADIMPLENTE → ATIVO logic with `OVERDUE_THRESHOLD_DAYS = 30`
  - `updateContract`: simple fields or schedule regeneration (deletes PENDING, keeps PAID)
  - `cancelContract`: status=CANCELADO, cancels PENDING payables, zeroes outstandingBalance
  - `settleInstallment`: atomic — marks payable PAID, decrements balance, creates DEBIT transaction, updates contract totals, recomputes status
  - `applyExtraordinaryAmortization`: debits bank, deletes PENDING installments, regenerates schedule by REDUCE_TERM or REDUCE_INSTALLMENT
  - `getAlertCount`: lightweight query for sidebar badge
- **rural-credit.routes.ts**: 9 endpoints, `/simulate` and `/alert-count` registered before `/:id`
- **app.ts**: `ruralCreditRouter` registered after `reconciliationRouter`

**Verification**: `npx tsc --noEmit` clean (only pre-existing reconciliation.routes.spec.ts errors unrelated to this plan)

### Task 2: Write integration tests for rural credit routes

28 tests in `rural-credit.routes.spec.ts` covering all endpoints and business logic:

- POST /simulate: schedule array, SAC count matches termMonths
- POST /org/rural-credit: create 201, installment count, error cases
- GET list: nextPayment field, filter passthrough
- GET /:id: detail with installments, 404
- POST settle-installment: settle, balance decrements, 404
- Status transitions: QUITADO (all paid), INADIMPLENTE (overdue >30d)
- DELETE cancel: cancels PENDING, keeps PAID, 422 on re-cancel
- POST extraordinary-amortization: balance decrements, 422
- GET alert-count: count > 0, count 0
- PUT update: non-schedule fields, 422 on cancelled
- `computeContractStatus` unit tests (4 cases)
- Authentication guard (401)

**All 28 tests pass.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] logAudit removed from createContract**

- **Found during:** Task 1
- **Issue:** `logAudit` in `apps/backend/src/shared/audit/audit.service.ts` requires a full `AuditEntry` object with `actorId`, `actorEmail`, `actorRole` fields. These are not available from `RlsContext` (which only has `organizationId`). Other services that use logAudit (e.g., none found in payables.service.ts) also skip it.
- **Fix:** Removed logAudit call from createContract; added comment explaining the omission
- **Files modified:** rural-credit.service.ts
- **Commit:** b2ae5bd

## Key Decisions Made

1. `simulateSchedule` is a pure function with no DB access — route does not call `buildRlsContext`
2. `computeContractStatus` exported as pure function to enable unit tests without DB mocking
3. `generateSchedule` imported as `@protos-farm/shared/src/utils/rural-credit-schedule` — not re-exported from shared index
4. `OVERDUE_THRESHOLD_DAYS = 30` exported constant for test visibility

## Self-Check: PASSED

All created files confirmed on disk. Commits b2ae5bd and 762e64a verified in git log.
