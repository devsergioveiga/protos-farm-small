import Decimal from 'decimal.js';

// ─── Mock Prisma ──────────────────────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {
    asset: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    depreciationEntry: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    assetDisposal: {
      count: jest.fn(),
    },
    workOrder: {
      groupBy: jest.fn(),
    },
    fuelRecord: {
      groupBy: jest.fn(),
    },
  },
}));

jest.mock('../depreciation/depreciation-engine.service', () => ({
  computeDepreciation: jest.fn(),
}));

import { prisma } from '../../database/prisma';
import { computeDepreciation } from '../depreciation/depreciation-engine.service';
import {
  getInventoryReport,
  getDepreciationProjection,
  getTCOFleet,
  exportInventoryReport,
} from './asset-reports.service';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedComputeDepreciation = computeDepreciation as jest.MockedFunction<
  typeof computeDepreciation
>;

const ORG_ID = 'org-1';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getInventoryReport ────────────────────────────────────────────────

describe('getInventoryReport', () => {
  it('rolls up 2 classifications with known values — correct per-row and totals', async () => {
    // Assets: MAQUINA has 2 assets worth 100k and 50k, VEICULO 1 asset worth 30k
    (mockedPrisma.asset.groupBy as jest.Mock).mockResolvedValue([
      { classification: 'MAQUINA', _sum: { acquisitionValue: new Decimal('150000') }, _count: 2 },
      { classification: 'VEICULO', _sum: { acquisitionValue: new Decimal('30000') }, _count: 1 },
    ]);

    // Asset id -> classification mapping
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', classification: 'MAQUINA' },
      { id: 'a2', classification: 'MAQUINA' },
      { id: 'a3', classification: 'VEICULO' },
    ]);

    // Depreciation entries per asset
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([
      { assetId: 'a1', _sum: { depreciationAmount: new Decimal('20000') } },
      { assetId: 'a2', _sum: { depreciationAmount: new Decimal('10000') } },
      { assetId: 'a3', _sum: { depreciationAmount: new Decimal('5000') } },
    ]);

    const result = await getInventoryReport({ organizationId: ORG_ID });

    expect(result.rows).toHaveLength(2);

    const maquinaRow = result.rows.find((r) => r.classification === 'MAQUINA');
    expect(maquinaRow).toBeDefined();
    expect(maquinaRow!.grossValue).toBe(150000);
    expect(maquinaRow!.accumulatedDepreciation).toBe(30000);
    expect(maquinaRow!.netBookValue).toBe(120000);
    expect(maquinaRow!.count).toBe(2);

    const veiculoRow = result.rows.find((r) => r.classification === 'VEICULO');
    expect(veiculoRow!.grossValue).toBe(30000);
    expect(veiculoRow!.accumulatedDepreciation).toBe(5000);
    expect(veiculoRow!.netBookValue).toBe(25000);

    expect(result.totals.count).toBe(3);
    expect(result.totals.grossValue).toBe(180000);
    expect(result.totals.accumulatedDepreciation).toBe(35000);
    expect(result.totals.netBookValue).toBe(145000);
    expect(typeof result.generatedAt).toBe('string');
  });

  it('empty dataset returns empty rows and zero totals', async () => {
    (mockedPrisma.asset.groupBy as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getInventoryReport({ organizationId: ORG_ID });

    expect(result.rows).toHaveLength(0);
    expect(result.totals.count).toBe(0);
    expect(result.totals.grossValue).toBe(0);
    expect(result.totals.accumulatedDepreciation).toBe(0);
    expect(result.totals.netBookValue).toBe(0);
  });

  it('with dateFrom/dateTo counts acquisitions and disposals in period', async () => {
    (mockedPrisma.asset.groupBy as jest.Mock).mockResolvedValue([
      { classification: 'MAQUINA', _sum: { acquisitionValue: new Decimal('100000') }, _count: 1 },
    ]);
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', classification: 'MAQUINA' },
    ]);
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);
    // Acquisitions count in period
    (mockedPrisma.asset.count as jest.Mock).mockResolvedValue(1);
    // Disposals count in period
    (mockedPrisma.assetDisposal.count as jest.Mock).mockResolvedValue(0);

    const result = await getInventoryReport({
      organizationId: ORG_ID,
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
    });

    expect(result.rows[0].acquisitionsInPeriod).toBe(1);
    expect(result.rows[0].disposalsInPeriod).toBe(0);
  });
});

// ─── getDepreciationProjection ─────────────────────────────────────────

describe('getDepreciationProjection', () => {
  const makeAsset = (id: string, method = 'STRAIGHT_LINE') => ({
    id,
    status: 'ATIVO',
    acquisitionDate: new Date('2020-01-01'),
    acquisitionValue: new Decimal('100000'),
    depreciationConfig: {
      method,
      fiscalAnnualRate: new Decimal('0.1'),
      managerialAnnualRate: null,
      usefulLifeMonths: 120,
      residualValue: new Decimal('10000'),
      totalHours: null,
      totalUnits: null,
      accelerationFactor: null,
      activeTrack: 'FISCAL',
    },
    depreciationEntries: [],
  });

  it('horizonMonths=12 produces exactly 12 rows', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([makeAsset('a1')]);
    mockedComputeDepreciation.mockReturnValue({
      depreciationAmount: new Decimal('750'),
      closingBookValue: new Decimal('99250'),
      proRataDays: null,
      daysInMonth: 30,
      skipped: false,
    });

    const result = await getDepreciationProjection({ organizationId: ORG_ID, horizonMonths: 12 });

    expect(result.rows).toHaveLength(12);
  });

  it('cumulativeDepreciation is monotonically increasing across rows', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([makeAsset('a1')]);
    let call = 0;
    mockedComputeDepreciation.mockImplementation(() => {
      call++;
      return {
        depreciationAmount: new Decimal('750'),
        closingBookValue: new Decimal(100000 - call * 750),
        proRataDays: null,
        daysInMonth: 30,
        skipped: false,
      };
    });

    const result = await getDepreciationProjection({ organizationId: ORG_ID, horizonMonths: 12 });

    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i].cumulativeDepreciation).toBeGreaterThan(
        result.rows[i - 1].cumulativeDepreciation,
      );
    }
  });

  it('asset already at residual value produces zero depreciationAmount rows', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([makeAsset('a1')]);
    mockedComputeDepreciation.mockReturnValue({
      depreciationAmount: new Decimal('0'),
      closingBookValue: new Decimal('10000'),
      proRataDays: null,
      daysInMonth: 30,
      skipped: true,
      skipReason: 'Valor residual atingido',
    });

    const result = await getDepreciationProjection({ organizationId: ORG_ID, horizonMonths: 12 });

    expect(result.rows).toHaveLength(12);
    result.rows.forEach((row) => {
      expect(row.projectedDepreciation).toBe(0);
    });
  });

  it('HOURS_OF_USE method falls back to STRAIGHT_LINE and increments assetsEstimated', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([makeAsset('a1', 'HOURS_OF_USE')]);
    mockedComputeDepreciation.mockReturnValue({
      depreciationAmount: new Decimal('750'),
      closingBookValue: new Decimal('99250'),
      proRataDays: null,
      daysInMonth: 30,
      skipped: false,
    });

    const result = await getDepreciationProjection({ organizationId: ORG_ID, horizonMonths: 12 });

    expect(result.assetsEstimated).toBe(1);
    expect(mockedComputeDepreciation).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ method: 'STRAIGHT_LINE' }),
      }),
    );
  });
});

// ─── getTCOFleet ───────────────────────────────────────────────────────

describe('getTCOFleet', () => {
  const makeFleetAssets = () => [
    {
      id: 'a1',
      name: 'Trator A',
      assetTag: 'PAT-001',
      assetType: 'MAQUINA',
      acquisitionValue: new Decimal('100000'),
      currentHourmeter: new Decimal('500'),
    },
  ];

  it('acquisitionValue=0 produces alert=NO_DATA and repairRatio=null', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a1',
        name: 'Trator A',
        assetTag: 'PAT-001',
        assetType: 'MAQUINA',
        acquisitionValue: new Decimal('0'),
        currentHourmeter: null,
      },
    ]);
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.workOrder.groupBy as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.fuelRecord.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getTCOFleet({ organizationId: ORG_ID });

    expect(result.assets[0].alert).toBe('NO_DATA');
    expect(result.assets[0].repairRatio).toBeNull();
  });

  it('maintenanceCost/acquisitionValue >= 0.70 produces alert=REPLACE', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue(makeFleetAssets());
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);
    // maintenanceCost = 75000, acquisitionValue = 100000, ratio = 0.75
    (mockedPrisma.workOrder.groupBy as jest.Mock).mockResolvedValue([
      { assetId: 'a1', _sum: { totalCost: new Decimal('75000') } },
    ]);
    (mockedPrisma.fuelRecord.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getTCOFleet({ organizationId: ORG_ID });

    expect(result.assets[0].alert).toBe('REPLACE');
    expect(result.assets[0].repairRatio).toBeCloseTo(0.75);
  });

  it('maintenanceCost/acquisitionValue >= 0.60 but < 0.70 produces alert=MONITOR', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue(makeFleetAssets());
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);
    // maintenanceCost = 65000, ratio = 0.65
    (mockedPrisma.workOrder.groupBy as jest.Mock).mockResolvedValue([
      { assetId: 'a1', _sum: { totalCost: new Decimal('65000') } },
    ]);
    (mockedPrisma.fuelRecord.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getTCOFleet({ organizationId: ORG_ID });

    expect(result.assets[0].alert).toBe('MONITOR');
  });

  it('maintenanceCost/acquisitionValue < 0.60 produces alert=OK', async () => {
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue(makeFleetAssets());
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);
    // maintenanceCost = 50000, ratio = 0.50
    (mockedPrisma.workOrder.groupBy as jest.Mock).mockResolvedValue([
      { assetId: 'a1', _sum: { totalCost: new Decimal('50000') } },
    ]);
    (mockedPrisma.fuelRecord.groupBy as jest.Mock).mockResolvedValue([]);

    const result = await getTCOFleet({ organizationId: ORG_ID });

    expect(result.assets[0].alert).toBe('OK');
  });
});

// ─── exportInventoryReport ────────────────────────────────────────────

describe('exportInventoryReport', () => {
  it('format=pdf returns a non-empty Buffer', async () => {
    (mockedPrisma.asset.groupBy as jest.Mock).mockResolvedValue([
      { classification: 'MAQUINA', _sum: { acquisitionValue: new Decimal('100000') }, _count: 1 },
    ]);
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', classification: 'MAQUINA' },
    ]);
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);

    const buffer = await exportInventoryReport({ organizationId: ORG_ID }, 'pdf');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('format=xlsx returns a non-empty Buffer', async () => {
    (mockedPrisma.asset.groupBy as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);

    const buffer = await exportInventoryReport({ organizationId: ORG_ID }, 'xlsx');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('format=csv returns a non-empty Buffer', async () => {
    (mockedPrisma.asset.groupBy as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([]);
    (mockedPrisma.depreciationEntry.groupBy as jest.Mock).mockResolvedValue([]);

    const buffer = await exportInventoryReport({ organizationId: ORG_ID }, 'csv');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
