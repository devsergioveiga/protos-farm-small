// ─── Error ──────────────────────────────────────────────────────────

export class MeasurementUnitError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MeasurementUnitError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const UNIT_CATEGORIES = ['WEIGHT', 'VOLUME', 'COUNT', 'AREA'] as const;
export type UnitCategory = (typeof UNIT_CATEGORIES)[number];

export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  WEIGHT: 'Peso',
  VOLUME: 'Volume',
  COUNT: 'Contagem',
  AREA: 'Área',
};

/**
 * System units seeded for every org on first access.
 * abbreviation is the unique key per org.
 */
export const SYSTEM_UNITS: {
  name: string;
  abbreviation: string;
  category: UnitCategory;
}[] = [
  // Weight
  { name: 'Quilograma', abbreviation: 'kg', category: 'WEIGHT' },
  { name: 'Grama', abbreviation: 'g', category: 'WEIGHT' },
  { name: 'Tonelada', abbreviation: 't', category: 'WEIGHT' },
  { name: 'Arroba', abbreviation: '@', category: 'WEIGHT' },
  { name: 'Saco (60 kg)', abbreviation: 'sc', category: 'WEIGHT' },
  // Volume
  { name: 'Litro', abbreviation: 'L', category: 'VOLUME' },
  { name: 'Mililitro', abbreviation: 'mL', category: 'VOLUME' },
  // Count
  { name: 'Unidade', abbreviation: 'un', category: 'COUNT' },
  { name: 'Caixa (40,8 kg)', abbreviation: 'cx', category: 'COUNT' },
  // Area
  { name: 'Hectare', abbreviation: 'ha', category: 'AREA' },
  { name: 'Alqueire paulista', abbreviation: 'alq', category: 'AREA' },
];

/**
 * Global conversions seeded as system defaults (CA2).
 * Keyed by [fromAbbreviation, toAbbreviation] → factor.
 * fromUnit * factor = toUnit
 */
export const SYSTEM_CONVERSIONS: {
  from: string;
  to: string;
  factor: number;
}[] = [
  // Weight
  { from: 't', to: 'kg', factor: 1000 },
  { from: 'kg', to: 'g', factor: 1000 },
  { from: 'sc', to: 'kg', factor: 60 },
  { from: '@', to: 'kg', factor: 15 }, // arroba bovina = 15 kg (café = 30 kg via product-level)
  // Volume
  { from: 'L', to: 'mL', factor: 1000 },
  // Count → Weight (laranja)
  { from: 'cx', to: 'kg', factor: 40.8 },
  // Area
  { from: 'alq', to: 'ha', factor: 2.42 }, // alqueire paulista
];

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateUnitInput {
  name: string;
  abbreviation: string;
  category: string;
}

export type UpdateUnitInput = Partial<CreateUnitInput> & { isActive?: boolean };

export interface ListUnitsQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  includeInactive?: boolean;
}

export interface CreateConversionInput {
  fromUnitId: string;
  toUnitId: string;
  factor: number;
}

export interface UpdateConversionInput {
  factor?: number;
  isActive?: boolean;
}

export interface ListConversionsQuery {
  page?: number;
  limit?: number;
  unitId?: string; // filter conversions involving this unit
}

// ─── Response Types ─────────────────────────────────────────────────

export interface UnitItem {
  id: string;
  organizationId: string;
  name: string;
  abbreviation: string;
  category: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionItem {
  id: string;
  organizationId: string;
  fromUnitId: string;
  fromUnitName: string;
  fromUnitAbbreviation: string;
  toUnitId: string;
  toUnitName: string;
  toUnitAbbreviation: string;
  factor: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertResult {
  fromValue: number;
  fromUnit: string;
  toValue: number;
  toUnit: string;
  factor: number;
  path: string[]; // chain of conversions used
}
