import Decimal from 'decimal.js';
import { Money, generateInstallments } from '@protos-farm/shared';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  AssetDisposalError,
  DISPOSAL_TYPE_LABELS,
  type CreateDisposalInput,
  type DisposalOutput,
} from './asset-disposals.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ────────────────────────────────────────────────────────

function toOutput(disposal: TxClient, asset: TxClient): DisposalOutput {
  return {
    id: disposal.id as string,
    assetId: disposal.assetId as string,
    assetTag: (asset.assetTag ?? '') as string,
    assetName: (asset.name ?? '') as string,
    disposalType: disposal.disposalType,
    disposalTypeLabel:
      DISPOSAL_TYPE_LABELS[disposal.disposalType as keyof typeof DISPOSAL_TYPE_LABELS],
    disposalDate: (disposal.disposalDate as Date).toISOString(),
    saleValue: disposal.saleValue != null ? new Decimal(disposal.saleValue).toNumber() : null,
    netBookValue: new Decimal(disposal.netBookValue).toNumber(),
    gainLoss: new Decimal(disposal.gainLoss).toNumber(),
    buyerName: (disposal.buyerName as string) ?? null,
    motivation: (disposal.motivation as string) ?? null,
    documentUrl: (disposal.documentUrl as string) ?? null,
    receivableId: (disposal.receivableId as string) ?? null,
    installmentCount: disposal.installmentCount as number,
    cancelledDepreciationCount: disposal.cancelledDepreciationCount as number,
    createdBy: disposal.createdBy as string,
    createdAt: (disposal.createdAt as Date).toISOString(),
  };
}

// ─── Create Disposal (atomic) ────────────────────────────────────────

/**
 * Atomically:
 *   1. Validates asset status (404, 409)
 *   2. Validates input fields per disposalType
 *   3. Computes netBookValue from latest DepreciationEntry (or acquisitionValue)
 *   4. Computes gainLoss
 *   5. Bulk-cancels pending DepreciationEntry rows (sets reversedAt)
 *   6. Updates asset.status = 'ALIENADO'
 *   7. Creates AssetDisposal record
 *   8. For VENDA: creates Receivable + ReceivableInstallments
 *
 * CRITICAL: Uses prisma.$transaction directly (NOT withRlsContext) to avoid
 * nested RLS transactions causing deadlocks — follows same pattern as
 * asset-acquisitions.service.ts.
 */
export async function createDisposal(
  ctx: RlsContext,
  assetId: string,
  input: CreateDisposalInput,
  userId: string,
): Promise<DisposalOutput> {
  // ── Pre-transaction validation ───────────────────────────────────

  const { disposalType } = input;

  if (disposalType === 'VENDA') {
    if (!input.saleValue || input.saleValue <= 0) {
      throw new AssetDisposalError('Valor de venda obrigatorio para alienacao por venda', 400);
    }
    if (!input.buyerName) {
      throw new AssetDisposalError('Nome do comprador obrigatorio para venda', 400);
    }
    if (!input.dueDate) {
      throw new AssetDisposalError('Data de vencimento obrigatoria para venda', 400);
    }
  } else {
    if (!input.motivation) {
      throw new AssetDisposalError(
        `Motivacao obrigatoria para alienacao por ${DISPOSAL_TYPE_LABELS[disposalType]}`,
        400,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    // ── Guard: find asset ─────────────────────────────────────────
    const asset = await tx.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
      select: {
        id: true,
        assetTag: true,
        name: true,
        farmId: true,
        acquisitionValue: true,
        status: true,
      },
    });

    if (!asset) {
      throw new AssetDisposalError('Ativo nao encontrado', 404);
    }

    if (asset.status === 'ALIENADO') {
      throw new AssetDisposalError('Ativo ja foi alienado', 409);
    }

    // ── Compute netBookValue ──────────────────────────────────────
    const latestEntry = await tx.depreciationEntry.findFirst({
      where: { assetId, reversedAt: null },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      select: { closingBookValue: true },
    });

    const netBookValue = latestEntry
      ? new Decimal(latestEntry.closingBookValue)
      : new Decimal(asset.acquisitionValue ?? 0);

    // ── Compute gainLoss ─────────────────────────────────────────
    const gainLoss =
      disposalType === 'VENDA'
        ? new Decimal(input.saleValue!).minus(netBookValue)
        : netBookValue.negated();

    // ── Cancel pending depreciation entries ──────────────────────
    const { count: cancelledDepreciationCount } = await tx.depreciationEntry.updateMany({
      where: { assetId, reversedAt: null },
      data: {
        reversedAt: new Date(),
        notes: `Cancelado por alienacao em ${input.disposalDate}`,
      },
    });

    // ── Update asset status ───────────────────────────────────────
    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: 'ALIENADO' as never,
        disposalDate: new Date(input.disposalDate),
      },
    });

    // ── Determine installmentCount for disposal record ────────────
    const installmentCount = disposalType === 'VENDA' ? (input.installmentCount ?? 1) : 1;

    // ── Create AssetDisposal ──────────────────────────────────────
    const disposal = await tx.assetDisposal.create({
      data: {
        organizationId: ctx.organizationId,
        assetId,
        disposalType: disposalType as never,
        disposalDate: new Date(input.disposalDate),
        saleValue: input.saleValue != null ? String(input.saleValue) : undefined,
        netBookValue: netBookValue.toDecimalPlaces(2).toString(),
        gainLoss: gainLoss.toDecimalPlaces(2).toString(),
        buyerName: input.buyerName,
        motivation: input.motivation,
        documentUrl: input.documentUrl,
        cancelledDepreciationCount,
        createdBy: userId,
      },
    });

    // ── Create Receivable for VENDA ───────────────────────────────
    let receivableId: string | null = null;

    if (disposalType === 'VENDA' && input.saleValue && input.saleValue > 0 && input.dueDate) {
      const firstDueDateObj = new Date(input.firstDueDate ?? input.dueDate);

      const installments = generateInstallments(
        Money(input.saleValue),
        installmentCount,
        firstDueDateObj,
      );

      const receivable = await tx.receivable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: asset.farmId,
          clientName: input.buyerName!,
          category: 'ASSET_SALE' as never,
          description: `Venda ${asset.assetTag} — ${asset.name}`,
          totalAmount: new Decimal(input.saleValue).toDecimalPlaces(2).toString(),
          dueDate: installments[0].dueDate,
          installmentCount,
          originType: 'ASSET_DISPOSAL',
          originId: disposal.id,
        },
        select: { id: true },
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

    // ── Update AssetDisposal with receivableId ────────────────────
    if (receivableId) {
      await tx.assetDisposal.update({
        where: { id: disposal.id },
        data: { receivableId },
      });
    }

    return toOutput({ ...disposal, installmentCount, receivableId }, asset);
  });
}

// ─── Get Disposal ────────────────────────────────────────────────────

export async function getDisposal(ctx: RlsContext, assetId: string): Promise<DisposalOutput> {
  const disposal = await prisma.assetDisposal.findFirst({
    where: {
      assetId,
      organization: { id: ctx.organizationId },
    },
    include: {
      asset: { select: { assetTag: true, name: true } },
    },
  });

  if (!disposal) {
    throw new AssetDisposalError('Alienacao nao encontrada para este ativo', 404);
  }

  return toOutput({ ...disposal, installmentCount: 1 }, disposal.asset);
}
