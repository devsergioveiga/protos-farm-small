---
phase: 08-requisi-o-e-aprova-o
plan: 01
subsystem: backend-foundation
tags: [prisma, schema, migration, types, state-machine, purchase-requests, approval, notifications]
dependency_graph:
  requires: [07-04-SUMMARY.md]
  provides:
    [
      PurchaseRequest model,
      ApprovalRule model,
      ApprovalAction model,
      Delegation model,
      Notification model,
      RC state machine types,
      approval types,
      notification types,
    ]
  affects: [08-02, 08-03, 08-04, 08-05, 08-06]
tech_stack:
  added: []
  patterns:
    [VALID_TRANSITIONS state machine, collocated module types, db-push + migrate-resolve pattern]
key_files:
  created:
    - apps/backend/prisma/migrations/20260408100000_add_purchase_requests_module/migration.sql
    - apps/backend/src/modules/purchase-requests/purchase-requests.types.ts
    - apps/backend/src/modules/approval-rules/approval-rules.types.ts
    - apps/backend/src/modules/notifications/notifications.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
decisions:
  - 'Notification model uses purchaseRequestId FK (optional) for direct relation — cleaner than relying only on referenceId/referenceType strings'
  - 'ApprovalAction.organizationId has explicit Organization relation (required for reverse relation on Organization model)'
  - 'All 7 new models use cuid() as ID per RESEARCH.md recommendation; existing models use uuid()'
metrics:
  duration: 5min
  completed_date: 2026-03-17
  tasks_completed: 2
  files_modified: 5
---

# Phase 8 Plan 1: Backend Foundation — Schema + Types Summary

Prisma schema extended with 7 models and 2 enums for the purchase request (RC) module, migration applied, and all type definitions created with state machine, error classes, and input interfaces.

## What Was Built

### Task 1: Prisma Schema + Migration

Added 2 enums and 7 models to `schema.prisma`:

- **`PurchaseRequestStatus`** enum: RASCUNHO, PENDENTE, APROVADA, REJEITADA, DEVOLVIDA, CANCELADA
- **`PurchaseRequestUrgency`** enum: NORMAL, URGENTE, EMERGENCIAL
- **`PurchaseRequest`**: Core RC model with sequential number (unique per org), urgency, status, SLA fields (`slaDeadline`, `slaNotifiedAt`), geo fields for mobile, soft delete
- **`PurchaseRequestItem`**: Line items with catalog product link or free-text fallback, cascade delete
- **`PurchaseRequestAttachment`**: File metadata (multer will write actual files to disk), cascade delete
- **`ApprovalRule`**: Org-scoped rules with value ranges, dual-approver support, priority ordering
- **`ApprovalAction`**: Step-based approval records; step 1 and step 2 for sequential double approval
- **`Delegation`**: Temporary approver substitution with date range and active flag
- **`Notification`**: In-app notification table with optional `purchaseRequestId` FK for direct relation

Reverse relations added to: `Organization`, `Farm`, `User`, `CostCenter`.

Migration `20260408100000_add_purchase_requests_module` created manually and marked as applied via `migrate resolve --applied` (same pattern as Phase 7 due to pre-existing shadow DB failure).

### Task 2: Type Definitions

Three module type files created following the collocated module pattern:

**`purchase-requests.types.ts`:**

- `RC_TYPES = SUPPLIER_CATEGORIES` — reuses Phase 7 supplier categories (no duplication)
- `RC_VALID_TRANSITIONS` state machine map — same pattern as `checks.types.ts`
- `canTransition(from, to)` — central transition validator
- `SLA_HOURS` map: NORMAL→null, URGENTE→24h, EMERGENCIAL→4h
- `PurchaseRequestError` with `statusCode`
- Input interfaces: `CreatePurchaseRequestInput`, `UpdatePurchaseRequestInput`, `ListPurchaseRequestsQuery`, `TransitionInput`

**`approval-rules.types.ts`:**

- `APPROVAL_ACTION_STATUSES`: PENDING, APPROVED, REJECTED, RETURNED
- `ApprovalRuleError` with `statusCode`
- Input interfaces: `CreateApprovalRuleInput`, `UpdateApprovalRuleInput`, `CreateDelegationInput`

**`notifications.types.ts`:**

- `NOTIFICATION_TYPES`: RC_APPROVED, RC_REJECTED, RC_RETURNED, RC_PENDING, SLA_REMINDER
- `NotificationError` with `statusCode`
- `CreateNotificationInput` interface

## Decisions Made

1. **Notification model FK**: Added explicit `purchaseRequestId String?` FK on `Notification` model with direct relation to `PurchaseRequest`, rather than relying only on `referenceId`/`referenceType` string fields. This enables typed joins when loading RC detail pages.

2. **ApprovalAction.organizationId relation**: Added explicit `Organization` relation on `ApprovalAction` model (required because `Organization` declares a `approvalActions` reverse relation — Prisma requires both sides).

3. **cuid() for new models**: All 7 Phase 8 models use `@id @default(cuid())` following the RESEARCH.md recommendation and the pattern from Phase 7 suppliers module. Existing models use `uuid()`.

## Deviations from Plan

None — plan executed exactly as written. The migration approach (db push + manual SQL + migrate resolve) matched the documented Phase 7 pattern.

## Pre-existing Issues (Out of Scope)

Two pre-existing TypeScript errors in test files were discovered but are out of scope:

- `src/modules/reconciliation/reconciliation.routes.spec.ts` (2 errors — type narrowing in mock data)
- `src/modules/rural-properties/rural-properties.routes.spec.ts` (3 errors — missing fields in mock data)

These were logged and not fixed per deviation scope boundary rules.

## Commits

| Hash      | Message                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `1da5f85` | feat(08-01): add 7 Prisma models for purchase request module                           |
| `507ca66` | feat(08-01): add type definitions for purchase requests, approval rules, notifications |

## Self-Check: PASSED

- [x] `apps/backend/prisma/schema.prisma` — contains all 7 models and 2 enums
- [x] `apps/backend/prisma/migrations/20260408100000_add_purchase_requests_module/migration.sql` — exists
- [x] `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — exists with all required exports
- [x] `apps/backend/src/modules/approval-rules/approval-rules.types.ts` — exists
- [x] `apps/backend/src/modules/notifications/notifications.types.ts` — exists
- [x] `npx prisma validate` exits 0
- [x] `npx prisma generate` exits 0
- [x] No TypeScript errors in new files
- [x] Commits `1da5f85` and `507ca66` present in git log
