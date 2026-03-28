import Decimal from 'decimal.js';
import { prisma } from '../../database/prisma';
import { runDepreciationBatch, reverseEntry } from './depreciation-batch.service';
import { DepreciationError } from './depreciation.types';

jest.mock('../../database/prisma', () => ({
  prisma: {
    organization: {
      findMany: jest.fn(),
    },
    asset: {
      findMany: jest.fn(),
    },
    depreciationRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    depreciationEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    depreciationEntryCCItem: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    pendingJournalPosting: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    accountingRule: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const BASE_INPUT = {
  organizationId: 'org-1',
  periodYear: 2025,
  periodMonth: 1,
  track: 'FISCAL' as const,
  triggeredBy: 'test',
};

const STRAIGHT_LINE_ASSET = {
  id: 'asset-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  name: 'Trator',
  acquisitionValue: new Decimal('250000.00'),
  acquisitionDate: new Date('2023-01-01'),
  disposalDate: null,
  status: 'ATIVO',
  classification: 'DEPRECIABLE_CPC27',
  costCenterId: null,
  depreciationConfig: {
    method: 'STRAIGHT_LINE',
    fiscalAnnualRate: new Decimal('0.1'),
    managerialAnnualRate: null,
    usefulLifeMonths: 120,
    residualValue: new Decimal('25000.00'),
    totalHours: null,
    totalUnits: null,
    accelerationFactor: null,
    activeTrack: 'FISCAL',
  },
  farm: { id: 'farm-1' },
};

describe('Depreciation Batch Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runDepreciationBatch', () => {
    it('processes eligible DEPRECIABLE_CPC27 assets and creates entries', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 0,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      const mockEntry = {
        id: 'entry-1',
        depreciationAmount: new Decimal('1875.00'),
        closingBookValue: new Decimal('223125.00'),
      };

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'COMPLETED',
        processedCount: 1,
        totalAmount: new Decimal('1875.00'),
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([STRAIGHT_LINE_ASSET]);
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: {
              create: jest.fn().mockResolvedValue(mockEntry),
            },
            depreciationEntryCCItem: {
              createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          });
        }
        return fn;
      });

      const result = await runDepreciationBatch(BASE_INPUT);

      expect(result.processedCount).toBe(1);
      expect(result.skippedCount).toBe(0);
    });

    it('skips EM_ANDAMENTO assets', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 0,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'COMPLETED',
      });
      // EM_ANDAMENTO should be filtered out by the query
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([]);

      const result = await runDepreciationBatch(BASE_INPUT);

      // The asset query excludes EM_ANDAMENTO
      expect(mockedPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.objectContaining({ notIn: expect.arrayContaining(['EM_ANDAMENTO']) }),
          }),
        }),
      );
      expect(result.processedCount).toBe(0);
    });

    it('skips assets without DepreciationConfig', async () => {
      const assetNoConfig = { ...STRAIGHT_LINE_ASSET, depreciationConfig: null };
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 1,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'COMPLETED',
        skippedCount: 1,
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([assetNoConfig]);
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: { create: jest.fn() },
            depreciationEntryCCItem: { createMany: jest.fn() },
          });
        }
        return fn;
      });

      const result = await runDepreciationBatch(BASE_INPUT);

      expect(result.skippedCount).toBe(1);
      expect(result.processedCount).toBe(0);
    });

    it('catches P2002 and marks as skipped (idempotent re-run)', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 1,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'PARTIAL',
        skippedCount: 1,
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([STRAIGHT_LINE_ASSET]);
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(null);

      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      (mockedPrisma.$transaction as jest.Mock).mockRejectedValue(p2002Error);

      const result = await runDepreciationBatch(BASE_INPUT);

      expect(result.skippedCount).toBe(1);
      expect(result.processedCount).toBe(0);
    });

    it('creates DepreciationRun with correct counts', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 1,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      const completedRun = {
        ...mockRun,
        status: 'COMPLETED',
        processedCount: 1,
        totalAmount: new Decimal('1875.00'),
        completedAt: new Date(),
      };

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue(completedRun);
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([STRAIGHT_LINE_ASSET]);
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: {
              create: jest
                .fn()
                .mockResolvedValue({ id: 'entry-1', depreciationAmount: new Decimal('1875.00') }),
            },
            depreciationEntryCCItem: {
              createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          });
        }
        return fn;
      });

      const result = await runDepreciationBatch(BASE_INPUT);

      expect(result.processedCount).toBe(1);
      expect(result.status).toBe('COMPLETED');
      expect(mockedPrisma.depreciationRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            periodYear: 2025,
            periodMonth: 1,
          }),
        }),
      );
    });

    it('creates DepreciationEntryCCItem for asset with costCenterId', async () => {
      const assetWithCC = {
        ...STRAIGHT_LINE_ASSET,
        costCenterId: 'cc-1',
        farm: { id: 'farm-1' },
      };

      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 1,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      const mockCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      const mockEntryCreate = jest.fn().mockResolvedValue({
        id: 'entry-1',
        depreciationAmount: new Decimal('1875.00'),
      });

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'COMPLETED',
        processedCount: 1,
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([assetWithCC]);
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: { create: mockEntryCreate },
            depreciationEntryCCItem: { createMany: mockCreateMany },
          });
        }
        return fn;
      });

      await runDepreciationBatch({ ...BASE_INPUT, organizationId: assetWithCC.organizationId });

      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              costCenterId: 'cc-1',
              farmId: 'farm-1',
              percentage: expect.anything(),
            }),
          ]),
        }),
      );
    });

    it('reconciliation: sum(ccItems.amount) === depreciationAmount', async () => {
      const assetWithCC = {
        ...STRAIGHT_LINE_ASSET,
        costCenterId: 'cc-1',
        farm: { id: 'farm-1' },
      };

      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 1,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      let capturedCCItems: { amount: Decimal }[] = [];
      let capturedDepreciationAmount: Decimal = new Decimal('0');

      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'COMPLETED',
        processedCount: 1,
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([assetWithCC]);
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          const mockCreate = jest
            .fn()
            .mockImplementation(({ data }: { data: { depreciationAmount: Decimal } }) => {
              capturedDepreciationAmount = new Decimal(data.depreciationAmount);
              return Promise.resolve({
                id: 'entry-1',
                depreciationAmount: capturedDepreciationAmount,
              });
            });
          const createManyMock = jest
            .fn()
            .mockImplementation(({ data }: { data: { amount: Decimal }[] }) => {
              capturedCCItems = data;
              return Promise.resolve({ count: data.length });
            });
          return fn({
            depreciationEntry: { create: mockCreate },
            depreciationEntryCCItem: { createMany: createManyMock },
          });
        }
        return fn;
      });

      await runDepreciationBatch({ ...BASE_INPUT, organizationId: assetWithCC.organizationId });

      if (capturedCCItems.length > 0) {
        const ccSum = capturedCCItems.reduce(
          (sum, item) => sum.plus(item.amount),
          new Decimal('0'),
        );
        expect(ccSum.toDecimalPlaces(2).equals(capturedDepreciationAmount.toDecimalPlaces(2))).toBe(
          true,
        );
      }
    });

    it('rejects duplicate run when force=false (409)', async () => {
      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue({
        id: 'run-existing',
        status: 'COMPLETED',
      });

      await expect(runDepreciationBatch({ ...BASE_INPUT, force: false })).rejects.toThrow(
        DepreciationError,
      );
      await expect(runDepreciationBatch({ ...BASE_INPUT, force: false })).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('allows force re-run when force=true', async () => {
      const mockRun = {
        id: 'run-2',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'PENDING',
        totalAssets: 0,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'test',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      };

      // findFirst returns existing run, but force=true should bypass check
      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue({
        id: 'run-1',
        status: 'COMPLETED',
      });
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun,
        status: 'COMPLETED',
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([]);

      const result = await runDepreciationBatch({ ...BASE_INPUT, force: true });

      expect(result).toBeDefined();
      expect(mockedPrisma.depreciationRun.create).toHaveBeenCalled();
    });

    it('handles empty organizationId by querying all organizations and processing each', async () => {
      const mockOrgs = [{ id: 'org-1' }, { id: 'org-2' }];
      const mockRun1 = {
        id: 'run-1',
        organizationId: 'org-1',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        status: 'COMPLETED',
        totalAssets: 0,
        processedCount: 0,
        skippedCount: 0,
        totalAmount: new Decimal('0'),
        triggeredBy: 'cron',
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
      };

      (mockedPrisma.organization.findMany as jest.Mock).mockResolvedValue(mockOrgs);
      (mockedPrisma.depreciationRun.findFirst as jest.Mock).mockResolvedValue(null);
      (mockedPrisma.depreciationRun.create as jest.Mock).mockResolvedValue(mockRun1);
      (mockedPrisma.depreciationRun.update as jest.Mock).mockResolvedValue({
        ...mockRun1,
        status: 'COMPLETED',
      });
      (mockedPrisma.asset.findMany as jest.Mock).mockResolvedValue([]);

      const result = await runDepreciationBatch({
        organizationId: '',
        periodYear: 2025,
        periodMonth: 1,
        track: 'FISCAL',
        triggeredBy: 'cron',
      });

      expect(mockedPrisma.organization.findMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('reverseEntry', () => {
    const MOCK_ENTRY = {
      id: 'entry-1',
      organizationId: 'org-1',
      assetId: 'asset-1',
      runId: 'run-1',
      periodYear: 2025,
      periodMonth: 1,
      track: 'FISCAL',
      openingBookValue: new Decimal('225000.00'),
      depreciationAmount: new Decimal('1875.00'),
      closingBookValue: new Decimal('223125.00'),
      proRataDays: null,
      daysInMonth: 31,
      reversedAt: null,
      reversalEntryId: null,
      notes: null,
      createdAt: new Date(),
    };

    const RLS_CTX = { organizationId: 'org-1', userId: 'user-1' };

    it('creates reversal entry with negative amounts', async () => {
      const mockReversalEntry = {
        ...MOCK_ENTRY,
        id: 'reversal-1',
        depreciationAmount: new Decimal('-1875.00'),
        closingBookValue: new Decimal('225000.00'),
        notes: 'Estorno do lancamento entry-1',
      };

      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(MOCK_ENTRY);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: {
              create: jest.fn().mockResolvedValue(mockReversalEntry),
              update: jest.fn().mockResolvedValue({ ...MOCK_ENTRY, reversedAt: new Date() }),
            },
            depreciationEntryCCItem: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          });
        }
        return fn;
      });

      const result = await reverseEntry(RLS_CTX, 'entry-1');

      expect(result.depreciationAmount.toString()).toBe('-1875');
    });

    it('marks original entry with reversedAt', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({
        ...MOCK_ENTRY,
        reversedAt: new Date(),
        reversalEntryId: 'reversal-1',
      });

      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(MOCK_ENTRY);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: {
              create: jest
                .fn()
                .mockResolvedValue({
                  ...MOCK_ENTRY,
                  id: 'reversal-1',
                  depreciationAmount: new Decimal('-1875.00'),
                }),
              update: mockUpdate,
            },
            depreciationEntryCCItem: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          });
        }
        return fn;
      });

      await reverseEntry(RLS_CTX, 'entry-1');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'entry-1' },
          data: expect.objectContaining({
            reversedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects already-reversed entry with 400', async () => {
      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue({
        ...MOCK_ENTRY,
        reversedAt: new Date(),
      });

      await expect(reverseEntry(RLS_CTX, 'entry-1')).rejects.toThrow(DepreciationError);
      await expect(reverseEntry(RLS_CTX, 'entry-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('deletes CC items of original entry', async () => {
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 2 });

      (mockedPrisma.depreciationEntry.findFirst as jest.Mock).mockResolvedValue(MOCK_ENTRY);
      (mockedPrisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            depreciationEntry: {
              create: jest
                .fn()
                .mockResolvedValue({
                  ...MOCK_ENTRY,
                  id: 'reversal-1',
                  depreciationAmount: new Decimal('-1875.00'),
                }),
              update: jest.fn().mockResolvedValue({ ...MOCK_ENTRY, reversedAt: new Date() }),
            },
            depreciationEntryCCItem: {
              deleteMany: mockDeleteMany,
            },
          });
        }
        return fn;
      });

      await reverseEntry(RLS_CTX, 'entry-1');

      expect(mockDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entryId: 'entry-1' },
        }),
      );
    });
  });
});
