import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { computeDepreciation } from './depreciation-engine.service';
import {
  DepreciationError,
  type RunDepreciationInput,
  type RlsContext,
} from './depreciation.types';

// ─── Types ────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type TxClient = any;

// ─── Internal helpers ─────────────────────────────────────────────────

async function _processOrganization(
  orgId: string,
  input: RunDepreciationInput,
): Promise<{
  id: string;
  status: string;
  processedCount: number;
  skippedCount: number;
  totalAmount: Decimal;
}> {
  const { periodYear, periodMonth, track = 'FISCAL', triggeredBy, force = false } = input;

  // Check for existing completed run for this org+period+track
  const existingRun = await prisma.depreciationRun.findFirst({
    where: {
      organizationId: orgId,
      periodYear,
      periodMonth,
      track: track as never,
      status: 'COMPLETED',
    },
  });

  if (existingRun && !force) {
    throw new DepreciationError('Depreciacao ja executada para este periodo', 409);
  }

  // Create DepreciationRun with PENDING status
  const run = await prisma.depreciationRun.create({
    data: {
      organizationId: orgId,
      periodYear,
      periodMonth,
      track: track as never,
      status: 'PENDING',
      triggeredBy,
    },
  });

  // Fetch eligible assets — excludes EM_ANDAMENTO and non-depreciable
  const assets = await prisma.asset.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { notIn: ['EM_ANDAMENTO', 'ALIENADO'] as never[] },
      classification: { in: ['DEPRECIABLE_CPC27', 'BEARER_PLANT_CPC27'] as never[] },
    },
    include: {
      depreciationConfig: true,
      farm: { select: { id: true } },
    },
  });

  // Update run with totalAssets count
  await prisma.depreciationRun.update({
    where: { id: run.id },
    data: { totalAssets: assets.length },
  });

  let processedCount = 0;
  let skippedCount = 0;
  let totalAmount = new Decimal(0);

  // Process each asset in an individual transaction
  for (const asset of assets) {
    try {
      // Skip if no depreciation config
      if (!asset.depreciationConfig) {
        skippedCount++;
        continue;
      }

      // Determine openingBookValue from latest entry or acquisitionValue
      const latestEntry = await prisma.depreciationEntry.findFirst({
        where: {
          assetId: asset.id,
          track: track as never,
          reversedAt: null,
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      });

      // acquisitionValue and acquisitionDate can be null in schema — skip if missing
      if (!asset.acquisitionValue || !asset.acquisitionDate) {
        skippedCount++;
        continue;
      }

      const openingBookValue = latestEntry
        ? new Decimal(latestEntry.closingBookValue)
        : new Decimal(asset.acquisitionValue);

      const cfg = asset.depreciationConfig;

      // Call compute engine
      const result = computeDepreciation({
        acquisitionValue: new Decimal(asset.acquisitionValue),
        residualValue: new Decimal(cfg.residualValue),
        openingBookValue,
        config: {
          method: cfg.method as
            | 'STRAIGHT_LINE'
            | 'HOURS_OF_USE'
            | 'UNITS_OF_PRODUCTION'
            | 'ACCELERATED',
          fiscalAnnualRate: cfg.fiscalAnnualRate ? new Decimal(cfg.fiscalAnnualRate) : undefined,
          managerialAnnualRate: cfg.managerialAnnualRate
            ? new Decimal(cfg.managerialAnnualRate)
            : undefined,
          usefulLifeMonths: cfg.usefulLifeMonths ?? undefined,
          accelerationFactor: cfg.accelerationFactor
            ? new Decimal(cfg.accelerationFactor)
            : undefined,
          totalHours: cfg.totalHours ? new Decimal(cfg.totalHours) : undefined,
          totalUnits: cfg.totalUnits ? new Decimal(cfg.totalUnits) : undefined,
          track: track as 'FISCAL' | 'MANAGERIAL',
        },
        period: { year: periodYear, month: periodMonth },
        acquisitionDate: asset.acquisitionDate,
        disposalDate: null,
      });

      if (result.skipped) {
        skippedCount++;
        continue;
      }

      // Create entry in individual transaction (NOT one big transaction — avoids timeout)
      await prisma.$transaction(async (tx: TxClient) => {
        const entry = await tx.depreciationEntry.create({
          data: {
            organizationId: orgId,
            assetId: asset.id,
            runId: run.id,
            periodYear,
            periodMonth,
            track: track as never,
            openingBookValue: openingBookValue.toDecimalPlaces(2),
            depreciationAmount: result.depreciationAmount.toDecimalPlaces(2),
            closingBookValue: result.closingBookValue.toDecimalPlaces(2),
            proRataDays: result.proRataDays,
            daysInMonth: result.daysInMonth,
          },
        });

        // Create CC distribution if asset has a costCenter
        if (asset.costCenterId && asset.farm) {
          const ccAmount = result.depreciationAmount.toDecimalPlaces(2);

          // Reconciliation assertion: single CC = 100% = full amount
          const reconciled = ccAmount.equals(result.depreciationAmount.toDecimalPlaces(2));
          if (!reconciled) {
            throw new DepreciationError(
              `Reconciliação CC falhou para ativo ${asset.id}: soma ${ccAmount} != ${result.depreciationAmount}`,
              500,
            );
          }

          await tx.depreciationEntryCCItem.createMany({
            data: [
              {
                entryId: entry.id,
                costCenterId: asset.costCenterId,
                farmId: asset.farm.id,
                amount: ccAmount,
                percentage: new Decimal('100.00'),
              },
            ],
          });
        }

        return entry;
      });

      processedCount++;
      totalAmount = totalAmount.plus(result.depreciationAmount);
    } catch (err: unknown) {
      // Catch Prisma P2002 (unique constraint) — idempotent re-run
      if (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        skippedCount++;
        continue;
      }
      // Re-throw other errors
      throw err;
    }
  }

  // Update run with final counts
  const finalStatus = skippedCount > 0 && processedCount === 0 ? 'PARTIAL' : 'COMPLETED';
  const updatedRun = await prisma.depreciationRun.update({
    where: { id: run.id },
    data: {
      status: finalStatus,
      processedCount,
      skippedCount,
      totalAmount: totalAmount.toDecimalPlaces(2),
      completedAt: new Date(),
    },
  });

  return {
    id: updatedRun.id,
    status: updatedRun.status,
    processedCount: updatedRun.processedCount,
    skippedCount: updatedRun.skippedCount,
    totalAmount: new Decimal(updatedRun.totalAmount),
  };
}

// ─── Public API ────────────────────────────────────────────────────────

export async function runDepreciationBatch(input: RunDepreciationInput) {
  const { organizationId } = input;

  // Cron mode: empty organizationId — enumerate all organizations
  if (!organizationId) {
    const orgs = await prisma.organization.findMany({ select: { id: true } });

    let totalProcessed = 0;
    let totalSkipped = 0;
    let grandTotal = new Decimal(0);
    let lastRun: {
      id: string;
      status: string;
      processedCount: number;
      skippedCount: number;
      totalAmount: Decimal;
    } | null = null;

    for (const org of orgs) {
      try {
        const result = await _processOrganization(org.id, { ...input, organizationId: org.id });
        totalProcessed += result.processedCount;
        totalSkipped += result.skippedCount;
        grandTotal = grandTotal.plus(result.totalAmount);
        lastRun = result;
      } catch (err) {
        // Skip DepreciationError 409 (already run) and continue
        if (err instanceof DepreciationError && err.statusCode === 409) {
          continue;
        }
        throw err;
      }
    }

    return (
      lastRun ?? {
        id: 'cron-aggregate',
        status: 'COMPLETED',
        processedCount: totalProcessed,
        skippedCount: totalSkipped,
        totalAmount: grandTotal,
      }
    );
  }

  return _processOrganization(organizationId, input);
}

export async function reverseEntry(rls: RlsContext, entryId: string) {
  // Find entry and verify org match
  const entry = await prisma.depreciationEntry.findFirst({
    where: { id: entryId, organizationId: rls.organizationId },
  });

  if (!entry) {
    throw new DepreciationError('Lançamento não encontrado', 404);
  }

  if (entry.reversedAt !== null) {
    throw new DepreciationError('Lancamento ja estornado', 400);
  }

  const reversalEntry = await prisma.$transaction(async (tx: TxClient) => {
    // Create reversal entry with negative amounts
    const reversal = await tx.depreciationEntry.create({
      data: {
        organizationId: rls.organizationId,
        assetId: entry.assetId,
        runId: entry.runId,
        periodYear: entry.periodYear,
        periodMonth: entry.periodMonth,
        track: entry.track,
        openingBookValue: new Decimal(entry.closingBookValue).toDecimalPlaces(2),
        depreciationAmount: new Decimal(entry.depreciationAmount).negated().toDecimalPlaces(2),
        closingBookValue: new Decimal(entry.openingBookValue).toDecimalPlaces(2),
        proRataDays: entry.proRataDays,
        daysInMonth: entry.daysInMonth,
        notes: `Estorno do lancamento ${entryId}`,
      },
    });

    // Mark original entry as reversed
    await tx.depreciationEntry.update({
      where: { id: entryId },
      data: {
        reversedAt: new Date(),
        reversalEntryId: reversal.id,
      },
    });

    // Delete CC items of original entry
    await tx.depreciationEntryCCItem.deleteMany({
      where: { entryId },
    });

    return reversal;
  });

  return reversalEntry;
}
