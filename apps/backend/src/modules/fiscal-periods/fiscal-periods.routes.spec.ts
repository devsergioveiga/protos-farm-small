// ─── Fiscal Periods Integration Tests ────────────────────────────────────────
// COA-04: Tests for fiscal year CRUD, period state machine, and audit trail.

// ─── Setup mocks before imports ──────────────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {
    fiscalYear: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import {
  createFiscalYear,
  getFiscalYears,
  closePeriod,
  reopenPeriod,
  blockPeriod,
  getPeriodForDate,
} from './fiscal-periods.service';
import { FiscalPeriodError } from './fiscal-periods.types';
import { prisma } from '../../database/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockPrisma = prisma as any;

// ─── Test data helpers ────────────────────────────────────────────────────────

function makeFiscalYear(overrides: Partial<any> = {}) {
  return {
    id: 'year-1',
    organizationId: 'org-1',
    name: 'Exercicio 2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePeriod(overrides: Partial<any> = {}) {
  return {
    id: 'period-1',
    organizationId: 'org-1',
    fiscalYearId: 'year-1',
    month: 3,
    year: 2026,
    status: 'OPEN' as const,
    openedAt: new Date('2026-03-01T00:00:00.000Z'),
    closedAt: null,
    closedBy: null,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    ...overrides,
  };
}

// ─── createFiscalYear ─────────────────────────────────────────────────────────

describe('createFiscalYear', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates calendar year (Jan-Dec 2026) with 12 monthly periods', async () => {
    mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);
    mockPrisma.fiscalYear.create.mockResolvedValue(makeFiscalYear());
    mockPrisma.accountingPeriod.createMany.mockResolvedValue({ count: 12 });

    const periods = Array.from({ length: 12 }, (_, i) =>
      makePeriod({ id: `period-${i + 1}`, month: i + 1, year: 2026 }),
    );
    mockPrisma.accountingPeriod.findMany.mockResolvedValue(periods);

    const result = await createFiscalYear(mockPrisma, 'org-1', {
      name: 'Exercicio 2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(result.id).toBe('year-1');
    expect(result.periods).toHaveLength(12);
    expect(result.periods[0].month).toBe(1);
    expect(result.periods[11].month).toBe(12);

    // Verify createMany was called with 12 periods
    const createManyCall = mockPrisma.accountingPeriod.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(12);
    expect(createManyCall.data[0].status).toBe('OPEN');
  });

  it('creates safra year (Jul 2025 - Jun 2026) with 12 periods spanning two calendar years', async () => {
    mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);
    mockPrisma.fiscalYear.create.mockResolvedValue(
      makeFiscalYear({
        name: 'Safra 2025/2026',
        startDate: new Date('2025-07-01'),
        endDate: new Date('2026-06-30'),
      }),
    );
    mockPrisma.accountingPeriod.createMany.mockResolvedValue({ count: 12 });

    const periods = [
      ...Array.from({ length: 6 }, (_, i) =>
        makePeriod({ month: i + 7, year: 2025 }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makePeriod({ month: i + 1, year: 2026 }),
      ),
    ];
    mockPrisma.accountingPeriod.findMany.mockResolvedValue(periods);

    const result = await createFiscalYear(mockPrisma, 'org-1', {
      name: 'Safra 2025/2026',
      startDate: '2025-07-01',
      endDate: '2026-06-30',
    });

    expect(result.periods).toHaveLength(12);

    // Verify createMany was called with 12 periods spanning two years
    const createManyCall = mockPrisma.accountingPeriod.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(12);

    const years = createManyCall.data.map((d: any) => d.year);
    expect(years).toContain(2025);
    expect(years).toContain(2026);
  });

  it('rejects overlapping fiscal year for same org with 409', async () => {
    mockPrisma.fiscalYear.findFirst.mockResolvedValue(makeFiscalYear());

    await expect(
      createFiscalYear(mockPrisma, 'org-1', {
        name: 'Exercicio Duplicado',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    ).rejects.toThrow(FiscalPeriodError);

    await expect(
      createFiscalYear(mockPrisma, 'org-1', {
        name: 'Exercicio Duplicado',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    ).rejects.toMatchObject({ code: 'OVERLAPPING_YEAR', statusCode: 409 });
  });

  it('returns fiscal year with periods array', async () => {
    mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);
    mockPrisma.fiscalYear.create.mockResolvedValue(makeFiscalYear());
    mockPrisma.accountingPeriod.createMany.mockResolvedValue({ count: 12 });
    mockPrisma.accountingPeriod.findMany.mockResolvedValue([makePeriod()]);

    const result = await createFiscalYear(mockPrisma, 'org-1', {
      name: 'Exercicio 2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    expect(result).toHaveProperty('periods');
    expect(Array.isArray(result.periods)).toBe(true);
  });
});

// ─── getFiscalYears ───────────────────────────────────────────────────────────

describe('getFiscalYears', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns list of fiscal years with periods ordered by startDate desc', async () => {
    const year2026 = {
      ...makeFiscalYear({ name: 'Exercicio 2026', startDate: new Date('2026-01-01') }),
      accountingPeriods: [makePeriod({ month: 1, year: 2026 }), makePeriod({ month: 2, year: 2026 })],
    };
    const year2025 = {
      ...makeFiscalYear({ id: 'year-0', name: 'Exercicio 2025', startDate: new Date('2025-01-01') }),
      accountingPeriods: [makePeriod({ month: 1, year: 2025 })],
    };

    mockPrisma.fiscalYear.findMany.mockResolvedValue([year2026, year2025]);

    const result = await getFiscalYears(mockPrisma, 'org-1');

    expect(result).toHaveLength(2);
    expect(result[0].periods).toHaveLength(2);
    expect(result[1].periods).toHaveLength(1);

    // Verify orderBy startDate desc was applied in query
    const findManyCall = mockPrisma.fiscalYear.findMany.mock.calls[0][0];
    expect(findManyCall.where.organizationId).toBe('org-1');
    expect(findManyCall.orderBy.startDate).toBe('desc');
  });
});

// ─── closePeriod ─────────────────────────────────────────────────────────────

describe('closePeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transitions OPEN to CLOSED, sets closedAt and closedBy', async () => {
    const openPeriod = makePeriod({ status: 'OPEN' as const });
    const closedPeriod = makePeriod({
      status: 'CLOSED' as const,
      closedAt: new Date(),
      closedBy: 'user-1',
    });

    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(openPeriod);
    mockPrisma.accountingPeriod.update.mockResolvedValue(closedPeriod);

    const result = await closePeriod(mockPrisma, 'org-1', 'period-1', { closedBy: 'user-1' });

    expect(result.status).toBe('CLOSED');
    expect(result.closedAt).not.toBeNull();
    expect(result.closedBy).toBe('user-1');

    const updateCall = mockPrisma.accountingPeriod.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('CLOSED');
    expect(updateCall.data.closedBy).toBe('user-1');
  });

  it('rejects closing an already CLOSED period with INVALID_TRANSITION', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'CLOSED' as const }),
    );

    await expect(
      closePeriod(mockPrisma, 'org-1', 'period-1', { closedBy: 'user-1' }),
    ).rejects.toThrow(FiscalPeriodError);

    await expect(
      closePeriod(mockPrisma, 'org-1', 'period-1', { closedBy: 'user-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION', statusCode: 422 });
  });

  it('rejects closing a BLOCKED period with INVALID_TRANSITION', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'BLOCKED' as const }),
    );

    await expect(
      closePeriod(mockPrisma, 'org-1', 'period-1', { closedBy: 'user-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});

// ─── reopenPeriod ─────────────────────────────────────────────────────────────

describe('reopenPeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transitions CLOSED to OPEN with reason and sets audit trail fields', async () => {
    const closedPeriod = makePeriod({ status: 'CLOSED' as const, closedAt: new Date(), closedBy: 'user-1' });
    const reopenedPeriod = makePeriod({
      status: 'OPEN' as const,
      reopenedAt: new Date(),
      reopenedBy: 'user-2',
      reopenReason: 'Lancamento esquecido',
    });

    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(closedPeriod);
    mockPrisma.accountingPeriod.update.mockResolvedValue(reopenedPeriod);

    const result = await reopenPeriod(mockPrisma, 'org-1', 'period-1', {
      reopenedBy: 'user-2',
      reopenReason: 'Lancamento esquecido',
    });

    expect(result.status).toBe('OPEN');
    expect(result.reopenedAt).not.toBeNull();
    expect(result.reopenedBy).toBe('user-2');
    expect(result.reopenReason).toBe('Lancamento esquecido');

    const updateCall = mockPrisma.accountingPeriod.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('OPEN');
    expect(updateCall.data.reopenedBy).toBe('user-2');
    expect(updateCall.data.reopenReason).toBe('Lancamento esquecido');
  });

  it('rejects reopen without reopenReason with REASON_REQUIRED', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'CLOSED' as const }),
    );

    await expect(
      reopenPeriod(mockPrisma, 'org-1', 'period-1', {
        reopenedBy: 'user-1',
        reopenReason: '',
      }),
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED', statusCode: 422 });
  });

  it('rejects reopening an OPEN period with INVALID_TRANSITION', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'OPEN' as const }),
    );

    await expect(
      reopenPeriod(mockPrisma, 'org-1', 'period-1', {
        reopenedBy: 'user-1',
        reopenReason: 'Algum motivo',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});

// ─── blockPeriod ─────────────────────────────────────────────────────────────

describe('blockPeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('transitions OPEN to BLOCKED', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'OPEN' as const }),
    );
    mockPrisma.accountingPeriod.update.mockResolvedValue(
      makePeriod({ status: 'BLOCKED' as const }),
    );

    const result = await blockPeriod(mockPrisma, 'org-1', 'period-1');
    expect(result.status).toBe('BLOCKED');

    const updateCall = mockPrisma.accountingPeriod.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('BLOCKED');
  });

  it('transitions CLOSED to BLOCKED', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'CLOSED' as const }),
    );
    mockPrisma.accountingPeriod.update.mockResolvedValue(
      makePeriod({ status: 'BLOCKED' as const }),
    );

    const result = await blockPeriod(mockPrisma, 'org-1', 'period-1');
    expect(result.status).toBe('BLOCKED');
  });

  it('rejects blocking an already BLOCKED period with INVALID_TRANSITION', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(
      makePeriod({ status: 'BLOCKED' as const }),
    );

    await expect(blockPeriod(mockPrisma, 'org-1', 'period-1')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
      statusCode: 422,
    });
  });
});

// ─── getPeriodForDate ─────────────────────────────────────────────────────────

describe('getPeriodForDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the matching period for a date within a fiscal year', async () => {
    const matchingPeriod = makePeriod({ month: 3, year: 2026 });
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(matchingPeriod);

    const result = await getPeriodForDate(mockPrisma, 'org-1', new Date('2026-03-15'));

    expect(result).not.toBeNull();
    expect(result!.month).toBe(3);
    expect(result!.year).toBe(2026);

    // Verify query parameters
    const findFirstCall = mockPrisma.accountingPeriod.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.month).toBe(3);
    expect(findFirstCall.where.year).toBe(2026);
    expect(findFirstCall.where.organizationId).toBe('org-1');
  });

  it('returns null if no period exists for the date', async () => {
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null);

    const result = await getPeriodForDate(mockPrisma, 'org-1', new Date('2099-01-01'));

    expect(result).toBeNull();
  });
});
