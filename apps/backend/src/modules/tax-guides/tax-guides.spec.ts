// ─── Tax Guides Service Tests ─────────────────────────────────────────
// Covers: generateGuides, listGuides, downloadGuide, due dates, alert levels,
// payable upsert, FUNRURAL rate lookup, idempotency.

import { TaxGuidesService } from './tax-guides.service';
import type { TaxGuideType } from '@prisma/client';

// ─── Mocks ────────────────────────────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {},
}));

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn((ctx: unknown, fn: (tx: unknown) => unknown) => fn(mockTx)),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockTx: any = {
  payrollRunItem: { aggregate: jest.fn(), findMany: jest.fn() },
  payrollLegalTable: { findFirst: jest.fn() },
  organization: { findFirst: jest.fn() },
  taxGuide: { upsert: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  payable: { upsert: jest.fn() },
};

// Re-export so tests can manipulate it
const { withRlsContext } = jest.requireMock('../../database/rls') as {
  withRlsContext: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  // Default: withRlsContext calls the callback with mockTx
  withRlsContext.mockImplementation((ctx: unknown, fn: (tx: typeof mockTx) => unknown) =>
    fn(mockTx),
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────

const ORG_ID = 'org-001';
const USER_ID = 'user-001';
const FARM_ID = 'farm-001';
const REF_MONTH = '2026-03-01'; // March 2026

function _makeAggResult(field: string, value: string) {
  return { _sum: { [field]: value } };
}

function setupAggregate(fgts: string, inss: string, irrf: string, gross: string) {
  mockTx.payrollRunItem.aggregate
    .mockResolvedValueOnce({ _sum: { fgtsAmount: fgts } })   // FGTS query
    .mockResolvedValueOnce({ _sum: { inssAmount: inss } })   // INSS query
    .mockResolvedValueOnce({ _sum: { irrfAmount: irrf } })   // IRRF query
    .mockResolvedValueOnce({ _sum: { grossSalary: gross } }); // FUNRURAL gross
}

function _makeTaxGuide(type: TaxGuideType, amount: string, dueDate: Date) {
  return {
    id: `guide-${type}`,
    organizationId: ORG_ID,
    guideType: type,
    referenceMonth: new Date(REF_MONTH),
    dueDate,
    totalAmount: { toString: () => amount },
    status: 'PENDING' as const,
    fileKey: null,
    payrollRunId: null,
    generatedBy: null,
    generatedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('TaxGuidesService.generateGuides', () => {
  it('creates 4 TaxGuide records for all guide types', async () => {
    setupAggregate('500.00', '200.00', '100.00', '3000.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda Teste',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: unknown }) =>
      Promise.resolve(create),
    );
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    const result = await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    expect(mockTx.taxGuide.upsert).toHaveBeenCalledTimes(4);
    expect(result).toHaveLength(4);
    const types = result.map((g: { guideType: string }) => g.guideType);
    expect(types).toContain('FGTS');
    expect(types).toContain('INSS');
    expect(types).toContain('IRRF');
    expect(types).toContain('FUNRURAL');
  });

  it('FGTS guide totalAmount equals sum of PayrollRunItem.fgtsAmount', async () => {
    setupAggregate('1234.56', '0.00', '0.00', '0.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    let fgtsAmount: string | undefined;
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { totalAmount: string; guideType: string } }) => {
      if (create.guideType === 'FGTS') fgtsAmount = create.totalAmount.toString();
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    expect(fgtsAmount).toBe('1234.56');
  });

  it('INSS guide totalAmount equals sum of PayrollRunItem.inssAmount', async () => {
    setupAggregate('0.00', '987.65', '0.00', '0.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    let inssAmount: string | undefined;
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { totalAmount: string; guideType: string } }) => {
      if (create.guideType === 'INSS') inssAmount = create.totalAmount.toString();
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    expect(inssAmount).toBe('987.65');
  });

  it('IRRF guide totalAmount equals sum of PayrollRunItem.irrfAmount', async () => {
    setupAggregate('0.00', '0.00', '456.78', '0.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    let irrfAmount: string | undefined;
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { totalAmount: string; guideType: string } }) => {
      if (create.guideType === 'IRRF') irrfAmount = create.totalAmount.toString();
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    expect(irrfAmount).toBe('456.78');
  });

  it('FUNRURAL uses PayrollLegalTable effective-date lookup (not hardcoded rate)', async () => {
    setupAggregate('0.00', '0.00', '0.00', '10000.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    // Rate from table = 2.7%
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });

    let funruralAmount: string | undefined;
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { totalAmount: string; guideType: string } }) => {
      if (create.guideType === 'FUNRURAL') funruralAmount = create.totalAmount.toString();
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    // 10000.00 * 2.7 / 100 = 270.00
    expect(funruralAmount).toBe('270.00');
    // Must have called payrollLegalTable.findFirst for FUNRURAL rate
    expect(mockTx.payrollLegalTable.findFirst).toHaveBeenCalled();
  });

  it('each guide creates a Payable with originType TAX_GUIDE and category TAXES', async () => {
    setupAggregate('100.00', '200.00', '50.00', '3000.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { guideType: string } }) =>
      Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING', totalAmount: { toString: () => '0' } }),
    );
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    expect(mockTx.payable.upsert).toHaveBeenCalledTimes(4);
    const calls = mockTx.payable.upsert.mock.calls as Array<[{ create: { originType: string; category: string } }]>;
    for (const [args] of calls) {
      expect(args.create.originType).toBe('TAX_GUIDE');
      expect(args.create.category).toBe('TAXES');
    }
  });

  it('FGTS due date is 7th of next month', async () => {
    setupAggregate('100.00', '0.00', '0.00', '0.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    let fgtsDueDate: Date | undefined;
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { guideType: string; dueDate: Date } }) => {
      if (create.guideType === 'FGTS') fgtsDueDate = create.dueDate;
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    // March 2026 -> April 7, 2026 (a Tuesday — no weekend adjustment needed)
    expect(fgtsDueDate).toBeDefined();
    expect(fgtsDueDate!.getUTCDate()).toBe(7);
    expect(fgtsDueDate!.getUTCMonth()).toBe(3); // April = 3 (0-indexed)
    expect(fgtsDueDate!.getUTCFullYear()).toBe(2026);
  });

  it('INSS/IRRF/FUNRURAL due date is 20th of next month', async () => {
    setupAggregate('0.00', '200.00', '50.00', '3000.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    const dueDates: Record<string, Date> = {};
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { guideType: string; dueDate: Date } }) => {
      dueDates[create.guideType] = create.dueDate;
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    for (const type of ['INSS', 'IRRF', 'FUNRURAL']) {
      expect(dueDates[type]).toBeDefined();
      expect(dueDates[type].getUTCDate()).toBe(20);
      expect(dueDates[type].getUTCMonth()).toBe(3); // April
      expect(dueDates[type].getUTCFullYear()).toBe(2026);
    }
  });

  it('due date falling on Saturday rolls to next Monday', async () => {
    // Find a month where the 7th of next month is a Saturday
    // Feb 2026 -> March 7, 2026 is a Saturday
    const refMonthFeb = '2026-02-01';
    setupAggregate('100.00', '0.00', '0.00', '0.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    let fgtsDueDate: Date | undefined;
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: { guideType: string; dueDate: Date } }) => {
      if (create.guideType === 'FGTS') fgtsDueDate = create.dueDate;
      return Promise.resolve({ ...create, id: `guide-${create.guideType}`, status: 'PENDING' });
    });
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    await service.generateGuides(ORG_ID, { referenceMonth: refMonthFeb }, USER_ID);

    // March 7, 2026 is Saturday -> rolls to March 9, 2026 (Monday)
    expect(fgtsDueDate).toBeDefined();
    const dow = fgtsDueDate!.getUTCDay();
    expect(dow).not.toBe(0); // not Sunday
    expect(dow).not.toBe(6); // not Saturday
    expect(fgtsDueDate!.getUTCDate()).toBe(9);
  });

  it('duplicate generation returns existing guides (upsert idempotency)', async () => {
    setupAggregate('100.00', '200.00', '50.00', '3000.00');
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
      farms: [{ id: FARM_ID }],
    });
    mockTx.payrollLegalTable.findFirst.mockResolvedValue({
      scalarValues: [{ key: 'rate', value: '2.7' }],
    });
    // upsert returns existing guide (simulating idempotency)
    mockTx.taxGuide.upsert.mockImplementation(({ create }: { create: any }) =>
      Promise.resolve({ id: 'existing-guide', status: 'GENERATED', guideType: create.guideType ?? 'FGTS', totalAmount: { toString: () => create.totalAmount ?? '100.00' }, dueDate: create.dueDate ?? new Date(), referenceMonth: create.referenceMonth ?? new Date(), organizationId: ORG_ID }),
    );
    mockTx.payable.upsert.mockResolvedValue({});

    const service = new TaxGuidesService();
    const result = await service.generateGuides(ORG_ID, { referenceMonth: REF_MONTH }, USER_ID);

    // Should complete without error, upsert called 4 times
    expect(mockTx.taxGuide.upsert).toHaveBeenCalledTimes(4);
    expect(result).toHaveLength(4);
  });
});

describe('TaxGuidesService.listGuides', () => {
  it('returns guides with computed alertLevel', async () => {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in8Days = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const in15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    mockTx.taxGuide.findMany.mockResolvedValue([
      { id: 'g1', guideType: 'FGTS', dueDate: in3Days, totalAmount: { toString: () => '100' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'g2', guideType: 'INSS', dueDate: in8Days, totalAmount: { toString: () => '200' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'g3', guideType: 'IRRF', dueDate: in15Days, totalAmount: { toString: () => '50' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const service = new TaxGuidesService();
    const result = await service.listGuides(ORG_ID, {});

    expect(result.data[0].alertLevel).toBe('danger');  // 3 days <= 5
    expect(result.data[1].alertLevel).toBe('warning'); // 8 days is 6-10
    expect(result.data[2].alertLevel).toBe('none');    // 15 days > 10
  });

  it('returns filtered guides by guideType', async () => {
    mockTx.taxGuide.findMany.mockResolvedValue([
      { id: 'g1', guideType: 'FGTS', dueDate: new Date(), totalAmount: { toString: () => '100' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const service = new TaxGuidesService();
    const result = await service.listGuides(ORG_ID, { guideType: 'FGTS' as TaxGuideType });

    const whereArg = mockTx.taxGuide.findMany.mock.calls[0][0] as { where: { guideType?: string } };
    expect(whereArg.where.guideType).toBe('FGTS');
    expect(result.data).toHaveLength(1);
  });

  it('alertLevel is danger when daysUntilDue <= 5', async () => {
    const in2Days = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    mockTx.taxGuide.findMany.mockResolvedValue([
      { id: 'g1', guideType: 'FGTS', dueDate: in2Days, totalAmount: { toString: () => '100' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const service = new TaxGuidesService();
    const result = await service.listGuides(ORG_ID, {});

    expect(result.data[0].alertLevel).toBe('danger');
    expect(result.data[0].daysUntilDue).toBeLessThanOrEqual(5);
  });

  it('alertLevel is warning when daysUntilDue is 6-10', async () => {
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockTx.taxGuide.findMany.mockResolvedValue([
      { id: 'g1', guideType: 'INSS', dueDate: in7Days, totalAmount: { toString: () => '200' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const service = new TaxGuidesService();
    const result = await service.listGuides(ORG_ID, {});

    expect(result.data[0].alertLevel).toBe('warning');
  });

  it('alertLevel is none when daysUntilDue > 10', async () => {
    const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    mockTx.taxGuide.findMany.mockResolvedValue([
      { id: 'g1', guideType: 'IRRF', dueDate: in20Days, totalAmount: { toString: () => '50' }, status: 'PENDING', referenceMonth: new Date(), organizationId: ORG_ID, fileKey: null, payrollRunId: null, generatedBy: null, generatedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const service = new TaxGuidesService();
    const result = await service.listGuides(ORG_ID, {});

    expect(result.data[0].alertLevel).toBe('none');
  });
});

describe('TaxGuidesService.downloadGuide', () => {
  it('returns buffer and filename for FGTS guide (SEFIP .RE)', async () => {
    mockTx.taxGuide.findFirst.mockResolvedValue({
      id: 'guide-fgts',
      guideType: 'FGTS',
      referenceMonth: new Date('2026-03-01'),
      dueDate: new Date('2026-04-07'),
      totalAmount: { toString: () => '500.00' },
      status: 'PENDING',
      organizationId: ORG_ID,
    });
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda Teste',
      document: '12345678000195',
      funruralBasis: 'PAYROLL',
    });
    mockTx.payrollRunItem.findMany.mockResolvedValue([]);
    mockTx.taxGuide.update.mockResolvedValue({});

    const service = new TaxGuidesService();
    const result = await service.downloadGuide(ORG_ID, 'guide-fgts');

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.filename).toMatch(/\.RE$/);
    expect(result.contentType).toBe('text/plain');
  });

  it('returns PDF buffer and filename for INSS guide (DARF)', async () => {
    mockTx.taxGuide.findFirst.mockResolvedValue({
      id: 'guide-inss',
      guideType: 'INSS',
      referenceMonth: new Date('2026-03-01'),
      dueDate: new Date('2026-04-20'),
      totalAmount: { toString: () => '200.00' },
      status: 'PENDING',
      organizationId: ORG_ID,
    });
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda Teste',
      document: '12345678000195',
    });
    mockTx.taxGuide.update.mockResolvedValue({});

    const service = new TaxGuidesService();
    const result = await service.downloadGuide(ORG_ID, 'guide-inss');

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.filename).toMatch(/\.pdf$/);
    expect(result.contentType).toBe('application/pdf');
  });

  it('returns PDF buffer for FUNRURAL guide (GPS)', async () => {
    mockTx.taxGuide.findFirst.mockResolvedValue({
      id: 'guide-funrural',
      guideType: 'FUNRURAL',
      referenceMonth: new Date('2026-03-01'),
      dueDate: new Date('2026-04-20'),
      totalAmount: { toString: () => '81.00' },
      status: 'PENDING',
      organizationId: ORG_ID,
    });
    mockTx.organization.findFirst.mockResolvedValue({
      id: ORG_ID,
      name: 'Fazenda Teste',
      document: '12345678000195',
    });
    mockTx.taxGuide.update.mockResolvedValue({});

    const service = new TaxGuidesService();
    const result = await service.downloadGuide(ORG_ID, 'guide-funrural');

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.filename).toMatch(/\.pdf$/);
    expect(result.contentType).toBe('application/pdf');
  });

  it('throws 404 when guide not found', async () => {
    mockTx.taxGuide.findFirst.mockResolvedValue(null);

    const service = new TaxGuidesService();
    await expect(service.downloadGuide(ORG_ID, 'nonexistent')).rejects.toThrow();
  });
});
