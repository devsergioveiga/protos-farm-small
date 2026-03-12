/**
 * Client-side dose conversion utilities.
 * Mirrors backend doseToAbsoluteQuantity + spray mix calculation (CA7).
 */

// ─── Dose → base unit conversion ──────────────────────────────────

/**
 * Convert a per-hectare (or per-plant) dose to absolute quantity in base units.
 * Base units: L for liquids (L_HA, ML_HA), kg for solids (KG_HA, G_HA, T_HA).
 */
export function doseToAbsoluteQuantity(
  dose: number,
  doseUnit: string,
  areaHa: number,
  plantsPerHa?: number,
): number {
  switch (doseUnit) {
    case 'L_HA':
      return dose * areaHa;
    case 'KG_HA':
      return dose * areaHa;
    case 'ML_HA':
      return (dose * areaHa) / 1000;
    case 'G_HA':
      return (dose * areaHa) / 1000;
    case 'T_HA':
      return dose * areaHa * 1000;
    case 'G_PLANTA':
      if (plantsPerHa) {
        return (dose * plantsPerHa * areaHa) / 1000;
      }
      return dose / 1000;
    default:
      return dose * areaHa;
  }
}

// ─── Base unit labels ─────────────────────────────────────────────

/** Returns the base stock unit for a given dose unit */
export function getBaseUnit(doseUnit: string): string {
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

/** Human-readable dose unit label */
export function getDoseUnitLabel(doseUnit: string): string {
  const labels: Record<string, string> = {
    L_HA: 'L/ha',
    KG_HA: 'kg/ha',
    ML_HA: 'mL/ha',
    G_HA: 'g/ha',
    T_HA: 't/ha',
    G_PLANTA: 'g/planta',
  };
  return labels[doseUnit] || doseUnit;
}

// ─── Spray mix calculation (CA7) ──────────────────────────────────

export interface SprayMixResult {
  /** Total spray volume for the entire area (L) */
  totalSprayVolume: number;
  /** Total product quantity for the entire area (base unit) */
  totalProductQuantity: number;
  /** Number of tanks needed */
  tanksNeeded: number;
  /** Product quantity per tank (base unit) */
  productPerTank: number;
  /** Spray volume per tank (L) */
  sprayVolumePerTank: number;
}

/**
 * Calculate spray mix quantities from dose + spray volume per hectare.
 * Used for pesticide applications (CA7).
 *
 * @param dose - product dose value
 * @param doseUnit - dose unit (L_HA, ML_HA, etc.)
 * @param sprayVolumeLPerHa - spray volume in L/ha
 * @param areaHa - area in hectares
 * @param tankCapacityL - tank capacity in liters (default 2000L)
 */
export function calculateSprayMix(
  dose: number,
  doseUnit: string,
  sprayVolumeLPerHa: number,
  areaHa: number,
  tankCapacityL: number = 2000,
): SprayMixResult | null {
  if (dose <= 0 || sprayVolumeLPerHa <= 0 || areaHa <= 0 || tankCapacityL <= 0) {
    return null;
  }

  const totalSprayVolume = sprayVolumeLPerHa * areaHa;
  const totalProductQuantity = doseToAbsoluteQuantity(dose, doseUnit, areaHa);
  const tanksNeeded = Math.ceil(totalSprayVolume / tankCapacityL);
  const productPerTank = totalProductQuantity / tanksNeeded;
  const sprayVolumePerTank = totalSprayVolume / tanksNeeded;

  return {
    totalSprayVolume: round(totalSprayVolume, 2),
    totalProductQuantity: round(totalProductQuantity, 4),
    tanksNeeded,
    productPerTank: round(productPerTank, 4),
    sprayVolumePerTank: round(sprayVolumePerTank, 2),
  };
}

// ─── Format helpers ───────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Format a number for display (removes trailing zeros) */
export function formatQuantity(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}
