/**
 * US-098 — Conversão em comercialização e produção
 *
 * Provides:
 * - CA5: Unified conversion between any commercial units
 * - CA6: Production report with configurable target unit
 * - CA7: Delivery manifest (romaneio) generation
 */

import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  HarvestConversionError,
  HARVEST_TYPES,
  UNIT_TO_KG,
  COMMERCIAL_UNIT_LABELS,
  type HarvestCropType,
  type ConvertHarvestQuery,
  type ConvertHarvestResult,
  type ProductionReportQuery,
  type ProductionReport,
  type ProductionReportItem,
  type DeliveryManifestInput,
  type DeliveryManifest,
  type DeliveryManifestLineItem,
} from './harvest-commercial-conversion.types';
import { STANDARD_MOISTURE, SACA_KG } from '../grain-harvests/grain-harvests.types';
import { DEFAULT_YIELD_LITERS_PER_SAC } from '../coffee-harvests/coffee-harvests.types';
import { BOX_WEIGHT_KG } from '../orange-harvests/orange-harvests.types';

// ─── Helpers ──────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function getUnitLabel(abbrev: string): string {
  return COMMERCIAL_UNIT_LABELS[abbrev] ?? abbrev;
}

/**
 * Convert a weight-based quantity between two units via kg.
 * Returns null if conversion is not possible (e.g., volume units without yield factor).
 */
function convertViaKg(quantity: number, fromUnit: string, toUnit: string): number | null {
  const fromFactor = UNIT_TO_KG[fromUnit];
  const toFactor = UNIT_TO_KG[toUnit];
  if (fromFactor == null || toFactor == null) return null;
  const kg = quantity * fromFactor;
  return kg / toFactor;
}

/**
 * Convert coffee liters to a weight-based unit using yield factor.
 * L → sc: L / yieldLitersPerSac
 * Then sc → other weight units via SACA_KG (60 kg/sc)
 */
function convertCoffeeLiters(
  liters: number,
  toUnit: string,
  yieldLitersPerSac: number,
): number | null {
  const sacs = liters / yieldLitersPerSac;
  if (toUnit === 'sc') return sacs;
  if (toUnit === 'L') return liters;
  // Convert sacs to kg, then to target
  const kg = sacs * SACA_KG;
  const toFactor = UNIT_TO_KG[toUnit];
  if (toFactor == null) return null;
  return kg / toFactor;
}

// ─── CA5: Conversion endpoint ─────────────────────────────────────

export function convertHarvestUnit(query: ConvertHarvestQuery): ConvertHarvestResult {
  const { harvestType, quantity, fromUnit, toUnit, yieldLitersPerSac } = query;

  if (!harvestType || !(HARVEST_TYPES as readonly string[]).includes(harvestType)) {
    throw new HarvestConversionError(
      `Tipo de colheita inválido. Use: ${HARVEST_TYPES.join(', ')}`,
      400,
    );
  }
  if (quantity == null || quantity < 0) {
    throw new HarvestConversionError('Quantidade deve ser zero ou maior', 400);
  }
  if (!fromUnit) {
    throw new HarvestConversionError('Unidade de origem é obrigatória', 400);
  }
  if (!toUnit) {
    throw new HarvestConversionError('Unidade de destino é obrigatória', 400);
  }

  // Same unit → identity
  if (fromUnit === toUnit) {
    return {
      originalQuantity: quantity,
      originalUnit: fromUnit,
      originalUnitLabel: getUnitLabel(fromUnit),
      convertedQuantity: quantity,
      targetUnit: toUnit,
      targetUnitLabel: getUnitLabel(toUnit),
      conversionFactor: 1,
      formula: `${quantity} ${fromUnit} = ${quantity} ${toUnit}`,
    };
  }

  let converted: number | null = null;

  // Handle coffee liters specially
  if (fromUnit === 'L') {
    const yield_ = yieldLitersPerSac ?? DEFAULT_YIELD_LITERS_PER_SAC;
    converted = convertCoffeeLiters(quantity, toUnit, yield_);
  } else if (toUnit === 'L') {
    // Reverse: weight → L (only for coffee with yield)
    const yield_ = yieldLitersPerSac ?? DEFAULT_YIELD_LITERS_PER_SAC;
    // First convert to sc, then sc → L
    const toKg = UNIT_TO_KG[fromUnit];
    if (toKg != null) {
      const kg = quantity * toKg;
      const sacs = kg / SACA_KG;
      converted = sacs * yield_;
    }
  } else {
    converted = convertViaKg(quantity, fromUnit, toUnit);
  }

  if (converted == null) {
    throw new HarvestConversionError(`Não é possível converter de ${fromUnit} para ${toUnit}`, 400);
  }

  const result = round(converted, 4);
  const factor = quantity > 0 ? round(result / quantity, 10) : 0;

  return {
    originalQuantity: quantity,
    originalUnit: fromUnit,
    originalUnitLabel: getUnitLabel(fromUnit),
    convertedQuantity: result,
    targetUnit: toUnit,
    targetUnitLabel: getUnitLabel(toUnit),
    conversionFactor: factor,
    formula: `${quantity} ${fromUnit} = ${result} ${toUnit}`,
  };
}

// ─── CA6: Production report ───────────────────────────────────────

/** Get standard moisture for crop normalization */
function getStandardMoisture(crop: string): number {
  const key = crop
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return STANDARD_MOISTURE[key] ?? 13;
}

/** Compute corrected grain production in kg */
function correctedGrainKg(
  grossKg: number,
  moisturePct: number,
  impurityPct: number,
  standardMoisturePct: number,
): number {
  const net = grossKg * (1 - impurityPct / 100);
  return (net * (100 - moisturePct)) / (100 - standardMoisturePct);
}

function convertFromKg(kg: number, targetUnit: string): number {
  if (targetUnit === 'kg') return kg;
  const factor = UNIT_TO_KG[targetUnit];
  if (factor == null) return kg;
  return kg / factor;
}

export async function getProductionReport(
  ctx: RlsContext,
  farmId: string,
  query: ProductionReportQuery,
): Promise<ProductionReport> {
  const targetUnit = query.unit ?? 'sc';

  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const farm = await (tx as any).farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!farm) {
      throw new HarvestConversionError('Fazenda não encontrada', 404);
    }

    // Build where clause
    const dateFilter: Record<string, Date> = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const plotMap = new Map<
      string,
      {
        fieldPlotName: string;
        crop: string;
        harvestType: HarvestCropType;
        entries: number;
        areaHa: number;
        productionKg: number;
      }
    >();

    // ── Grain harvests ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grainWhere: any = { farmId, deletedAt: null };
    if (hasDateFilter) grainWhere.harvestDate = dateFilter;
    if (query.fieldPlotId) grainWhere.fieldPlotId = query.fieldPlotId;
    if (query.crop) grainWhere.crop = { contains: query.crop, mode: 'insensitive' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grains = await (tx as any).grainHarvest.findMany({
      where: grainWhere,
      include: { fieldPlot: { select: { name: true, boundaryAreaHa: true } } },
    });

    for (const g of grains) {
      const plotId = g.fieldPlotId as string;
      const crop = g.crop as string;
      const key = `${plotId}:GRAIN:${crop}`;
      const existing = plotMap.get(key);
      const corrected = correctedGrainKg(
        Number(g.grossProductionKg),
        Number(g.moisturePct),
        Number(g.impurityPct),
        getStandardMoisture(crop),
      );

      if (existing) {
        existing.entries += 1;
        existing.areaHa += Number(g.harvestedAreaHa);
        existing.productionKg += corrected;
      } else {
        plotMap.set(key, {
          fieldPlotName: g.fieldPlot?.name ?? '',
          crop,
          harvestType: 'GRAIN',
          entries: 1,
          areaHa: Number(g.harvestedAreaHa),
          productionKg: corrected,
        });
      }
    }

    // ── Coffee harvests ──
    if (
      !query.crop ||
      'café'.includes(query.crop.toLowerCase()) ||
      'coffee'.includes(query.crop.toLowerCase())
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coffeeWhere: any = { farmId, deletedAt: null };
      if (hasDateFilter) coffeeWhere.harvestDate = dateFilter;
      if (query.fieldPlotId) coffeeWhere.fieldPlotId = query.fieldPlotId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coffees = await (tx as any).coffeeHarvest.findMany({
        where: coffeeWhere,
        include: { fieldPlot: { select: { name: true, boundaryAreaHa: true } } },
      });

      for (const c of coffees) {
        const plotId = c.fieldPlotId as string;
        const key = `${plotId}:COFFEE:Café`;
        const existing = plotMap.get(key);
        const volumeL = Number(c.volumeLiters);
        const yieldFactor =
          c.yieldLitersPerSac != null ? Number(c.yieldLitersPerSac) : DEFAULT_YIELD_LITERS_PER_SAC;
        const sacs = volumeL / yieldFactor;
        const kg = sacs * SACA_KG;
        const areaHa = c.fieldPlot?.boundaryAreaHa != null ? Number(c.fieldPlot.boundaryAreaHa) : 0;

        if (existing) {
          existing.entries += 1;
          existing.areaHa += areaHa;
          existing.productionKg += kg;
        } else {
          plotMap.set(key, {
            fieldPlotName: c.fieldPlot?.name ?? '',
            crop: 'Café',
            harvestType: 'COFFEE',
            entries: 1,
            areaHa,
            productionKg: kg,
          });
        }
      }
    }

    // ── Orange harvests ──
    if (
      !query.crop ||
      'laranja'.includes(query.crop.toLowerCase()) ||
      'orange'.includes(query.crop.toLowerCase())
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orangeWhere: any = { farmId, deletedAt: null };
      if (hasDateFilter) orangeWhere.harvestDate = dateFilter;
      if (query.fieldPlotId) orangeWhere.fieldPlotId = query.fieldPlotId;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oranges = await (tx as any).orangeHarvest.findMany({
        where: orangeWhere,
        include: { fieldPlot: { select: { name: true, boundaryAreaHa: true } } },
      });

      for (const o of oranges) {
        const plotId = o.fieldPlotId as string;
        const key = `${plotId}:ORANGE:Laranja`;
        const existing = plotMap.get(key);
        const boxes = Number(o.numberOfBoxes);
        const kg = o.totalWeightKg != null ? Number(o.totalWeightKg) : boxes * BOX_WEIGHT_KG;
        const areaHa = o.fieldPlot?.boundaryAreaHa != null ? Number(o.fieldPlot.boundaryAreaHa) : 0;

        if (existing) {
          existing.entries += 1;
          existing.areaHa += areaHa;
          existing.productionKg += kg;
        } else {
          plotMap.set(key, {
            fieldPlotName: o.fieldPlot?.name ?? '',
            crop: 'Laranja',
            harvestType: 'ORANGE',
            entries: 1,
            areaHa,
            productionKg: kg,
          });
        }
      }
    }

    // Build report items
    const items: ProductionReportItem[] = [];
    let totalEntries = 0;
    let totalAreaHa = 0;
    let totalProductionTarget = 0;

    for (const [_key, data] of plotMap) {
      const kg = round(data.productionKg, 2);
      const targetQuantity = round(convertFromKg(kg, targetUnit), 4);

      items.push({
        fieldPlotId: _key.split(':')[0],
        fieldPlotName: data.fieldPlotName,
        crop: data.crop,
        harvestType: data.harvestType,
        totalEntries: data.entries,
        totalAreaHa: round(data.areaHa, 2),
        production: {
          kg,
          sc: round(kg / SACA_KG, 2),
          arroba: round(kg / 15, 2),
          t: round(kg / 1000, 4),
        },
        targetQuantity,
        targetUnit,
        targetUnitLabel: getUnitLabel(targetUnit),
        productivityPerHa: data.areaHa > 0 ? round(targetQuantity / data.areaHa, 2) : 0,
      });

      totalEntries += data.entries;
      totalAreaHa += data.areaHa;
      totalProductionTarget += targetQuantity;
    }

    // Sort by production desc
    items.sort((a, b) => b.targetQuantity - a.targetQuantity);

    return {
      farmId,
      farmName: farm.name as string,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      targetUnit,
      targetUnitLabel: getUnitLabel(targetUnit),
      items,
      totals: {
        totalEntries,
        totalAreaHa: round(totalAreaHa, 2),
        totalProduction: round(totalProductionTarget, 4),
        avgProductivityPerHa: totalAreaHa > 0 ? round(totalProductionTarget / totalAreaHa, 2) : 0,
      },
    };
  });
}

// ─── CA7: Delivery manifest (romaneio) ────────────────────────────

export async function generateDeliveryManifest(
  ctx: RlsContext,
  farmId: string,
  input: DeliveryManifestInput,
): Promise<DeliveryManifest> {
  const harvestType = input.harvestType as HarvestCropType;
  if (!(HARVEST_TYPES as readonly string[]).includes(harvestType)) {
    throw new HarvestConversionError(
      `Tipo de colheita inválido. Use: ${HARVEST_TYPES.join(', ')}`,
      400,
    );
  }
  if (!input.harvestIds?.length) {
    throw new HarvestConversionError('É necessário informar ao menos uma colheita', 400);
  }
  if (!input.targetUnit) {
    throw new HarvestConversionError('Unidade de destino é obrigatória', 400);
  }
  if (!input.deliveryDate) {
    throw new HarvestConversionError('Data de entrega é obrigatória', 400);
  }
  const d = new Date(input.deliveryDate);
  if (isNaN(d.getTime())) {
    throw new HarvestConversionError('Data de entrega inválida', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const farm = await (tx as any).farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!farm) {
      throw new HarvestConversionError('Fazenda não encontrada', 404);
    }

    const items: DeliveryManifestLineItem[] = [];
    let totalConverted = 0;

    for (const harvestId of input.harvestIds) {
      let originalQuantity: number;
      let originalUnit: string;
      let fieldPlotName: string;
      let harvestDate: string;

      if (harvestType === 'GRAIN') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const harvest = await (tx as any).grainHarvest.findFirst({
          where: { id: harvestId, farmId, deletedAt: null },
          include: { fieldPlot: { select: { name: true } } },
        });
        if (!harvest) {
          throw new HarvestConversionError(`Colheita de grãos ${harvestId} não encontrada`, 404);
        }
        // Use corrected production (with moisture/impurity discounts)
        const stdMoisture = getStandardMoisture(harvest.crop as string);
        originalQuantity = correctedGrainKg(
          Number(harvest.grossProductionKg),
          Number(harvest.moisturePct),
          Number(harvest.impurityPct),
          stdMoisture,
        );
        originalUnit = 'kg';
        fieldPlotName = harvest.fieldPlot?.name ?? '';
        harvestDate = (harvest.harvestDate as Date).toISOString().split('T')[0];
      } else if (harvestType === 'COFFEE') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const harvest = await (tx as any).coffeeHarvest.findFirst({
          where: { id: harvestId, farmId, deletedAt: null },
          include: { fieldPlot: { select: { name: true } } },
        });
        if (!harvest) {
          throw new HarvestConversionError(`Colheita de café ${harvestId} não encontrada`, 404);
        }
        originalQuantity = Number(harvest.volumeLiters);
        originalUnit = 'L';
        fieldPlotName = harvest.fieldPlot?.name ?? '';
        harvestDate = (harvest.harvestDate as Date).toISOString().split('T')[0];
      } else {
        // ORANGE
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const harvest = await (tx as any).orangeHarvest.findFirst({
          where: { id: harvestId, farmId, deletedAt: null },
          include: { fieldPlot: { select: { name: true } } },
        });
        if (!harvest) {
          throw new HarvestConversionError(`Colheita de laranja ${harvestId} não encontrada`, 404);
        }
        originalQuantity = Number(harvest.numberOfBoxes);
        originalUnit = 'cx';
        fieldPlotName = harvest.fieldPlot?.name ?? '';
        harvestDate = (harvest.harvestDate as Date).toISOString().split('T')[0];
      }

      // Convert to target unit
      let convertedQuantity: number;
      if (originalUnit === input.targetUnit) {
        convertedQuantity = originalQuantity;
      } else if (originalUnit === 'L') {
        const result = convertCoffeeLiters(
          originalQuantity,
          input.targetUnit,
          DEFAULT_YIELD_LITERS_PER_SAC,
        );
        if (result == null) {
          throw new HarvestConversionError(
            `Não é possível converter de ${originalUnit} para ${input.targetUnit}`,
            400,
          );
        }
        convertedQuantity = result;
      } else {
        const result = convertViaKg(originalQuantity, originalUnit, input.targetUnit);
        if (result == null) {
          throw new HarvestConversionError(
            `Não é possível converter de ${originalUnit} para ${input.targetUnit}`,
            400,
          );
        }
        convertedQuantity = result;
      }

      convertedQuantity = round(convertedQuantity, 4);
      totalConverted += convertedQuantity;

      items.push({
        harvestId,
        fieldPlotName,
        harvestDate,
        originalQuantity: round(originalQuantity, 2),
        originalUnit,
        convertedQuantity,
        targetUnit: input.targetUnit,
      });
    }

    // Generate manifest number: FARM-YYYYMMDD-NNN
    const dateStr = input.deliveryDate.replace(/-/g, '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await (tx as any).grainHarvest.count({
      where: { farmId, deletedAt: null },
    });
    const manifestNumber = `ROM-${dateStr}-${String(count + 1).padStart(3, '0')}`;

    return {
      manifestNumber,
      farmId,
      farmName: farm.name as string,
      deliveryDate: input.deliveryDate,
      recipient: input.recipient?.trim() ?? null,
      transporterName: input.transporterName?.trim() ?? null,
      vehiclePlate: input.vehiclePlate?.trim().toUpperCase() ?? null,
      targetUnit: input.targetUnit,
      targetUnitLabel: getUnitLabel(input.targetUnit),
      items,
      totalConverted: round(totalConverted, 4),
      notes: input.notes?.trim() ?? null,
      generatedAt: new Date().toISOString(),
    };
  });
}
