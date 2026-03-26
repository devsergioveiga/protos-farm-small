// ─── Accounting Entries Tests ─────────────────────────────────────────────────
// Tests for service functions: list, getById, exportCsv,
// and integration hooks: createPayrollEntries, createReversalEntry, revertPayrollEntries.

// ─── Setup mocks before imports ──────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {
    payrollRun: {
      findFirst: jest.fn(),
    },
    payrollRunItem: {
      findMany: jest.fn(),
    },
    payrollProvision: {
      findMany: jest.fn(),
    },
    accountingEntry: {
      createMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn(),
}));

import Decimal from 'decimal.js';
import {
  createPayrollEntries,
  createReversalEntry,
  revertPayrollEntries,
  list,
  getById,
  exportCsv,
} from './accounting-entries.service';
import { AccountingEntryError, ACCOUNT_CODES } from './accounting-entries.types';
import { AccountingEntryType, AccountingSourceType } from '@prisma/client';
import { prisma } from '../../database/prisma';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockPrisma = prisma as any;

const rls = { organizationId: 'org-1', userId: 'user-1' };

const referenceMonthDate = new Date('2026-03-01T00:00:00.000Z');

// ─── Test data helpers ────────────────────────────────────────────────

function makeEntry(overrides: Partial<any> = {}) {
  return {
    id: 'entry-1',
    organizationId: 'org-1',
    referenceMonth: referenceMonthDate,
    entryType: AccountingEntryType.PAYROLL_SALARY,
    debitAccount: '6.1.01',
    debitLabel: 'Despesa com Salarios',
    creditAccount: '2.1.01',
    creditLabel: 'Salarios a Pagar',
    amount: new Decimal('3000.00'),
    costCenterId: null,
    farmId: 'farm-1',
    sourceType: AccountingSourceType.PAYROLL_RUN,
    sourceId: 'run-1',
    reversedByEntryId: null,
    notes: null,
    createdAt: new Date('2026-03-26T10:00:00.000Z'),
    ...overrides,
  };
}

function makeRunItem(overrides: Partial<any> = {}) {
  return {
    grossSalary: new Decimal('3000.00'),
    inssPatronal: new Decimal('690.00'),
    fgtsAmount: new Decimal('240.00'),
    inssAmount: new Decimal('330.00'),
    irrfAmount: new Decimal('0.00'),
    employee: {
      farms: [{ farmId: 'farm-1' }],
    },
    ...overrides,
  };
}

// ─── createPayrollEntries ─────────────────────────────────────────────

describe('createPayrollEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates 3 accounting entries for a run with no provisions and zero IRRF', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      referenceMonth: referenceMonthDate,
    });

    mockPrisma.payrollRunItem.findMany.mockResolvedValue([
      makeRunItem({ irrfAmount: new Decimal('0'), inssAmount: new Decimal('0') }),
    ]);

    mockPrisma.payrollProvision.findMany.mockResolvedValue([]);

    mockPrisma.accountingEntry.createMany.mockResolvedValue({ count: 2 });

    await createPayrollEntries('org-1', 'run-1');

    expect(mockPrisma.accountingEntry.createMany).toHaveBeenCalledTimes(1);
    const { data } = mockPrisma.accountingEntry.createMany.mock.calls[0][0];

    // PAYROLL_SALARY and PAYROLL_CHARGES (no TAX_LIABILITY if inss=irrf=0)
    const entryTypes = data.map((e: any) => e.entryType);
    expect(entryTypes).toContain(AccountingEntryType.PAYROLL_SALARY);
    expect(entryTypes).toContain(AccountingEntryType.PAYROLL_CHARGES);
    expect(entryTypes).not.toContain(AccountingEntryType.SALARY_REVERSAL);
  });

  it('creates 5 accounting entries (no SALARY_REVERSAL) for full run with provisions', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      referenceMonth: referenceMonthDate,
    });

    mockPrisma.payrollRunItem.findMany.mockResolvedValue([makeRunItem()]);

    mockPrisma.payrollProvision.findMany.mockResolvedValue([
      {
        provisionType: 'VACATION',
        totalAmount: new Decimal('333.33'),
        costCenterId: null,
        accountingEntryJson: null,
      },
      {
        provisionType: 'THIRTEENTH',
        totalAmount: new Decimal('250.00'),
        costCenterId: null,
        accountingEntryJson: null,
      },
    ]);

    mockPrisma.accountingEntry.createMany.mockResolvedValue({ count: 5 });

    await createPayrollEntries('org-1', 'run-1');

    const { data } = mockPrisma.accountingEntry.createMany.mock.calls[0][0];
    const entryTypes = data.map((e: any) => e.entryType);

    expect(entryTypes).toContain(AccountingEntryType.PAYROLL_SALARY);
    expect(entryTypes).toContain(AccountingEntryType.PAYROLL_CHARGES);
    expect(entryTypes).toContain(AccountingEntryType.VACATION_PROVISION);
    expect(entryTypes).toContain(AccountingEntryType.THIRTEENTH_PROVISION);
    expect(entryTypes).toContain(AccountingEntryType.TAX_LIABILITY);
    // SALARY_REVERSAL is NOT created at run close — only on payment
    expect(entryTypes).not.toContain(AccountingEntryType.SALARY_REVERSAL);
  });

  it('uses PAYROLL_RUN sourceType (not plain string) for run-level entries', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      referenceMonth: referenceMonthDate,
    });
    mockPrisma.payrollRunItem.findMany.mockResolvedValue([makeRunItem()]);
    mockPrisma.payrollProvision.findMany.mockResolvedValue([]);
    mockPrisma.accountingEntry.createMany.mockResolvedValue({ count: 3 });

    await createPayrollEntries('org-1', 'run-1');

    const { data } = mockPrisma.accountingEntry.createMany.mock.calls[0][0];
    const salaryEntry = data.find((e: any) => e.entryType === AccountingEntryType.PAYROLL_SALARY);
    expect(salaryEntry.sourceType).toBe(AccountingSourceType.PAYROLL_RUN);
    expect(salaryEntry.sourceId).toBe('run-1');
  });

  it('uses ACCOUNT_CODES for correct debit/credit accounts on each entry type', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      referenceMonth: referenceMonthDate,
    });
    mockPrisma.payrollRunItem.findMany.mockResolvedValue([makeRunItem()]);
    mockPrisma.payrollProvision.findMany.mockResolvedValue([
      {
        provisionType: 'VACATION',
        totalAmount: new Decimal('333.33'),
        costCenterId: null,
        accountingEntryJson: null,
      },
    ]);
    mockPrisma.accountingEntry.createMany.mockResolvedValue({ count: 4 });

    await createPayrollEntries('org-1', 'run-1');

    const { data } = mockPrisma.accountingEntry.createMany.mock.calls[0][0];

    const salaryEntry = data.find((e: any) => e.entryType === AccountingEntryType.PAYROLL_SALARY);
    expect(salaryEntry.debitAccount).toBe(ACCOUNT_CODES.PAYROLL_SALARY.debit);
    expect(salaryEntry.creditAccount).toBe(ACCOUNT_CODES.PAYROLL_SALARY.credit);

    const vacationEntry = data.find((e: any) => e.entryType === AccountingEntryType.VACATION_PROVISION);
    expect(vacationEntry.debitAccount).toBe(ACCOUNT_CODES.VACATION_PROVISION.debit);
    expect(vacationEntry.creditAccount).toBe(ACCOUNT_CODES.VACATION_PROVISION.credit);
  });

  it('throws when payroll run not found', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue(null);

    await expect(createPayrollEntries('org-1', 'nonexistent')).rejects.toThrow(
      AccountingEntryError,
    );
  });
});

// ─── createReversalEntry ─────────────────────────────────────────────

describe('createReversalEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.accountingEntry.create.mockResolvedValue({ id: 'reversal-1' });
  });

  it('creates a SALARY_REVERSAL entry with PAYABLE_SETTLEMENT sourceType', async () => {
    await createReversalEntry('org-1', 'payable-1', new Decimal('2670.00'), 'farm-1');

    expect(mockPrisma.accountingEntry.create).toHaveBeenCalledTimes(1);
    const { data } = mockPrisma.accountingEntry.create.mock.calls[0][0];

    expect(data.entryType).toBe(AccountingEntryType.SALARY_REVERSAL);
    expect(data.sourceType).toBe(AccountingSourceType.PAYABLE_SETTLEMENT);
    expect(data.sourceId).toBe('payable-1');
    expect(data.debitAccount).toBe(ACCOUNT_CODES.SALARY_REVERSAL.debit);
    expect(data.creditAccount).toBe(ACCOUNT_CODES.SALARY_REVERSAL.credit);
  });

  it('handles null farmId', async () => {
    await createReversalEntry('org-1', 'payable-1', 2670, null);

    const { data } = mockPrisma.accountingEntry.create.mock.calls[0][0];
    expect(data.farmId).toBeNull();
  });
});

// ─── revertPayrollEntries ─────────────────────────────────────────────

describe('revertPayrollEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.accountingEntry.deleteMany.mockResolvedValue({ count: 5 });
  });

  it('deletes PAYROLL_RUN entries linked to runId', async () => {
    await revertPayrollEntries('org-1', 'run-1');

    const calls = mockPrisma.accountingEntry.deleteMany.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);

    const firstCall = calls[0][0];
    expect(firstCall.where.sourceType).toBe(AccountingSourceType.PAYROLL_RUN);
    expect(firstCall.where.sourceId).toBe('run-1');
  });

  it('also deletes PAYROLL_PROVISION entries linked to runId', async () => {
    await revertPayrollEntries('org-1', 'run-1');

    const calls = mockPrisma.accountingEntry.deleteMany.mock.calls;
    // Should have 2 deleteMany calls: one for PAYROLL_RUN, one for PAYROLL_PROVISION
    expect(calls.length).toBe(2);

    const sourceTypes = calls.map((c: any) => c[0].where.sourceType);
    expect(sourceTypes).toContain(AccountingSourceType.PAYROLL_RUN);
    expect(sourceTypes).toContain(AccountingSourceType.PAYROLL_PROVISION);
  });
});

// ─── list ─────────────────────────────────────────────────────────────

describe('list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated entries filtered by referenceMonth', async () => {
    const entries = [makeEntry()];
    mockPrisma.accountingEntry.findMany.mockResolvedValue(entries);
    mockPrisma.accountingEntry.count.mockResolvedValue(1);

    const result = await list(rls, { referenceMonth: '2026-03', page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.data[0].entryType).toBe(AccountingEntryType.PAYROLL_SALARY);
  });

  it('filters by entryType', async () => {
    mockPrisma.accountingEntry.findMany.mockResolvedValue([]);
    mockPrisma.accountingEntry.count.mockResolvedValue(0);

    await list(rls, { entryType: AccountingEntryType.VACATION_PROVISION });

    const callWhere = mockPrisma.accountingEntry.findMany.mock.calls[0][0].where;
    expect(callWhere.entryType).toBe(AccountingEntryType.VACATION_PROVISION);
  });

  it('filters by farmId', async () => {
    mockPrisma.accountingEntry.findMany.mockResolvedValue([]);
    mockPrisma.accountingEntry.count.mockResolvedValue(0);

    await list(rls, { farmId: 'farm-2' });

    const callWhere = mockPrisma.accountingEntry.findMany.mock.calls[0][0].where;
    expect(callWhere.farmId).toBe('farm-2');
  });

  it('always filters by organizationId', async () => {
    mockPrisma.accountingEntry.findMany.mockResolvedValue([]);
    mockPrisma.accountingEntry.count.mockResolvedValue(0);

    await list(rls, {});

    const callWhere = mockPrisma.accountingEntry.findMany.mock.calls[0][0].where;
    expect(callWhere.organizationId).toBe('org-1');
  });
});

// ─── getById ──────────────────────────────────────────────────────────

describe('getById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a single entry by id', async () => {
    mockPrisma.accountingEntry.findFirst.mockResolvedValue(makeEntry());

    const result = await getById(rls, 'entry-1');
    expect(result.id).toBe('entry-1');
    expect(result.sourceType).toBe(AccountingSourceType.PAYROLL_RUN);
  });

  it('throws AccountingEntryError when not found', async () => {
    mockPrisma.accountingEntry.findFirst.mockResolvedValue(null);

    await expect(getById(rls, 'missing')).rejects.toThrow(AccountingEntryError);
  });
});

// ─── exportCsv ────────────────────────────────────────────────────────

describe('exportCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns CSV string with correct headers', async () => {
    mockPrisma.accountingEntry.findMany.mockResolvedValue([makeEntry()]);

    const csv = await exportCsv(rls, {});

    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    expect(headers).toContain('id');
    expect(headers).toContain('entryType');
    expect(headers).toContain('debitAccount');
    expect(headers).toContain('creditAccount');
    expect(headers).toContain('amount');
    expect(headers).toContain('sourceType');
  });

  it('includes data rows after header', async () => {
    mockPrisma.accountingEntry.findMany.mockResolvedValue([makeEntry(), makeEntry({ id: 'entry-2' })]);

    const csv = await exportCsv(rls, {});
    const lines = csv.split('\n');

    // header + 2 data rows
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain('entry-1');
    expect(lines[2]).toContain('entry-2');
  });

  it('returns header-only CSV when no entries match', async () => {
    mockPrisma.accountingEntry.findMany.mockResolvedValue([]);

    const csv = await exportCsv(rls, {});
    const lines = csv.split('\n');
    expect(lines.length).toBe(1); // header only
  });
});
