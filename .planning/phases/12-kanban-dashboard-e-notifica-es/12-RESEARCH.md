# Phase 12: Kanban, Dashboard e Notificações - Research

**Researched:** 2026-03-18
**Domain:** React DnD kanban, metrics aggregation, notification preferences — P2P purchase module
**Confidence:** HIGH

## Summary

Phase 12 closes the P2P purchase module with three capabilities: a kanban board that gives buyers visual control over the full pipeline (RC through payment), an executive dashboard with KPI comparatives for managers, and user-configurable notification preferences. All three features are read/action layers on top of already-existing data models (PurchaseRequest, Quotation, PurchaseOrder, GoodsReceipt, Payable) — no new core domain logic is needed.

The main technical challenge is the kanban aggregation: a single "card" must represent the full pipeline state of a purchase cycle that spans four separate models (RC → Quotation → PO → GoodsReceipt) each with their own status enums. The backend must produce a unified kanban view by joining across entities and mapping to the 7 canonical column positions. The dashboard aggregation pattern already exists in `saving-analysis.service.ts` (cross-entity joins with cycle days calculation) and can be extended directly.

**Primary recommendation:** Build the kanban aggregation as a new `modules/purchase-kanban/` backend module with a single `/api/org/purchase-kanban` endpoint that returns cards pre-sorted into columns. Add `modules/purchase-dashboard/` for executive metrics. Add `NotificationPreference` model and preference CRUD to the existing `notifications` module.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Kanban columns (7):** RC Pendente → Aprovada → Em Cotação → OC Emitida → Aguardando Entrega → Recebido → Pago
- **Drag & drop:** Triggers ConfirmModal before executing state transition — never silent
- **DnD library:** @dnd-kit/sortable (must install — NOT currently in project)
- **Card content:** nº/tipo/solicitante/valor/urgência/dias no estágio
- **Card badges:** Urgency color coding (normal/urgente/emergencial) + overdue alert icon when SLA exceeded
- **Column counters:** Badge with item count per column header
- **Filters:** Farm, category, urgency, supplier, date range — filter bar above board
- **Drill-down:** Click card opens detail modal for the relevant entity
- **Dashboard layout:** Top row with 5 KPI cards, below 2-column grid with charts
- **Primary KPIs:** Volume total (R$), Nº requisições/pedidos, Prazo médio ciclo (dias), % entrega no prazo, Saving acumulado (R$)
- **Comparison:** Each KPI shows % change badge vs previous same-length period (green/red arrow)
- **Charts:** BarChart (purchases by category), LineChart (saving evolution), ComposedChart (budget vs actual)
- **Period filter:** Preset buttons (Mês atual, Trimestre, Safra, Ano) + custom date range picker
- **Filters on dashboard:** Farm, category (applied to all charts/KPIs simultaneously)
- **Alerts section:** Bottom panel with requisições pendentes aging, pedidos em atraso, budget overages
- **Chart library:** Recharts (already installed v3.7.0, lazy-loaded)
- **Notification granularity:** Per-event-type toggle grouped by role context
- **Channels:** In-app badge + push mobile (email is placeholder — real SMTP deferred to v1.2)
- **Digest:** Daily digest toggle for managers
- **Storage:** New NotificationPreference model (userId, eventType, channel, enabled)
- **Default:** All notifications enabled on first use
- **Events covered:** See CONTEXT.md decisions for full event list by role
- **Preferences page:** Sub-page/modal accessible from NotificationBell dropdown
- **Backend caching:** 5-minute TTL on dashboard endpoint
- **Metrics computed:** Avg cycle time, % on-time delivery, urgent vs planned ratio, top 10 products, top 5 suppliers

### Claude's Discretion

- Exact KPI card styling and iconography
- Dashboard skeleton loading layout
- Chart color palette (should follow design system tokens)
- Kanban column width and card height
- Notification preference UI layout details
- Caching implementation (in-memory vs Redis)
- Whether to add WebSocket for real-time kanban updates or keep polling

### Deferred Ideas (OUT OF SCOPE)

- Email notifications (SMTP/SES): Real email delivery deferred to v1.2
- WebSocket real-time updates: Consider for v1.2 if polling proves insufficient
- Supplier performance report with charts
- NF-e XML import
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                           | Research Support                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DASH-01 | Kanban board with 7-column pipeline, drag & drop with confirmation, cards with key fields, filters, and visual alerts | @dnd-kit/sortable for DnD; backend aggregation query spanning RC/Quotation/PO/GR/Payable models; VALID_TRANSITIONS map for allowed drag actions                  |
| DASH-02 | Executive dashboard with 5 KPIs + comparatives, bar/line/composed charts, period filter, alerts panel                 | Recharts v3.7.0 (already installed); new `modules/purchase-dashboard/` service with comparison period arithmetic; reuse SavingAnalysisPage preset button pattern |
| DASH-03 | Per-user notification preferences by event type and channel, with daily digest for managers                           | New `NotificationPreference` Prisma model; extend `notifications.types.ts` with new event types; CRUD endpoints in existing notifications module                 |

</phase_requirements>

## Standard Stack

### Core

| Library           | Version | Purpose                                                | Why Standard                                         |
| ----------------- | ------- | ------------------------------------------------------ | ---------------------------------------------------- |
| @dnd-kit/core     | ^6.x    | DnD primitives (sensors, context, collision detection) | Modern, accessible, tree-shakeable — locked decision |
| @dnd-kit/sortable | ^8.x    | Sortable wrapper providing useSortable hook            | Provides the kanban drop target/draggable pattern    |
| recharts          | ^3.7.0  | Charts (BarChart, LineChart, ComposedChart)            | Already installed, lazy-loaded pattern established   |

### Supporting

| Library                    | Version  | Purpose                                     | When to Use                         |
| -------------------------- | -------- | ------------------------------------------- | ----------------------------------- |
| @dnd-kit/utilities         | ^3.x     | CSS transform utilities for drag animations | Companion to @dnd-kit/sortable      |
| node-cache / in-memory Map | built-in | 5-min TTL cache for dashboard endpoint      | Simpler than Redis; discretion area |

### Alternatives Considered

| Instead of      | Could Use                           | Tradeoff                                                                                                                             |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| @dnd-kit        | react-beautiful-dnd                 | rbd is deprecated/unmaintained since 2022; @dnd-kit is actively maintained and lighter                                               |
| @dnd-kit        | HTML5 native drag (Phase 8 pattern) | HTML5 drag events used for rule reorder (single list); @dnd-kit is warranted for multi-column kanban with accessibility requirements |
| in-memory cache | Redis                               | Redis adds infra complexity; in-memory Map with TTL is fine for single-process Express                                               |

**Installation:**

```bash
pnpm --filter @protos-farm/frontend add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Architecture Patterns

### Recommended Project Structure

**Backend — new modules:**

```
apps/backend/src/modules/
├── purchase-kanban/
│   ├── purchase-kanban.routes.ts
│   ├── purchase-kanban.routes.spec.ts
│   ├── purchase-kanban.service.ts
│   └── purchase-kanban.types.ts
└── purchase-dashboard/
    ├── purchase-dashboard.routes.ts
    ├── purchase-dashboard.routes.spec.ts
    ├── purchase-dashboard.service.ts
    └── purchase-dashboard.types.ts
```

**Frontend — new pages and components:**

```
apps/frontend/src/
├── pages/
│   ├── PurchaseKanbanPage.tsx / .css
│   └── PurchaseDashboardPage.tsx / .css
├── components/
│   ├── purchase-kanban/
│   │   ├── KanbanColumn.tsx
│   │   ├── KanbanCard.tsx
│   │   └── KanbanCardDetailModal.tsx
│   └── purchase-dashboard/
│       ├── PurchaseCategoryChart.tsx   (lazy)
│       ├── PurchaseSavingChart.tsx     (lazy)
│       └── BudgetVsActualChart.tsx     (lazy)
└── hooks/
    ├── usePurchaseKanban.ts
    └── usePurchaseDashboard.ts
```

**Notification preferences addition:**

```
apps/backend/src/modules/notifications/
├── notifications.routes.ts         (add preference CRUD routes)
├── notification-preferences.service.ts  (new: preference CRUD)
├── notifications.types.ts          (extend NotificationType enum)
└── notifications.service.ts        (extend createNotification to check preferences)
```

### Pattern 1: Kanban Pipeline Aggregation

**What:** Backend service that joins across RC/Quotation/PO/GoodsReceipt/Payable to produce a unified list of `KanbanCard` objects, each with a `column` assignment based on the pipeline's furthest-progressed status.

**Column assignment logic (server-side):**

```
RC.status == PENDENTE                              → column: RC_PENDENTE
RC.status == APROVADA, no Quotation                → column: APROVADA
Quotation exists, status != FECHADA                → column: EM_COTACAO
PO exists, status in [RASCUNHO, EMITIDA, CONFIRMADA, EM_TRANSITO] → column: OC_EMITIDA
PO.status == ENTREGUE OR GR.status == CONFIRMADO, Payable unpaid → column: AGUARDANDO_ENTREGA
GR.status == CONFIRMADO                            → column: RECEBIDO
Payable.status == PAID                             → column: PAGO
```

**When to use:** This is the canonical approach — a single endpoint returns all cards pre-assigned to columns. The frontend renders by filtering `cards.filter(c => c.column === col)`.

**Example backend type:**

```typescript
// Source: project pattern — purchase-kanban.types.ts
export type KanbanColumn =
  | 'RC_PENDENTE'
  | 'APROVADA'
  | 'EM_COTACAO'
  | 'OC_EMITIDA'
  | 'AGUARDANDO_ENTREGA'
  | 'RECEBIDO'
  | 'PAGO';

export interface KanbanCard {
  id: string; // purchaseRequestId (anchor entity)
  column: KanbanColumn;
  number: string; // RC sequential number
  type: string; // RC type (INSUMO_AGRICOLA, etc.)
  requester: string; // user display name
  totalValue: number; // sum of item estimated prices OR PO total
  urgency: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  daysInStage: number; // days since entering current column
  isOverdue: boolean; // SLA exceeded OR delivery date passed
  // entity IDs for drill-down
  purchaseRequestId: string;
  quotationId?: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
}
```

### Pattern 2: Dashboard Comparison Period

**What:** The dashboard KPIs need `current` and `previous` period values. The comparison is computed by running the same aggregation query twice — once for the requested period, once for the same-length period immediately preceding it.

**Example:**

```typescript
// Source: project pattern — follows saving-analysis.service.ts approach
async function getDashboardMetrics(ctx, params: { startDate; endDate }) {
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - periodMs);

  const [current, previous] = await Promise.all([
    computeMetrics(ctx, { startDate, endDate }),
    computeMetrics(ctx, { startDate: prevStartDate, endDate: prevEndDate }),
  ]);

  return {
    totalVolume: { current: current.totalVolume, previous: previous.totalVolume },
    // ...
  };
}
```

### Pattern 3: @dnd-kit Multi-Column Kanban

**What:** Use `DndContext` wrapping the board, `SortableContext` per column, and `useSortable` per card. `onDragEnd` validates the transition and opens `ConfirmModal` before calling the API.

**Example:**

```typescript
// Source: @dnd-kit documentation pattern
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function KanbanBoard({ cards, onTransition }) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const fromColumn = active.data.current?.column as KanbanColumn;
    const toColumn = over.id as KanbanColumn;
    if (fromColumn === toColumn) return;
    // Validate transition, then open ConfirmModal
    onTransition({ cardId: active.id as string, from: fromColumn, to: toColumn });
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {COLUMNS.map(col => (
        <SortableContext key={col} id={col} items={cards.filter(c => c.column === col).map(c => c.id)}>
          <KanbanColumn column={col} cards={cards.filter(c => c.column === col)} />
        </SortableContext>
      ))}
    </DndContext>
  );
}

function KanbanCard({ card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { column: card.column } });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return <article ref={setNodeRef} style={style} {...attributes} {...listeners}>...</article>;
}
```

### Pattern 4: NotificationPreference Model

**What:** New Prisma model storing per-user, per-event-type, per-channel preferences. Checked by `createNotification` before dispatching.

**New Prisma model:**

```prisma
model NotificationPreference {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  eventType      String   // NotificationType enum value
  channel        String   // 'IN_APP' | 'PUSH' | 'DIGEST'
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])

  @@unique([organizationId, userId, eventType, channel])
  @@index([userId, organizationId])
  @@map("notification_preferences")
}
```

**Key point:** Default is all-enabled. Preferences are created on-demand when a user opts OUT — the absence of a record means "enabled". This avoids seeding all users × all event types on signup.

### Anti-Patterns to Avoid

- **Emitting one card per entity:** The kanban must have ONE card per purchase cycle (anchored on RC), not separate cards for RC, Quotation, PO. The aggregation logic determines the furthest column reached.
- **Client-side column assignment:** Do not send raw entity data to the frontend and ask it to figure out columns. The backend returns `column` pre-assigned.
- **Silent drag transitions:** Every drag end that produces a valid target column MUST open `ConfirmModal` before the API call. This is a locked decision.
- **@dnd-kit without `useDroppable` on columns:** Column targets need to register as drop zones. Using only `SortableContext` without a `useDroppable`-based column component will cause drops to not register correctly when dragging to an empty column.
- **Blocking Prisma transaction for dashboard query:** Dashboard endpoint does multiple `findMany` calls — these should NOT be wrapped in a single `$transaction` since they are read-only queries that benefit from parallelism via `Promise.all`.

## Don't Hand-Roll

| Problem                                       | Don't Build            | Use Instead                                            | Why                                                                                              |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Drag handle gestures (touch, mouse, keyboard) | Custom event listeners | @dnd-kit sensors                                       | @dnd-kit handles PointerSensor + KeyboardSensor, accessibility, DragOverlay, collision detection |
| Drag animation/transform                      | CSS translate manually | CSS.Transform.toString() from @dnd-kit/utilities       | Handles FLIP correctly with React rendering cycle                                                |
| Chart tooltips, responsive sizing             | Custom SVG             | Recharts ResponsiveContainer + Tooltip                 | Already solved; Recharts pattern is established in SavingAnalysisPage                            |
| Comparison period math                        | Custom date arithmetic | `periodMs` subtraction pattern (see Pattern 2)         | Handles month boundary edge cases correctly                                                      |
| Notification delivery filtering               | Per-send query         | NotificationPreference model + default-enabled pattern | Avoids seeding, reduces query overhead                                                           |

**Key insight:** The hardest part of this phase is the kanban aggregation SQL/ORM logic — the presentation layer is straightforward once the backend returns correctly column-assigned cards. Invest in the aggregation query, not the UI mechanics.

## Common Pitfalls

### Pitfall 1: Empty Column Drop Targets

**What goes wrong:** When a kanban column has 0 cards, `SortableContext` has no items and the column won't register as a valid drop target. Dragging to an empty column silently fails.
**Why it happens:** @dnd-kit's `SortableContext` alone doesn't create a drop target — it only knows about sortable items within it.
**How to avoid:** Wrap each column with `useDroppable({ id: columnId })` in addition to `SortableContext`. The column `div` receives `setNodeRef` from `useDroppable`, making the entire column a drop zone.
**Warning signs:** Drag to empty column reverts immediately without triggering `onDragEnd` with a valid `over`.

### Pitfall 2: Kanban Card Aggregation — Orphaned Entities

**What goes wrong:** A PO can be created without a Quotation (emergency purchase). A GoodsReceipt can exist without a PO (EMERGENCIAL type). The aggregation query must handle all optional FK chains.
**Why it happens:** The schema has nullable FKs: `PurchaseOrder.quotationId?`, `GoodsReceipt.purchaseOrderId?`. A LEFT JOIN approach is required.
**How to avoid:** Anchor the query on `PurchaseRequest` with LEFT JOINs to Quotation, PO, GR. For emergency POs (no RC), consider a separate query pass or a dedicated "emergency" lane.
**Warning signs:** Missing cards for emergency purchases, or duplicates when one RC has multiple quotations.

### Pitfall 3: Recharts ComposedChart Data Shape

**What goes wrong:** `ComposedChart` for budget vs actual requires an array where each data point has BOTH the budget value and actual value at the same category/date. If the dataset is sparse (some categories have budget but no actuals), the chart renders gaps.
**Why it happens:** Recharts does not automatically fill missing values with 0.
**How to avoid:** Normalize data on the backend: return an array where every category appears exactly once, with `budget: 0` or `actual: 0` when no data exists for that side.
**Warning signs:** Chart shows floating bars with gaps between bars.

### Pitfall 4: NotificationPreference Default-Enabled vs Record Absence

**What goes wrong:** Creating a preference record for EVERY user × every event type on signup causes schema bloat and migration complexity. Checking for a record and treating absence as "disabled" inverts the intent.
**Why it happens:** Naive implementation creates "all enabled" records. The default is actually all-enabled; records should only be created when a user opts OUT.
**How to avoid:** In `createNotification`, query: `SELECT enabled FROM notification_preferences WHERE userId=X AND eventType=Y AND channel=Z`. If no record found, treat as `enabled=true`. Only create/update records when user explicitly changes a preference.
**Warning signs:** Migration seeds thousands of preference rows per organization.

### Pitfall 5: Kanban Transition Validation Against VALID_TRANSITIONS

**What goes wrong:** The kanban maps 4 domain state machines onto 7 visual columns. A drag from "Em Cotação" to "OC Emitida" is valid, but the actual backend transition must go through the correct entity (create PO from quotation), not just update a field.
**Why it happens:** Treating column-to-column as a simple status update misses the domain action (e.g., approving a quotation and creating a PO is not just `UPDATE purchase_requests SET status='OC_EMITIDA'`).
**How to avoid:** The kanban transition API should accept `{ purchaseRequestId, targetColumn }` and the backend service dispatches the appropriate domain action (not a generic status update). Map target column to required action:

- `APROVADA` → call approve-RC action
- `EM_COTACAO` → create Quotation or update to AGUARDANDO_PROPOSTA
- `OC_EMITIDA` → approve Quotation + create PO
- `AGUARDANDO_ENTREGA` → emit PO (set to ENTREGUE pending GR)
- `RECEBIDO` → confirm GoodsReceipt
- `PAGO` → mark Payable as PAID
  **Warning signs:** Drag transitions succeed in UI but leave domain models in inconsistent states (RC approved but no approval record, etc.).

### Pitfall 6: 5-Minute Dashboard Cache Stale State

**What goes wrong:** If caching is implemented per-process with a simple Map, after restart the cache is empty (fine). But if the cache key doesn't include `organizationId` + filter params, one org's data bleeds into another.
**Why it happens:** Simple cache with a fixed key like `"purchase-dashboard"` ignores tenant and filter context.
**How to avoid:** Cache key must be `${organizationId}:${startDate}:${endDate}:${farmId ?? 'all'}:${categoryId ?? 'all'}`. Use a `Map<string, { data: unknown; expiresAt: number }>` with TTL check on read.
**Warning signs:** Manager A sees Manager B's farm data after B refreshes the page.

## Code Examples

### Kanban Board DnD Setup

```typescript
// Source: @dnd-kit/core official docs pattern
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor),
);

<DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
  {KANBAN_COLUMNS.map((col) => (
    <KanbanColumn key={col.id} column={col} cards={cardsByColumn[col.id] ?? []} />
  ))}
  <DragOverlay>
    {activeCard ? <KanbanCard card={activeCard} isOverlay /> : null}
  </DragOverlay>
</DndContext>
```

### Column with useDroppable

```typescript
// Source: @dnd-kit/core official pattern for empty column drop zones
import { useDroppable } from '@dnd-kit/core';

function KanbanColumn({ column, cards }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div ref={setNodeRef} style={{ background: isOver ? 'var(--color-primary-50)' : undefined }}>
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {cards.map(card => <KanbanCard key={card.id} card={card} />)}
      </SortableContext>
    </div>
  );
}
```

### Backend Kanban Aggregation (skeleton)

```typescript
// Source: project pattern — extends saving-analysis.service.ts approach
export async function getKanbanCards(
  ctx: RlsContext,
  filters: KanbanFilters,
): Promise<KanbanCard[]> {
  return withRlsContext(ctx, async (tx) => {
    const rcs = await tx.purchaseRequest.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        status: { notIn: ['RASCUNHO', 'CANCELADA', 'REJEITADA'] },
        ...(filters.farmId ? { farmId: filters.farmId } : {}),
        ...(filters.urgency ? { urgency: filters.urgency } : {}),
      },
      include: {
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            purchaseOrders: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                goodsReceipts: {
                  where: { status: 'CONFIRMADO' },
                  take: 1,
                },
              },
            },
          },
        },
        items: { select: { estimatedUnitPrice: true, quantity: true } },
        createdByUser: { select: { name: true } },
      },
    });

    return rcs.map((rc) => assignColumn(rc));
  });
}
```

### Notification Preference Check in createNotification

```typescript
// Source: project pattern — notifications.service.ts extension
export async function createNotificationIfEnabled(
  tx: TxClient,
  organizationId: string,
  input: CreateNotificationInput,
): Promise<void> {
  // Check preference — absence means enabled (default)
  const pref = await tx.notificationPreference.findFirst({
    where: {
      organizationId,
      userId: input.recipientId,
      eventType: input.type,
      channel: 'IN_APP',
    },
  });
  if (pref && !pref.enabled) return; // explicitly disabled
  await createNotification(tx, organizationId, input);
}
```

### Dashboard Period Comparison Pattern

```typescript
// Source: project pattern — extends saving-analysis.service.ts
function buildComparisonPeriod(startDate: Date, endDate: Date): { prevStart: Date; prevEnd: Date } {
  const periodMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);
  return { prevStart, prevEnd };
}
```

## State of the Art

| Old Approach                 | Current Approach                       | When Changed         | Impact                                                                   |
| ---------------------------- | -------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| react-beautiful-dnd          | @dnd-kit                               | 2022 (rbd abandoned) | @dnd-kit is the current standard; rbd last commit 2022                   |
| WebSocket for real-time      | Polling (30s interval)                 | Project decision     | Polling established in useNotifications; @dnd-kit phase can keep polling |
| Global notification settings | Per-event-type per-channel preferences | Phase 12             | NotificationPreference model adds granularity                            |

**Deprecated/outdated:**

- `react-beautiful-dnd`: Unmaintained since 2022. Do not add to project.
- Spinner full-page loading: Project prohibits this; use skeleton screens per design system.

## Open Questions

1. **Emergency POs without RC: include in kanban or separate view?**
   - What we know: `PurchaseOrder.isEmergency = true` with no `quotationId` means no RC parent
   - What's unclear: Should these appear anchored to the PO (starting at OC_EMITIDA column) or be excluded?
   - Recommendation: Include them — start their card at OC_EMITIDA column with a special "Emergencial direto" badge. The kanban must anchor on PO, not RC, for these cases.

2. **Payable.status PAID detection for "Pago" column**
   - What we know: `Payable.status` enum has `PAID` and `GoodsReceipt.payableId` links receipt to payable
   - What's unclear: Which payable installment triggers the "Pago" column — all installments paid, or any?
   - Recommendation: All installments must be PAID (check `PayableInstallment` table). If partial payment exists, card stays in RECEBIDO column.

3. **Daily digest implementation mechanism**
   - What we know: BullMQ is used for async jobs (established in Phase 8). `dispatchPushNotification` is a fire-and-forget placeholder.
   - What's unclear: Is there an existing BullMQ scheduler/cron queue in the project?
   - Recommendation: Implement digest as a cron job using BullMQ's `repeat` option. Check if a `queue.ts` or `worker.ts` file exists before creating new infra.

## Validation Architecture

### Test Framework

| Property             | Value                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| Framework (backend)  | Jest (tsx, spec.ts files)                                                             |
| Framework (frontend) | Vitest 3.0 + @testing-library/react                                                   |
| Config file          | Backend: jest config in package.json; Frontend: vitest.config.ts                      |
| Quick run command    | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-kanban`        |
| Full suite command   | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test` |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                         | Test Type   | Automated Command                                                                        | File Exists? |
| ------- | -------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- | ------------ |
| DASH-01 | GET /api/org/purchase-kanban returns cards with correct column assignments       | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-kanban.routes`    | ❌ Wave 0    |
| DASH-01 | Drag-drop transition updates correct entity status                               | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-kanban.routes`    | ❌ Wave 0    |
| DASH-01 | Empty-column drop target registers                                               | manual-only | Visual test in browser                                                                   | N/A          |
| DASH-02 | GET /api/org/purchase-dashboard returns all 5 KPIs with comparison               | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-dashboard.routes` | ❌ Wave 0    |
| DASH-02 | KPI comparison period math is correct                                            | unit        | within purchase-dashboard.routes.spec.ts                                                 | ❌ Wave 0    |
| DASH-03 | GET/PATCH /api/org/notification-preferences returns and updates user preferences | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=notifications.routes`      | ❌ Wave 0    |
| DASH-03 | createNotificationIfEnabled skips disabled channel                               | unit        | within notifications module spec                                                         | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-kanban|purchase-dashboard|notifications`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.spec.ts` — covers DASH-01
- [ ] `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.spec.ts` — covers DASH-02
- [ ] Prisma migration file for `NotificationPreference` model — covers DASH-03
- [ ] `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` must be installed before frontend implementation

## Sources

### Primary (HIGH confidence)

- Project codebase — `apps/backend/src/modules/saving-analysis/saving-analysis.service.ts` — aggregation pattern
- Project codebase — `apps/backend/prisma/schema.prisma` — PurchaseRequest, Quotation, PurchaseOrder, GoodsReceipt, Payable, Notification models
- Project codebase — `apps/frontend/src/hooks/useNotifications.ts` — polling pattern, NotificationType
- Project codebase — `apps/frontend/src/pages/FinancialDashboardPage.tsx` — KPI card pattern, skeleton, YoY badge
- Project codebase — `apps/frontend/src/pages/SavingAnalysisPage.tsx` — preset buttons, lazy chart loading, KpiCard component

### Secondary (MEDIUM confidence)

- @dnd-kit official docs (https://docs.dndkit.com) — useDroppable + SortableContext multi-column pattern, sensor configuration
- Recharts v3.7.0 docs — ComposedChart, ResponsiveContainer, lazy-load compatibility with React.lazy

### Tertiary (LOW confidence)

- BullMQ cron/repeat scheduler for daily digest — verify if existing queue infrastructure exists before implementation

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — @dnd-kit locked decision; Recharts already installed and in use
- Architecture: HIGH — follows established patterns from saving-analysis, notifications, and financial-dashboard modules
- Pitfalls: HIGH — all identified from actual schema inspection and existing codebase patterns
- Kanban aggregation logic: MEDIUM — column assignment rules are clear from CONTEXT.md; PO-without-RC edge case and "Pago" column detection need care during implementation

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain; only risk is if Phases 9-11 introduce schema changes before Phase 12 executes)
