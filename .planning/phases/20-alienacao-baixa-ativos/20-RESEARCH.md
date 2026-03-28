# Phase 20: Alienação e Baixa de Ativos — Research

**Researched:** 2026-03-22
**Domain:** Asset lifecycle close — sale/disposal/transfer, gain/loss calculation, CR generation, depreciation entry cancellation, farm-to-farm transfer, physical inventory reconciliation, patrimônio dashboard
**Confidence:** HIGH

## Summary

Phase 20 closes the asset lifecycle loop: assets registered in Phase 16, depreciated in Phase 17, maintained in Phase 18, and acquired via financial integration in Phase 19 can now be sold, written off, or transferred — triggering automatic financial entries and halting future depreciation. All six requirements are purely additive: no existing module needs destructive modification. Three new backend modules are required (`asset-disposals`, `asset-farm-transfers`, `asset-inventory`) plus extensions to the `assets` module (new fields on the `Asset` model) and a patrimônio sub-dashboard endpoint in `financial-dashboard`.

The critical architectural decision already locked in STATE.md applies directly here: "Asset disposal cancels pending depreciation atomically." This means the disposal transaction must call `prisma.$transaction` and within that transaction: (1) set `asset.status = 'ALIENADO'`, (2) write the disposal record, (3) stamp `reversedAt = now()` on every not-yet-reversed `DepreciationEntry` for the asset, and (4) create the `Receivable` (for sales) or loss-entry record (for write-offs). The reversal pattern for existing depreciation entries is established in `depreciation-batch.service.ts` — the disposal service reuses that pattern in bulk.

The gain/loss calculation is: `saleValue - netBookValue`, where `netBookValue` = latest `DepreciationEntry.closingBookValue` (if at least one entry exists), otherwise `asset.acquisitionValue`. CR generation for sales follows the exact same `withRlsContext` + `tx.receivable.create` pattern used in `receivables.service.ts`. The `ReceivableCategory` enum must be extended with `ASSET_SALE` (requires an `ALTER TYPE` migration). For installment sales (DISP-03), `generateInstallments` from `@protos-farm/shared` is reused exactly as in `asset-acquisitions.service.ts`.

**Primary recommendation:** Build in 4 plans — Wave 0 (spec stubs + migration), disposal backend + CR integration, asset-farm-transfer + inventory reconciliation backend, and a single frontend wave combining DisposalModal, TransferModal, InventoryModal, and the patrimônio dashboard tab.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                    | Research Support                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISP-01 | Gerente pode registrar venda de ativo com cálculo automático de ganho/perda contábil e geração de CR                                           | `asset.status` ALIENADO already in enum; netBookValue from latest `DepreciationEntry.closingBookValue`; CR via `tx.receivable.create` pattern; `ReceivableCategory` needs `ASSET_SALE` value added via migration      |
| DISP-02 | Gerente pode registrar baixa por sinistro, descarte ou obsolescência com motivo, laudo, valor residual e lançamento de perda                   | New `asset_disposals` model; `DisposalType` enum (SINISTRO, DESCARTE, OBSOLESCENCIA); `reversedAt` bulk-set on `DepreciationEntry` rows in single transaction; no CR needed — loss amount recorded on disposal record |
| DISP-03 | Gerente pode registrar venda parcelada de ativo com parcelas no CR                                                                             | `generateInstallments` from `@protos-farm/shared` used verbatim; same `installmentCount` + `firstDueDate` pattern as `asset-acquisitions.service.ts`; CR `installmentCount` > 1                                       |
| DISP-04 | Gerente pode transferir ativo entre fazendas da mesma organização com histórico e reavaliação opcional                                         | New `asset_farm_transfers` model; `asset.farmId` update + optional `costCenterId` change; both farms must belong to same `organizationId` (guard in service); transfer history queryable via relation                 |
| DISP-05 | Contador pode conciliar patrimônio físico vs contábil com inventário e gerar ajustes                                                           | New `asset_inventories` + `asset_inventory_items` models; flow mirrors `StockInventory` → count → reconcile pattern; adjustment records set `asset.status` or notes; no Decimal arithmetic needed here                |
| DISP-06 | Gerente pode ver dashboard financeiro patrimonial com valor total de ativos, depreciação acumulada, aquisições/baixas do período e indicadores | New `GET /financial-dashboard/patrimony` endpoint added to existing `financial-dashboard` module; aggregates from `assets`, `depreciation_entries`, `asset_disposals`; follows `getFinancialDashboard` pattern        |

</phase_requirements>

---

## Standard Stack

### Core

| Library             | Version | Purpose                                                 | Why Standard                                                                    |
| ------------------- | ------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Prisma              | 7.x     | ORM + migrations for 3 new models + schema extension    | Already in use; `prisma.$transaction` pattern for atomic disposal               |
| decimal.js          | ^10.6.0 | Gain/loss arithmetic (saleValue - netBookValue)         | STATE.md locked decision for all monetary math                                  |
| @protos-farm/shared | current | `generateInstallments`, `Money`, `generateInstallments` | Already used in `asset-acquisitions.service.ts` for identical installment logic |
| Express 5           | 5.x     | HTTP routes for 3 new modules                           | Standard module pattern                                                         |

### Supporting

| Library                         | Version | Purpose                                | When to Use                                          |
| ------------------------------- | ------- | -------------------------------------- | ---------------------------------------------------- |
| ExcelJS                         | ^4.4.0  | Inventory report XLSX export (DISP-05) | Already installed; used in `depreciation.service.ts` |
| Jest + @swc/jest                | current | Backend integration tests              | All `routes.spec.ts` files                           |
| Vitest + @testing-library/react | current | Frontend component specs               | New modal specs                                      |

### Alternatives Considered

| Instead of                                                  | Could Use                       | Tradeoff                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic transaction for disposal + depreciation cancellation | Event-driven async cancellation | Sync transaction is mandatory per STATE.md decision: "Asset disposal cancels pending depreciation atomically"                                                                |
| `ReceivableCategory.ASSET_SALE` (new enum value)            | `OTHER` category                | New value provides correct financial categorization and traceability; `ALTER TYPE` migration is trivial                                                                      |
| New `asset-disposals` module                                | Extending `assets.service.ts`   | Isolation keeps disposal logic self-contained — same rationale as `asset-acquisitions` module                                                                                |
| `prisma.$transaction` directly (no `withRlsContext`)        | `withRlsContext` wrapper        | CRITICAL: asset-acquisitions uses `prisma.$transaction` directly (not `withRlsContext`) to avoid nested RLS context deadlocks — disposal module MUST follow the same pattern |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/asset-disposals/
├── asset-disposals.routes.ts         # POST /:id/dispose, GET /:assetId/disposal
├── asset-disposals.routes.spec.ts    # Jest integration tests
├── asset-disposals.service.ts        # createDisposal (atomic: status + depr cancel + CR)
└── asset-disposals.types.ts          # Input/output types, error class, DisposalType enum

apps/backend/src/modules/asset-farm-transfers/
├── asset-farm-transfers.routes.ts    # POST /:id/transfer, GET /:assetId/transfers
├── asset-farm-transfers.routes.spec.ts
├── asset-farm-transfers.service.ts   # createTransfer (update farmId + optionally costCenterId)
└── asset-farm-transfers.types.ts

apps/backend/src/modules/asset-inventory/
├── asset-inventory.routes.ts         # POST /inventories, GET /:id, PATCH /:id/items, POST /:id/reconcile
├── asset-inventory.routes.spec.ts
├── asset-inventory.service.ts        # createInventory, countItems, reconcileInventory
└── asset-inventory.types.ts

apps/backend/src/modules/financial-dashboard/
└── (extend) financial-dashboard.service.ts  # add getPatrimonyDashboard()
    financial-dashboard.routes.ts            # add GET /patrimony

apps/frontend/src/components/assets/
├── AssetDisposalModal.tsx + .css      # DISP-01, 02, 03
├── AssetTransferModal.tsx + .css      # DISP-04
├── AssetInventoryModal.tsx + .css     # DISP-05

apps/frontend/src/components/depreciation/
└── (extend) PatrimonyDashboard.tsx + .css   # DISP-06

apps/frontend/src/hooks/
├── useAssetDisposal.ts
├── useAssetTransfer.ts
└── useAssetInventory.ts
```

### New Schema Models (migration required)

```prisma
// New fields on Asset model:
//   disposalDate   DateTime?
//   disposalType   AssetDisposalType?
// (disposalJustification and saleValue stored on AssetDisposal record)

enum AssetDisposalType {
  VENDA
  DESCARTE
  SINISTRO
  OBSOLESCENCIA
}

model AssetDisposal {
  id               String           @id @default(uuid())
  organizationId   String
  assetId          String           @unique  // one disposal per asset
  disposalType     AssetDisposalType
  disposalDate     DateTime
  saleValue        Decimal?         @db.Decimal(15, 2)  // null for non-sale
  netBookValue     Decimal          @db.Decimal(15, 2)  // snapshot at disposal
  gainLoss         Decimal          @db.Decimal(15, 2)  // computed: saleValue - netBookValue
  motivation       String?          // motivo/laudo
  documentUrl      String?          // laudo técnico upload
  receivableId     String?          // FK to Receivable (sales only)
  cancelledDepreciationCount Int    @default(0)
  createdBy        String
  createdAt        DateTime         @default(now())

  asset        Asset         @relation(...)
  organization Organization  @relation(...)

  @@index([organizationId, disposalDate])
  @@map("asset_disposals")
}

model AssetFarmTransfer {
  id               String    @id @default(uuid())
  organizationId   String
  assetId          String
  fromFarmId       String
  toFarmId         String
  transferDate     DateTime
  fromCostCenterId String?
  toCostCenterId   String?
  notes            String?
  createdBy        String
  createdAt        DateTime  @default(now())

  asset        Asset         @relation(...)
  fromFarm     Farm          @relation("TransferFrom", ...)
  toFarm       Farm          @relation("TransferTo", ...)
  organization Organization  @relation(...)

  @@index([assetId])
  @@index([organizationId, transferDate])
  @@map("asset_farm_transfers")
}

enum AssetInventoryStatus {
  DRAFT
  COUNTING
  RECONCILED
  CANCELLED
}

model AssetInventory {
  id             String               @id @default(uuid())
  organizationId String
  farmId         String?              // null = all farms
  status         AssetInventoryStatus @default(DRAFT)
  notes          String?
  reconciledAt   DateTime?
  createdBy      String
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  items        AssetInventoryItem[]
  organization Organization          @relation(...)

  @@index([organizationId, status])
  @@map("asset_inventories")
}

model AssetInventoryItem {
  id              String   @id @default(uuid())
  inventoryId     String
  assetId         String
  registeredStatus AssetStatus  // status in DB at inventory time
  physicalStatus  String?  // O QUE O CONTADOR VIU: ENCONTRADO, NAO_ENCONTRADO, AVARIADO
  notes           String?
  updatedAt       DateTime @updatedAt

  inventory AssetInventory @relation(...)
  asset     Asset          @relation(...)

  @@unique([inventoryId, assetId])
  @@map("asset_inventory_items")
}
```

### Pattern 1: Atomic Disposal Transaction

**What:** Single `prisma.$transaction` that sets status, records disposal, bulk-reverses depreciation entries, and (for sales) creates Receivable.
**When to use:** Always — atomicity is a locked decision.

```typescript
// Source: STATE.md + asset-acquisitions.service.ts pattern
export async function createDisposal(
  ctx: RlsContext,
  assetId: string,
  input: CreateDisposalInput,
): Promise<AssetDisposalOutput> {
  return prisma.$transaction(async (tx: TxClient) => {
    // 1. Guard: asset must be ATIVO or INATIVO
    const asset = await tx.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!asset) throw new AssetDisposalError('Ativo não encontrado', 404);
    if (asset.status === 'ALIENADO') throw new AssetDisposalError('Ativo já alienado', 409);

    // 2. Compute netBookValue (latest closing entry or acquisitionValue)
    const latestEntry = await tx.depreciationEntry.findFirst({
      where: { assetId, reversedAt: null },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
    const netBookValue = latestEntry
      ? new Decimal(latestEntry.closingBookValue)
      : new Decimal(asset.acquisitionValue ?? 0);

    // 3. Compute gain/loss
    const saleValue = input.saleValue != null ? new Decimal(input.saleValue) : new Decimal(0);
    const gainLoss = input.disposalType === 'VENDA'
      ? saleValue.minus(netBookValue)
      : netBookValue.negated(); // full loss for write-offs

    // 4. Bulk-cancel pending depreciation entries
    const pendingEntries = await tx.depreciationEntry.findMany({
      where: { assetId, reversedAt: null },
    });
    await tx.depreciationEntry.updateMany({
      where: { assetId, reversedAt: null },
      data: { reversedAt: new Date(), notes: `Cancelado por alienação ${new Date().toISOString()}` },
    });

    // 5. Update asset status
    await tx.asset.update({
      where: { id: assetId },
      data: { status: 'ALIENADO', disposalDate: new Date(input.disposalDate) },
    });

    // 6. Create AssetDisposal record
    const disposal = await tx.assetDisposal.create({ data: { ... } });

    // 7. Create Receivable for sales (CRITICAL: use tx directly, NOT withRlsContext)
    let receivableId: string | null = null;
    if (input.disposalType === 'VENDA' && saleValue.gt(0) && input.dueDate) {
      const installments = generateInstallments(
        Money(saleValue.toNumber()),
        input.installmentCount ?? 1,
        new Date(input.dueDate),
      );
      const receivable = await tx.receivable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: asset.farmId,
          clientName: input.buyerName ?? '',
          category: 'ASSET_SALE',
          description: `Venda ${asset.assetTag} — ${asset.name}`,
          totalAmount: saleValue.toDecimalPlaces(2),
          dueDate: installments[0].dueDate,
          installmentCount: installments.length,
          originType: 'ASSET_DISPOSAL',
          originId: disposal.id,
        },
      });
      await tx.receivableInstallment.createMany({
        data: installments.map((inst) => ({
          receivableId: receivable.id,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });
      receivableId = receivable.id;
    }

    return { disposal, receivableId, gainLoss: gainLoss.toNumber(), cancelledCount: pendingEntries.length };
  });
}
```

### Pattern 2: Farm Transfer

**What:** Update `asset.farmId` (and optionally `asset.costCenterId`) + record the history row in `asset_farm_transfers`.
**When to use:** DISP-04 — both farms must belong to same `organizationId` (guard always required).

```typescript
// Source: assets.service.ts update pattern
export async function createFarmTransfer(
  ctx: RlsContext,
  assetId: string,
  input: CreateTransferInput,
) {
  return prisma.$transaction(async (tx: TxClient) => {
    const asset = await tx.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!asset) throw new AssetTransferError('Ativo não encontrado', 404);
    if (asset.status === 'ALIENADO')
      throw new AssetTransferError('Ativo alienado não pode ser transferido', 400);

    // Guard: destination farm must belong to same org
    const destFarm = await tx.farm.findFirst({
      where: { id: input.toFarmId, organizationId: ctx.organizationId },
    });
    if (!destFarm)
      throw new AssetTransferError('Fazenda destino não encontrada na organização', 404);

    // Record history before update
    await tx.assetFarmTransfer.create({
      data: {
        organizationId: ctx.organizationId,
        assetId,
        fromFarmId: asset.farmId,
        toFarmId: input.toFarmId,
        transferDate: new Date(input.transferDate),
        fromCostCenterId: asset.costCenterId,
        toCostCenterId: input.toCostCenterId ?? null,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
      },
    });

    // Update asset
    await tx.asset.update({
      where: { id: assetId },
      data: {
        farmId: input.toFarmId,
        costCenterId: input.toCostCenterId ?? asset.costCenterId,
      },
    });
  });
}
```

### Pattern 3: Patrimônio Dashboard Query

**What:** Aggregate query over `assets`, `depreciation_entries`, `asset_disposals` within a period.
**When to use:** DISP-06 — follows `getFinancialDashboard` month-boundary pattern.

```typescript
// Source: financial-dashboard.service.ts pattern
const totalActiveValue = await tx.asset.aggregate({
  where: { organizationId: ctx.organizationId, status: { not: 'ALIENADO' }, deletedAt: null },
  _sum: { acquisitionValue: true },
});

const totalAccumulatedDepreciation = await tx.depreciationEntry.aggregate({
  where: { organizationId: ctx.organizationId, reversedAt: null },
  _sum: { depreciationAmount: true },
});

const acquisitionsInPeriod = await tx.asset.aggregate({
  where: {
    organizationId: ctx.organizationId,
    acquisitionDate: { gte: monthStart, lt: monthEnd },
    deletedAt: null,
  },
  _sum: { acquisitionValue: true },
  _count: true,
});

const disposalsInPeriod = await tx.assetDisposal.aggregate({
  where: {
    organizationId: ctx.organizationId,
    disposalDate: { gte: monthStart, lt: monthEnd },
  },
  _sum: { saleValue: true, gainLoss: true },
  _count: true,
});
```

### Anti-Patterns to Avoid

- **Using `withRlsContext` inside disposal transaction:** `asset-acquisitions.service.ts` (line 77) uses `prisma.$transaction` directly — NOT `withRlsContext` — to avoid nested RLS transaction deadlocks. Disposal MUST follow this same pattern.
- **Skipping gain/loss snapshot:** Do not compute gain/loss at display time from live data. Store `gainLoss` and `netBookValue` on the `AssetDisposal` record at creation time — book value changes as more depreciation runs.
- **Marking entries deleted vs reversedAt:** Depreciation entries use `reversedAt` (a nullable timestamp), not hard delete. The batch query `reversedAt: null` already excludes cancelled entries — this is the correct filter to use in the disposal service.
- **Ignoring ALIENADO guard in batch:** The depreciation batch already excludes `EM_ANDAMENTO` assets. After Phase 20, the batch query must ALSO exclude `ALIENADO` — add `status: { notIn: ['EM_ANDAMENTO', 'ALIENADO'] }` to the batch eligibility filter in `depreciation-batch.service.ts`.

---

## Don't Hand-Roll

| Problem                                    | Don't Build                           | Use Instead                                                                                                | Why                                                       |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Installment generation for parcelated sale | Custom loop generating monthly dates  | `generateInstallments` from `@protos-farm/shared`                                                          | Handles cent residuals, leap years, month-end edge cases  |
| Gain/loss arithmetic                       | Raw JS subtraction on numbers         | `new Decimal(saleValue).minus(netBookValue)` with decimal.js                                               | Avoids floating-point errors on monetary values           |
| Atomic transaction for multi-step disposal | Sequential awaits without transaction | `prisma.$transaction` wrapping all 5-7 steps                                                               | Prevents partial state if any step fails                  |
| CR generation for sale                     | New receivables creation code         | `tx.receivable.create` + `tx.receivableInstallment.createMany` reusing the established receivables pattern | Ensures same structure as all other receivables in system |

---

## Common Pitfalls

### Pitfall 1: `withRlsContext` Inside `prisma.$transaction`

**What goes wrong:** If the disposal service wraps the transaction in `withRlsContext` (like `receivables.service.ts` does), and that transaction itself tries to create a Receivable, it creates a nested RLS context, causing a deadlock.
**Why it happens:** `withRlsContext` sets Postgres session variables (`app.current_org_id`) inside a transaction — nesting this inside another transaction collides.
**How to avoid:** Use `prisma.$transaction` directly (same as `asset-acquisitions.service.ts`). The organizationId guard comes from the service's `ctx` parameter, not from RLS.
**Warning signs:** Hanging requests, Prisma P2024 timeout errors.

### Pitfall 2: Book Value Computed at Display Time

**What goes wrong:** If gain/loss is computed by looking up the latest depreciation entry at display time, the value changes as more depreciation runs happen after disposal — leading to inconsistency in reports.
**Why it happens:** Using live data instead of a snapshot.
**How to avoid:** Store `netBookValue` and `gainLoss` as Decimal columns on the `AssetDisposal` record, computed atomically inside the disposal transaction.

### Pitfall 3: Depreciation Batch Not Updated

**What goes wrong:** After Phase 20, the depreciation batch still processes `ALIENADO` assets (they exist but the batch only excluded `EM_ANDAMENTO`). The unique constraint on `(assetId, periodYear, periodMonth, track)` in `depreciation_entries` prevents duplicates, but `ALIENADO` assets accumulate junk skip records.
**Why it happens:** `depreciation-batch.service.ts` line 62 filters `status: { not: 'EM_ANDAMENTO' }` — `ALIENADO` is not in the exclusion.
**How to avoid:** Update the batch query to `status: { notIn: ['EM_ANDAMENTO', 'ALIENADO'] as never[] }`.

### Pitfall 4: Farm Transfer Without Same-Org Guard

**What goes wrong:** If the service only validates `farmId` exists without checking `organizationId`, an attacker could transfer an asset to a farm in another organization.
**Why it happens:** Prisma finds the farm by ID without an org filter.
**How to avoid:** Always query `tx.farm.findFirst({ where: { id: toFarmId, organizationId: ctx.organizationId } })` before updating the asset.

### Pitfall 5: `ReceivableCategory` Enum ALTER Without Safe Migration

**What goes wrong:** Adding `ASSET_SALE` to a Postgres enum in production while the app is running can cause issues with active connections that have a cached enum type.
**Why it happens:** `ALTER TYPE ... ADD VALUE` is not transactional in Postgres.
**How to avoid:** The project already has `20260426100000_add_payable_category_asset_acquisition` as a precedent for adding enum values — same migration pattern applies. Ensure the migration runs before the new code is deployed.

---

## Code Examples

### Get Net Book Value at Disposal

```typescript
// Source: depreciation-batch.service.ts openingBookValue pattern (line 90-107)
async function getNetBookValue(tx: TxClient, assetId: string): Promise<Decimal> {
  const latestEntry = await tx.depreciationEntry.findFirst({
    where: { assetId, reversedAt: null },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    select: { closingBookValue: true },
  });

  if (latestEntry) {
    return new Decimal(latestEntry.closingBookValue);
  }

  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    select: { acquisitionValue: true },
  });
  return new Decimal(asset?.acquisitionValue ?? 0);
}
```

### Bulk-Cancel Depreciation Entries

```typescript
// Source: reverseEntry in depreciation-batch.service.ts (individual pattern) — use updateMany for bulk
const cancelledCount = await tx.depreciationEntry.updateMany({
  where: { assetId, reversedAt: null, organizationId: ctx.organizationId },
  data: { reversedAt: new Date(), notes: `Cancelado por alienação em ${input.disposalDate}` },
});
// Returns { count: N } — store N on AssetDisposal.cancelledDepreciationCount
```

### CR Creation for Asset Sale

```typescript
// Source: asset-acquisitions.service.ts tx.payable.create pattern (line 157)
// AND receivables.service.ts tx.receivable.create pattern (line 138)
// Use tx.receivable.create directly — NOT withRlsContext — to avoid nested transactions

const receivable = await tx.receivable.create({
  data: {
    organizationId: ctx.organizationId,
    farmId: asset.farmId,
    clientName: input.buyerName,
    category: 'ASSET_SALE',
    description: `Venda ${asset.assetTag} — ${asset.name}`,
    totalAmount: Money(saleValue.toNumber()).toDecimal(),
    dueDate: installments[0].dueDate,
    installmentCount: installments.length,
    originType: 'ASSET_DISPOSAL',
    originId: disposal.id,
  },
});
await tx.receivableInstallment.createMany({
  data: installments.map((inst) => ({
    receivableId: receivable.id,
    number: inst.number,
    amount: inst.amount.toDecimal(),
    dueDate: inst.dueDate,
  })),
});
```

---

## State of the Art

| Old Approach                         | Current Approach                                        | When Changed      | Impact                                                                                  |
| ------------------------------------ | ------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| Manual asset status update via PATCH | Atomic disposal transaction (status + depr cancel + CR) | Phase 20 decision | Prevents partial state; STATUS.md decision locked                                       |
| Hard delete depreciation entries     | `reversedAt` timestamp (soft cancel)                    | Phase 17          | Preserves audit trail; batch and disposal queries filter on `reversedAt: null`          |
| Asset category in CP/CR as `OTHER`   | `ASSET_ACQUISITION` (Phase 19), `ASSET_SALE` (Phase 20) | Phase 19/20       | Correct financial categorization for DFC (DISINVESTMENT classification for asset sales) |

**Deprecated/outdated:**

- `AssetStatus.INATIVO` for disposed assets: Phase 20 introduces `ALIENADO` as the correct terminal state. Do not set `INATIVO` for disposed assets.

---

## Open Questions

1. **DFC classification for asset sale receivables**
   - What we know: `ASSET_ACQUISITION` maps to `DFC: INVESTIMENTO` per STATE.md Phase 19 decision
   - What's unclear: Should `ASSET_SALE` Receivables map to `DFC: DESINVESTIMENTO` (correct accounting) or remain without DFC mapping?
   - Recommendation: Assign `DFC: DESINVESTIMENTO` — asset sales are disinvestment cash flows. No blocker; add to Receivable record same way Phase 19 added `DFC: INVESTIMENTO` to Payable.

2. **Inventory item "physical status" vocabulary**
   - What we know: DISP-05 requires "contagem física vs registro"
   - What's unclear: Exact values for physical status — is ENCONTRADO / NAO_ENCONTRADO / AVARIADO sufficient, or should there be DESCARTADO?
   - Recommendation: Use `ENCONTRADO | NAO_ENCONTRADO | AVARIADO | DESCARTADO` — covers all reconciliation outcomes. Planner can define these as a string enum in types.

3. **Depreciation batch exclusion update scope**
   - What we know: `depreciation-batch.service.ts` only excludes `EM_ANDAMENTO` from the batch query
   - What's unclear: Whether modifying the batch service is in scope for Phase 20 or deferred
   - Recommendation: Include it in Phase 20 Wave 0 migration task — it is a one-line fix and prevents data quality issues immediately.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Framework          | Jest + @swc/jest                                                                 |
| Config file        | `apps/backend/jest.config.ts`                                                    |
| Quick run command  | `pnpm --filter backend test -- --testPathPattern="asset-disposal" --no-coverage` |
| Full suite command | `pnpm --filter backend test -- --no-coverage`                                    |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                              | Test Type | Automated Command                                                                             | File Exists?                      |
| ------- | --------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- | --------------------------------- |
| DISP-01 | Sale creates AssetDisposal + marks ALIENADO + creates Receivable      | unit      | `pnpm --filter backend test -- --testPathPattern="asset-disposals.routes" --no-coverage`      | ❌ Wave 0                         |
| DISP-01 | Gain/loss = saleValue - netBookValue                                  | unit      | same                                                                                          | ❌ Wave 0                         |
| DISP-02 | Write-off creates AssetDisposal with full-loss amount                 | unit      | `pnpm --filter backend test -- --testPathPattern="asset-disposals.routes" --no-coverage`      | ❌ Wave 0                         |
| DISP-02 | Disposal atomically cancels N pending depreciation entries            | unit      | same                                                                                          | ❌ Wave 0                         |
| DISP-03 | Installment sale creates N ReceivableInstallments                     | unit      | same                                                                                          | ❌ Wave 0                         |
| DISP-04 | Transfer updates farmId + records history                             | unit      | `pnpm --filter backend test -- --testPathPattern="asset-farm-transfers.routes" --no-coverage` | ❌ Wave 0                         |
| DISP-04 | Transfer rejects cross-org destination farm                           | unit      | same                                                                                          | ❌ Wave 0                         |
| DISP-05 | Reconcile sets physicalStatus on inventory items                      | unit      | `pnpm --filter backend test -- --testPathPattern="asset-inventory.routes" --no-coverage`      | ❌ Wave 0                         |
| DISP-06 | Patrimony dashboard returns totalActiveValue, accumulatedDepreciation | unit      | `pnpm --filter backend test -- --testPathPattern="financial-dashboard.routes" --no-coverage`  | ❌ Wave 0 (extends existing spec) |

### Sampling Rate

- **Per task commit:** `pnpm --filter backend test -- --testPathPattern="asset-disposal|asset-farm-transfer|asset-inventory" --no-coverage`
- **Per wave merge:** `pnpm --filter backend test -- --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/asset-disposals/asset-disposals.routes.spec.ts` — covers DISP-01, DISP-02, DISP-03
- [ ] `apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.routes.spec.ts` — covers DISP-04
- [ ] `apps/backend/src/modules/asset-inventory/asset-inventory.routes.spec.ts` — covers DISP-05
- [ ] Migration file: `apps/backend/prisma/migrations/20260427100000_add_asset_disposal_models/migration.sql`
- [ ] Prisma schema additions: `AssetDisposal`, `AssetFarmTransfer`, `AssetInventory`, `AssetInventoryItem` models + `AssetDisposalType` enum + `Asset.disposalDate` field + `ReceivableCategory.ASSET_SALE` value

---

## Sources

### Primary (HIGH confidence)

- `apps/backend/prisma/schema.prisma` — Asset model, DepreciationEntry model, ReceivableCategory enum, AssetStatus enum, full schema audit
- `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.service.ts` — `prisma.$transaction` direct (no withRlsContext) pattern for asset + payable creation; `generateInstallments` usage; CP creation
- `apps/backend/src/modules/depreciation/depreciation-batch.service.ts` — batch eligibility query, `reversedAt` cancellation pattern, `reverseEntry` implementation
- `apps/backend/src/modules/receivables/receivables.service.ts` — `tx.receivable.create` pattern, installment creation, `withRlsContext` usage
- `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts` — month boundary helpers, aggregate query patterns
- `.planning/STATE.md` — locked decisions: "Asset disposal cancels pending depreciation atomically", `prisma.$transaction` direct for asset operations, Decimal-only arithmetic

### Secondary (MEDIUM confidence)

- `apps/backend/src/modules/stock-inventories/` — `StockInventory` DRAFT→COUNTING→RECONCILED flow, used as reference for `AssetInventory` state machine
- `apps/backend/src/modules/depreciation/depreciation.service.ts` — `DepreciationConfig` CRUD pattern, ExcelJS export pattern

### Tertiary (LOW confidence)

- None — all findings are verified against project source code

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified against project source; no new libraries required
- Architecture: HIGH — all patterns directly derived from Phase 19 (`asset-acquisitions`), Phase 17 (depreciation), and existing receivables module
- Pitfalls: HIGH — `withRlsContext` deadlock is documented in STATE.md as a resolved decision (Phase 19); `reversedAt` pattern directly from code; batch exclusion gap is directly observable in source

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase; no fast-moving external dependencies)
