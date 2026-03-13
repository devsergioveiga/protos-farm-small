/**
 * Bridge between dose calculations and the measurement-units conversion system.
 *
 * Converts a calculated quantity (in base units like L or kg) to the product's
 * configured stock unit, using product-specific conversions, density, or global
 * conversions as needed.
 *
 * Used by field operation services (pesticide, fertilizer, soil-prep, planting)
 * to ensure stock deductions use the correct unit.
 *
 * US-096 CA1: Conversão automática em operações de campo
 */

import type { TxClient } from '../../database/rls';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ─────────────────────────────────────────────────────────

export interface StockUnitConversionResult {
  /** Quantity in the product's stock unit */
  stockQuantity: number;
  /** Abbreviation of the stock unit (e.g. 'L', 'kg', 'mL', 'sc') */
  stockUnitAbbrev: string;
  /** Whether a conversion was applied (false if stock unit matches base unit) */
  conversionApplied: boolean;
  /** Conversion factor used (null if no conversion) */
  factor: number | null;
  /** Original quantity before conversion (in base unit) */
  baseQuantity: number;
  /** Base unit abbreviation (e.g. 'L', 'kg') */
  baseUnitAbbrev: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/**
 * Maps dose unit strings to the base stock unit abbreviation.
 * Liquid dose units (L_HA, ML_HA) → 'L'
 * Solid dose units (KG_HA, G_HA, T_HA, G_PLANTA) → 'kg'
 */
export function getBaseUnitAbbrev(doseUnit: string): string {
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
      return 'kg';
  }
}

// ─── Main conversion function ─────────────────────────────────────

/**
 * Convert a calculated quantity (in base unit) to the product's configured stock unit.
 *
 * Flow:
 * 1. Look up the product's ProductUnitConfig for stockUnitId
 * 2. Find the MeasurementUnit matching the base abbreviation (L/kg)
 * 3. If stock unit matches base unit → return quantity unchanged
 * 4. If stock unit differs:
 *    a. Try product-specific conversion
 *    b. Try density-based conversion (weight↔volume)
 *    c. Try global/system conversion (direct or 2-hop)
 * 5. If no conversion path found → return quantity unchanged with base unit
 *
 * @param tx - Prisma transaction client (already inside withRlsContext)
 * @param organizationId - Organization for scoping units/conversions
 * @param productId - Product to look up unit config for
 * @param baseQuantity - Quantity calculated by doseToAbsoluteQuantity (in L or kg)
 * @param doseUnit - Original dose unit string (e.g. 'L_HA', 'KG_HA')
 */
export async function convertToStockUnit(
  tx: TxClient,
  organizationId: string,
  productId: string,
  baseQuantity: number,
  doseUnit: string,
): Promise<StockUnitConversionResult> {
  const baseUnitAbbrev = getBaseUnitAbbrev(doseUnit);

  // 1. Look up product's unit config
  const config = await (tx as any).productUnitConfig.findFirst({
    where: { organizationId, productId },
    include: {
      stockUnit: { select: { id: true, abbreviation: true, category: true } },
      productConversions: {
        include: {
          fromUnit: { select: { id: true, abbreviation: true, category: true } },
          toUnit: { select: { id: true, abbreviation: true, category: true } },
        },
      },
    },
  });

  // No config → no conversion needed, use base unit
  if (!config?.stockUnit) {
    return {
      stockQuantity: baseQuantity,
      stockUnitAbbrev: baseUnitAbbrev,
      conversionApplied: false,
      factor: null,
      baseQuantity,
      baseUnitAbbrev,
    };
  }

  const stockUnitAbbrev = config.stockUnit.abbreviation as string;

  // 2. If stock unit matches base unit → no conversion needed
  if (stockUnitAbbrev === baseUnitAbbrev) {
    return {
      stockQuantity: baseQuantity,
      stockUnitAbbrev,
      conversionApplied: false,
      factor: null,
      baseQuantity,
      baseUnitAbbrev,
    };
  }

  // 3. Find the base unit's MeasurementUnit ID
  const baseUnit = await (tx as any).measurementUnit.findFirst({
    where: { organizationId, abbreviation: baseUnitAbbrev, isActive: true },
    select: { id: true, abbreviation: true, category: true },
  });

  if (!baseUnit) {
    // Base unit not found in system → can't convert, use as-is
    return {
      stockQuantity: baseQuantity,
      stockUnitAbbrev: baseUnitAbbrev,
      conversionApplied: false,
      factor: null,
      baseQuantity,
      baseUnitAbbrev,
    };
  }

  const stockUnitId = config.stockUnit.id as string;
  const baseUnitId = baseUnit.id as string;

  // 4a. Try product-specific conversion (base → stock)
  const productConversion = config.productConversions?.find(
    (pc: any) => pc.fromUnitId === baseUnitId && pc.toUnitId === stockUnitId,
  );
  if (productConversion) {
    const factor = toNumber(productConversion.factor);
    return {
      stockQuantity: round(baseQuantity * factor, 6),
      stockUnitAbbrev,
      conversionApplied: true,
      factor,
      baseQuantity,
      baseUnitAbbrev,
    };
  }

  // 4b. Try density-based conversion (weight↔volume)
  if (config.densityGPerMl) {
    const density = toNumber(config.densityGPerMl);
    const densityResult = tryDensityConversion(
      baseUnit.category as string,
      config.stockUnit.category as string,
      baseQuantity,
      density,
      baseUnitAbbrev,
      stockUnitAbbrev,
    );
    if (densityResult) return densityResult;
  }

  // 4c. Try global/system conversion (direct)
  const directConversion = await (tx as any).unitConversion.findFirst({
    where: {
      organizationId,
      fromUnitId: baseUnitId,
      toUnitId: stockUnitId,
      isActive: true,
    },
  });

  if (directConversion) {
    const factor = toNumber(directConversion.factor);
    return {
      stockQuantity: round(baseQuantity * factor, 6),
      stockUnitAbbrev,
      conversionApplied: true,
      factor,
      baseQuantity,
      baseUnitAbbrev,
    };
  }

  // 4d. Try 2-hop global conversion (base → intermediate → stock)
  const twoHopResult = await tryTwoHopConversion(
    tx,
    organizationId,
    baseUnitId,
    stockUnitId,
    baseQuantity,
    baseUnitAbbrev,
    stockUnitAbbrev,
  );
  if (twoHopResult) return twoHopResult;

  // 5. No conversion path found → return as-is with base unit
  return {
    stockQuantity: baseQuantity,
    stockUnitAbbrev: baseUnitAbbrev,
    conversionApplied: false,
    factor: null,
    baseQuantity,
    baseUnitAbbrev,
  };
}

// ─── Density conversion ───────────────────────────────────────────

function tryDensityConversion(
  fromCategory: string,
  toCategory: string,
  value: number,
  densityGPerMl: number,
  fromAbbrev: string,
  toAbbrev: string,
): StockUnitConversionResult | null {
  const isFromWeight = fromCategory === 'WEIGHT';
  const isFromVolume = fromCategory === 'VOLUME';
  const isToWeight = toCategory === 'WEIGHT';
  const isToVolume = toCategory === 'VOLUME';

  if (!((isFromWeight && isToVolume) || (isFromVolume && isToWeight))) {
    return null;
  }

  if (isFromWeight && isToVolume) {
    // weight → volume: g / density = mL
    // For base units: kg / (density * 1000) = L, which simplifies to kg / density = L
    // Actually: 1 kg = 1000 g, 1000 g / density = mL, mL / 1000 = L
    // So: kg → L = (kg * 1000 / density) / 1000 = kg / density
    const factor = 1 / densityGPerMl;
    return {
      stockQuantity: round(value * factor, 6),
      stockUnitAbbrev: toAbbrev,
      conversionApplied: true,
      factor,
      baseQuantity: value,
      baseUnitAbbrev: fromAbbrev,
    };
  }

  // volume → weight: mL * density = g
  // For base units: L * density * 1000 / 1000 = L * density → kg
  const factor = densityGPerMl;
  return {
    stockQuantity: round(value * factor, 6),
    stockUnitAbbrev: toAbbrev,
    conversionApplied: true,
    factor,
    baseQuantity: value,
    baseUnitAbbrev: fromAbbrev,
  };
}

// ─── 2-hop conversion ─────────────────────────────────────────────

async function tryTwoHopConversion(
  tx: TxClient,
  organizationId: string,
  fromUnitId: string,
  toUnitId: string,
  value: number,
  fromAbbrev: string,
  toAbbrev: string,
): Promise<StockUnitConversionResult | null> {
  const fromConversions = await (tx as any).unitConversion.findMany({
    where: { organizationId, fromUnitId, isActive: true },
    select: { toUnitId: true, factor: true },
  });

  for (const first of fromConversions) {
    const second = await (tx as any).unitConversion.findFirst({
      where: {
        organizationId,
        fromUnitId: first.toUnitId,
        toUnitId,
        isActive: true,
      },
      select: { factor: true },
    });

    if (second) {
      const factor = toNumber(first.factor) * toNumber(second.factor);
      return {
        stockQuantity: round(value * factor, 6),
        stockUnitAbbrev: toAbbrev,
        conversionApplied: true,
        factor,
        baseQuantity: value,
        baseUnitAbbrev: fromAbbrev,
      };
    }
  }

  return null;
}

// ─── Utility ──────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
