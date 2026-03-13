import { convertToStockUnit, getBaseUnitAbbrev } from './unit-conversion-bridge';

// ─── Mock Prisma ─────────────────────────────────────────────────────

function createMockTx(
  overrides: {
    productUnitConfig?: Record<string, unknown> | null;
    measurementUnit?: Record<string, unknown> | null;
    unitConversion?: Record<string, unknown> | null;
    unitConversions?: Array<Record<string, unknown>>;
    unitConversionSecondHop?: Record<string, unknown> | null;
  } = {},
) {
  return {
    productUnitConfig: {
      findFirst: jest.fn().mockResolvedValue(overrides.productUnitConfig ?? null),
    },
    measurementUnit: {
      findFirst: jest.fn().mockResolvedValue(overrides.measurementUnit ?? null),
    },
    unitConversion: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(overrides.unitConversion ?? null)
        .mockResolvedValueOnce(overrides.unitConversionSecondHop ?? null),
      findMany: jest.fn().mockResolvedValue(overrides.unitConversions ?? []),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ─── getBaseUnitAbbrev ──────────────────────────────────────────────

describe('getBaseUnitAbbrev', () => {
  it('returns L for liquid dose units', () => {
    expect(getBaseUnitAbbrev('L_HA')).toBe('L');
    expect(getBaseUnitAbbrev('ML_HA')).toBe('L');
  });

  it('returns kg for solid dose units', () => {
    expect(getBaseUnitAbbrev('KG_HA')).toBe('kg');
    expect(getBaseUnitAbbrev('G_HA')).toBe('kg');
    expect(getBaseUnitAbbrev('T_HA')).toBe('kg');
    expect(getBaseUnitAbbrev('G_PLANTA')).toBe('kg');
  });

  it('defaults to kg for unknown dose units', () => {
    expect(getBaseUnitAbbrev('UNKNOWN')).toBe('kg');
  });
});

// ─── convertToStockUnit ─────────────────────────────────────────────

describe('convertToStockUnit', () => {
  const ORG_ID = 'org-1';
  const PRODUCT_ID = 'prod-1';

  it('returns base quantity when no ProductUnitConfig exists', async () => {
    const tx = createMockTx({ productUnitConfig: null });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 16, 'L_HA');

    expect(result).toEqual({
      stockQuantity: 16,
      stockUnitAbbrev: 'L',
      conversionApplied: false,
      factor: null,
      baseQuantity: 16,
      baseUnitAbbrev: 'L',
    });
  });

  it('returns base quantity when stock unit matches base unit', async () => {
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-L', abbreviation: 'L', category: 'VOLUME' },
        productConversions: [],
        densityGPerMl: null,
      },
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 16, 'L_HA');

    expect(result.stockQuantity).toBe(16);
    expect(result.conversionApplied).toBe(false);
  });

  it('uses product-specific conversion when available', async () => {
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-mL', abbreviation: 'mL', category: 'VOLUME' },
        productConversions: [
          {
            fromUnitId: 'unit-L',
            toUnitId: 'unit-mL',
            factor: 1000, // 1 L = 1000 mL
            fromUnit: { abbreviation: 'L' },
            toUnit: { abbreviation: 'mL' },
          },
        ],
        densityGPerMl: null,
      },
      measurementUnit: { id: 'unit-L', abbreviation: 'L', category: 'VOLUME' },
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 16, 'L_HA');

    expect(result.stockQuantity).toBe(16000);
    expect(result.stockUnitAbbrev).toBe('mL');
    expect(result.conversionApplied).toBe(true);
    expect(result.factor).toBe(1000);
    expect(result.baseQuantity).toBe(16);
    expect(result.baseUnitAbbrev).toBe('L');
  });

  it('uses density-based conversion (weight→volume)', async () => {
    // Product stocked in L but dose calculated in kg, density 1.2 g/mL
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-L', abbreviation: 'L', category: 'VOLUME' },
        productConversions: [],
        densityGPerMl: 1.2,
      },
      measurementUnit: { id: 'unit-kg', abbreviation: 'kg', category: 'WEIGHT' },
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 10, 'KG_HA');

    // 10 kg / 1.2 density = 8.333... L
    expect(result.stockQuantity).toBeCloseTo(8.333333, 4);
    expect(result.stockUnitAbbrev).toBe('L');
    expect(result.conversionApplied).toBe(true);
    expect(result.factor).toBeCloseTo(1 / 1.2, 6);
  });

  it('uses density-based conversion (volume→weight)', async () => {
    // Product stocked in kg but dose calculated in L, density 1.2 g/mL
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-kg', abbreviation: 'kg', category: 'WEIGHT' },
        productConversions: [],
        densityGPerMl: 1.2,
      },
      measurementUnit: { id: 'unit-L', abbreviation: 'L', category: 'VOLUME' },
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 10, 'L_HA');

    // 10 L * 1.2 density = 12 kg
    expect(result.stockQuantity).toBe(12);
    expect(result.stockUnitAbbrev).toBe('kg');
    expect(result.conversionApplied).toBe(true);
    expect(result.factor).toBe(1.2);
  });

  it('uses global direct conversion as fallback', async () => {
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-sc', abbreviation: 'sc', category: 'WEIGHT' },
        productConversions: [],
        densityGPerMl: null,
      },
      measurementUnit: { id: 'unit-kg', abbreviation: 'kg', category: 'WEIGHT' },
    });

    // Override unitConversion findFirst to return a direct conversion
    tx.unitConversion.findFirst = jest.fn().mockResolvedValue({
      factor: 1 / 60, // 1 kg = 1/60 sc (1 saco = 60 kg)
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 120, 'KG_HA');

    // 120 kg * (1/60) = 2 sc
    expect(result.stockQuantity).toBe(2);
    expect(result.stockUnitAbbrev).toBe('sc');
    expect(result.conversionApplied).toBe(true);
    expect(result.factor).toBeCloseTo(1 / 60, 6);
  });

  it('uses 2-hop global conversion as final fallback', async () => {
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-sc', abbreviation: 'sc', category: 'WEIGHT' },
        productConversions: [],
        densityGPerMl: null,
      },
      measurementUnit: { id: 'unit-g', abbreviation: 'g', category: 'WEIGHT' },
    });

    // No direct conversion
    tx.unitConversion.findFirst = jest.fn().mockResolvedValue(null);

    // 2-hop: g → kg (factor 0.001), kg → sc (factor 1/60)
    tx.unitConversion.findMany = jest
      .fn()
      .mockResolvedValue([{ toUnitId: 'unit-kg', factor: 0.001 }]);

    // Second hop: kg → sc
    // Override findFirst for second call (inside tryTwoHopConversion)
    let findFirstCallCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx.unitConversion.findFirst = jest.fn().mockImplementation((args: any) => {
      findFirstCallCount++;
      if (findFirstCallCount === 1) return null; // No direct conversion
      // Second call is from 2-hop
      if (args?.where?.fromUnitId === 'unit-kg' && args?.where?.toUnitId === 'unit-sc') {
        return { factor: 1 / 60 };
      }
      return null;
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 6000, 'G_HA');

    // 6000 g → kg (0.001) → sc (1/60) = 6000 * 0.001 * (1/60) = 0.1 sc
    expect(result.stockQuantity).toBeCloseTo(0.1, 4);
    expect(result.stockUnitAbbrev).toBe('sc');
    expect(result.conversionApplied).toBe(true);
  });

  it('returns base quantity when base unit not found in system', async () => {
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-sc', abbreviation: 'sc', category: 'WEIGHT' },
        productConversions: [],
        densityGPerMl: null,
      },
      measurementUnit: null, // base unit not found
    });

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 100, 'KG_HA');

    expect(result.stockQuantity).toBe(100);
    expect(result.stockUnitAbbrev).toBe('kg');
    expect(result.conversionApplied).toBe(false);
  });

  it('returns base quantity when no conversion path exists', async () => {
    const tx = createMockTx({
      productUnitConfig: {
        stockUnit: { id: 'unit-custom', abbreviation: 'cx', category: 'COUNT' },
        productConversions: [],
        densityGPerMl: null,
      },
      measurementUnit: { id: 'unit-kg', abbreviation: 'kg', category: 'WEIGHT' },
    });

    // No conversions found
    tx.unitConversion.findFirst = jest.fn().mockResolvedValue(null);
    tx.unitConversion.findMany = jest.fn().mockResolvedValue([]);

    const result = await convertToStockUnit(tx, ORG_ID, PRODUCT_ID, 100, 'KG_HA');

    expect(result.stockQuantity).toBe(100);
    expect(result.stockUnitAbbrev).toBe('kg');
    expect(result.conversionApplied).toBe(false);
  });
});
