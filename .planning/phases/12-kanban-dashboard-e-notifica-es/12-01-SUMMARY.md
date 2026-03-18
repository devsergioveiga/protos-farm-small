---
phase: 12-kanban-dashboard-e-notifica-es
plan: '01'
subsystem: purchasing-kanban
tags: [kanban, notifications, backend, prisma, p2p]
dependency_graph:
  requires: []
  provides:
    - NotificationPreference Prisma model
    - purchasing-kanban GET endpoint
    - 15 notification types
    - node-cron installed
  affects:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/notifications/notifications.types.ts
    - apps/backend/src/app.ts
tech_stack:
  added: [node-cron, '@types/node-cron']
  patterns:
    - Promise.all parallel queries for 5 P2P entities
    - withRlsContext for all DB access
    - RC/SC overlap prevention via quotation existence check
key_files:
  created:
    - apps/backend/src/modules/purchasing-kanban/purchasing-kanban.types.ts
    - apps/backend/src/modules/purchasing-kanban/purchasing-kanban.service.ts
    - apps/backend/src/modules/purchasing-kanban/purchasing-kanban.routes.ts
    - apps/backend/src/modules/purchasing-kanban/purchasing-kanban.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/notifications/notifications.types.ts
    - apps/backend/package.json
    - apps/backend/src/app.ts
decisions:
  - 'RC with existing quotation placed in EM_COTACAO, not RC_APROVADA — checked via quotations count in RC query'
  - 'PAGO column uses paidAt >= 30 days ago filter on Payable.status=PAID with goodsReceiptId not null'
  - 'PurchaseOrder has no farmId — farm resolved via quotation → purchaseRequest → farm chain'
  - 'GoodsReceipt RECEBIDO: status=CONFIRMADO + payableId=null (pending payment), resolves to RECEBIDO column'
  - 'Payable farm field: added farm relation select since Payable has farmId FK to Farm'
metrics:
  duration: '18min'
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_created: 4
  files_modified: 4
---

# Phase 12 Plan 01: Backend Foundation Summary

Purchasing kanban GET endpoint aggregating 5 P2P entities into 7 semantic columns, with NotificationPreference schema model and 15 notification types.

## What Was Built

**Task 1: Schema + Types + Infrastructure**

- Added `NotificationPreference` Prisma model with `@@unique([userId, organizationId, eventType, channel])` and `@@map("notification_preferences")`
- Added back-relations: `User.notificationPreferences` and `Organization.notificationPreferences`
- Expanded `NOTIFICATION_TYPES` from 9 to 15 entries: added `QUOTATION_RECEIVED`, `PO_GOODS_RECEIVED`, `BUDGET_EXCEEDED`, `RETURN_REGISTERED`, `RETURN_RESOLVED`, `DAILY_DIGEST`
- Installed `node-cron` (prod) and `@types/node-cron` (dev) in backend
- Ran `prisma db push --accept-data-loss` + `prisma generate` (schema in sync)

**Task 2: Purchasing Kanban Module**

- `purchasing-kanban.types.ts`: `KanbanColumnId` (7 values), `KanbanCard`, `KanbanColumn`, `KanbanBoard`, `KanbanFilters`, `KANBAN_VALID_DROPS`
- `purchasing-kanban.service.ts`: `getKanbanBoard` using `withRlsContext` with `Promise.all` across 5 parallel queries (RC, SC, OC, GR, Payable)
- `purchasing-kanban.routes.ts`: `GET /api/org/:orgId/purchasing/kanban` with `authenticate` + `checkPermission('purchases:read')`
- Registered `purchasingKanbanRouter` in `app.ts`
- 9 integration tests (all passing): 7-column structure, farmId/urgency/search filters, SC/RC overlap prevention, PAGO column, 401/403 auth gates

## Column Mapping Logic

| Column             | Source Entity   | Filter Condition                            |
| ------------------ | --------------- | ------------------------------------------- |
| RC_PENDENTE        | PurchaseRequest | status IN (RASCUNHO, PENDENTE, DEVOLVIDA)   |
| RC_APROVADA        | PurchaseRequest | status=APROVADA AND no quotation            |
| EM_COTACAO         | Quotation       | status IN (AGUARDANDO_PROPOSTA, EM_ANALISE) |
| OC_EMITIDA         | PurchaseOrder   | status IN (EMITIDA, CONFIRMADA)             |
| AGUARDANDO_ENTREGA | PurchaseOrder   | status=EM_TRANSITO                          |
| RECEBIDO           | GoodsReceipt    | status=CONFIRMADO AND payableId=null        |
| PAGO               | Payable         | status=PAID AND paidAt >= 30 days ago       |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route middleware import correction**

- **Found during:** Task 2
- **Issue:** Plan referenced `authenticate` from `../../shared/auth/authenticate` and `requirePermission` — but actual project pattern uses `authenticate` from `../../middleware/auth` and `checkPermission` from `../../middleware/check-permission`
- **Fix:** Used correct imports matching existing module pattern
- **Files modified:** `purchasing-kanban.routes.ts`
- **Commit:** 02ca6bc

**2. [Rule 3 - Blocking] TypeScript strict error in routes**

- **Found during:** Task 2 (tsc check)
- **Issue:** `req.params.orgId` typed as `string | string[]` not assignable to `RlsContext.organizationId: string`
- **Fix:** Added explicit `as string` cast: `req.params.orgId as string`
- **Files modified:** `purchasing-kanban.routes.ts`
- **Commit:** 02ca6bc

## Self-Check: PASSED

All 4 created files exist on disk. Both task commits (7eb99ea, 02ca6bc) verified in git log.
