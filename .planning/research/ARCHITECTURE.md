# Architecture Patterns

**Domain:** Asset lifecycle management integration into Protos Farm monolith
**Researched:** 2026-03-19
**Confidence:** HIGH — derived from direct analysis of existing codebase (schema 6500+ lines, services, module patterns, cron infrastructure)

---

## Context: Existing Architecture This Milestone Extends

This is the v1.2 milestone. The base architecture and integration contracts are established:

| Existing Component | Relevance to Asset Management |
|---|---|
| `modules/payables/` `createPayable()` | Asset purchase → CP; maintenance OS cost → CP (expense) or capitalization |
| `modules/receivables/` | Asset sale → CR with gain/loss calculation |
| `modules/cost-centers/` | Depreciation and maintenance costs allocated per CC; rateio validator reused |
| `withRlsContext` / `RlsContext` | All new modules use same multitenancy pattern — no exceptions |
| `Money` factory (decimal.js) | All monetary fields: acquisition cost, residual value, depreciation amounts |
| `generateInstallments` (shared) | Financed asset purchase → CP installments; leasing periodic payments |
| `Payable.originType` / `Payable.originId` | Polymorphic link: `originType='ASSET_PURCHASE'`, `'MAINTENANCE_OS'`, `'LEASING'` |
| `Receivable.originType` / `Receivable.originId` | Asset sale: `originType='ASSET_SALE'` |
| `FarmLocation` with PostGIS geometry | Benfeitorias and imóveis get location Point, assets at structures reference this |
| `Farm` with PostGIS boundary | Farm-level asset inventory filtering; transfer between farms |
| `StockBalance` / `StockEntry` / `StockOutput` | Maintenance spare parts consume existing stock modules as-is |
| `RuralCreditContract` (SAC/Price amortization) | Financing model for asset acquisition loans; leasing follows same installment logic |
| `node-cron` + Redis lock pattern | Monthly depreciation batch reuses `digest.cron.ts` infrastructure exactly |
| `OC_VALID_TRANSITIONS` pattern (purchase-orders) | Maintenance OS state machine follows same exported const + guard function pattern |
| `pdfkit` (pesticide-prescriptions) | Asset ficha completa PDF and OS PDF reuse same synchronous stream-to-response approach |
| `LayerControlPanel` + `FarmMap.tsx` (react-leaflet) | Asset map layer added via existing `LayerConfig[]` extensibility point — no rewrite |
| Sidebar group structure | New `PATRIMÔNIO` group added between `COMPRAS` and `FINANCEIRO` |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                          │
│                                                                      │
│  New sidebar group "PATRIMÔNIO":                                     │
│  AssetsPage (inventory), AssetDetailPage (ficha), DepreciationPage   │
│  MaintenancePage (OS list), MaintenanceDashboardPage                 │
│  FuelPage, DocumentsPage, AssetMapPage, PatrimonialDashboardPage     │
│                                                                      │
│  Modified: FarmMapPage (+ assets layer via LayerControlPanel)        │
└─────────────────────────────────────────────────────────────────────┘
                          │ HTTP REST JSON
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Express 5)                             │
│                                                                      │
│  NEW MODULES (asset domain):                                         │
│  assets → asset-depreciation → maintenance-plans → work-orders       │
│  → fuel-records → asset-documents → asset-acquisition                │
│  → asset-disposal → asset-dashboard                                  │
│                                                                      │
│  NEW CRON:                                                           │
│  shared/cron/depreciation.cron.ts  (monthly, 1st day, per org)      │
│                                                                      │
│  MODIFIED MODULES (integration points):                              │
│  payables (+ originType='ASSET_PURCHASE','MAINTENANCE_OS','LEASING') │
│  receivables (+ originType='ASSET_SALE')                             │
│  farms (+ assets relation in Farm model)                             │
│  FarmMap (+ asset marker layer, frontend only)                       │
│                                                                      │
│  UNCHANGED MODULES (consumed read-only):                             │
│  cost-centers, stock-entries, stock-outputs, stock-balances,         │
│  products, measurement-units, suppliers, rural-credit                │
│                                                                      │
│                    withRlsContext (Prisma 7)                          │
│                                                                      │
│  NEW TABLES (migration sequence):                                    │
│  assets, asset_components (hierarchy), asset_cost_center_items       │
│  depreciation_configs, depreciation_runs, depreciation_entries       │
│  maintenance_plans, maintenance_plan_items                           │
│  work_orders, work_order_items, work_order_cost_center_items         │
│  fuel_records, asset_documents, asset_acquisitions                   │
│  asset_disposals, asset_transfers, asset_biological_valuations       │
│  asset_wip_contributions (obras em andamento)                        │
│                                                                      │
│  MODIFIED TABLES:                                                    │
│  payables (+assetId FK nullable, +workOrderId FK nullable)           │
│  receivables (+assetId FK nullable)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## New Module Inventory

### New Backend Modules

| Module | Key Responsibility | New Prisma Models |
|---|---|---|
| `assets/` | CRUD ativos com hierarquia pai-filho (3 níveis), ficha completa, inventory, bulk import, transfer between farms | `Asset`, `AssetComponent`, `AssetCostCenterItem` |
| `asset-depreciation/` | Config de métodos, cálculo mensal batch, pro rata die, lançamento CC, relatórios | `DepreciationConfig`, `DepreciationRun`, `DepreciationEntry` |
| `maintenance-plans/` | Planos preventivos com gatilhos (tempo, horímetro, odômetro), geração automática de OS | `MaintenancePlan`, `MaintenancePlanItem` |
| `work-orders/` | CRUD OS (corretiva + preventiva), state machine, peças (stock deduction), classificação contábil, PDF | `WorkOrder`, `WorkOrderItem`, `WorkOrderCostCenterItem` |
| `fuel-records/` | Registro de abastecimentos, custo/litro, cálculo custo/hora | `FuelRecord` |
| `asset-documents/` | Documentos e vencimentos (CRLV, seguro, revisão), alertas de vencimento | `AssetDocument` |
| `asset-acquisition/` | Compra à vista/financiada, NF-e (XML parse), leasing CPC 06, troca, multi-ativo por NF | `AssetAcquisition`, `AssetAcquisitionItem`, `AssetLease` |
| `asset-disposal/` | Baixa (sinistro/descarte/obsolescência), venda com ganho/perda, venda parcelada | `AssetDisposal` |
| `asset-dashboard/` | TCO, disponibilidade, MTBF, relatórios patrimoniais (read-only aggregation) | no new models |

### Modified Existing Modules

| Module | Change | Reason |
|---|---|---|
| `payables/` | Add `assetId` FK nullable, `workOrderId` FK nullable to `Payable` | Link CP to asset purchase or OS costs for traceability |
| `receivables/` | Add `assetId` FK nullable to `Receivable` | Link CR to asset sale for financial reconciliation |
| Schema `Farm` | Add `assets Asset[]` relation | Farm owns assets (FK already implicit, relation declaration needed) |
| `PayableCategory` enum | Add `ASSET_PURCHASE`, `ASSET_MAINTENANCE`, `LEASING` values | Categorization for CP auto-generated from asset flows |
| `ReceivableCategory` enum | Add `ASSET_SALE` value | Categorization for CR generated from asset sale |

---

## Key Data Models

### Asset (core entity)

```
Asset
├── id (uuid)
├── organizationId → Organization (RLS)
├── farmId → Farm
├── parentId → Asset? (self-reference, max 3 levels enforced at service layer)
├── type: AssetType (MACHINE | VEHICLE | IMPLEMENT | BENFEITORIA | LAND | BIOLOGICAL | WIP | EQUIPMENT)
├── name: String
├── description: String?
├── serialNumber: String?
├── plate: String?               -- vehicles
├── manufacturerYear: Int?
├── manufacturer: String?
├── model: String?
│
│  -- Acquisition data
├── acquisitionDate: DateTime?
├── acquisitionCost: Decimal      @db.Decimal(15,2)
├── acquisitionType: AcquisitionType (CASH | FINANCED | LEASING | EXCHANGE | DONATION)
├── supplierId → Supplier?        -- FK to existing suppliers module
├── invoiceNumber: String?
│
│  -- Depreciation
├── depreciationMethod: DepreciationMethod (LINEAR | USAGE_HOURS | PRODUCTION | ACCELERATED | NONE)
├── usefulLifeYears: Decimal?     @db.Decimal(5,2)
├── residualValue: Decimal        @db.Decimal(15,2) @default(0)
├── accumulatedDepreciation: Decimal @db.Decimal(15,2) @default(0)
├── currentNetValue: Decimal      @db.Decimal(15,2)  -- computed, maintained by depreciation run
│
│  -- Operational tracking
├── currentHours: Decimal?        @db.Decimal(10,1)  -- horímetro
├── currentOdometer: Int?         -- km
├── status: AssetStatus (ACTIVE | INACTIVE | MAINTENANCE | DISPOSED | TRANSFERRED | WIP)
│
│  -- Geolocation (benfeitorias/imóveis only)
├── location: geometry(Point,4326)?  -- Unsupported, PostGIS
├── linkedFarmLocationId → FarmLocation?  -- optional link to existing farm_locations
│
├── notes: String?
├── deletedAt: DateTime?
├── createdAt: DateTime
└── updatedAt: DateTime

AssetComponent
├── id (uuid)
├── assetId → Asset (parent)
├── componentAssetId → Asset (child)
├── addedAt: DateTime
└── notes: String?
-- Enforces: parent.depth + 1 <= 3 (checked at service layer)

AssetCostCenterItem
├── id
├── assetId → Asset
├── costCenterId → CostCenter
├── farmId → Farm
├── allocMode: CostCenterAllocMode  -- reuses existing enum (PERCENTAGE | FIXED_VALUE)
├── percentage: Decimal?
└── fixedAmount: Decimal?
-- Used for depreciation AND maintenance cost allocation
```

### DepreciationConfig + Run + Entry

```
DepreciationConfig
├── id, assetId → Asset @unique
├── method: DepreciationMethod
├── usefulLifeYears: Decimal
├── residualValue: Decimal
├── monthlyRate: Decimal?           -- stored for LINEAR (= (cost - residual) / (life * 12))
├── totalProductionCapacity: Decimal? -- for PRODUCTION method
├── isActive: Boolean
└── configuredAt: DateTime

DepreciationRun
├── id, organizationId → Organization
├── runDate: DateTime               -- 1st of month
├── periodYear: Int
├── periodMonth: Int
├── status: RunStatus (PENDING | RUNNING | COMPLETED | FAILED)
├── totalAssetsProcessed: Int
├── totalDepreciationAmount: Decimal
├── errorLog: String?
└── createdAt: DateTime

DepreciationEntry
├── id
├── runId → DepreciationRun
├── assetId → Asset
├── periodYear: Int
├── periodMonth: Int
├── depreciationAmount: Decimal     -- amount for this period
├── proRataDays: Int?               -- for first/last partial month
├── accumulatedBefore: Decimal      -- snapshot
├── accumulatedAfter: Decimal       -- snapshot
├── costCenterId → CostCenter?      -- primary CC allocation
├── payableId → Payable?            -- if depreciation generates a CP (reclassification)
└── createdAt: DateTime
```

### WorkOrder (Maintenance OS state machine)

```
WorkOrder
├── id, organizationId, farmId
├── assetId → Asset
├── maintenancePlanId → MaintenancePlan?  -- null for corrective
├── type: WorkOrderType (PREVENTIVE | CORRECTIVE | REFORM | IMPROVEMENT)
├── status: WorkOrderStatus (OPEN | IN_PROGRESS | WAITING_PARTS | COMPLETED | CANCELLED)
├── priority: Priority (LOW | MEDIUM | HIGH | CRITICAL)
├── requestedBy → User
├── assignedTo → User?
├── openedAt: DateTime
├── scheduledFor: DateTime?
├── startedAt: DateTime?
├── completedAt: DateTime?
│
│  -- Parts consumed (deducted from stock)
├── items → WorkOrderItem[]
│
│  -- Cost allocation
├── costCenterItems → WorkOrderCostCenterItem[]
│
│  -- Accounting classification
├── accountingType: AccountingType (EXPENSE | CAPITALIZATION | DEFERRAL)
├── deferralMonths: Int?            -- for DEFERRAL: spread over N months
├── capitalizedToAssetId → Asset?  -- for CAPITALIZATION: add to asset book value
│
│  -- Financial integration
├── totalLaborCost: Decimal?        @db.Decimal(15,2)
├── totalPartsCost: Decimal?        @db.Decimal(15,2)
├── payableId → Payable?            -- generated on completion for external services
├── notes: String?
└── createdAt, updatedAt

WorkOrderItem
├── id, workOrderId → WorkOrder
├── productId → Product?            -- from existing products module
├── description: String             -- fallback if no productId
├── quantity: Decimal
├── unitId → MeasurementUnit?
├── unitCost: Decimal?
├── stockOutputId → StockOutput?    -- created on COMPLETE to deduct from stock
└── notes: String?

-- State machine (stored in work-orders.types.ts):
VALID_WO_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
  WAITING_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
}
```

### AssetAcquisition (financial integration hub)

```
AssetAcquisition
├── id, organizationId, farmId
├── acquisitionType: AcquisitionType (CASH | FINANCED | LEASING | EXCHANGE)
├── invoiceNumber: String?
├── invoiceDate: DateTime?
├── invoiceKey: String?             -- NF-e chave de acesso
├── supplierId → Supplier
├── totalAmount: Decimal            @db.Decimal(15,2)
├── items → AssetAcquisitionItem[]  -- one NF can have multiple assets
│
│  -- Generated on confirm:
├── payableId → Payable?            -- CASH: single CP; FINANCED: installment CP
├── leasingId → AssetLease?         -- if LEASING
└── createdAt, updatedAt

AssetAcquisitionItem
├── id, acquisitionId → AssetAcquisition
├── assetId → Asset
├── amount: Decimal                 -- portion of invoice for this asset
└── notes: String?

AssetLease
├── id, organizationId
├── assetId → Asset
├── lessorName: String
├── lessorDocument: String
├── contractNumber: String
├── startDate: DateTime
├── endDate: DateTime
├── monthlyPayment: Decimal         @db.Decimal(15,2)
├── depositAmount: Decimal?
├── purchaseOptionAmount: Decimal?  -- CPC 06 residual
├── status: LeaseStatus (ACTIVE | EXPIRED | EXERCISED | CANCELLED)
└── payables Payable[]              -- monthly lease payments as CP

AssetDisposal
├── id, organizationId, farmId
├── assetId → Asset
├── disposalType: DisposalType (SALE | WRITE_OFF | SCRAP | SINISTER)
├── disposalDate: DateTime
├── saleAmount: Decimal?            @db.Decimal(15,2)
├── bookValueAtDisposal: Decimal    -- snapshot of netValue on disposal date
├── gainLoss: Decimal               -- computed: saleAmount - bookValueAtDisposal
├── buyerName: String?
├── buyerDocument: String?
├── installmentCount: Int @default(1)
├── receivableId → Receivable?      -- generated on confirm for sale
└── notes: String?
```

---

## Critical Data Flows

### Flow 1: Monthly Depreciation Batch

This is the most architecturally novel feature — no equivalent exists in the current system.

```
depreciation.cron.ts (node-cron, 0 0 1 * *)
    ↓
For each active organization:
    Lock: redis.set('cron:depreciation:{orgId}:{year}-{month}', EX=300, NX)
    ↓
asset-depreciation.service.runMonthlyDepreciation(ctx, year, month)
    ↓
withRlsContext → single transaction per org:
    │
    ├── 1. Create DepreciationRun (status=RUNNING)
    │
    ├── 2. Query active assets with depreciationMethod != NONE
    │       (exclude WIP, DISPOSED, type=LAND)
    │
    ├── 3. For each asset (chunk of 100 to limit tx size):
    │       a. Compute depreciationAmount:
    │           LINEAR:       (acquisitionCost - residualValue) / (usefulLifeYears * 12)
    │           USAGE_HOURS:  (hours this period / totalHours) * depreciableAmount
    │           PRODUCTION:   (production this period / totalCapacity) * depreciableAmount
    │           ACCELERATED:  LINEAR * accelerationFactor
    │       b. Apply pro-rata for first/last partial month
    │       c. Cap at remaining depreciable value (never depreciate below residualValue)
    │       d. Create DepreciationEntry
    │       e. Update asset.accumulatedDepreciation and asset.currentNetValue
    │       f. If asset has costCenterItems: split entry across CCs per allocation %
    │
    └── 4. Update DepreciationRun (status=COMPLETED, totalAmount=SUM)

IMPORTANT: Depreciation batch does NOT create Payable records automatically.
It creates DepreciationEntry records. Accountant reviews and posts to CP manually
(or future automation in accounting milestone). This matches CPC 27 workflow.
```

### Flow 2: WorkOrder Completion (3-domain atomic write)

Mirrors the GoodsReceipt confirmation pattern from v1.1.

```
POST /api/work-orders/:id/complete
    ↓
work-orders.service.complete(ctx, id, completionData)
    ↓
withRlsContext → single transaction:
    │
    ├── 1. Validate WO state (VALID_WO_TRANSITIONS check)
    │
    ├── 2. Update WorkOrder: status=COMPLETED, completedAt=now()
    │
    ├── 3. For each WorkOrderItem with productId:
    │       Create StockOutput via stock-outputs logic (existing)
    │       → CONSUMPTION type, links back to workOrderId
    │       Update item.stockOutputId = created output id
    │
    ├── 4. Compute totalPartsCost from items, totalLaborCost from input
    │
    ├── 5. If accountingType=EXPENSE and externalService cost > 0:
    │       Create Payable (originType='MAINTENANCE_OS', originId=workOrder.id)
    │       category='ASSET_MAINTENANCE', CC from workOrder.costCenterItems
    │
    ├── 6. If accountingType=CAPITALIZATION:
    │       Add cost to Asset.acquisitionCost (capitalização)
    │       Recalculate DepreciationConfig.monthlyRate
    │
    └── 7. If maintenancePlan linked: generate next MaintenancePlan trigger / next WO
```

### Flow 3: Asset Purchase (financial integration)

```
POST /api/asset-acquisitions/:id/confirm
    ↓
asset-acquisition.service.confirm(ctx, id)
    ↓
withRlsContext → single transaction:
    │
    ├── 1. For each AssetAcquisitionItem: set Asset.status=ACTIVE
    │
    ├── 2. If acquisitionType=CASH:
    │       createPayable(ctx, {
    │         originType: 'ASSET_PURCHASE',
    │         originId: acquisition.id,
    │         category: 'ASSET_PURCHASE',
    │         totalAmount: acquisition.totalAmount,
    │         installmentCount: 1
    │       })
    │
    ├── 3. If acquisitionType=FINANCED:
    │       createPayable(ctx, {
    │         ...
    │         installmentCount: financingMonths,
    │         firstDueDate: ...
    │       })
    │       -- reuses generateInstallments() from packages/shared
    │
    └── 4. If acquisitionType=LEASING:
            createAssetLease(tx, ...)
            -- create periodic Payable for each monthly payment
            -- or create recurring Payable with recurrenceFrequency='MONTHLY'
```

### Flow 4: Asset Sale (gain/loss + CR)

```
POST /api/asset-disposals/:id/confirm
    ↓
asset-disposal.service.confirm(ctx, id)
    ↓
withRlsContext → single transaction:
    │
    ├── 1. Run final depreciation for partial month (pro-rata)
    │
    ├── 2. Compute bookValueAtDisposal = acquisitionCost - accumulatedDepreciation
    │       gainLoss = saleAmount - bookValueAtDisposal
    │
    ├── 3. Create Receivable (originType='ASSET_SALE', originId=disposal.id)
    │       category='ASSET_SALE'
    │       If installmentCount > 1: reuses generateInstallments()
    │
    └── 4. Set Asset.status=DISPOSED, Asset.deletedAt=now()
```

---

## Asset Hierarchy: Parent-Child (3 Levels)

The spec requires "ativo composto com hierarquia pai-filho, até 3 níveis." Implementation:

```
Asset (level 0: master) — e.g. "Colheitadeira John Deere S680"
  └── AssetComponent → Asset (level 1: component) — e.g. "Motor Plataforma"
        └── AssetComponent → Asset (level 2: sub-component) — e.g. "Correia Esteira"
```

Rules enforced at service layer (not database constraint):
- Before creating an AssetComponent link, traverse up from proposed parent to root
- If depth >= 3: throw AssetError('Hierarquia máxima de 3 níveis atingida', 400)
- Depreciation runs on each asset independently (components have their own schedule)
- `Asset.parentId` is NOT stored directly — hierarchy is via `AssetComponent` join table
- This allows one asset to appear as component in multiple parents (e.g., a shared implement)

---

## Map Layer Integration

The existing `FarmMap.tsx` accepts `LayerControlPanel` with `LayerConfig[]`. Adding an asset layer requires:

**Backend:** New endpoint `GET /api/assets?farmId=X&includeLocation=true` returns assets with PostGIS Point as GeoJSON Feature coordinates.

**Frontend changes (additive only, no FarmMap rewrite):**

```typescript
// hooks/useFarmMap.ts — extend return type
interface FarmMapData {
  // ... existing fields ...
  assetMarkers: AssetMapItem[];  // NEW
}

// AssetMapItem
interface AssetMapItem {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  lat: number;
  lng: number;
}

// FarmMap.tsx — add asset layer (CircleMarker, same pattern as farm_locations)
{layers.assets.enabled && assetMarkers.map(asset => (
  <CircleMarker
    key={asset.id}
    center={[asset.lat, asset.lng]}
    radius={8}
    pathOptions={{ color: ASSET_TYPE_COLORS[asset.type], fillOpacity: 0.7 }}
  >
    <Popup>{asset.name} — {asset.status}</Popup>
  </CircleMarker>
))}

// LayerControlPanel receives one new LayerConfig entry:
{ id: 'assets', label: 'Patrimônio', enabled: false }
```

Only benfeitorias and imóveis rurais will have meaningful locations. Machines/vehicles get no marker unless operator logs a GPS location explicitly. The asset layer is off by default.

---

## Depreciation Method Architecture

Four methods, one interface:

```typescript
// asset-depreciation/depreciation-calculator.ts
export interface DepreciationInput {
  method: DepreciationMethod;
  acquisitionCost: Decimal;
  residualValue: Decimal;
  usefulLifeMonths: number;
  accumulatedDepreciation: Decimal;
  // For USAGE_HOURS:
  hoursThisPeriod?: Decimal;
  totalEstimatedHours?: Decimal;
  // For PRODUCTION:
  productionThisPeriod?: Decimal;
  totalEstimatedProduction?: Decimal;
  // For pro-rata:
  daysInPeriod?: number;
  totalDaysInMonth?: number;
}

export interface DepreciationResult {
  amount: Decimal;          // depreciation this period
  isFullyDepreciated: boolean;
  remainingPeriods?: number;
}

export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  // pure function — no DB calls, fully testable
}
```

This pure function lives in `modules/asset-depreciation/depreciation-calculator.ts` and is called by both the cron batch and the preview endpoint (`GET /api/assets/:id/depreciation-preview`).

---

## Frontend Architecture

### New Pages (sidebar group PATRIMÔNIO)

```
apps/frontend/src/pages/
├── AssetsPage.tsx               # Inventory list + filters + bulk import + export
├── AssetDetailPage.tsx          # Ficha completa: TCO, timeline, OS history, docs
├── DepreciationPage.tsx         # Depreciation runs list, manual trigger, CC entries
├── MaintenancePlansPage.tsx     # Preventive plans CRUD
├── WorkOrdersPage.tsx           # OS Kanban (OPEN/IN_PROGRESS/WAITING/COMPLETED)
├── MaintenanceDashboardPage.tsx # MTBF, availability, cost/asset, upcoming OS
├── FuelRecordsPage.tsx          # Abastecimentos per asset
├── AssetDocumentsPage.tsx       # Documents + expiry calendar
├── AssetAcquisitionsPage.tsx    # Purchase flows (at-sight, financed, leasing, trade)
└── PatrimonialDashboardPage.tsx # Total asset value, depreciation YTD, gain/loss
```

### Component Structure

```
apps/frontend/src/components/
├── assets/
│   ├── AssetModal.tsx           # Create/edit ativo (multi-step: Tipo → Dados → Aquisição → CC)
│   ├── AssetHierarchyTree.tsx   # Parent-child 3 levels (collapsible tree)
│   ├── AssetStatusBadge.tsx
│   ├── AssetImportModal.tsx     # CSV/Excel bulk import (reuse BulkImportModal pattern)
│   └── AssetInventoryTable.tsx  # Sortable/filterable table with export
├── depreciation/
│   ├── DepreciationConfigModal.tsx  # Configure method + useful life + residual
│   ├── DepreciationPreviewCard.tsx  # Shows projected schedule before confirming config
│   └── DepreciationRunDetails.tsx  # Entries per asset for a run
├── work-orders/
│   ├── WorkOrderModal.tsx       # Create/edit OS: asset, type, items (parts), CC
│   ├── WorkOrderKanban.tsx      # Status columns (reuse PurchasingKanbanPage pattern)
│   ├── WorkOrderCompletionModal.tsx  # Complete: labor cost, accounting classification
│   └── WorkOrderPdfButton.tsx   # pdfkit PDF download (same pattern as pesticide-prescriptions)
├── maintenance-plans/
│   ├── MaintenancePlanModal.tsx # Plan with trigger conditions (time/hours/km)
│   └── MaintenancePlanCalendar.tsx  # Next scheduled maintenance calendar view
├── asset-acquisition/
│   ├── AssetAcquisitionModal.tsx  # Purchase type selector → conditional fields
│   ├── NfeImportModal.tsx          # XML upload → parsed asset list preview → confirm
│   └── LeasingModal.tsx            # CPC 06 leasing contract form
└── asset-disposal/
    └── AssetDisposalModal.tsx   # Baixa: type selector, sale amount, gain/loss preview
```

### AssetDetailPage Tab Structure

```
AssetDetailPage
├── Tab: Dados Gerais   — identity, acquisition, location, current values
├── Tab: Depreciação    — config, accumulated, projection chart (recharts, already used)
├── Tab: Manutenções    — OS history timeline + open OS list + plan link
├── Tab: Documentos     — CRLV, seguro, revisão — sorted by expiry date with alert badges
├── Tab: Combustível    — abastecimento history, cost/hour chart
├── Tab: Histórico      — audit log of all changes, transfers, status changes
└── Tab: TCO            — Total Cost of Ownership: acquisition + depreciation + maintenance + fuel
```

---

## Prisma Migration Strategy

New migrations follow the established `20260{timestamp}_{name}` convention. The last shipped migration is `20260411100000`. Asset management starts at `20260412`:

| Migration | Content | Depends on |
|---|---|---|
| `20260412100000_add_assets_core` | `Asset`, `AssetComponent`, `AssetCostCenterItem`, enums | Farm, CostCenter, Supplier, FarmLocation |
| `20260412200000_add_depreciation` | `DepreciationConfig`, `DepreciationRun`, `DepreciationEntry` | Asset, CostCenter |
| `20260412300000_add_maintenance_plans` | `MaintenancePlan`, `MaintenancePlanItem` | Asset |
| `20260412400000_add_work_orders` | `WorkOrder`, `WorkOrderItem`, `WorkOrderCostCenterItem` | Asset, MaintenancePlan, CostCenter, Product |
| `20260412500000_add_fuel_records` | `FuelRecord` | Asset |
| `20260412600000_add_asset_documents` | `AssetDocument` | Asset |
| `20260412700000_add_asset_acquisition` | `AssetAcquisition`, `AssetAcquisitionItem`, `AssetLease` | Asset, Supplier |
| `20260412800000_add_asset_disposal` | `AssetDisposal` | Asset |
| `20260412900000_add_asset_biological` | `AssetBiologicalValuation` (CPC 29/IAS 41) | Asset |
| `20260413000000_add_asset_wip` | `AssetWipContribution` (obras em andamento aporte parcial) | Asset |
| `20260413100000_modify_payables_asset` | ADD `assetId`, `workOrderId` FK columns to `payables`; ADD `ASSET_PURCHASE`, `ASSET_MAINTENANCE`, `LEASING` to `PayableCategory` | Asset, WorkOrder |
| `20260413200000_modify_receivables_asset` | ADD `assetId` FK column to `receivables`; ADD `ASSET_SALE` to `ReceivableCategory` | Asset |

---

## Build Order (Dependency-Driven)

```
Phase 1 — Core Asset Entity (no financial deps)
  assets module
  → Asset, AssetComponent, AssetCostCenterItem
  → CRUD: list, create, edit, delete (soft), transfer between farms
  → Bulk import CSV/Excel (reuse existing import pattern)
  → Asset map layer in FarmMap (additive, no FarmMap rewrite)
  → AssetDetailPage skeleton with tabs
  UNBLOCKS: everything else

Phase 2 — Depreciation (depends on assets only)
  asset-depreciation module
  → DepreciationConfig, DepreciationRun, DepreciationEntry
  → depreciation-calculator.ts (pure function, testable in isolation)
  → Manual trigger endpoint + preview endpoint
  → depreciation.cron.ts (monthly, follows digest.cron.ts exactly)
  → DepreciationPage + AssetDetailPage depreciation tab
  NOTE: cron does NOT auto-generate Payables — this is intentional (CPC 27)

Phase 3 — Maintenance OS (depends on assets, stock-outputs existing)
  maintenance-plans module
  work-orders module
  → WorkOrder state machine (VALID_WO_TRANSITIONS)
  → OS completion: atomic StockOutput creation + Payable creation
  → Accounting classification (expense/capitalization/deferral)
  → WorkOrdersPage Kanban + MaintenanceDashboardPage
  CRITICAL DEPENDENCY: stock-outputs module must be imported (already exists)

Phase 4 — Operational Records (depends on assets only)
  fuel-records module
  asset-documents module
  → Simple CRUD, low complexity
  → Document expiry alerts (cron or daily check in existing digest cron)

Phase 5 — Financial Integration: Acquisition (depends on assets + payables + shared)
  asset-acquisition module
  → CASH/FINANCED: createPayable() with originType='ASSET_PURCHASE'
  → FINANCED: generateInstallments() from packages/shared
  → LEASING: AssetLease + recurring Payable (recurrenceFrequency='MONTHLY')
  → NF-e XML parse (reuse existing xml2js pattern from goods-receipts)
  → Modify payables table (migration 20260413100000)

Phase 6 — Financial Integration: Disposal (depends on assets + receivables + depreciation)
  asset-disposal module
  → Run final pro-rata depreciation first
  → Compute gain/loss
  → createReceivable() with originType='ASSET_SALE'
  → Modify receivables table (migration 20260413200000)
  DEPENDENCY: Phase 2 (depreciation) and Phase 5 (financial patterns) must be done first

Phase 7 — Reporting + Dashboard (read-only, depends on all above)
  asset-dashboard module
  → TCO calculation (acquisition + depreciation + maintenance + fuel)
  → PatrimonialDashboardPage: total patrimônio, depreciação acumulada, ROI por ativo
  → Relatórios patrimoniais PDF (pdfkit, same pattern as pesticide-prescriptions)

Phase 8 — Specialized Asset Types (depends on assets core)
  → AssetBiologicalValuation (CPC 29/IAS 41): fair value model for cattle/perennial crops
  → AssetWipContribution: aportes parciais até ativação de imobilizado em andamento
  → These are lower priority; can be deferred if milestone scope needs trimming
```

---

## Integration Points with Existing Modules

### Reads (asset modules read existing data)

| Existing Module | What Asset Management Reads |
|---|---|
| `farms/` | Farm boundary for filtering; farm transfer target |
| `cost-centers/` | CC allocation on depreciation entries and OS costs |
| `suppliers/` | Supplier on asset acquisition (supplierId FK) |
| `products/` | Spare parts catalog on WorkOrderItem |
| `measurement-units/` | Units for spare parts quantities |
| `stock-balances/` | Pre-check parts availability before OS completion |
| `rural-credit/` | Reference only — financing linked to Payable not duplicated here |
| `farm-locations/` | Optional link: benfeitoria asset ↔ existing farm_locations entry |

### Writes to Existing Modules

| Existing Module | Modification | Trigger |
|---|---|---|
| `stock-outputs/` | WorkOrder.complete() creates StockOutput per spare part item consumed | OS completion |
| `payables/` | Asset acquisition confirm → CP; OS completion with external cost → CP; leasing monthly → recurring CP | Acquisition/OS/Leasing confirm |
| `receivables/` | Asset disposal confirm (sale) → CR with gain/loss | Asset sale confirm |

### New Permissions for RBAC

```
module: 'assets',           action: 'read' | 'create' | 'update' | 'delete' | 'transfer'
module: 'depreciation',     action: 'read' | 'run' | 'configure'
module: 'work-orders',      action: 'read' | 'create' | 'complete' | 'cancel'
module: 'maintenance-plans', action: 'read' | 'create' | 'update' | 'delete'
module: 'asset-acquisition', action: 'read' | 'create' | 'confirm'
module: 'asset-disposal',   action: 'read' | 'create' | 'confirm'
```

---

## Patterns to Follow

### Pattern 1: Atomic Multi-Domain Write (OS Completion)

Mirrors v1.1 GoodsReceipt confirmation. WorkOrder.complete() atomically writes to WorkOrder, StockOutput (for each part), and Payable (for external services) in one `withRlsContext` transaction. If StockOutput creation fails due to insufficient stock: entire operation rolls back. Frontend shows specific error: "Peça X com saldo insuficiente."

### Pattern 2: State Machine via VALID_TRANSITIONS + Guard

WorkOrder uses the same `VALID_WO_TRANSITIONS: Record<string, string[]>` pattern established in checks.types.ts and purchase-orders.types.ts. Stored in `work-orders.types.ts`, exported, tested independently.

### Pattern 3: Batch Cron with Redis Lock

Monthly depreciation cron follows `digest.cron.ts` exactly: `node-cron`, Redis `SET NX EX`, per-org lock key (`cron:depreciation:{orgId}:{YYYY-MM}`). Processing per org in separate `withRlsContext` calls, not one giant transaction.

```typescript
// shared/cron/depreciation.cron.ts
export function startDepreciationCron(): void {
  cron.schedule('0 0 1 * *', async () => {
    const orgs = await getActiveOrganizations();
    for (const org of orgs) {
      const lockKey = `cron:depreciation:${org.id}:${year}-${month}`;
      const locked = await redis.set(lockKey, '1', 'EX', 300, 'NX');
      if (!locked) continue;
      try {
        await runMonthlyDepreciation({ organizationId: org.id }, year, month);
      } catch (err) {
        logger.error({ err, orgId: org.id }, 'Depreciation cron failed for org');
        // Do NOT rethrow — process other orgs
      } finally {
        await redis.del(lockKey);
      }
    }
  }, { timezone: 'America/Sao_Paulo' });
}
```

### Pattern 4: Pure Calculation Functions

`calculateDepreciation()` and `computeGainLoss()` are pure functions in their respective module's `*-calculator.ts` file. No DB calls, no side effects. Enables testing all depreciation math without database setup. Preview endpoints call the pure function directly; the cron calls the same function with real data.

### Pattern 5: Polymorphic Origin on Payable/Receivable

Asset management reuses the existing `Payable.originType` / `Payable.originId` pattern. New originType values: `'ASSET_PURCHASE'`, `'MAINTENANCE_OS'`, `'LEASING'`. No schema change to Payable's core structure — just new enum values in `PayableCategory` and FK columns. This follows the precedent established by `'GOODS_RECEIPT'` in v1.1.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Auto-Generate Payable from Depreciation Run

**What goes wrong:** Depreciation cron automatically creates a CP for each depreciation entry every month.

**Why it's wrong:** Depreciation in Brazilian accounting (CPC 27) is an accounting entry (débito Depreciação / crédito Depreciação Acumulada), not a cash payment. Generating a CP would misrepresent it as a financial obligation. The system currently has no full accounting module — this integration waits for the future contabilidade milestone.

**Instead:** Depreciation entries are records for reporting and cost allocation. The accountant reviews the DepreciationRun report. Accounting module (future milestone) will consume DepreciationEntry to generate journal entries.

### Anti-Pattern 2: One Giant Transaction for Batch Depreciation

**What goes wrong:** Running all organizations' depreciation in a single `withRlsContext` transaction.

**Why it's wrong:** With 100+ assets across multiple orgs, transaction timeout risk is high. One org failure rolls back all orgs.

**Instead:** One `withRlsContext` per org (as shown in Pattern 3). Each org is independent. Failure is logged per org, processing continues.

### Anti-Pattern 3: Storing Asset Hierarchy as Adjacency List on Asset Itself

**What goes wrong:** Adding `parentId: String?` directly to the Asset model and computing depth via recursive queries.

**Why it's wrong:** PostgreSQL recursive CTEs for adjacency lists are complex to write correctly and hard to understand. Depth validation requires a CTE.

**Instead:** Use the `AssetComponent` join table as shown above. Depth check at service layer traverses up from proposed parent (max 3 hops = cheap). Clean separation between hierarchy relationship and asset data.

### Anti-Pattern 4: Hard-Coding Depreciation into FarmMap Component

**What goes wrong:** Adding asset markers directly into `FarmMap.tsx` with special-cased conditional rendering.

**Why it's wrong:** FarmMap already has 9 layer types. Asset markers are just another optional layer. Hard-coding creates tight coupling and makes the map component hard to test.

**Instead:** Use the existing `LayerControlPanel` / `LayerConfig[]` extensibility point. Pass `assetMarkers` as a new prop to `FarmMap`. Add `CircleMarker` rendering inside the existing layers section — additive, not invasive.

### Anti-Pattern 5: Replicating Installment Logic for Leasing

**What goes wrong:** Writing custom installment generation for leasing monthly payments.

**Why it's wrong:** `generateInstallments()` in `packages/shared` already handles this correctly with Decimal arithmetic and cent residual allocation.

**Instead:** Use `generateInstallments(monthlyPayment, termMonths, startDate, 1)` to generate leasing CP rows. The same function already used by payables and rural-credit modules.

---

## Scalability Considerations

| Concern | At ~50 farms | At ~500 farms | At ~5k farms |
|---|---|---|---|
| Depreciation batch | 500 assets: runs in < 1s | 5k assets: 10-15s per org, stagger by org | 50k assets: parallelize per farm, batch size tuning |
| Asset inventory query | No issue | Add composite index `(organizationId, farmId, status, type)` | Consider partial index on `status != 'DISPOSED'` |
| OS history per asset | No issue | No issue | Paginate WorkOrder query by default (already standard) |
| Map layer (asset markers) | No issue | 100+ markers: cluster with leaflet.markercluster | 1k+ markers: server-side spatial query with bbox filter |

**First bottleneck:** Monthly depreciation cron when org has hundreds of active assets. Mitigation: batch assets in chunks of 100 per transaction (already in design), per-org Redis lock prevents duplicate runs.

**Second bottleneck:** PatrimonialDashboardPage TCO aggregation joining assets + depreciation_entries + work_orders + fuel_records. Mitigation: add `(assetId, periodYear, periodMonth)` composite index on `depreciation_entries`; add `(assetId, completedAt)` index on `work_orders`.

---

## Sources

- Direct codebase analysis: `apps/backend/prisma/schema.prisma` (6500+ lines)
- `apps/backend/src/shared/cron/digest.cron.ts` — cron infrastructure pattern
- `apps/backend/src/modules/checks/checks.types.ts` — VALID_TRANSITIONS state machine pattern
- `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — OC_VALID_TRANSITIONS pattern
- `apps/backend/src/database/rls.ts` — withRlsContext + RlsContext types
- `apps/frontend/src/components/map/LayerControlPanel.tsx` — LayerConfig extensibility point
- `apps/frontend/src/components/map/FarmMap.tsx` — CircleMarker pattern for locations
- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` — atomic multi-domain write pattern
- `apps/backend/src/modules/payables/payables.service.ts` — createPayable() function signature
- `apps/backend/src/modules/rural-credit/` — installment generation for financed acquisitions
- `packages/shared/src/utils/installments.ts` — generateInstallments() reuse
- PROJECT.md: v1.2 milestone requirements and constraints

---

_Architecture research for: Asset management integration into Protos Farm monolith (v1.2)_
_Researched: 2026-03-19_
