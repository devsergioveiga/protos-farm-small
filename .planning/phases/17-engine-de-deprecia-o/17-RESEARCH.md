# Phase 17: Engine de Depreciação — Research

**Researched:** 2026-03-19
**Domain:** Depreciation engine — schema extension, arithmetic precision, idempotent monthly batch job, cost-center allocation, depreciation report UI
**Confidence:** HIGH

## Summary

Phase 17 builds the depreciation engine on top of the Asset entity created in Phase 16. The schema is clean: `Asset` has `classification` (DEPRECIABLE_CPC27, NON_DEPRECIABLE_CPC27, FAIR_VALUE_CPC29, BEARER_PLANT_CPC27) and `status` (including EM_ANDAMENTO for WIP exclusion) — both locked decisions from STATE.md that are already in the database. Three new models are needed: `DepreciationConfig` (per-asset config: method, rates, life, residual), `DepreciationEntry` (one row per asset-per-period, unique constraint for idempotence), and `DepreciationRun` (batch tracking for safe retry). A `DepreciationEntryCCItem` model distributes each entry across cost centers.

The monthly batch job must be idempotent: the unique constraint on `(assetId, periodYear, periodMonth, track)` in `depreciation_entries` prevents duplicate rows. Re-execution simply finds existing rows (upsert or skip-on-conflict) and produces a `DepreciationRun` record that records which assets were processed. The batch is triggered by a `node-cron` job (already in the project at `shared/cron/`) with a Redis distributed lock (ioredis already installed) to prevent double-execution in multi-replica deployments. A manual POST endpoint allows the accountant to trigger on demand.

Pro-rata-die calculation in the first and last month requires only the acquisition date (first month) and disposal date (last month). The formula is `dailyAmount * daysInPeriod / daysInMonth`. All arithmetic uses `decimal.js` (already installed) and the project's `Money` value object from `@protos-farm/shared`. The cost-center reconciliation asserts `sum(ccItems.amount) === totalAmount` — same validation pattern as `validateCostCenterItems` in the shared package.

**Primary recommendation:** Build in 4 plans — Wave 0 (spec stubs), schema + engine (backend), batch job + manual trigger (backend), frontend depreciation config + report. Use the digest.cron.ts pattern for the scheduled job and the PayableCostCenterItem model as the reference for the CC distribution model.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                           | Research Support                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| DEPR-01 | Contador pode configurar método de depreciação por ativo (linear, horas-uso, produção, acelerada) com taxas RFB pré-configuradas e suporte a taxa fiscal vs gerencial | New DepreciationConfig model; DepreciationMethod enum; fiscal/managerial dual-track fields; RFB rate defaults per AssetType |
| DEPR-02 | Sistema calcula depreciação mensal automaticamente com pro rata die, parada em valor residual, relatório mensal e possibilidade de estorno/recálculo                  | node-cron job; unique constraint on (assetId, periodYear, periodMonth, track); reversal endpoint; decimal.js arithmetic     |
| CCPA-01 | Contador pode vincular cada ativo a centro de custo (fixo, rateio % ou dinâmico por horas-máquina) para depreciação e manutenção serem apropriadas corretamente       | Asset.costCenterId already in schema; new DepreciationEntryCCItem model; CostCenterAllocMode enum already exists            |
| CCPA-02 | Processamento mensal gera lançamentos detalhados por centro de custo com conciliação automática (soma CCs = total depreciado)                                         | validateCostCenterItems from @protos-farm/shared; assertion in batch service before commit                                  |

</phase_requirements>

---

## Standard Stack

### Core

| Library             | Version | Purpose                                      | Why Standard                                                                               |
| ------------------- | ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Prisma              | 7.x     | ORM + migrations for 3 new models            | Already in use; follows existing schema conventions                                        |
| decimal.js          | ^10.6.0 | All depreciation arithmetic                  | Already installed; STATE.md locked decision for all monetary math                          |
| @protos-farm/shared | current | Money value object + validateCostCenterItems | Already imported in receivables.service.ts; Money wraps decimal.js for consistent rounding |
| node-cron           | ^4.2.1  | Monthly batch trigger (1st of each month)    | Already installed; used in digest.cron.ts                                                  |
| ioredis             | ^5.9.3  | Distributed lock for cron idempotence        | Already installed; used in digest.cron.ts for lock key pattern                             |

### Supporting

| Library                         | Version | Purpose                         | When to Use                                        |
| ------------------------------- | ------- | ------------------------------- | -------------------------------------------------- |
| ExcelJS                         | ^4.4.0  | Depreciation report XLSX export | Already installed; used in multiple modules        |
| pdfkit                          | ^0.17.2 | Depreciation report PDF export  | Already installed; used in pesticide-prescriptions |
| Jest + @swc/jest                | current | Backend spec files              | All routes.spec.ts files                           |
| Vitest + @testing-library/react | current | Frontend specs                  | New page/component specs                           |

### Alternatives Considered

| Instead of                | Could Use                  | Tradeoff                                                                    |
| ------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| node-cron (existing)      | BullMQ scheduled jobs      | No BullMQ in project — node-cron + Redis lock is the established pattern    |
| DepreciationEntry per-row | Aggregate in Payable table | Separate model keeps depreciation history clean and independently queryable |
| Manual trigger only       | Auto cron only             | Both needed: auto for normal ops, manual for correction after config change |

**Installation:** No new packages needed. All required libraries already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/depreciation/
├── depreciation.routes.ts           # Config CRUD + manual run trigger + reversal + report
├── depreciation.routes.spec.ts      # Jest integration tests
├── depreciation.service.ts          # DepreciationConfig CRUD + report query
├── depreciation-engine.service.ts   # Core calculation: pro-rata-die, method dispatch, CC split
├── depreciation-batch.service.ts    # Batch: query eligible assets, call engine, persist entries + run record
├── depreciation.types.ts            # Input/output types + error class

apps/backend/src/shared/cron/
└── depreciation.cron.ts             # node-cron wrapper — calls depreciation-batch.service.ts

apps/frontend/src/pages/
└── DepreciationPage.tsx             # Monthly report: table + per-asset detail + export
apps/frontend/src/pages/
└── DepreciationPage.css

apps/frontend/src/components/depreciation/
├── DepreciationConfigModal.tsx      # Configure method/rates/life/residual per asset
├── DepreciationConfigModal.css
├── DepreciationReportTable.tsx      # Monthly report rows (asset | before | amount | after | CCs)
└── DepreciationRunBadge.tsx         # Shows last run status on page header

apps/frontend/src/hooks/
├── useDepreciationConfig.ts         # CRUD config per asset
├── useDepreciationRun.ts            # Trigger manual run, poll run status
└── useDepreciationReport.ts         # Fetch monthly report

apps/frontend/src/types/
└── depreciation.ts
```

### Pattern 1: Schema — Three New Models

**What:** `DepreciationConfig` (per asset config), `DepreciationEntry` (idempotent per-period row), `DepreciationRun` (batch audit trail), `DepreciationEntryCCItem` (CC distribution of each entry).
**When to use:** Every asset with `classification IN (DEPRECIABLE_CPC27, BEARER_PLANT_CPC27)` and `status != EM_ANDAMENTO`.

```prisma
// Source: STATE.md locked decisions + project Prisma conventions
enum DepreciationMethod {
  STRAIGHT_LINE       // Linear — valor depreciável / vida útil em meses
  HOURS_OF_USE        // Horas-uso — valor depreciável / horas totais * horas do período
  UNITS_OF_PRODUCTION // Produção — valor depreciável / unidades totais * unidades do período
  ACCELERATED         // Acelerada (fator × linear) — taxa dupla ou 150%
}

enum DepreciationTrack {
  FISCAL      // Taxa RFB — para IR/CSLL
  MANAGERIAL  // Taxa gerencial — para gestão interna
}

model DepreciationConfig {
  id                    String              @id @default(uuid())
  organizationId        String
  assetId               String              @unique  // one config per asset
  method                DepreciationMethod  @default(STRAIGHT_LINE)
  fiscalAnnualRate      Decimal?            @db.Decimal(7, 4)  // e.g. 0.2000 = 20%/year
  managerialAnnualRate  Decimal?            @db.Decimal(7, 4)
  usefulLifeMonths      Int?                // Used for STRAIGHT_LINE
  residualValue         Decimal             @db.Decimal(15, 2) @default(0)
  totalHours            Decimal?            @db.Decimal(12, 2) // For HOURS_OF_USE
  totalUnits            Decimal?            @db.Decimal(14, 2) // For UNITS_OF_PRODUCTION
  accelerationFactor    Decimal?            @db.Decimal(5, 2)  // Default 2.0 for double-declining
  activeTrack           DepreciationTrack   @default(FISCAL)
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  asset         Asset              @relation(fields: [assetId], references: [id])
  organization  Organization       @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@map("depreciation_configs")
}

model DepreciationEntry {
  id                  String              @id @default(uuid())
  organizationId      String
  assetId             String
  runId               String
  periodYear          Int
  periodMonth         Int                 // 1–12
  track               DepreciationTrack
  openingBookValue    Decimal             @db.Decimal(15, 2)
  depreciationAmount  Decimal             @db.Decimal(15, 2)
  closingBookValue    Decimal             @db.Decimal(15, 2)
  proRataDays         Int?                // null = full month; >0 = partial first/last month
  daysInMonth         Int
  reversedAt          DateTime?
  reversalEntryId     String?             // FK to the reversal entry
  notes               String?
  createdAt           DateTime            @default(now())

  asset        Asset                     @relation(fields: [assetId], references: [id])
  run          DepreciationRun           @relation(fields: [runId], references: [id])
  organization Organization              @relation(fields: [organizationId], references: [id])
  ccItems      DepreciationEntryCCItem[]

  @@unique([assetId, periodYear, periodMonth, track])  // Idempotence constraint
  @@index([organizationId, periodYear, periodMonth])
  @@index([assetId])
  @@map("depreciation_entries")
}

model DepreciationRun {
  id             String    @id @default(uuid())
  organizationId String
  periodYear     Int
  periodMonth    Int
  track          DepreciationTrack
  status         String    @default("PENDING")  // PENDING | COMPLETED | FAILED | PARTIAL
  totalAssets    Int       @default(0)
  processedCount Int       @default(0)
  skippedCount   Int       @default(0)
  totalAmount    Decimal   @db.Decimal(15, 2) @default(0)
  triggeredBy    String    // "cron" | userId
  startedAt      DateTime  @default(now())
  completedAt    DateTime?
  errorMessage   String?

  organization Organization       @relation(fields: [organizationId], references: [id])
  entries      DepreciationEntry[]

  @@index([organizationId, periodYear, periodMonth])
  @@map("depreciation_runs")
}

model DepreciationEntryCCItem {
  id              String   @id @default(uuid())
  entryId         String
  costCenterId    String
  farmId          String
  amount          Decimal  @db.Decimal(15, 2)
  percentage      Decimal  @db.Decimal(5, 2)

  entry      DepreciationEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  costCenter CostCenter        @relation(fields: [costCenterId], references: [id])

  @@index([entryId])
  @@map("depreciation_entry_cc_items")
}
```

### Pattern 2: Depreciation Engine — Core Arithmetic

**What:** Dispatch by `DepreciationMethod`, compute pro-rata-die, stop at residual value. All arithmetic via `decimal.js` directly (not Money which rounds to 2dp at `.toDecimal()`; keep higher precision internally until final storage).
**Source:** STATE.md locked decision — decimal.js for all depreciation math.

```typescript
// Source: project convention from packages/shared/src/types/money.ts + STATE.md
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

interface EngineInput {
  acquisitionValue: Decimal;
  residualValue: Decimal;
  openingBookValue: Decimal;
  config: {
    method: DepreciationMethod;
    fiscalAnnualRate?: Decimal;
    managerialAnnualRate?: Decimal;
    usefulLifeMonths?: number;
    accelerationFactor?: Decimal;
    totalHours?: Decimal;
    totalUnits?: Decimal;
    track: DepreciationTrack;
  };
  period: { year: number; month: number }; // 1-based month
  acquisitionDate: Date;
  disposalDate?: Date | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

function proRataDays(
  year: number,
  month: number,
  acquisitionDate: Date | null,
  disposalDate: Date | null,
): { days: number; totalDays: number } {
  const total = daysInMonth(year, month);
  let days = total;
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month - 1, total);

  // First month: depreciates from acquisition day to end of month
  if (acquisitionDate && acquisitionDate >= firstDay && acquisitionDate <= lastDay) {
    days = total - acquisitionDate.getDate() + 1;
  }

  // Last month: depreciates from start to disposal day
  if (disposalDate && disposalDate >= firstDay && disposalDate <= lastDay) {
    days = Math.min(days, disposalDate.getDate());
  }

  return { days, totalDays: total };
}

function computeDepreciation(input: EngineInput): Decimal {
  const depreciableValue = input.acquisitionValue.minus(input.residualValue);
  const { days, totalDays } = proRataDays(
    input.period.year,
    input.period.month,
    input.acquisitionDate,
    input.disposalDate ?? null,
  );

  const rate =
    input.config.track === 'FISCAL'
      ? input.config.fiscalAnnualRate
      : input.config.managerialAnnualRate;

  let monthlyAmount: Decimal;

  switch (input.config.method) {
    case 'STRAIGHT_LINE': {
      // If annual rate: monthly = value * (rate / 12)
      if (rate) {
        monthlyAmount = depreciableValue.times(rate.dividedBy(12));
      } else if (input.config.usefulLifeMonths) {
        monthlyAmount = depreciableValue.dividedBy(input.config.usefulLifeMonths);
      } else {
        throw new DepreciationError('STRAIGHT_LINE requires rate or usefulLifeMonths', 400);
      }
      break;
    }
    case 'ACCELERATED': {
      // Double-declining balance: rate applied to current book value
      const factor = input.config.accelerationFactor ?? new Decimal(2);
      if (!rate) throw new DepreciationError('ACCELERATED requires fiscalAnnualRate', 400);
      monthlyAmount = input.openingBookValue.times(rate.times(factor).dividedBy(12));
      break;
    }
    case 'HOURS_OF_USE': {
      // Caller must supply periodicHours for this period
      throw new DepreciationError(
        'HOURS_OF_USE requires periodicHours input — extend EngineInput',
        400,
      );
    }
    case 'UNITS_OF_PRODUCTION': {
      throw new DepreciationError(
        'UNITS_OF_PRODUCTION requires periodicUnits input — extend EngineInput',
        400,
      );
    }
  }

  // Pro-rata-die adjustment
  const proRated = monthlyAmount.times(days).dividedBy(totalDays);

  // Stop at residual: cannot depreciate below residualValue
  const remaining = input.openingBookValue.minus(input.residualValue);
  const final = Decimal.min(proRated, remaining);

  return final.toDecimalPlaces(2); // Store at 2dp per Decimal.ROUND_HALF_UP
}
```

### Pattern 3: Idempotent Batch with upsert-or-skip

**What:** `DepreciationRun` is created before processing. For each asset, attempt `create` on `depreciation_entries` with `skipDuplicates: false` — catch `P2002` unique violation and mark as skipped. This makes re-execution safe.

```typescript
// Source: project Prisma error handling pattern
import { Prisma } from '@prisma/client';

async function processAsset(
  tx: Prisma.TransactionClient,
  asset: AssetWithConfig,
  run: DepreciationRun,
  period: { year: number; month: number },
  track: DepreciationTrack,
): Promise<'created' | 'skipped' | 'excluded'> {
  // WIP exclusion — locked decision from STATE.md
  if (asset.status === 'EM_ANDAMENTO') return 'excluded';
  if (asset.classification === 'NON_DEPRECIABLE_CPC27') return 'excluded';
  if (asset.classification === 'FAIR_VALUE_CPC29') return 'excluded';
  if (!asset.depreciationConfig) return 'excluded';

  const amount = computeDepreciation({ ... });

  // Skip if fully depreciated
  if (amount.isZero()) return 'skipped';

  try {
    const entry = await tx.depreciationEntry.create({
      data: {
        organizationId: asset.organizationId,
        assetId: asset.id,
        runId: run.id,
        periodYear: period.year,
        periodMonth: period.month,
        track,
        openingBookValue: openingValue,
        depreciationAmount: amount,
        closingBookValue: openingValue.minus(amount),
        daysInMonth: daysInMonth(period.year, period.month),
      },
    });

    // CC distribution — reconciliation assertion
    await createCCItems(tx, entry, asset.depreciationConfig, amount);

    return 'created';
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'skipped';  // Already processed — idempotent re-run
    }
    throw err;
  }
}
```

### Pattern 4: Cost-Center Distribution and Reconciliation

**What:** Each `DepreciationEntry` is split across CC items proportionally. Sum of CC items must equal `depreciationAmount` exactly — rounding residual goes to the primary CC (same pattern as installment generation in shared package).

```typescript
// Source: pattern from packages/shared/src/utils/installments.ts (cent-residual to first item)
async function createCCItems(
  tx: Prisma.TransactionClient,
  entry: { id: string; depreciationAmount: Decimal },
  config: DepreciationConfig & {
    asset: { costCenterId: string; costCenterPercent: Decimal | null; farmId: string };
  },
  totalAmount: Decimal,
): Promise<void> {
  // Simple case: single CC (FIXED mode) — 100% to asset.costCenterId
  if (!config.asset.costCenterId) return; // No CC configured — skip

  const items = [
    {
      entryId: entry.id,
      costCenterId: config.asset.costCenterId,
      farmId: config.asset.farmId,
      amount: totalAmount,
      percentage: new Decimal(100),
    },
  ];

  // Multi-CC PERCENTAGE mode (future — CCPA-01 extension):
  // Validate sum(percentages) === 100 before computing amounts.
  // Apply cent-residual to first item for exact reconciliation.
  // For Phase 17, single CC per asset is sufficient.

  // Reconciliation assertion
  const sum = items.reduce((acc, i) => acc.plus(i.amount), new Decimal(0));
  if (!sum.equals(totalAmount)) {
    throw new DepreciationError('CC reconciliation failed: sum of items !== totalAmount', 500);
  }

  await tx.depreciationEntryCCItem.createMany({ data: items });
}
```

### Pattern 5: Cron Job — node-cron + Redis Distributed Lock

**What:** Runs on the 1st of each month at 02:00 BRT. Uses the same Redis `SET key 1 EX 300 NX` lock pattern as `digest.cron.ts` to prevent double-execution.

```typescript
// Source: apps/backend/src/shared/cron/digest.cron.ts (direct copy pattern)
import cron from 'node-cron';
import { redis } from '../../database/redis';
import { runDepreciationBatch } from '../../modules/depreciation/depreciation-batch.service';
import { logger } from '../utils/logger';

export function startDepreciationCron(): void {
  // Run at 02:00 on the 1st of every month, São Paulo timezone
  cron.schedule(
    '0 2 1 * *',
    async () => {
      const now = new Date();
      const lockKey = `cron:depreciation:${now.getFullYear()}-${now.getMonth() + 1}`;
      const locked = await redis.set(lockKey, '1', 'EX', 600, 'NX');
      if (!locked) {
        logger.info('Depreciation cron: another instance is running, skipping');
        return;
      }
      try {
        logger.info('Depreciation cron: starting batch');
        // Process the previous month (cron runs on 1st, calculates prior month)
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        await runDepreciationBatch({
          periodYear: prevYear,
          periodMonth: prevMonth,
          triggeredBy: 'cron',
        });
        logger.info('Depreciation cron: completed');
      } catch (err) {
        logger.error({ err }, 'Depreciation cron: failed');
      } finally {
        await redis.del(lockKey);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
```

### Pattern 6: Manual Trigger Endpoint

**What:** `POST /api/org/:orgId/depreciation/run` allows accountant to trigger for a specific month. Returns `DepreciationRun` with counts. Rejects if a run already exists for that period (unless `force: true`).

```typescript
// Source: project module pattern — Express 5 + authenticate + requirePermission
router.post(
  '/depreciation/run',
  authenticate,
  requirePermission('assets', 'update'),
  async (req, res) => {
    const { periodYear, periodMonth, track = 'FISCAL', force = false } = req.body;
    const run = await runDepreciationBatch({
      organizationId: req.user.organizationId,
      periodYear,
      periodMonth,
      track,
      triggeredBy: req.user.userId,
      force,
    });
    res.status(202).json(run);
  },
);
```

### Pattern 7: Reversal Endpoint

**What:** `POST /api/org/:orgId/depreciation/entries/:id/reverse` creates a correcting entry that negates the original. Sets `reversedAt` on the original. Atomic transaction.

### Pattern 8: RFB Default Rates (Brazilian Tax Authority)

**What:** Standard RFB depreciation rates to pre-populate when creating `DepreciationConfig`. These are authoritative values from Brazilian tax law (IN RFB 1.700/2017 and Ato Declaratório 30/2002).

| AssetType   | RFB Annual Rate | Useful Life     |
| ----------- | --------------- | --------------- |
| MAQUINA     | 10%             | 10 years        |
| VEICULO     | 20%             | 5 years         |
| IMPLEMENTO  | 10%             | 10 years        |
| BENFEITORIA | 4%              | 25 years        |
| TERRA       | 0%              | Non-depreciable |

These rates ship as constants in the frontend `DepreciationConfigModal` as default values when the user opens the config for an asset. The planner should include a `DEFAULT_RFB_RATES` constant in `depreciation.types.ts`.

### Anti-Patterns to Avoid

- **Native JS float for depreciation math:** Always use `decimal.js`. `0.1 + 0.2 !== 0.3` in IEEE 754 floating point. Any single float operation in a depreciation calculation is a data integrity bug.
- **Running batch inside a single Prisma transaction spanning all assets:** Creates a very long transaction that locks rows and risks timeout. Process each asset in its own transaction; the `DepreciationRun` record tracks overall status.
- **Assuming `openingBookValue = acquisitionValue`:** After the first month, `openingBookValue = previousEntry.closingBookValue`. The engine must query the latest `DepreciationEntry` for the asset to get the current book value. For the first entry, use `acquisitionValue`.
- **Ignoring `status === EM_ANDAMENTO`:** WIP assets must be excluded from the batch. Locked decision in STATE.md.
- **Storing `depreciationAmount` as negative number:** Store as positive amount. The accounting sign is implicit: depreciation reduces asset book value. Negative amounts create ambiguity in report queries.
- **Creating `DepreciationEntryCCItem` before asserting reconciliation:** Always validate `sum(items) === totalAmount` before the `createMany` call. A reconciliation failure after partial write is much harder to correct.
- **Pro-rata-die by calendar days only:** The formula uses `daysInPeriod / daysInMonth` where `daysInMonth` is the actual number of days in that specific month (28/29/30/31). Use `new Date(year, month, 0).getDate()`.

---

## Don't Hand-Roll

| Problem                      | Don't Build                 | Use Instead                                                    | Why                                                         |
| ---------------------------- | --------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Decimal arithmetic           | `number` math               | `decimal.js` (already installed)                               | IEEE 754 rounding errors in monetary calculations           |
| CC reconciliation validation | Ad-hoc sum check            | Pattern from `validateCostCenterItems` in shared package       | Established pattern; cent-residual handling already solved  |
| Cron distributed lock        | DB-based mutex              | Redis `SET key 1 EX N NX` (ioredis, pattern in digest.cron.ts) | Already in project; prevents multi-replica double-execution |
| Idempotence on re-run        | Pre-check query then insert | Prisma unique constraint + catch P2002                         | Race-condition safe; no extra round trip                    |
| Book value lookup            | Recomputing from scratch    | Query latest `DepreciationEntry.closingBookValue`              | Single source of truth; avoids recomputing full history     |
| XLSX export for report       | Custom CSV builder          | ExcelJS (already installed, same pattern as other reports)     | Handles column formatting, number cells, dates correctly    |

---

## Common Pitfalls

### Pitfall 1: openingBookValue = acquisitionValue on Every Run

**What goes wrong:** All depreciation entries show the same amount every month — the book value is never reduced.
**Why it happens:** Not querying the latest `DepreciationEntry` for the asset before computing the new period.
**How to avoid:** In `depreciation-engine.service.ts`, always `findFirst({ where: { assetId, track }, orderBy: { periodYear: 'desc', periodMonth: 'desc' } })` to get the previous entry. If null, `openingBookValue = acquisitionValue`.
**Warning signs:** `closingBookValue` equals `acquisitionValue - depreciationAmount` in every entry regardless of period.

### Pitfall 2: Batch Transaction Timeout

**What goes wrong:** Processing 500 assets in a single Prisma transaction hits the PostgreSQL statement timeout.
**Why it happens:** `prisma.$transaction(async (tx) => { /* 500 assets */ })` holds locks and takes minutes.
**How to avoid:** Process each asset in its own `prisma.$transaction`. The `DepreciationRun` record is created first (outside transactions), then updated via `PATCH` after each asset batch. A failed asset does not roll back the others.
**Warning signs:** Timeout errors in logs; partial `DepreciationRun` with `status: PARTIAL`.

### Pitfall 3: Duplicating Entries on Cron Retry

**What goes wrong:** Cron fires at 02:00, dies at 02:03 mid-batch, retries at 02:05. Assets processed in the first run get duplicate entries.
**Why it happens:** No idempotence mechanism.
**How to avoid:** `@@unique([assetId, periodYear, periodMonth, track])` on `depreciation_entries`. Catch `P2002` and mark as `skipped`. The `DepreciationRun` records which assets were new vs skipped.
**Warning signs:** Unique constraint violations in batch service; always catch and handle `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'`.

### Pitfall 4: Depreciating Below Residual Value

**What goes wrong:** Asset with `residualValue = 5000` gets depreciated to 4800 — negative net book value effectively.
**Why it happens:** Not clamping `depreciationAmount` to `max(0, openingBookValue - residualValue)`.
**How to avoid:** `const remaining = openingBookValue.minus(residualValue); const final = Decimal.min(proRated, remaining);`. Also stop computing if `remaining.isZero()` — skip with `skippedCount++`.
**Warning signs:** `closingBookValue < residualValue` in any entry.

### Pitfall 5: Pro-Rata-Die in Wrong Month

**What goes wrong:** Asset acquired on 2025-01-15 gets full-month depreciation in January (31 days) instead of 17 days.
**Why it happens:** Not checking whether `acquisitionDate` falls in the current period.
**How to avoid:** In `proRataDays`, check `acquisitionDate >= firstDayOfPeriod && acquisitionDate <= lastDayOfPeriod`. Only then reduce from full month.
**Warning signs:** January entry for a mid-month acquisition shows same `depreciationAmount` as February.

### Pitfall 6: Missing `DepreciationConfig` → Silent Skip vs 400 Error

**What goes wrong:** Accountant triggers manual run, some assets have no config, the run completes with 0 entries for those assets but no warning is shown.
**Why it happens:** The batch silently skips assets without `DepreciationConfig`.
**How to avoid:** The `DepreciationRun` response includes `skippedCount` and a `skippedAssets` array (assetId + reason). The frontend shows a warning if `skippedCount > 0`.
**Warning signs:** `processedCount + skippedCount + excludedCount !== totalAssets`.

### Pitfall 7: costCenterId is null on Asset

**What goes wrong:** Depreciation entry is created but `DepreciationEntryCCItem` is empty — CC report shows nothing.
**Why it happens:** Asset was created without assigning a cost center.
**How to avoid:** Batch skips CC creation (not an error) but includes a warning in `DepreciationRun.notes`. Frontend shows warning for assets with missing CC in the report. CCPA-01 requires CC assignment, but the engine should not fail hard — it degrades gracefully.
**Warning signs:** `DepreciationEntry` exists with no associated `DepreciationEntryCCItem` rows.

---

## Code Examples

### Pro-Rata-Die Calculation

```typescript
// Source: Brazilian accounting standard (in days, not business days)
function daysInMonth(year: number, month: number): number {
  // month is 1-based; new Date(year, month, 0) gives last day of prior month = current month's day count
  return new Date(year, month, 0).getDate();
}

function getProRataDays(
  periodYear: number,
  periodMonth: number,
  acquisitionDate: Date | null,
  disposalDate: Date | null,
): number {
  const total = daysInMonth(periodYear, periodMonth);
  let days = total;
  const firstDay = new Date(periodYear, periodMonth - 1, 1);
  const lastDay = new Date(periodYear, periodMonth - 1, total);

  if (acquisitionDate && acquisitionDate >= firstDay && acquisitionDate <= lastDay) {
    // Acquisition in this period: start from acquisition day
    days = total - acquisitionDate.getDate() + 1;
  }
  if (disposalDate && disposalDate >= firstDay && disposalDate <= lastDay) {
    // Disposal in this period: end at disposal day
    days = Math.min(days, disposalDate.getDate());
  }
  return days;
}
```

### Straight-Line Monthly Amount

```typescript
// Source: STATE.md + Brazilian accounting norm
import Decimal from 'decimal.js';

function straightLine(
  depreciableValue: Decimal, // acquisitionValue - residualValue
  annualRate: Decimal, // e.g. 0.1000 for 10%
  proRataDays: number,
  daysInMonth: number,
): Decimal {
  const monthly = depreciableValue.times(annualRate).dividedBy(12);
  return monthly.times(proRataDays).dividedBy(daysInMonth).toDecimalPlaces(2);
}
```

### Batch Entry Query (Eligible Assets)

```typescript
// Source: project RLS pattern — all queries scoped to organizationId
async function fetchEligibleAssets(organizationId: string) {
  return prisma.asset.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: { not: 'EM_ANDAMENTO' }, // WIP excluded — STATE.md locked decision
      classification: {
        in: ['DEPRECIABLE_CPC27', 'BEARER_PLANT_CPC27'], // Only depreciable classes
      },
    },
    include: {
      depreciationConfig: true,
      farm: { select: { id: true } },
    },
  });
}
```

### Frontend: DepreciationConfigModal — RFB Defaults

```typescript
// Source: project pattern — type-based defaults in modal
const DEFAULT_RFB_RATES: Record<AssetType, { annualRate: number; usefulLifeMonths: number }> = {
  MAQUINA: { annualRate: 0.1, usefulLifeMonths: 120 },
  VEICULO: { annualRate: 0.2, usefulLifeMonths: 60 },
  IMPLEMENTO: { annualRate: 0.1, usefulLifeMonths: 120 },
  BENFEITORIA: { annualRate: 0.04, usefulLifeMonths: 300 },
  TERRA: { annualRate: 0, usefulLifeMonths: 0 },
};

// On modal open: prefill from config if exists, else use RFB defaults by asset.assetType
const defaults = config ?? DEFAULT_RFB_RATES[asset.assetType];
```

---

## State of the Art

| Old Approach                     | Current Approach                                              | When Changed    | Impact                                                        |
| -------------------------------- | ------------------------------------------------------------- | --------------- | ------------------------------------------------------------- |
| Single depreciation track        | Dual track: FISCAL (RFB) + MANAGERIAL                         | Phase 17 design | Accountant can compare tax vs management view side by side    |
| Batch per organization in one tx | Per-asset transactions with DepreciationRun aggregate         | Phase 17 design | No batch timeout; partial failures don't roll back everything |
| isDepreciable boolean (rejected) | AssetClassification enum with 4 values (in DB since Phase 16) | Phase 16 schema | Engine filters on enum; no boolean logic needed               |

**Deprecated/outdated:**

- None — Phase 17 is greenfield on top of Phase 16 foundation.

---

## Open Questions

1. **HOURS_OF_USE method: how does the period's hours get recorded?**
   - What we know: `MeterReading` already exists with `HOURMETER` type. The engine needs hours consumed this period = currentReading - previousReading.
   - What's unclear: Is this always derivable from `MeterReading`, or does the accountant manually input period hours?
   - Recommendation: Query `MeterReading` for the period range. If no reading exists for the period, batch skips the asset with reason "no meter reading for period" and logs a warning. The accountant should be notified.

2. **UNITS_OF_PRODUCTION: what unit source is used for agriculture?**
   - What we know: Harvest tonnage exists in grain/coffee/orange harvest modules. Which harvest table maps to which asset?
   - What's unclear: No explicit `assetId` FK on harvest tables — linking harvest production to a specific asset is not established.
   - Recommendation: For Phase 17, implement UNITS_OF_PRODUCTION as a config-only stub (store method in DB) but skip in batch with reason "requires manual periodic units input." Full implementation deferred to a future phase when asset-harvest linking exists.

3. **Dual-track reporting: should one DepreciationRun process both FISCAL and MANAGERIAL tracks, or separate runs?**
   - What we know: `DepreciationRun` has a `track` field — implies separate runs per track.
   - What's unclear: Whether the monthly cron should fire two separate runs or one combined run.
   - Recommendation: Two separate runs (one per track) triggered sequentially by the cron. This keeps the unique constraint `(assetId, periodYear, periodMonth, track)` clean and allows the accountant to run only one track manually if needed.

4. **Confirm customer tax regime before Phase 22**
   - STATE.md notes: "Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido before Phase 22 (accelerated depreciation dual-track)."
   - Impact on Phase 17: ACCELERATED method (double-declining) is implemented but RFB rate defaults assume Lucro Real rates. Simples Nacional entities typically use the same physical rates. No blocking issue for Phase 17.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | Jest + @swc/jest (backend), Vitest + @testing-library/react (frontend) |
| Config file        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`        |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern depreciation`       |
| Full suite command | `cd apps/backend && pnpm test`                                         |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                         | Test Type        | Automated Command                                    | File Exists? |
| ------- | ---------------------------------------------------------------- | ---------------- | ---------------------------------------------------- | ------------ |
| DEPR-01 | POST config creates DepreciationConfig for asset                 | unit/integration | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| DEPR-01 | GET config returns config with RFB default hint by assetType     | unit/integration | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| DEPR-01 | PATCH config updates method/rates/life/residual                  | unit/integration | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| DEPR-02 | Engine: straight-line full month produces correct amount         | unit             | `pnpm test -- --testPathPattern depreciation-engine` | ❌ Wave 0    |
| DEPR-02 | Engine: pro-rata first month (mid-month acquisition)             | unit             | `pnpm test -- --testPathPattern depreciation-engine` | ❌ Wave 0    |
| DEPR-02 | Engine: stops at residual value (does not over-depreciate)       | unit             | `pnpm test -- --testPathPattern depreciation-engine` | ❌ Wave 0    |
| DEPR-02 | Engine: EM_ANDAMENTO asset excluded from batch                   | unit             | `pnpm test -- --testPathPattern depreciation-engine` | ❌ Wave 0    |
| DEPR-02 | Batch: idempotent re-run does not duplicate entries (P2002 skip) | integration      | `pnpm test -- --testPathPattern depreciation-batch`  | ❌ Wave 0    |
| DEPR-02 | POST /run triggers batch and returns DepreciationRun record      | integration      | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| DEPR-02 | POST /entries/:id/reverse creates reversal entry, marks original | integration      | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| DEPR-02 | GET /report returns monthly entries with before/after values     | integration      | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| CCPA-01 | POST config with costCenterId stores CC allocation on asset      | integration      | `pnpm test -- --testPathPattern depreciation.routes` | ❌ Wave 0    |
| CCPA-02 | Batch creates DepreciationEntryCCItem records for each entry     | integration      | `pnpm test -- --testPathPattern depreciation-batch`  | ❌ Wave 0    |
| CCPA-02 | Reconciliation: sum(ccItems.amount) === entry.depreciationAmount | unit             | `pnpm test -- --testPathPattern depreciation-engine` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern "depreciation"`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/depreciation/depreciation.routes.spec.ts` — covers DEPR-01, DEPR-02, CCPA-01, CCPA-02 route-level behaviors
- [ ] `apps/backend/src/modules/depreciation/depreciation-engine.spec.ts` — pure unit tests for arithmetic (no DB, no supertest)
- [ ] `apps/backend/src/modules/depreciation/depreciation-batch.spec.ts` — integration tests for batch with test DB

---

## Sources

### Primary (HIGH confidence)

- Project codebase — `apps/backend/prisma/schema.prisma` (existing Asset, CostCenter, PayableCostCenterItem models)
- Project codebase — `apps/backend/src/shared/cron/digest.cron.ts` (node-cron + Redis lock pattern)
- Project codebase — `packages/shared/src/types/money.ts` (Money value object, decimal.js config)
- Project codebase — `packages/shared/src/utils/installments.ts` (validateCostCenterItems, cent-residual pattern)
- Project codebase — `apps/backend/src/modules/receivables/receivables.service.ts` (Money.fromPrismaDecimal usage pattern)
- `.planning/STATE.md` — locked architectural decisions: decimal-only, EM_ANDAMENTO exclusion, dual track, unique constraint idempotence, atomic disposal
- `.planning/REQUIREMENTS.md` — DEPR-01, DEPR-02, CCPA-01, CCPA-02 descriptions

### Secondary (MEDIUM confidence)

- Brazilian tax law — IN RFB 1.700/2017 and Ato Declaratório 30/2002 for RFB depreciation rates (standard public domain rates, not verified against current official text in this session)
- `.planning/phases/16-cadastro-de-ativos/16-RESEARCH.md` — Phase 16 architecture decisions that Phase 17 builds on

### Tertiary (LOW confidence)

- None — all critical findings verified against project codebase and STATE.md.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed and in use; cron + Redis pattern already established
- Architecture: HIGH — directly derived from existing project patterns and locked STATE.md decisions
- Depreciation arithmetic: HIGH — formulas are standard accounting, not framework-dependent; verified against project decimal.js setup
- RFB rates: MEDIUM — standard values from Brazilian tax law; should be verified against latest IN RFB before shipping to accountant users
- Pitfalls: HIGH — derived from known Prisma P2002 handling, decimal precision issues, and STATE.md locked decisions

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain — no fast-moving libraries; RFB rates stable)
