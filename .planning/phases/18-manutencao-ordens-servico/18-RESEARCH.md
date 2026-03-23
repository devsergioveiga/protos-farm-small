# Phase 18: Manutenção e Ordens de Serviço — Research

**Researched:** 2026-03-20
**Domain:** Maintenance management — preventive plans, work orders, spare parts stock, cost-center appropriation, mobile offline requests, maintenance dashboard
**Confidence:** HIGH

## Summary

Phase 18 builds the maintenance module on top of the Asset entity established in Phase 16. The `Asset` model already has `status: EM_MANUTENCAO` and the `AssetMaintenanceTab` in `AssetDrawer` is a placeholder stub waiting for this phase. Three new backend modules are needed: `maintenance-plans` (preventive scheduling with triggers by hourmeter/km/time), `work-orders` (OS lifecycle with parts consumption, labor, external costs, accounting classification), and `spare-parts` (spare-parts sub-stock with per-asset compatibility and reorder points). The existing `stock-deduction` helper is the correct integration point for automatic parts deduction when OS is closed — use `createConsumptionOutput` with `fieldOperationRef: "work-order:{id}"`. Cost-center appropriation for OS costs (CCPA-03) inherits `Asset.costCenterId` with optional manual rateio override, following the same `DepreciationEntryCCItem` pattern used in Phase 17.

The mobile maintenance request (MANU-03) follows the established offline queue pattern: enqueue a `CREATE maintenance_requests` operation in `pending-operations-repository` and sync via `SyncContext.flushNow()` when connectivity is restored. Push notification to responsible uses the existing `push-notifications.ts` + `expo-notifications` stack already in place. Photo attachment uses `expo-image-picker` (already in Expo SDK 52) stored to object storage (same bucket as asset photos).

The OS accounting classification wizard (MANU-06) for high-value OS presents three options at close time: immediate expense (`DESPESA`), capitalization (`CAPITALIZACAO` — increases asset book value, resets depreciation base), and deferral (`DIFERIMENTO` — spreads cost across future periods). The locked decision from STATE.md is that `PATCH /work-orders/:id/close` returns 400 if `accountingTreatment` is absent. The frontend wizard is a modal step triggered when total OS cost exceeds a configurable threshold (default BRL 1,000).

**Primary recommendation:** Build in 5 plans — Wave 0 (test stubs + schema), maintenance plans + backend core (plans service + triggers), work orders backend (OS lifecycle + stock deduction + CC appropriation), maintenance plans + work orders frontend, mobile maintenance request + dashboard.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                          | Research Support                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MANU-01 | Gerente pode criar planos de manutenção preventiva com gatilhos (horímetro, km, tempo), cálculo automático próxima execução e alerta | New MaintenancePlan model; triggers stored as JSON array; next-due calculation from last MeterReading + interval; node-cron for daily alert check             |
| MANU-02 | Gerente pode abrir, acompanhar e encerrar OS com peças (baixa automática no estoque), horas de mão de obra, custo externo e fotos    | WorkOrder + WorkOrderPart + WorkOrderLabor models; createConsumptionOutput from stock-deduction; photoUrls JSON array; assetStatus → EM_MANUTENCAO on open    |
| MANU-03 | Operador pode solicitar manutenção pelo celular com foto, geolocalização e notificação push, funcionando offline                     | pending-operations-repository + SyncContext pattern; expo-image-picker; expo-location; push-notifications.ts + notifications.service.ts                       |
| MANU-04 | Gerente pode controlar estoque de peças de reposição com ponto de reposição, vinculação por máquina e inventário                     | SparePart model linked to Product (existing); SparePartAssetCompat join; reorderPoint field; stock balance reuses StockBalance existing model                 |
| MANU-05 | Dashboard de manutenção: disponibilidade mecânica, MTBF, MTTR, custo acumulado, kanban de OS e alertas de manutenções vencidas       | Computed metrics from WorkOrder history; kanban reuses @dnd-kit/core already installed; existing KanbanBoard/Column/Card components as reference              |
| MANU-06 | Ao encerrar OS de alto valor, assistente de classificação contábil (despesa, capitalização ou diferimento)                           | WorkOrderAccountingTreatment enum; mandatory on close (locked STATE.md decision); threshold-based trigger; frontend multi-step modal wizard pattern           |
| MANU-07 | Contador pode diferenciar e apropriar despesas antecipadas (diferimento) de manutenções grandes                                      | DeferredMaintenance model; monthly amortization amount; WorkOrder.deferredMaintenanceId FK; ties into CCPA-03 cost-center appropriation                       |
| MANU-08 | Contador pode configurar provisão mensal de manutenção por ativo ou frota com lançamento automático e conciliação com gastos reais   | MaintenanceProvision model; monthly cron (same pattern as depreciation.cron.ts); provision vs actual reconciliation report                                    |
| CCPA-03 | Custos de manutenção (OS) são apropriados por CC com rateio manual ou herança do CC do ativo                                         | WorkOrderCCItem model (mirrors DepreciationEntryCCItem); inherit from Asset.costCenterId or manual override; validateCostCenterItems from @protos-farm/shared |

</phase_requirements>

---

## Standard Stack

### Core

| Library                | Version | Purpose                                                     | Why Standard                                                          |
| ---------------------- | ------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Prisma                 | 7.x     | ORM + migrations for 5 new models                           | Already in use; follows existing schema conventions                   |
| decimal.js             | ^10.6.0 | Monetary arithmetic (OS cost, parts cost, provision)        | Already installed; locked decision for all monetary math              |
| @protos-farm/shared    | current | validateCostCenterItems, Money value object                 | Already imported; CC reconciliation pattern established in Phase 17   |
| node-cron + ioredis    | current | Daily alert check for overdue plans; monthly provision cron | Already installed; pattern established in digest.cron.ts and Phase 17 |
| stock-deduction module | current | createConsumptionOutput for automatic parts deduction       | Already used by pesticide/fertilizer/soil-prep; same pattern applies  |
| @dnd-kit/core          | current | Kanban drag-and-drop for OS board (MANU-05)                 | Already installed; used by KanbanBoard in purchasing-dashboard        |
| expo-notifications     | SDK 52  | Push notification on maintenance request sync (MANU-03)     | Already configured in push-notifications.ts                           |
| expo-image-picker      | SDK 52  | Photo capture for mobile maintenance request                | Already in Expo SDK 52; same pattern as asset photos                  |
| expo-location          | SDK 52  | Geolocation capture for mobile maintenance request          | Already in Expo SDK 52; used by monitoring-record mobile screen       |

### Supporting

| Library  | Version | Purpose                             | When to Use                                                      |
| -------- | ------- | ----------------------------------- | ---------------------------------------------------------------- |
| ExcelJS  | ^4.4.0  | OS report / maintenance cost XLSX   | Already installed; use for export endpoints                      |
| pdfkit   | ^0.17.2 | OS report PDF                       | Already installed; used in pesticide-prescriptions               |
| date-fns | current | Next-due date calculation utilities | Already installed; use for addDays/addMonths interval arithmetic |

### Alternatives Considered

| Instead of                     | Could Use                        | Tradeoff                                                                                                            |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Reusing StockBalance for parts | Separate SparePartsBalance table | StockBalance already scoped to organizationId+productId; no separate model needed if spare parts are typed Products |
| Custom kanban for OS           | New kanban implementation        | Existing KanbanBoard/Column/Card components can be reused with OS-specific column definitions                       |
| Manual provision               | Automatic cron only              | Both needed: auto for normal ops, manual override for ad-hoc provision                                              |

**Installation:** No new packages needed. All required libraries already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
├── maintenance-plans/
│   ├── maintenance-plans.routes.ts
│   ├── maintenance-plans.routes.spec.ts
│   ├── maintenance-plans.service.ts
│   └── maintenance-plans.types.ts
├── work-orders/
│   ├── work-orders.routes.ts
│   ├── work-orders.routes.spec.ts
│   ├── work-orders.service.ts
│   └── work-orders.types.ts
└── maintenance-provisions/
    ├── maintenance-provisions.routes.ts
    ├── maintenance-provisions.routes.spec.ts
    ├── maintenance-provisions.service.ts
    └── maintenance-provisions.types.ts

apps/backend/src/shared/cron/
└── maintenance-alerts.cron.ts    # Daily: compute overdue plans, send notifications

apps/frontend/src/pages/
├── MaintenancePlansPage.tsx
├── MaintenancePlansPage.css
├── WorkOrdersPage.tsx
├── WorkOrdersPage.css
├── MaintenanceDashboardPage.tsx
└── MaintenanceDashboardPage.css

apps/frontend/src/components/maintenance/
├── MaintenancePlanModal.tsx
├── MaintenancePlanModal.css
├── WorkOrderModal.tsx
├── WorkOrderModal.css
├── WorkOrderCloseWizard.tsx       # Multi-step: cost summary → accounting treatment → confirm
├── WorkOrderCloseWizard.css
├── MaintenanceKanban.tsx          # Wraps existing KanbanBoard with OS columns
├── MaintenanceProvisionModal.tsx
└── MaintenanceProvisionModal.css

apps/frontend/src/hooks/
├── useMaintenancePlans.ts
├── useWorkOrders.ts
├── useMaintenanceDashboard.ts
└── useMaintenanceProvisions.ts

apps/frontend/src/types/
└── maintenance.ts

apps/mobile/app/(app)/
└── maintenance-request.tsx        # Offline-capable request form

apps/mobile/services/db/
└── maintenance-request-repository.ts   # Local SQLite store for offline requests
```

### Pattern 1: Schema — New Models

**What:** Five new models: `MaintenancePlan` (preventive triggers + next-due), `WorkOrder` (OS lifecycle), `WorkOrderPart` (parts consumed per OS), `WorkOrderLabor` (labor hours per OS), `WorkOrderCCItem` (CC distribution of OS cost), `DeferredMaintenance` (deferral amortization), `MaintenanceProvision` (monthly provision config).

```prisma
// Source: project Prisma conventions + STATE.md locked decisions

enum MaintenanceTriggerType {
  HOURMETER   // hours since last service
  ODOMETER    // km since last service
  CALENDAR    // days/months since last service
}

enum WorkOrderStatus {
  ABERTA
  EM_ANDAMENTO
  AGUARDANDO_PECA
  ENCERRADA
  CANCELADA
}

enum WorkOrderType {
  PREVENTIVA   // from MaintenancePlan schedule
  CORRETIVA    // unplanned breakdown
  SOLICITACAO  // operator mobile request
}

enum WorkOrderAccountingTreatment {
  DESPESA         // immediate expense to P&L
  CAPITALIZACAO   // add to asset book value, reset depreciation base
  DIFERIMENTO     // defer cost across future periods
}

model MaintenancePlan {
  id              String   @id @default(uuid())
  organizationId  String
  assetId         String
  name            String
  description     String?
  triggerType     MaintenanceTriggerType
  intervalValue   Decimal  @db.Decimal(12, 2)  // hours, km, or days
  alertBeforeValue Decimal @db.Decimal(12, 2)  // alert N hours/km/days before due
  lastExecutedAt  DateTime?
  lastMeterValue  Decimal? @db.Decimal(12, 2)
  nextDueAt       DateTime?
  nextDueMeter    Decimal? @db.Decimal(12, 2)
  isActive        Boolean  @default(true)
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  asset        Asset       @relation(fields: [assetId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])
  workOrders   WorkOrder[]

  @@index([organizationId, assetId])
  @@index([nextDueAt])
  @@map("maintenance_plans")
}

model WorkOrder {
  id                    String                       @id @default(uuid())
  organizationId        String
  assetId               String
  sequentialNumber      Int
  type                  WorkOrderType
  status                WorkOrderStatus              @default(ABERTA)
  title                 String
  description           String?
  maintenancePlanId     String?
  requestedBy           String?
  assignedTo            String?
  openedAt              DateTime                     @default(now())
  startedAt             DateTime?
  closedAt              DateTime?
  hourmeterAtOpen       Decimal?                     @db.Decimal(12, 2)
  odomoterAtOpen        Decimal?                     @db.Decimal(12, 2)
  externalCost          Decimal?                     @db.Decimal(15, 2)
  externalSupplier      String?
  laborHours            Decimal?                     @db.Decimal(8, 2)
  laborCostPerHour      Decimal?                     @db.Decimal(10, 2)
  totalPartsCost        Decimal?                     @db.Decimal(15, 2)
  totalLaborCost        Decimal?                     @db.Decimal(15, 2)
  totalCost             Decimal?                     @db.Decimal(15, 2)
  accountingTreatment   WorkOrderAccountingTreatment?
  accountingThreshold   Decimal?                     @db.Decimal(15, 2)
  photoUrls             Json?                        @default("[]")
  geoLat                Decimal?                     @db.Decimal(9, 6)
  geoLon                Decimal?                     @db.Decimal(9, 6)
  stockOutputId         String?    // FK to StockOutput created at close
  costCenterId          String?    // overrides asset.costCenterId if set
  costCenterMode        String     @default("INHERITED")  // INHERITED | FIXED | PERCENTAGE
  notes                 String?
  createdBy             String
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt

  asset            Asset                    @relation(fields: [assetId], references: [id])
  organization     Organization             @relation(fields: [organizationId], references: [id])
  maintenancePlan  MaintenancePlan?         @relation(fields: [maintenancePlanId], references: [id])
  parts            WorkOrderPart[]
  ccItems          WorkOrderCCItem[]
  deferredMaint    DeferredMaintenance?

  @@unique([organizationId, sequentialNumber])
  @@index([organizationId, status])
  @@index([assetId])
  @@map("work_orders")
}

model WorkOrderPart {
  id             String   @id @default(uuid())
  workOrderId    String
  productId      String
  quantity       Decimal  @db.Decimal(10, 3)
  unitCost       Decimal  @db.Decimal(10, 4)
  totalCost      Decimal  @db.Decimal(15, 2)
  notes          String?
  createdAt      DateTime @default(now())

  workOrder WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)

  @@index([workOrderId])
  @@map("work_order_parts")
}

model WorkOrderCCItem {
  id           String  @id @default(uuid())
  workOrderId  String
  costCenterId String
  farmId       String
  amount       Decimal @db.Decimal(15, 2)
  percentage   Decimal @db.Decimal(5, 2)

  workOrder  WorkOrder  @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  costCenter CostCenter @relation(fields: [costCenterId], references: [id])

  @@index([workOrderId])
  @@map("work_order_cc_items")
}

model DeferredMaintenance {
  id                  String   @id @default(uuid())
  organizationId      String
  workOrderId         String   @unique
  totalAmount         Decimal  @db.Decimal(15, 2)
  monthlyAmortization Decimal  @db.Decimal(15, 2)
  startMonth          Int      // 1-12
  startYear           Int
  endMonth            Int
  endYear             Int
  amortizedToDate     Decimal  @db.Decimal(15, 2) @default(0)
  isFullyAmortized    Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  workOrder    WorkOrder    @relation(fields: [workOrderId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, isFullyAmortized])
  @@map("deferred_maintenances")
}

model MaintenanceProvision {
  id                  String   @id @default(uuid())
  organizationId      String
  assetId             String?   // null = fleet-level provision
  monthlyAmount       Decimal  @db.Decimal(15, 2)
  costCenterId        String?
  isActive            Boolean  @default(true)
  description         String?
  createdBy           String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  asset        Asset?       @relation(fields: [assetId], references: [id])

  @@index([organizationId, isActive])
  @@map("maintenance_provisions")
}
```

### Pattern 2: Work Order Close — Mandatory Accounting Treatment

**What:** `PATCH /work-orders/:id/close` requires `accountingTreatment` in body. Returns 400 if absent. If `CAPITALIZACAO`, add `totalCost` to asset `acquisitionValue` and invalidate current depreciation config. If `DIFERIMENTO`, create `DeferredMaintenance` record.
**Source:** STATE.md locked decision — "OS accounting treatment is mandatory."

```typescript
// Source: STATE.md locked decision + project Express 5 pattern
async function closeWorkOrder(
  id: string,
  input: CloseWorkOrderInput,
  rls: RlsContext,
): Promise<WorkOrderOutput> {
  if (!input.accountingTreatment) {
    throw new WorkOrderError('Classificação contábil obrigatória para encerrar OS', 400);
  }

  return prisma.$transaction(async (tx) => {
    const wo = await tx.workOrder.findFirst({
      where: { id, organizationId: rls.organizationId, deletedAt: null },
      include: { parts: true, asset: { include: { costCenter: true } } },
    });
    if (!wo) throw new WorkOrderError('OS não encontrada', 404);
    if (wo.status === 'ENCERRADA') throw new WorkOrderError('OS já encerrada', 400);

    // 1. Auto-deduct parts from stock
    let stockOutputId: string | null = null;
    if (wo.parts.length > 0) {
      const deduction = await createConsumptionOutput(tx, {
        organizationId: rls.organizationId,
        items: wo.parts.map((p) => ({
          productId: p.productId,
          quantity: Number(p.quantity),
        })),
        fieldOperationRef: `work-order:${id}`,
        outputDate: new Date(),
        responsibleName: input.closedBy,
        notes: `OS #${wo.sequentialNumber} — ${wo.title}`,
      });
      stockOutputId = deduction?.stockOutputId ?? null;
    }

    // 2. Compute total cost
    const partsCost = wo.parts.reduce((acc, p) => acc.plus(p.totalCost), new Decimal(0));
    const laborCost = input.laborHours && input.laborCostPerHour
      ? new Decimal(input.laborHours).times(input.laborCostPerHour)
      : new Decimal(0);
    const externalCost = input.externalCost ? new Decimal(input.externalCost) : new Decimal(0);
    const totalCost = partsCost.plus(laborCost).plus(externalCost);

    // 3. Accounting treatment
    if (input.accountingTreatment === 'CAPITALIZACAO') {
      await tx.asset.update({
        where: { id: wo.assetId },
        data: {
          acquisitionValue: { increment: totalCost.toNumber() },
          // Depreciation config must be recalculated — mark via notes or invalidate
        },
      });
    }
    if (input.accountingTreatment === 'DIFERIMENTO' && input.deferralMonths) {
      const monthly = totalCost.dividedBy(input.deferralMonths).toDecimalPlaces(2);
      const startDate = new Date();
      await tx.deferredMaintenance.create({
        data: {
          organizationId: rls.organizationId,
          workOrderId: id,
          totalAmount: totalCost,
          monthlyAmortization: monthly,
          startMonth: startDate.getMonth() + 1,
          startYear: startDate.getFullYear(),
          endMonth: /* compute from deferralMonths */ ...,
          endYear: ...,
        },
      });
    }

    // 4. CC appropriation — inherit from asset or use override
    const ccId = input.costCenterId ?? wo.asset.costCenterId;
    if (ccId) {
      await tx.workOrderCCItem.create({
        data: {
          workOrderId: id,
          costCenterId: ccId,
          farmId: wo.asset.farmId,
          amount: totalCost,
          percentage: new Decimal(100),
        },
      });
    }

    // 5. Update asset status back to ATIVO
    await tx.asset.update({
      where: { id: wo.assetId },
      data: { status: 'ATIVO' },
    });

    return tx.workOrder.update({
      where: { id },
      data: {
        status: 'ENCERRADA',
        closedAt: new Date(),
        accountingTreatment: input.accountingTreatment,
        totalPartsCost: partsCost,
        totalLaborCost: laborCost,
        externalCost: externalCost,
        totalCost: totalCost,
        stockOutputId,
      },
    });
  });
}
```

### Pattern 3: Next-Due Calculation for Preventive Plans

**What:** After each OS close, recalculate `nextDueAt` / `nextDueMeter` for the linked `MaintenancePlan`. For CALENDAR trigger: `lastExecutedAt + intervalValue days`. For HOURMETER: `lastMeterValue + intervalValue`. For ODOMETER: same. Daily cron scans for plans where `nextDueAt <= now + alertBeforeValue days` or `nextDueMeter <= currentMeter + alertBeforeValue` and fires notification.

```typescript
// Source: project patterns — date-fns already installed
import { addDays, addMonths } from 'date-fns';

function computeNextDue(
  plan: MaintenancePlan,
  lastExecutedAt: Date,
  lastMeterValue: number | null,
): { nextDueAt: Date | null; nextDueMeter: number | null } {
  if (plan.triggerType === 'CALENDAR') {
    // intervalValue is in days
    return {
      nextDueAt: addDays(lastExecutedAt, Number(plan.intervalValue)),
      nextDueMeter: null,
    };
  }
  if (plan.triggerType === 'HOURMETER' || plan.triggerType === 'ODOMETER') {
    return {
      nextDueAt: null,
      nextDueMeter: (lastMeterValue ?? 0) + Number(plan.intervalValue),
    };
  }
  return { nextDueAt: null, nextDueMeter: null };
}
```

### Pattern 4: Mobile Maintenance Request (Offline-First)

**What:** Add `maintenance_requests` to `OperationEntity` enum in `pending-operations-repository.ts`. Create `maintenance-request-repository.ts` for local SQLite cache. The form captures title, description, photo (expo-image-picker), and geolocation (expo-location). On submit, enqueue to `offline-queue` and call `flushNow()` if connected. On sync, backend creates a `WorkOrder` with `type: SOLICITACAO` and fires push notification to `assignedTo` user.

```typescript
// Source: pattern from apps/mobile/services/db/pending-operations-repository.ts

// 1. Add to OperationEntity type:
export type OperationEntity =
  | ... (existing)
  | 'maintenance_requests';  // ADD

// 2. In maintenance-request.tsx (mobile screen):
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSyncContext } from '@/stores/SyncContext';

const { flushNow } = useSyncContext();

async function submitRequest(form: MaintenanceRequestForm) {
  // Upload photo to backend before enqueuing (requires connectivity)
  // OR store photo path locally and attach base64 on sync (offline path)
  const payload = {
    assetId: form.assetId,
    title: form.title,
    description: form.description,
    photoUrls: form.photoUrls,
    geoLat: form.location?.coords.latitude,
    geoLon: form.location?.coords.longitude,
    type: 'SOLICITACAO',
  };

  await enqueuePendingOperation({
    entity: 'maintenance_requests',
    operation: 'CREATE',
    payload,
    endpoint: '/api/org/work-orders',
    method: 'POST',
  });

  if (isConnected) await flushNow();
}
```

### Pattern 5: Maintenance Dashboard — MTBF/MTTR Computation

**What:** MTBF (Mean Time Between Failures) = total uptime / number of corrective OS. MTTR (Mean Time To Repair) = sum of (closedAt - openedAt) for corrective OS / count. Mechanical availability = uptime / (uptime + downtime) \* 100. These are computed server-side in a dedicated `GET /maintenance/dashboard` endpoint (same pattern as `/purchasing/dashboard`).

```typescript
// Source: project pattern from modules/purchasing-dashboard
// Dashboard endpoint aggregates WorkOrder data — no external libraries needed

interface MaintenanceDashboardOutput {
  availability: number; // percentage, e.g. 94.2
  mtbfHours: number; // avg hours between failures
  mttrHours: number; // avg hours to repair
  totalCostYTD: number; // year-to-date OS cost
  openOrdersCount: number;
  overdueMaintenancesCount: number;
  byStatus: Record<WorkOrderStatus, number>;
  costByAsset: Array<{ assetId: string; assetName: string; totalCost: number }>;
  recentOrders: WorkOrderSummary[];
}
```

### Pattern 6: Kanban for Open Work Orders

**What:** Reuse existing `KanbanBoard`, `KanbanColumn`, `KanbanCard` components. Define OS-specific columns: ABERTA | EM_ANDAMENTO | AGUARDANDO_PECA. Drag-and-drop changes `status` via `PATCH /work-orders/:id`. Each card shows asset name, type badge, sequential number, and age.

```typescript
// Source: apps/frontend/src/components/kanban/ — already installed
// @dnd-kit/core already in project dependencies

const OS_KANBAN_COLUMNS = [
  { id: 'ABERTA', label: 'Abertas', color: 'neutral' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento', color: 'warning' },
  { id: 'AGUARDANDO_PECA', label: 'Aguardando peça', color: 'error' },
] as const;
```

### Pattern 7: AssetMaintenanceTab — Fill the Stub

**What:** `AssetMaintenanceTab` in `AssetDrawer` is a placeholder. Phase 18 replaces it with actual content: a list of open/recent OS for the asset + button to open new OS + list of maintenance plans for the asset.

```typescript
// Replace stub in apps/frontend/src/components/assets/AssetMaintenanceTab.tsx
// Props: assetId string
// Content:
// - "Nova OS" button (opens WorkOrderModal with assetId pre-filled)
// - Maintenance plans table (name, trigger, nextDue, lastExecuted)
// - Recent work orders list (last 10, with status badges)
```

### Anti-Patterns to Avoid

- **Opening OS without setting `asset.status = EM_MANUTENCAO`**: Always update asset status atomically in the same transaction that creates the WorkOrder. Failing to do so means the asset appears available on the inventory.
- **Closing OS without mandatory `accountingTreatment`**: STATE.md locked decision — return 400. Never silently default to DESPESA.
- **Creating stock output outside the OS close transaction**: Parts deduction must be atomic with OS closure. Use `createConsumptionOutput(tx, ...)` passing the existing transaction client, same pattern as field operations.
- **Calculating MTBF/MTTR in the frontend**: These metrics require aggregating time ranges across OS records. Compute server-side to avoid large data payloads.
- **Ignoring OS with `type = PREVENTIVA` in MTBF calculation**: MTBF is defined as time between unplanned failures. Only `CORRETIVA` type OS should count as failure events. Mixing PREVENTIVA orders inflates MTBF.
- **Hand-rolling a kanban**: `@dnd-kit/core` is already installed. `KanbanBoard`, `KanbanColumn`, `KanbanCard` components exist. Use them.
- **Separate `spare-parts-balance` table**: Spare parts are Products (reuse existing `Product` model). Stock balance is `StockBalance` (existing). The `SparePartAssetCompat` join table maps which parts are compatible with which assets. No separate balance table needed.
- **Date arithmetic with native JS `Date` for next-due calculation**: Use `date-fns` (already installed) for `addDays`, `addMonths`. Native Date arithmetic with months is error-prone (varying month lengths).

---

## Don't Hand-Roll

| Problem                           | Don't Build               | Use Instead                                                | Why                                                             |
| --------------------------------- | ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Stock deduction on OS close       | Custom stock update logic | `createConsumptionOutput` from `stock-deduction` module    | Already handles FEFO, average cost, insufficient stock alerts   |
| CC reconciliation on OS cost      | Ad-hoc sum check          | `validateCostCenterItems` from `@protos-farm/shared`       | Cent-residual handling already solved in Phase 17               |
| Kanban drag-and-drop for OS       | Custom DnD implementation | `@dnd-kit/core` + existing `KanbanBoard` components        | Already installed and proven in purchasing-dashboard            |
| Date interval arithmetic          | Manual Date math          | `date-fns` `addDays`/`addMonths`/`differenceInHours`       | Already installed; handles edge cases (month lengths, DST)      |
| Push notification on request sync | Custom WebSocket          | `expo-notifications` + existing `notifications.service.ts` | Full stack already in place from purchase request notifications |
| Offline queue for mobile request  | Custom sync mechanism     | `pending-operations-repository` + `SyncContext.flushNow()` | Pattern established and battle-tested across 20+ entity types   |
| Monetary arithmetic (cost totals) | `number` math             | `decimal.js` (already installed)                           | IEEE 754 rounding errors; same rule as depreciation             |
| XLSX/PDF OS report export         | Custom CSV builder        | ExcelJS / pdfkit (already installed)                       | Column formatting, number cells, dates handled correctly        |

**Key insight:** Phase 18 adds maintenance logic but reuses the project's entire stock, CC, notification, offline, and kanban infrastructure. The scope is primarily new domain models and business logic, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Asset Status Drift

**What goes wrong:** Asset remains `EM_MANUTENCAO` after OS is closed/cancelled — appears unavailable indefinitely on inventory.
**Why it happens:** OS close endpoint updates WorkOrder but not Asset.
**How to avoid:** Use `prisma.$transaction` that atomically updates both WorkOrder status to ENCERRADA and Asset status to ATIVO. On cancellation, also reset to ATIVO.
**Warning signs:** `Asset.status = EM_MANUTENCAO` with no open WorkOrder for that asset.

### Pitfall 2: Stock Output Created Outside Transaction

**What goes wrong:** OS is closed (WorkOrder.status = ENCERRADA) but stock deduction fails — inventory becomes inconsistent.
**Why it happens:** Stock output created in a separate await chain from WorkOrder update.
**How to avoid:** Always call `createConsumptionOutput(tx, ...)` inside the same `prisma.$transaction` as the WorkOrder close. The function accepts a `TxClient` for exactly this reason.
**Warning signs:** WorkOrder with `stockOutputId = null` despite having parts.

### Pitfall 3: accountingTreatment Silently Defaulting

**What goes wrong:** Frontend submits close without accountingTreatment when total cost is below threshold — backend silently defaults to DESPESA.
**Why it happens:** Developer adds a fallback default to avoid 400 errors.
**How to avoid:** The STATE.md locked decision is explicit: return 400 if absent. The threshold-based frontend wizard should always fire, but the backend must enforce regardless of the UI. Never add a default.
**Warning signs:** WorkOrders with `accountingTreatment = null` in the database.

### Pitfall 4: Sequential Number Race Condition

**What goes wrong:** Two concurrent OS opens get the same `sequentialNumber`.
**Why it happens:** Computing `MAX(sequentialNumber) + 1` in application code before insert.
**How to avoid:** Use a PostgreSQL sequence or the same `SELECT ... FOR UPDATE` pattern used by other sequential numbers in the project. Check how `purchase_requests.sequentialNumber` is generated (likely `MAX + 1` inside a transaction with row lock on the sequence counter table). Follow the same pattern.
**Warning signs:** `P2002` unique constraint violation on `(organizationId, sequentialNumber)`.

### Pitfall 5: MTBF with Zero Corrective Orders

**What goes wrong:** Dashboard endpoint throws division-by-zero for assets with only preventive OS.
**Why it happens:** MTBF = total uptime / count of failures — count can be 0.
**How to avoid:** Return `null` for MTBF/MTTR when corrective count is 0. Frontend displays "N/D" (não disponível) with tooltip explanation.
**Warning signs:** NaN or Infinity in dashboard response.

### Pitfall 6: Mobile Photo Stored Only Locally

**What goes wrong:** Photo taken offline is never uploaded because the sync queue only sends JSON payload, not binary.
**Why it happens:** `pending-operations-repository` stores serialized JSON; binary blobs are not supported.
**How to avoid:** Two options: (a) convert photo to base64 and include in payload (acceptable for small photos, limits size to ~1MB); (b) store photo in a separate pending-upload queue that fires separately when online. The project currently uses base64 in animal-health-records for mobile. Use the same approach and document the size limit.
**Warning signs:** WorkOrder created on sync with empty `photoUrls` array despite photo being captured.

### Pitfall 7: Provision vs Actual Reconciliation — Incorrect Period Matching

**What goes wrong:** Provision for January is compared against OS costs from February.
**Why it happens:** OS `closedAt` date is used for period assignment, but the OS may span multiple months.
**How to avoid:** Use `closedAt` month/year as the accounting period for OS costs (consistent with how depreciation uses periodYear/periodMonth). Document this convention explicitly in the provisioning report query.
**Warning signs:** Reconciliation report shows large variances that are actually timing differences.

---

## Code Examples

### Sequential Number Generation (Safe Pattern)

```typescript
// Source: pattern from apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
// Use MAX+1 inside transaction to avoid race conditions with unique constraint as safety net

async function getNextSequentialNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  const last = await tx.workOrder.findFirst({
    where: { organizationId },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  return (last?.sequentialNumber ?? 0) + 1;
  // @@unique([organizationId, sequentialNumber]) catches collision via P2002 retry
}
```

### Daily Alert Cron

```typescript
// Source: pattern from apps/backend/src/shared/cron/digest.cron.ts
import cron from 'node-cron';
import { redis } from '../../database/redis';

export function startMaintenanceAlertsCron(): void {
  cron.schedule(
    '0 6 * * *', // Daily at 06:00 BRT
    async () => {
      const lockKey = `cron:maintenance-alerts:${new Date().toISOString().slice(0, 10)}`;
      const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
      if (!locked) return;
      try {
        await processOverdueMaintenancePlans();
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}

async function processOverdueMaintenancePlans() {
  const now = new Date();
  // Plans overdue by nextDueAt
  const overduePlans = await prisma.maintenancePlan.findMany({
    where: {
      isActive: true,
      nextDueAt: { lte: now },
    },
    include: {
      asset: { include: { organization: true } },
    },
  });
  // Also check HOURMETER plans: currentHourmeter >= nextDueMeter
  // Then send notifications via notifications.service.ts
}
```

### Work Order CC Appropriation

```typescript
// Source: pattern from depreciation-batch.service.ts WorkOrderCCItem creation
import { validateCostCenterItems } from '@protos-farm/shared';
import Decimal from 'decimal.js';

async function createWorkOrderCCItems(
  tx: Prisma.TransactionClient,
  workOrderId: string,
  costCenterId: string,
  farmId: string,
  totalCost: Decimal,
): Promise<void> {
  // Simple single-CC case (INHERITED mode — most common)
  const items = [
    {
      workOrderId,
      costCenterId,
      farmId,
      amount: totalCost,
      percentage: new Decimal(100),
    },
  ];

  // Reconciliation assertion before write
  const sum = items.reduce((acc, i) => acc.plus(i.amount), new Decimal(0));
  if (!sum.equals(totalCost)) {
    throw new WorkOrderError('CC reconciliation failed', 500);
  }

  await tx.workOrderCCItem.createMany({ data: items });
}
```

### Frontend: WorkOrder Close Wizard

```typescript
// Source: project multi-step modal pattern (phase 17 DepreciationConfigModal + CLAUDE.md)
// Multi-step: Step 1 = Cost summary, Step 2 = Accounting classification, Step 3 = Confirm

// Trigger condition: total cost > threshold (configurable, default 1000)
// If below threshold: skip wizard, auto-classify as DESPESA with toast
// If above threshold: show 3-step modal

const ACCOUNTING_TREATMENT_OPTIONS = [
  {
    value: 'DESPESA',
    label: 'Despesa imediata',
    description:
      'Custo vai direto para o resultado do período. Use quando a manutenção não estende a vida útil do ativo.',
  },
  {
    value: 'CAPITALIZACAO',
    label: 'Capitalização',
    description:
      'Custo é somado ao valor do ativo e começa a depreciar. Use quando a manutenção restaura ou aumenta a capacidade produtiva.',
  },
  {
    value: 'DIFERIMENTO',
    label: 'Diferimento (despesa antecipada)',
    description:
      'Custo é distribuído nos próximos meses. Use para manutenções programadas de grande porte.',
  },
];
```

---

## State of the Art

| Old Approach                                | Current Approach                                       | When Changed    | Impact                                                   |
| ------------------------------------------- | ------------------------------------------------------ | --------------- | -------------------------------------------------------- |
| AssetMaintenanceTab as placeholder stub     | Full maintenance management (Phase 18)                 | Phase 18 design | AssetDrawer tab now shows real OS history + plans        |
| Manual stock tracking for parts             | Auto-deduction via createConsumptionOutput on OS close | Phase 18 design | Parts inventory always accurate after OS closure         |
| No accounting classification on maintenance | Mandatory accountingTreatment at OS close              | STATE.md locked | Compliant with CPC 27 capitalization vs expense criteria |

**Deprecated/outdated:**

- `AssetMaintenanceTab` placeholder content: replace entirely with real maintenance tab in Phase 18.

---

## Open Questions

1. **SparePartAssetCompat: how to model asset-specific parts compatibility?**
   - What we know: MANU-04 requires "vinculação de peças compatíveis por máquina."
   - What's unclear: A dedicated join table `SparePartAssetCompat(productId, assetId, notes)` is the straightforward approach. The alternative is a tag/category system on the Product.
   - Recommendation: Use the join table approach. Simple, queryable, and matches the requirement ("peças compatíveis por máquina"). If Products already have categories, also add a `isSparePart` boolean flag on `Product` to allow filtering in the UI.

2. **Capitalization treatment and depreciation recalculation**
   - What we know: When `accountingTreatment = CAPITALIZACAO`, the asset's `acquisitionValue` increases by OS total cost. The depreciation base must be updated.
   - What's unclear: Should Phase 18 automatically update the `DepreciationConfig` (residualValue, usefulLifeMonths) or just increase `acquisitionValue` and let the accountant manually reconfigure?
   - Recommendation: Only update `acquisitionValue` in Phase 18. Log a notification/warning to the accountant that the depreciation config should be reviewed. Automatic life extension computation is deferred to Phase 22 (HIER-02).

3. **Offline photo strategy for mobile maintenance request**
   - What we know: `expo-image-picker` captures photos. The pending-operations-repository stores JSON. Project currently uses base64 in some mobile payloads.
   - What's unclear: Maximum photo size tolerance before base64 payload becomes too large for the sync queue.
   - Recommendation: Compress photo to 1024x768 with JPEG quality 0.7 before base64 encoding using `expo-image-manipulator` (already in Expo SDK 52). Limit to 1 photo per offline request. Multiple photos require connectivity.

4. **Sequential number strategy alignment**
   - What we know: The `@@unique([organizationId, sequentialNumber])` constraint provides safety net. Other modules (purchase-requests) use MAX+1 inside transaction.
   - What's unclear: Is there a shared utility for sequential number generation or does each module implement its own MAX+1?
   - Recommendation: Verify in `purchase-requests.service.ts` before implementing. Copy the same pattern verbatim. Do not create a new utility — DRY is secondary to consistency here.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | Jest + @swc/jest (backend), Vitest + @testing-library/react (frontend) |
| Config file        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`        |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern work-orders`        |
| Full suite command | `cd apps/backend && pnpm test`                                         |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                      | Test Type   | Automated Command                                              | File Exists? |
| ------- | ----------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- | ------------ |
| MANU-01 | POST plan creates MaintenancePlan with trigger and next-due calculation       | integration | `pnpm test -- --testPathPattern maintenance-plans.routes`      | ❌ Wave 0    |
| MANU-01 | Next-due recalculates after OS close linked to plan                           | integration | `pnpm test -- --testPathPattern maintenance-plans.routes`      | ❌ Wave 0    |
| MANU-01 | Daily alert cron marks overdue plans, fires notification                      | unit        | `pnpm test -- --testPathPattern maintenance-plans.service`     | ❌ Wave 0    |
| MANU-02 | POST work-order creates OS, sets asset status EM_MANUTENCAO atomically        | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| MANU-02 | PATCH close without accountingTreatment returns 400                           | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| MANU-02 | PATCH close with parts deducts stock via createConsumptionOutput              | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| MANU-02 | PATCH close resets asset status to ATIVO                                      | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| MANU-06 | CAPITALIZACAO increases asset.acquisitionValue by totalCost                   | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| MANU-06 | DIFERIMENTO creates DeferredMaintenance with correct monthly amortization     | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| MANU-07 | DeferredMaintenance monthly amortization sums to totalAmount exactly          | unit        | `pnpm test -- --testPathPattern work-orders.service`           | ❌ Wave 0    |
| MANU-08 | MaintenanceProvision monthly cron creates entries, handles fleet-level config | integration | `pnpm test -- --testPathPattern maintenance-provisions.routes` | ❌ Wave 0    |
| CCPA-03 | OS close creates WorkOrderCCItem inheriting asset.costCenterId                | integration | `pnpm test -- --testPathPattern work-orders.routes`            | ❌ Wave 0    |
| CCPA-03 | WorkOrderCCItem sum reconciles to totalCost (no cent drift)                   | unit        | `pnpm test -- --testPathPattern work-orders.service`           | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern "work-orders|maintenance"`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/work-orders/work-orders.routes.spec.ts` — covers MANU-02, MANU-06, CCPA-03 route-level
- [ ] `apps/backend/src/modules/maintenance-plans/maintenance-plans.routes.spec.ts` — covers MANU-01
- [ ] `apps/backend/src/modules/maintenance-provisions/maintenance-provisions.routes.spec.ts` — covers MANU-08

---

## Sources

### Primary (HIGH confidence)

- Project codebase — `apps/backend/prisma/schema.prisma` (Asset, DepreciationConfig, DepreciationEntryCCItem, StockOutput, StockBalance models)
- Project codebase — `apps/backend/src/modules/stock-deduction/stock-deduction.ts` (createConsumptionOutput — exact reuse pattern)
- Project codebase — `apps/backend/src/modules/depreciation/depreciation.types.ts` (CC reconciliation pattern, decimal.js conventions)
- Project codebase — `apps/backend/src/shared/cron/` (node-cron + Redis distributed lock pattern)
- Project codebase — `apps/frontend/src/components/kanban/` (KanbanBoard/Column/Card — reusable for OS board)
- Project codebase — `apps/mobile/services/push-notifications.ts` (expo-notifications stack, already wired)
- Project codebase — `apps/mobile/services/db/pending-operations-repository.ts` (offline queue entity types)
- Project codebase — `apps/mobile/stores/SyncContext.tsx` (flushNow pattern)
- Project codebase — `apps/frontend/src/components/assets/AssetMaintenanceTab.tsx` (placeholder stub to replace)
- `.planning/STATE.md` — locked decision: "OS accounting treatment is mandatory: PATCH /work-orders/:id/close returns 400 if accountingTreatment absent"
- `.planning/REQUIREMENTS.md` — MANU-01 through MANU-08, CCPA-03 descriptions

### Secondary (MEDIUM confidence)

- Brazilian accounting standard CPC 27 (IAS 16) — criteria for capitalizing maintenance vs expensing. Generally: capitalize if it extends useful life or restores original capacity beyond original level; expense if it merely maintains current operating capacity.
- Phase 17 RESEARCH.md — CC reconciliation pattern (`validateCostCenterItems`), decimal.js arithmetic conventions, cron pattern established

### Tertiary (LOW confidence)

- None — all critical findings verified against project codebase and STATE.md.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed; patterns established in Phases 16 and 17
- Architecture: HIGH — directly derived from existing project patterns (stock-deduction, depreciation CC, kanban, push notifications, offline queue)
- Schema design: HIGH — follows established Prisma conventions; models derived from requirements + existing model patterns
- OS accounting treatment: HIGH — STATE.md locked decision enforced; CPC 27 criteria are standard Brazilian accounting norms
- MTBF/MTTR formulas: MEDIUM — standard OEE definitions; verified against project context but not against an external authoritative source in this session
- Mobile offline photo strategy: MEDIUM — based on existing patterns in codebase; exact size limit for base64 not benchmarked

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain — no fast-moving libraries; all stack is project-internal)
