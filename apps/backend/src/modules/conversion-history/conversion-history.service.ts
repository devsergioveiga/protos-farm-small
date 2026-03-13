/**
 * Conversion History / Audit service (US-095 CA8).
 *
 * Aggregates dose→quantity conversions from:
 * - PesticideApplication (dose + doseUnit → totalQuantityUsed)
 * - FertilizerApplication (dose + doseUnit → totalQuantityUsed)
 * - SoilPrepOperation (inputs JSON → stockOutput)
 */

import type { RlsContext } from '../../database/rls';
import { withRlsContext, type TxClient } from '../../database/rls';
import type {
  ConversionHistoryItem,
  ListConversionHistoryQuery,
  OperationType,
} from './conversion-history.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

const DOSE_UNIT_LABELS: Record<string, string> = {
  L_HA: 'L/ha',
  KG_HA: 'kg/ha',
  ML_HA: 'mL/ha',
  G_HA: 'g/ha',
  T_HA: 't/ha',
  G_PLANTA: 'g/planta',
};

function getBaseUnit(doseUnit: string): string {
  switch (doseUnit) {
    case 'L_HA':
    case 'ML_HA':
      return 'L';
    case 'KG_HA':
    case 'G_HA':
    case 'T_HA':
    case 'G_PLANTA':
      return 'kg';
    default:
      return 'un';
  }
}

function buildConversionFormula(
  dose: number,
  doseUnit: string,
  areaHa: number,
  totalQty: number,
): string {
  const unitLabel = DOSE_UNIT_LABELS[doseUnit] || doseUnit;
  const baseUnit = getBaseUnit(doseUnit);
  return `${dose} ${unitLabel} × ${areaHa} ha = ${totalQty.toFixed(2)} ${baseUnit}`;
}

const OPERATION_LABELS: Record<OperationType, string> = {
  PESTICIDE: 'Aplicação de defensivo',
  FERTILIZER: 'Adubação',
  SOIL_PREP: 'Preparo de solo',
};

// ─── Main query ─────────────────────────────────────────────────────

export async function listConversionHistory(
  ctx: RlsContext,
  query: ListConversionHistoryQuery,
): Promise<{
  data: ConversionHistoryItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  return withRlsContext(ctx, async (tx) => {
    const items: ConversionHistoryItem[] = [];

    const includeTypes = query.operationType
      ? [query.operationType]
      : (['PESTICIDE', 'FERTILIZER', 'SOIL_PREP'] as OperationType[]);

    // ── Pesticide conversions ──
    if (includeTypes.includes('PESTICIDE')) {
      const pesticideItems = await queryPesticideConversions(tx, query);
      items.push(...pesticideItems);
    }

    // ── Fertilizer conversions ──
    if (includeTypes.includes('FERTILIZER')) {
      const fertilizerItems = await queryFertilizerConversions(tx, query);
      items.push(...fertilizerItems);
    }

    // ── Soil prep conversions ──
    if (includeTypes.includes('SOIL_PREP')) {
      const soilPrepItems = await querySoilPrepConversions(tx, query);
      items.push(...soilPrepItems);
    }

    // Sort by date desc
    items.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = items.slice(offset, offset + limit);

    return {
      data: paginated,
      meta: { page, limit, total, totalPages },
    };
  });
}

// ─── Pesticide query ────────────────────────────────────────────────

async function queryPesticideConversions(
  tx: TxClient,
  query: ListConversionHistoryQuery,
): Promise<ConversionHistoryItem[]> {
  const where: any = {
    deletedAt: null,
    totalQuantityUsed: { not: null },
  };
  if (query.farmId) where.farmId = query.farmId;
  if (query.productName) {
    where.productName = { contains: query.productName, mode: 'insensitive' };
  }
  if (query.dateFrom || query.dateTo) {
    where.appliedAt = {};
    if (query.dateFrom) where.appliedAt.gte = new Date(query.dateFrom);
    if (query.dateTo) where.appliedAt.lte = new Date(query.dateTo + 'T23:59:59Z');
  }

  const rows = await (tx as any).pesticideApplication.findMany({
    where,
    include: {
      farm: { select: { name: true } },
      fieldPlot: { select: { name: true, boundaryAreaHa: true } },
      recorder: { select: { name: true } },
    },
    orderBy: { appliedAt: 'desc' },
  });

  return rows.map((r: any) => {
    const dose = toNumber(r.dose);
    const totalQty = toNumber(r.totalQuantityUsed);
    const areaHa = toNumber(r.fieldPlot.boundaryAreaHa);
    const doseUnit = r.doseUnit as string;

    return {
      id: r.id,
      operationType: 'PESTICIDE' as const,
      operationLabel: OPERATION_LABELS.PESTICIDE,
      farmId: r.farmId,
      farmName: r.farm.name,
      fieldPlotId: r.fieldPlotId,
      fieldPlotName: r.fieldPlot.name,
      productName: r.productName,
      productId: r.productId,
      appliedAt: r.appliedAt.toISOString(),
      dose,
      doseUnit,
      doseUnitLabel: DOSE_UNIT_LABELS[doseUnit] || doseUnit,
      areaHa,
      totalQuantityUsed: totalQty,
      baseUnit: getBaseUnit(doseUnit),
      conversionFormula: buildConversionFormula(dose, doseUnit, areaHa, totalQty),
      stockOutputId: r.stockOutputId,
      recordedBy: r.recordedBy,
      recorderName: r.recorder?.name || '',
      createdAt: r.createdAt.toISOString(),
    };
  });
}

// ─── Fertilizer query ───────────────────────────────────────────────

async function queryFertilizerConversions(
  tx: TxClient,
  query: ListConversionHistoryQuery,
): Promise<ConversionHistoryItem[]> {
  const where: any = {
    deletedAt: null,
    totalQuantityUsed: { not: null },
  };
  if (query.farmId) where.farmId = query.farmId;
  if (query.productName) {
    where.productName = { contains: query.productName, mode: 'insensitive' };
  }
  if (query.dateFrom || query.dateTo) {
    where.appliedAt = {};
    if (query.dateFrom) where.appliedAt.gte = new Date(query.dateFrom);
    if (query.dateTo) where.appliedAt.lte = new Date(query.dateTo + 'T23:59:59Z');
  }

  const rows = await (tx as any).fertilizerApplication.findMany({
    where,
    include: {
      farm: { select: { name: true } },
      fieldPlot: { select: { name: true, boundaryAreaHa: true } },
      recorder: { select: { name: true } },
    },
    orderBy: { appliedAt: 'desc' },
  });

  return rows.map((r: any) => {
    const dose = toNumber(r.dose);
    const totalQty = toNumber(r.totalQuantityUsed);
    const areaHa = toNumber(r.fieldPlot.boundaryAreaHa);
    const doseUnit = r.doseUnit as string;

    return {
      id: r.id,
      operationType: 'FERTILIZER' as const,
      operationLabel: OPERATION_LABELS.FERTILIZER,
      farmId: r.farmId,
      farmName: r.farm.name,
      fieldPlotId: r.fieldPlotId,
      fieldPlotName: r.fieldPlot.name,
      productName: r.productName,
      productId: r.productId,
      appliedAt: r.appliedAt.toISOString(),
      dose,
      doseUnit,
      doseUnitLabel: DOSE_UNIT_LABELS[doseUnit] || doseUnit,
      areaHa,
      totalQuantityUsed: totalQty,
      baseUnit: getBaseUnit(doseUnit),
      conversionFormula: buildConversionFormula(dose, doseUnit, areaHa, totalQty),
      stockOutputId: r.stockOutputId,
      recordedBy: r.recordedBy,
      recorderName: r.recorder?.name || '',
      createdAt: r.createdAt.toISOString(),
    };
  });
}

// ─── Soil Prep query ────────────────────────────────────────────────

async function querySoilPrepConversions(
  tx: TxClient,
  query: ListConversionHistoryQuery,
): Promise<ConversionHistoryItem[]> {
  const where: any = {
    deletedAt: null,
    stockOutputId: { not: null },
  };
  if (query.farmId) where.farmId = query.farmId;
  if (query.dateFrom || query.dateTo) {
    where.startedAt = {};
    if (query.dateFrom) where.startedAt.gte = new Date(query.dateFrom);
    if (query.dateTo) where.startedAt.lte = new Date(query.dateTo + 'T23:59:59Z');
  }

  const rows = await (tx as any).soilPrepOperation.findMany({
    where,
    include: {
      farm: { select: { name: true } },
      fieldPlot: { select: { name: true, boundaryAreaHa: true } },
      recorder: { select: { name: true } },
      stockOutput: {
        select: {
          items: {
            select: { productId: true, quantity: true, product: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  const results: ConversionHistoryItem[] = [];

  for (const r of rows) {
    const inputs = Array.isArray(r.inputs) ? r.inputs : [];
    const areaHa = toNumber(r.fieldPlot.boundaryAreaHa);
    const outputItems = r.stockOutput?.items || [];

    // If there are stock output items, use them as the source of truth
    if (outputItems.length > 0) {
      for (const item of outputItems) {
        const qty = toNumber(item.quantity);
        const productName = item.product?.name || 'Insumo';

        // Try to find matching input for dose info
        const matchingInput = inputs.find(
          (inp: any) => inp.productId === item.productId || inp.productName === productName,
        );
        const dose = matchingInput ? toNumber(matchingInput.dose) : 0;
        const doseUnit = matchingInput?.doseUnit || 'KG_HA';

        // Filter by productName search
        if (
          query.productName &&
          !productName.toLowerCase().includes(query.productName.toLowerCase())
        ) {
          continue;
        }

        results.push({
          id: `${r.id}:${item.productId}`,
          operationType: 'SOIL_PREP',
          operationLabel: OPERATION_LABELS.SOIL_PREP,
          farmId: r.farmId,
          farmName: r.farm.name,
          fieldPlotId: r.fieldPlotId,
          fieldPlotName: r.fieldPlot.name,
          productName,
          productId: item.productId,
          appliedAt: r.startedAt.toISOString(),
          dose,
          doseUnit,
          doseUnitLabel: DOSE_UNIT_LABELS[doseUnit] || doseUnit,
          areaHa,
          totalQuantityUsed: qty,
          baseUnit: getBaseUnit(doseUnit),
          conversionFormula:
            dose > 0
              ? buildConversionFormula(dose, doseUnit, areaHa, qty)
              : `${qty.toFixed(2)} ${getBaseUnit(doseUnit)} (consumo direto)`,
          stockOutputId: r.stockOutputId,
          recordedBy: r.recordedBy,
          recorderName: r.recorder?.name || '',
          createdAt: r.createdAt.toISOString(),
        });
      }
    } else if (inputs.length > 0) {
      // Fallback: use inputs JSON
      for (const inp of inputs) {
        const dose = toNumber(inp.dose);
        const doseUnit = inp.doseUnit || 'KG_HA';
        const totalQty = toNumber(inp.totalQuantity || inp.quantity);
        const productName = inp.productName || 'Insumo';

        if (
          query.productName &&
          !productName.toLowerCase().includes(query.productName.toLowerCase())
        ) {
          continue;
        }

        if (totalQty <= 0) continue;

        results.push({
          id: `${r.id}:${inp.productId || productName}`,
          operationType: 'SOIL_PREP',
          operationLabel: OPERATION_LABELS.SOIL_PREP,
          farmId: r.farmId,
          farmName: r.farm.name,
          fieldPlotId: r.fieldPlotId,
          fieldPlotName: r.fieldPlot.name,
          productName,
          productId: inp.productId || null,
          appliedAt: r.startedAt.toISOString(),
          dose,
          doseUnit,
          doseUnitLabel: DOSE_UNIT_LABELS[doseUnit] || doseUnit,
          areaHa,
          totalQuantityUsed: totalQty,
          baseUnit: getBaseUnit(doseUnit),
          conversionFormula:
            dose > 0
              ? buildConversionFormula(dose, doseUnit, areaHa, totalQty)
              : `${totalQty.toFixed(2)} ${getBaseUnit(doseUnit)} (consumo direto)`,
          stockOutputId: r.stockOutputId,
          recordedBy: r.recordedBy,
          recorderName: r.recorder?.name || '',
          createdAt: r.createdAt.toISOString(),
        });
      }
    }
  }

  return results;
}

// ─── CSV export ─────────────────────────────────────────────────────

export async function exportConversionHistoryCsv(
  ctx: RlsContext,
  query: ListConversionHistoryQuery,
): Promise<string> {
  const result = await listConversionHistory(ctx, { ...query, page: 1, limit: 10000 });

  const header = [
    'Data',
    'Tipo de Operação',
    'Fazenda',
    'Talhão',
    'Produto',
    'Dose',
    'Unidade',
    'Área (ha)',
    'Quantidade Total',
    'Unidade Base',
    'Fórmula',
    'Baixa Estoque',
    'Registrado por',
  ].join(',');

  const rows = result.data.map((item) =>
    [
      new Date(item.appliedAt).toLocaleDateString('pt-BR'),
      item.operationLabel,
      item.farmName.replace(/[,\n\r]/g, ' '),
      item.fieldPlotName.replace(/[,\n\r]/g, ' '),
      item.productName.replace(/[,\n\r]/g, ' '),
      item.dose.toFixed(4),
      item.doseUnitLabel,
      item.areaHa.toFixed(4),
      item.totalQuantityUsed.toFixed(4),
      item.baseUnit,
      `"${item.conversionFormula}"`,
      item.stockOutputId ? 'Sim' : 'Não',
      item.recorderName.replace(/[,\n\r]/g, ' '),
    ].join(','),
  );

  return [header, ...rows].join('\n');
}
