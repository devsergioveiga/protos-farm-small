import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import {
  BiologicalAssetError,
  GROUP_TYPE_LABELS,
  type CreateValuationInput,
  type GroupType,
  type ListValuationsFilters,
  type ValuationOutput,
  type ValuationSummaryItem,
} from './biological-assets.types';

// ─── Helpers ──────────────────────────────────────────────────────────

function toValuationOutput(record: {
  id: string;
  organizationId: string;
  farmId: string;
  farm: { name: string };
  valuationDate: Date;
  assetGroup: string;
  groupType: string;
  headCount: number | null;
  areaHa: Decimal | null;
  pricePerUnit: Decimal;
  totalFairValue: Decimal;
  previousValue: Decimal | null;
  fairValueChange: Decimal | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}): ValuationOutput {
  return {
    id: record.id,
    organizationId: record.organizationId,
    farmId: record.farmId,
    farmName: record.farm.name,
    valuationDate: record.valuationDate.toISOString().split('T')[0],
    assetGroup: record.assetGroup,
    groupType: record.groupType as GroupType,
    groupTypeLabel: GROUP_TYPE_LABELS[record.groupType as GroupType] ?? record.groupType,
    headCount: record.headCount,
    areaHa: record.areaHa != null ? Number(record.areaHa) : null,
    pricePerUnit: Number(record.pricePerUnit),
    totalFairValue: Number(record.totalFairValue),
    previousValue: record.previousValue != null ? Number(record.previousValue) : null,
    fairValueChange: record.fairValueChange != null ? Number(record.fairValueChange) : null,
    notes: record.notes,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
}

// ─── Service Functions ────────────────────────────────────────────────

export async function createValuation(
  ctx: RlsContext,
  input: CreateValuationInput,
): Promise<ValuationOutput> {
  const { organizationId } = ctx;

  // Validate required fields
  if (!input.farmId) throw new BiologicalAssetError('Fazenda é obrigatória', 400);
  if (!input.valuationDate) throw new BiologicalAssetError('Data de avaliação é obrigatória', 400);
  if (!input.assetGroup) throw new BiologicalAssetError('Grupo do ativo é obrigatório', 400);
  if (!input.groupType) throw new BiologicalAssetError('Tipo de grupo é obrigatório', 400);
  if (input.pricePerUnit == null)
    throw new BiologicalAssetError('Preço por unidade é obrigatório', 400);
  if (input.totalFairValue == null)
    throw new BiologicalAssetError('Valor justo total é obrigatório', 400);

  // Validate groupType-specific fields
  if (input.groupType === 'ANIMAL' && (input.headCount == null || input.headCount <= 0)) {
    throw new BiologicalAssetError(
      'Quantidade de cabeças é obrigatória para ativos do tipo Rebanho',
      400,
    );
  }
  if (input.groupType === 'PERENNIAL_CROP' && (input.areaHa == null || input.areaHa <= 0)) {
    throw new BiologicalAssetError('Área (ha) é obrigatória para culturas perenes', 400);
  }

  // Find previous valuation for same org + assetGroup
  const valuationDateParsed = new Date(input.valuationDate);
  const previous = await prisma.biologicalAssetValuation.findFirst({
    where: {
      organizationId,
      assetGroup: input.assetGroup,
      valuationDate: { lt: valuationDateParsed },
    },
    orderBy: { valuationDate: 'desc' },
    select: { totalFairValue: true },
  });

  const totalFairValueDec = new Decimal(input.totalFairValue);
  const previousValueDec = previous ? new Decimal(previous.totalFairValue.toString()) : null;
  const fairValueChangeDec = previousValueDec ? totalFairValueDec.minus(previousValueDec) : null;

  const created = await prisma.biologicalAssetValuation.create({
    data: {
      organizationId,
      farmId: input.farmId,
      valuationDate: valuationDateParsed,
      assetGroup: input.assetGroup,
      groupType: input.groupType,
      headCount: input.headCount ?? null,
      areaHa: input.areaHa != null ? new Decimal(input.areaHa) : null,
      pricePerUnit: new Decimal(input.pricePerUnit),
      totalFairValue: totalFairValueDec,
      previousValue: previousValueDec,
      fairValueChange: fairValueChangeDec,
      notes: input.notes ?? null,
      createdBy: (ctx as { userId?: string }).userId ?? 'system',
    },
    include: { farm: { select: { name: true } } },
  });

  return toValuationOutput(created);
}

export async function listValuations(
  ctx: RlsContext,
  filters: ListValuationsFilters = {},
): Promise<ValuationOutput[]> {
  const { organizationId } = ctx;
  const where: Record<string, unknown> = { organizationId };
  if (filters.farmId) where.farmId = filters.farmId;
  if (filters.assetGroup) where.assetGroup = filters.assetGroup;
  if (filters.groupType) where.groupType = filters.groupType;

  const records = await prisma.biologicalAssetValuation.findMany({
    where,
    include: { farm: { select: { name: true } } },
    orderBy: { valuationDate: 'desc' },
  });

  return records.map(toValuationOutput);
}

export async function getValuation(ctx: RlsContext, id: string): Promise<ValuationOutput> {
  const { organizationId } = ctx;
  const record = await prisma.biologicalAssetValuation.findFirst({
    where: { id, organizationId },
    include: { farm: { select: { name: true } } },
  });
  if (!record) throw new BiologicalAssetError('Avaliação não encontrada', 404);
  return toValuationOutput(record);
}

export async function deleteValuation(ctx: RlsContext, id: string): Promise<void> {
  const { organizationId } = ctx;
  const record = await prisma.biologicalAssetValuation.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!record) throw new BiologicalAssetError('Avaliação não encontrada', 404);
  await prisma.biologicalAssetValuation.delete({ where: { id } });
}

export async function getSummary(
  ctx: RlsContext,
  farmId?: string,
): Promise<ValuationSummaryItem[]> {
  const { organizationId } = ctx;
  const where: Record<string, unknown> = { organizationId };
  if (farmId) where.farmId = farmId;

  // Get all records, then compute latest per group in memory (simpler than raw SQL)
  const records = await prisma.biologicalAssetValuation.findMany({
    where,
    orderBy: { valuationDate: 'desc' },
    select: {
      assetGroup: true,
      groupType: true,
      totalFairValue: true,
      fairValueChange: true,
      valuationDate: true,
    },
  });

  // Group by assetGroup + groupType
  const groupMap = new Map<
    string,
    {
      assetGroup: string;
      groupType: string;
      latestTotalFairValue: Decimal;
      latestFairValueChange: Decimal | null;
      valuationCount: number;
    }
  >();

  for (const rec of records) {
    const key = `${rec.assetGroup}__${rec.groupType}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        assetGroup: rec.assetGroup,
        groupType: rec.groupType,
        latestTotalFairValue: new Decimal(rec.totalFairValue.toString()),
        latestFairValueChange:
          rec.fairValueChange != null ? new Decimal(rec.fairValueChange.toString()) : null,
        valuationCount: 1,
      });
    } else {
      const entry = groupMap.get(key)!;
      entry.valuationCount += 1;
    }
  }

  return Array.from(groupMap.values()).map((entry) => ({
    assetGroup: entry.assetGroup,
    groupType: entry.groupType as GroupType,
    latestTotalFairValue: Number(entry.latestTotalFairValue),
    latestFairValueChange:
      entry.latestFairValueChange != null ? Number(entry.latestFairValueChange) : null,
    valuationCount: entry.valuationCount,
  }));
}
