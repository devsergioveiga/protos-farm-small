import Decimal from 'decimal.js';
import { Money, generateInstallments } from '@protos-farm/shared';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  AssetLeasingError,
  LEASING_STATUS_LABELS,
  type CreateLeasingInput,
  type LeasingOutput,
} from './asset-leasings.types';

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

function monthsBetween(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function formatLeasing(leasing: {
  id: string;
  organizationId: string;
  farmId: string;
  farm: { name: string };
  rouAssetId: string;
  rouAsset: { assetTag: string; name: string };
  lessorName: string;
  lessorDocument: string | null;
  contractNumber: string | null;
  contractDate: Date;
  startDate: Date;
  endDate: Date;
  totalContractValue: Decimal;
  monthlyInstallment: Decimal;
  installmentCount: number;
  purchaseOptionValue: Decimal | null;
  purchaseOptionDate: Date | null;
  hasPurchaseOption: boolean;
  status: string;
  payableId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}): LeasingOutput {
  return {
    id: leasing.id,
    organizationId: leasing.organizationId,
    farmId: leasing.farmId,
    farmName: leasing.farm.name,
    rouAssetId: leasing.rouAssetId,
    rouAssetTag: leasing.rouAsset.assetTag,
    rouAssetName: leasing.rouAsset.name,
    lessorName: leasing.lessorName,
    lessorDocument: leasing.lessorDocument,
    contractNumber: leasing.contractNumber,
    contractDate: leasing.contractDate.toISOString().split('T')[0],
    startDate: leasing.startDate.toISOString().split('T')[0],
    endDate: leasing.endDate.toISOString().split('T')[0],
    totalContractValue: Number(leasing.totalContractValue),
    monthlyInstallment: Number(leasing.monthlyInstallment),
    installmentCount: leasing.installmentCount,
    purchaseOptionValue:
      leasing.purchaseOptionValue !== null ? Number(leasing.purchaseOptionValue) : null,
    purchaseOptionDate: leasing.purchaseOptionDate
      ? leasing.purchaseOptionDate.toISOString().split('T')[0]
      : null,
    hasPurchaseOption: leasing.hasPurchaseOption,
    status: leasing.status as LeasingOutput['status'],
    statusLabel:
      LEASING_STATUS_LABELS[leasing.status as keyof typeof LEASING_STATUS_LABELS] ?? leasing.status,
    payableId: leasing.payableId,
    notes: leasing.notes,
    createdBy: leasing.createdBy,
    createdAt: leasing.createdAt.toISOString(),
  };
}

const LEASING_INCLUDE = {
  farm: { select: { name: true } },
  rouAsset: { select: { assetTag: true, name: true } },
};

// ─── Create Leasing ───────────────────────────────────────────────────

/**
 * Atomically creates a leasing contract + ROU Asset + DepreciationConfig + CP installments.
 * CRITICAL: Uses prisma.$transaction directly (NOT withRlsContext) to avoid nested RLS deadlocks.
 */
export async function createLeasing(
  ctx: RlsContext,
  input: CreateLeasingInput,
): Promise<{
  leasing: LeasingOutput;
  rouAsset: { id: string; assetTag: string; name: string };
  payableId: string | null;
}> {
  // Validate required fields
  if (!input.lessorName?.trim()) {
    throw new AssetLeasingError('Nome do arrendador é obrigatório', 400);
  }
  if (!input.farmId?.trim()) {
    throw new AssetLeasingError('Fazenda é obrigatória', 400);
  }
  if (!input.assetName?.trim()) {
    throw new AssetLeasingError('Nome do ativo é obrigatório', 400);
  }
  if (!input.assetType?.trim()) {
    throw new AssetLeasingError('Tipo do ativo é obrigatório', 400);
  }
  if (!input.contractDate) {
    throw new AssetLeasingError('Data do contrato é obrigatória', 400);
  }
  if (!input.startDate) {
    throw new AssetLeasingError('Data de início é obrigatória', 400);
  }
  if (!input.endDate) {
    throw new AssetLeasingError('Data de fim é obrigatória', 400);
  }
  if (!input.totalContractValue || input.totalContractValue <= 0) {
    throw new AssetLeasingError('Valor total do contrato deve ser maior que zero', 400);
  }
  if (!input.installmentCount || input.installmentCount < 1) {
    throw new AssetLeasingError('Número de parcelas deve ser pelo menos 1', 400);
  }
  if (!input.firstDueDate) {
    throw new AssetLeasingError('Vencimento da 1ª parcela é obrigatório', 400);
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (endDate <= startDate) {
    throw new AssetLeasingError('Data de fim deve ser posterior à data de início', 400);
  }

  return prisma.$transaction(async (tx) => {
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);

    // Compute contract duration in months for depreciation
    const durationMonths = monthsBetween(startDate, endDate);
    const usefulLifeMonths = Math.max(1, durationMonths);

    // Build ROU asset name
    const rouName = `ROU — ${input.lessorName} — ${input.contractNumber ?? assetTag}`;

    // 1. Create ROU Asset
    const rouAsset = await tx.asset.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        assetType: input.assetType as never,
        classification: 'DEPRECIABLE_CPC27',
        name: rouName,
        assetTag,
        acquisitionDate: startDate,
        acquisitionValue: String(input.totalContractValue),
        status: 'ATIVO',
        notes: `Ativo de direito de uso (ROU) — Arrendamento mercantil CPC 06. Arrendador: ${input.lessorName}. Contrato: ${input.contractNumber ?? 'N/A'}.`,
        photoUrls: [],
      },
      select: { id: true, assetTag: true, name: true },
    });

    // 2. Create DepreciationConfig (STRAIGHT_LINE over contract duration)
    await tx.depreciationConfig.create({
      data: {
        organizationId: ctx.organizationId,
        assetId: rouAsset.id,
        method: 'STRAIGHT_LINE',
        usefulLifeMonths,
        residualValue: '0',
      },
    });

    // 3. Compute monthly installment
    const monthlyInstallment = new Decimal(input.totalContractValue)
      .dividedBy(input.installmentCount)
      .toDecimalPlaces(2);

    // 4. Generate installments
    const installments = generateInstallments(
      Money(input.totalContractValue),
      input.installmentCount,
      new Date(input.firstDueDate),
    );

    // 5. Create Payable (directly via tx — NOT via payables.service to avoid nested RLS transactions)
    const payable = await tx.payable.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        supplierName: input.lessorName,
        category: 'FINANCING',
        description: `Leasing CPC 06 — ${rouAsset.assetTag}`,
        totalAmount: Money(input.totalContractValue).toDecimal(),
        dueDate: installments[0].dueDate,
        installmentCount: input.installmentCount,
        originType: 'ASSET_LEASING',
        originId: rouAsset.id,
      },
      select: { id: true },
    });

    // 6. Create PayableInstallments
    await tx.payableInstallment.createMany({
      data: installments.map((inst) => ({
        payableId: payable.id,
        number: inst.number,
        amount: inst.amount.toDecimal(),
        dueDate: inst.dueDate,
      })),
    });

    // 7. Create AssetLeasing record
    const leasing = await tx.assetLeasing.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        rouAssetId: rouAsset.id,
        lessorName: input.lessorName,
        lessorDocument: input.lessorDocument ?? null,
        contractNumber: input.contractNumber ?? null,
        contractDate: new Date(input.contractDate),
        startDate,
        endDate,
        totalContractValue: String(input.totalContractValue),
        monthlyInstallment: monthlyInstallment.toString(),
        installmentCount: input.installmentCount,
        purchaseOptionValue: input.purchaseOptionValue ? String(input.purchaseOptionValue) : null,
        purchaseOptionDate: input.purchaseOptionDate ? new Date(input.purchaseOptionDate) : null,
        hasPurchaseOption: input.hasPurchaseOption ?? false,
        status: 'ACTIVE',
        payableId: payable.id,
        notes: input.notes ?? null,
        createdBy: ctx.userId!,
      },
      include: LEASING_INCLUDE,
    });

    return {
      leasing: formatLeasing(leasing),
      rouAsset,
      payableId: payable.id,
    };
  });
}

// ─── List Leasings ────────────────────────────────────────────────────

export async function listLeasings(
  ctx: RlsContext,
  filters?: { farmId?: string; status?: string },
): Promise<LeasingOutput[]> {
  const where: Record<string, unknown> = { organizationId: ctx.organizationId };
  if (filters?.farmId) where.farmId = filters.farmId;
  if (filters?.status) where.status = filters.status;

  const leasings = await prisma.assetLeasing.findMany({
    where,
    include: LEASING_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  return leasings.map(formatLeasing);
}

// ─── Get Leasing ──────────────────────────────────────────────────────

export async function getLeasing(ctx: RlsContext, id: string): Promise<LeasingOutput> {
  const leasing = await prisma.assetLeasing.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: LEASING_INCLUDE,
  });

  if (!leasing) {
    throw new AssetLeasingError('Contrato de leasing não encontrado', 404);
  }

  return formatLeasing(leasing);
}

// ─── Exercise Purchase Option ─────────────────────────────────────────

export async function exercisePurchaseOption(ctx: RlsContext, id: string): Promise<LeasingOutput> {
  const leasing = await prisma.assetLeasing.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: LEASING_INCLUDE,
  });

  if (!leasing) {
    throw new AssetLeasingError('Contrato de leasing não encontrado', 404);
  }

  if (leasing.status !== 'ACTIVE') {
    throw new AssetLeasingError('Contrato não está ativo', 409);
  }

  if (!leasing.hasPurchaseOption) {
    throw new AssetLeasingError('Este contrato não possui opção de compra', 400);
  }

  return prisma.$transaction(async (tx) => {
    // Update leasing status
    const updated = await tx.assetLeasing.update({
      where: { id },
      data: { status: 'PURCHASE_OPTION_EXERCISED' },
      include: LEASING_INCLUDE,
    });

    // If purchaseOptionValue > 0, create CP for the purchase option
    const purchaseValue = leasing.purchaseOptionValue ? Number(leasing.purchaseOptionValue) : 0;
    if (purchaseValue > 0) {
      const dueDate = leasing.purchaseOptionDate ?? new Date();
      const payable = await tx.payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: leasing.farmId,
          supplierName: leasing.lessorName,
          category: 'ASSET_ACQUISITION',
          description: `Opção de compra — Leasing ${leasing.rouAsset.assetTag}`,
          totalAmount: String(purchaseValue),
          dueDate,
          installmentCount: 1,
          originType: 'ASSET_LEASING_PURCHASE',
          originId: leasing.id,
        },
        select: { id: true },
      });

      await tx.payableInstallment.create({
        data: {
          payableId: payable.id,
          number: 1,
          amount: String(purchaseValue),
          dueDate,
        },
      });
    }

    return formatLeasing(updated);
  });
}

// ─── Return Asset ─────────────────────────────────────────────────────

export async function returnAsset(ctx: RlsContext, id: string): Promise<LeasingOutput> {
  const leasing = await prisma.assetLeasing.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: LEASING_INCLUDE,
  });

  if (!leasing) {
    throw new AssetLeasingError('Contrato de leasing não encontrado', 404);
  }

  if (leasing.status !== 'ACTIVE') {
    throw new AssetLeasingError('Contrato não está ativo', 409);
  }

  return prisma.$transaction(async (tx) => {
    // Update leasing status
    const updated = await tx.assetLeasing.update({
      where: { id },
      data: { status: 'RETURNED' },
      include: LEASING_INCLUDE,
    });

    // Mark ROU asset as ALIENADO
    await tx.asset.update({
      where: { id: leasing.rouAssetId },
      data: { status: 'ALIENADO', disposalDate: new Date() },
    });

    // Cancel pending depreciation entries
    await tx.depreciationEntry.updateMany({
      where: { assetId: leasing.rouAssetId, reversedAt: null },
      data: { reversedAt: new Date() },
    });

    return formatLeasing(updated);
  });
}

// ─── Cancel Leasing ───────────────────────────────────────────────────

export async function cancelLeasing(ctx: RlsContext, id: string): Promise<LeasingOutput> {
  const leasing = await prisma.assetLeasing.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: LEASING_INCLUDE,
  });

  if (!leasing) {
    throw new AssetLeasingError('Contrato de leasing não encontrado', 404);
  }

  if (leasing.status !== 'ACTIVE') {
    throw new AssetLeasingError('Contrato não está ativo', 409);
  }

  const updated = await prisma.assetLeasing.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: LEASING_INCLUDE,
  });

  return formatLeasing(updated);
}
