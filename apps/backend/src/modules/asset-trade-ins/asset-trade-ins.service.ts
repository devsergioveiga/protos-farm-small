import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  AssetTradeInError,
  type CreateTradeInInput,
  type TradeInOutput,
} from './asset-trade-ins.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────

async function getNextAssetTag(tx: TxClient, organizationId: string): Promise<string> {
  const last = await tx.asset.findFirst({
    where: { organizationId, assetTag: { startsWith: 'PAT-' } },
    orderBy: { assetTag: 'desc' },
    select: { assetTag: true },
  });

  let lastNum = 0;
  if (last?.assetTag) {
    const num = parseInt(last.assetTag.replace('PAT-', ''), 10);
    if (!isNaN(num)) lastNum = num;
  }

  return `PAT-${String(lastNum + 1).padStart(5, '0')}`;
}

function toOutput(tradeIn: TxClient): TradeInOutput {
  return {
    id: tradeIn.id as string,
    organizationId: tradeIn.organizationId as string,
    farmId: tradeIn.farmId as string,
    farmName: (tradeIn.farm?.name ?? '') as string,
    tradedAssetId: tradeIn.tradedAssetId as string,
    tradedAssetTag: (tradeIn.tradedAsset?.assetTag ?? '') as string,
    tradedAssetName: (tradeIn.tradedAsset?.name ?? '') as string,
    newAssetId: tradeIn.newAssetId as string,
    newAssetTag: (tradeIn.newAsset?.assetTag ?? '') as string,
    newAssetName: (tradeIn.newAsset?.name ?? '') as string,
    tradeInDate: (tradeIn.tradeInDate as Date).toISOString(),
    tradedAssetValue: new Decimal(tradeIn.tradedAssetValue).toNumber(),
    newAssetValue: new Decimal(tradeIn.newAssetValue).toNumber(),
    netPayable: new Decimal(tradeIn.netPayable).toNumber(),
    gainLossOnTrade: new Decimal(tradeIn.gainLossOnTrade).toNumber(),
    payableId: (tradeIn.payableId as string) ?? null,
    supplierName: (tradeIn.supplierName as string) ?? null,
    notes: (tradeIn.notes as string) ?? null,
    createdBy: tradeIn.createdBy as string,
    createdAt: (tradeIn.createdAt as Date).toISOString(),
  };
}

// ─── Create Trade-in (atomic) ────────────────────────────────────────

/**
 * Atomically:
 *   1. Validates old asset (404, 409)
 *   2. Computes NBV from DepreciationEntry aggregate
 *   3. Calculates gainLoss = tradedAssetValue - NBV
 *   4. Calculates netPayable = newAssetValue - tradedAssetValue
 *   5. Disposes old asset (status ALIENADO + cancel pending depreciation)
 *   6. Creates new asset with sequential assetTag
 *   7. Creates AssetTradeIn record
 *   8. Creates CP (Payable) if netPayable > 0
 *
 * CRITICAL: Uses prisma.$transaction directly (NOT withRlsContext) to avoid
 * nested RLS transactions causing deadlocks — follows same pattern as
 * asset-acquisitions.service.ts and asset-disposals.service.ts.
 */
export async function createTradeIn(
  ctx: RlsContext,
  input: CreateTradeInInput,
): Promise<TradeInOutput> {
  // Basic validation
  if (!input.tradedAssetId || !input.farmId || !input.newAssetName) {
    throw new AssetTradeInError('Campos obrigatorios ausentes', 400);
  }

  if (!input.tradedAssetValue || input.tradedAssetValue <= 0) {
    throw new AssetTradeInError('Valor do ativo para troca deve ser positivo', 400);
  }

  if (!input.newAssetValue || input.newAssetValue <= 0) {
    throw new AssetTradeInError('Valor do novo ativo deve ser positivo', 400);
  }

  return prisma.$transaction(async (tx) => {
    // ── Guard: find old asset ─────────────────────────────────────
    const oldAsset = await tx.asset.findFirst({
      where: { id: input.tradedAssetId, organizationId: ctx.organizationId, deletedAt: null },
      select: {
        id: true,
        assetTag: true,
        name: true,
        farmId: true,
        acquisitionValue: true,
        status: true,
      },
    });

    if (!oldAsset) {
      throw new AssetTradeInError('Ativo nao encontrado', 404);
    }

    if (oldAsset.status !== 'ATIVO') {
      throw new AssetTradeInError('Ativo ja foi baixado ou esta em andamento', 409);
    }

    // ── Compute NBV ────────────────────────────────────────────────
    const depAgg = await tx.depreciationEntry.aggregate({
      where: { assetId: input.tradedAssetId, reversedAt: null },
      _sum: { depreciationAmount: true },
    });
    const nbv = new Decimal(oldAsset.acquisitionValue ?? 0).minus(
      new Decimal(depAgg._sum.depreciationAmount ?? 0),
    );

    // ── Calculate financials ───────────────────────────────────────
    const tradedValue = new Decimal(input.tradedAssetValue);
    const newValue = new Decimal(input.newAssetValue);
    const gainLoss = tradedValue.minus(nbv);
    const netPayableAmount = newValue.minus(tradedValue);

    // ── Dispose old asset ──────────────────────────────────────────
    await tx.asset.update({
      where: { id: input.tradedAssetId },
      data: { status: 'ALIENADO' as never },
    });

    await tx.depreciationEntry.updateMany({
      where: { assetId: input.tradedAssetId, reversedAt: null },
      data: { reversedAt: new Date() },
    });

    // ── Create new asset ───────────────────────────────────────────
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);
    const newAsset = await tx.asset.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        assetType: input.newAssetType as never,
        classification: input.newAssetClassification as never,
        name: input.newAssetName,
        assetTag,
        acquisitionDate: input.newAssetAcquisitionDate
          ? new Date(input.newAssetAcquisitionDate)
          : new Date(input.tradeInDate),
        acquisitionValue: newValue.toDecimalPlaces(2).toString(),
        status: 'ATIVO' as never,
        photoUrls: [],
        notes: `Adquirido via trade-in (ativo antigo: ${oldAsset.assetTag})`,
      },
      select: { id: true, assetTag: true, name: true },
    });

    // ── Create TradeIn record ──────────────────────────────────────
    const tradeIn = await tx.assetTradeIn.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        tradedAssetId: input.tradedAssetId,
        newAssetId: newAsset.id,
        tradeInDate: new Date(input.tradeInDate),
        tradedAssetValue: tradedValue.toDecimalPlaces(2).toString(),
        newAssetValue: newValue.toDecimalPlaces(2).toString(),
        netPayable: netPayableAmount.greaterThan(0)
          ? netPayableAmount.toDecimalPlaces(2).toString()
          : '0',
        gainLossOnTrade: gainLoss.toDecimalPlaces(2).toString(),
        supplierName: input.supplierName ?? null,
        notes: input.notes ?? null,
        createdBy: ctx.userId!,
      },
    });

    // ── Generate CP if netPayable > 0 ──────────────────────────────
    let payableId: string | null = null;

    if (netPayableAmount.greaterThan(0)) {
      const payable = await tx.payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: input.farmId,
          supplierName: input.supplierName ?? '',
          category: 'ASSET_ACQUISITION',
          description: `Trade-in ${newAsset.assetTag} — ${newAsset.name}`,
          totalAmount: netPayableAmount.toDecimalPlaces(2).toString(),
          dueDate: input.dueDate ? new Date(input.dueDate) : new Date(input.tradeInDate),
          originType: 'ASSET_TRADE_IN',
          originId: tradeIn.id,
        },
        select: { id: true },
      });

      payableId = payable.id;

      await tx.assetTradeIn.update({
        where: { id: tradeIn.id },
        data: { payableId },
      });
    }

    // ── Fetch farm name for output ─────────────────────────────────
    const farm = await tx.farm.findUnique({
      where: { id: input.farmId },
      select: { name: true },
    });

    return toOutput({
      ...tradeIn,
      payableId,
      farm: { name: farm?.name ?? '' },
      tradedAsset: { assetTag: oldAsset.assetTag, name: oldAsset.name },
      newAsset: { assetTag: newAsset.assetTag, name: newAsset.name },
    });
  });
}

// ─── List Trade-ins ───────────────────────────────────────────────────

export async function listTradeIns(
  ctx: RlsContext,
  farmId?: string,
): Promise<TradeInOutput[]> {
  const tradeIns = await prisma.assetTradeIn.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(farmId ? { farmId } : {}),
    },
    include: {
      farm: { select: { name: true } },
      tradedAsset: { select: { assetTag: true, name: true } },
      newAsset: { select: { assetTag: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return tradeIns.map(toOutput);
}

// ─── Get Trade-in ─────────────────────────────────────────────────────

export async function getTradeIn(ctx: RlsContext, id: string): Promise<TradeInOutput> {
  const tradeIn = await prisma.assetTradeIn.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      farm: { select: { name: true } },
      tradedAsset: { select: { assetTag: true, name: true } },
      newAsset: { select: { assetTag: true, name: true } },
    },
  });

  if (!tradeIn) {
    throw new AssetTradeInError('Trade-in nao encontrado', 404);
  }

  return toOutput(tradeIn);
}
