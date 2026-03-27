// ─── Auto-Posting Service Tests ────────────────────────────────────────────
// Unit tests for the auto-posting engine using mocked Prisma.
// Tests: process(), retry(), listRules(), updateRule(), previewRule().

// ─── Mock Prisma before imports ───────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {
    pendingJournalPosting: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    accountingRule: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    accountingRuleLine: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
    },
    journalEntry: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    accountBalance: {
      upsert: jest.fn(),
    },
    costCenter: {
      findFirst: jest.fn(),
    },
    payrollRun: {
      findFirst: jest.fn(),
    },
    payable: {
      findFirst: jest.fn(),
    },
    receivable: {
      findFirst: jest.fn(),
    },
    depreciationRun: {
      findFirst: jest.fn(),
    },
    stockEntry: {
      findFirst: jest.fn(),
    },
    stockOutput: {
      findFirst: jest.fn(),
    },
    payrollProvision: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

import { prisma } from '../../database/prisma';
import * as service from './auto-posting.service';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Helper factories ─────────────────────────────────────────────────

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    organizationId: 'org-1',
    sourceType: 'PAYROLL_RUN_CLOSE' as const,
    isActive: true,
    historyTemplate: 'Folha {{referenceMonth}}',
    requireCostCenter: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'line-1',
        ruleId: 'rule-1',
        lineOrder: 1,
        side: 'DEBIT' as const,
        accountId: 'account-1',
        description: 'Salarios',
        account: { id: 'account-1', code: '6.1.01', name: 'Despesa Salarios', nature: 'DEVEDORA' },
      },
      {
        id: 'line-2',
        ruleId: 'rule-1',
        lineOrder: 2,
        side: 'CREDIT' as const,
        accountId: 'account-2',
        description: 'Salarios a pagar',
        account: { id: 'account-2', code: '2.1.01', name: 'Salarios a Pagar', nature: 'CREDORA' },
      },
    ],
    ...overrides,
  };
}

function makePending(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pending-1',
    organizationId: 'org-1',
    sourceType: 'PAYROLL_RUN_CLOSE' as const,
    sourceId: 'payroll-run-1',
    accountingRuleId: 'rule-1',
    status: 'ERROR' as const,
    journalEntryId: null,
    errorMessage: 'Previous error',
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    processedAt: null,
    ...overrides,
  };
}

function makeExtractedPayrollData() {
  return {
    totalGross: { toString: () => '5000.00' },
    totalCharges: { toString: () => '1000.00' },
    referenceMonth: new Date('2026-01-01'),
    organization: { name: 'Fazenda Teste' },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('auto-posting.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('process()', () => {
    it('creates PendingJournalPosting COMPLETED + JournalEntry AUTOMATIC with valid rule', async () => {
      // D-17: no existing COMPLETED posting
      (mockedPrisma.pendingJournalPosting.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // Active rule exists
      (mockedPrisma.accountingRule.findFirst as jest.Mock).mockResolvedValueOnce(makeRule());

      // Upsert pending → PROCESSING
      const upsertedPending = makePending({ status: 'PROCESSING', errorMessage: null });
      (mockedPrisma.pendingJournalPosting.upsert as jest.Mock).mockResolvedValueOnce(upsertedPending);

      // PayrollRun extractor data
      (mockedPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValueOnce(makeExtractedPayrollData());

      // Open accounting period
      (mockedPrisma.accountingPeriod.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'period-1',
        fiscalYearId: 'fy-1',
        month: 1,
        status: 'OPEN',
      });

      // Transaction mock
      (mockedPrisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        // Mock tx operations inside transaction
        const tx = {
          journalEntry: {
            aggregate: jest.fn().mockResolvedValue({ _max: { entryNumber: 5 } }),
            create: jest.fn().mockResolvedValue({
              id: 'entry-1',
              lines: [
                { accountId: 'account-1', side: 'DEBIT', amount: { toString: () => '5000.00' } },
                { accountId: 'account-2', side: 'CREDIT', amount: { toString: () => '5000.00' } },
              ],
            }),
          },
          accountBalance: { upsert: jest.fn().mockResolvedValue({}) },
          pendingJournalPosting: { update: jest.fn().mockResolvedValue({}) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        } as unknown as typeof prisma;
        return fn(tx);
      });

      await service.process('PAYROLL_RUN_CLOSE', 'payroll-run-1', 'org-1');

      expect(mockedPrisma.pendingJournalPosting.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
      expect(mockedPrisma.accountingRule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1', isActive: true }),
        }),
      );
      expect(mockedPrisma.pendingJournalPosting.upsert).toHaveBeenCalled();
      expect(mockedPrisma.$transaction).toHaveBeenCalled();
    });

    it('returns silently when sourceType+sourceId already COMPLETED (idempotency per D-17)', async () => {
      // Existing COMPLETED posting found
      (mockedPrisma.pendingJournalPosting.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'pending-existing',
        status: 'COMPLETED',
      });

      await service.process('PAYROLL_RUN_CLOSE', 'payroll-run-1', 'org-1');

      // Should NOT call accountingRule or upsert — returns immediately
      expect(mockedPrisma.accountingRule.findFirst).not.toHaveBeenCalled();
      expect(mockedPrisma.pendingJournalPosting.upsert).not.toHaveBeenCalled();
    });

    it('returns without creating PendingJournalPosting when no active rule (per D-18)', async () => {
      // No existing COMPLETED
      (mockedPrisma.pendingJournalPosting.findFirst as jest.Mock).mockResolvedValueOnce(null);
      // No active rule
      (mockedPrisma.accountingRule.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await service.process('PAYROLL_RUN_CLOSE', 'payroll-run-999', 'org-1');

      expect(mockedPrisma.pendingJournalPosting.upsert).not.toHaveBeenCalled();
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates PendingJournalPosting ERROR when period is closed (per D-25)', async () => {
      (mockedPrisma.pendingJournalPosting.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (mockedPrisma.accountingRule.findFirst as jest.Mock).mockResolvedValueOnce(makeRule());

      const upsertedPending = makePending({ status: 'PROCESSING', errorMessage: null });
      (mockedPrisma.pendingJournalPosting.upsert as jest.Mock).mockResolvedValueOnce(upsertedPending);

      (mockedPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValueOnce(makeExtractedPayrollData());

      // No open period
      (mockedPrisma.accountingPeriod.findFirst as jest.Mock).mockResolvedValueOnce(null);

      // update to ERROR
      (mockedPrisma.pendingJournalPosting.update as jest.Mock).mockResolvedValueOnce({
        ...upsertedPending,
        status: 'ERROR',
        errorMessage: 'Periodo contabil fechado para 1/2026',
      });

      await service.process('PAYROLL_RUN_CLOSE', 'payroll-run-1', 'org-1');

      expect(mockedPrisma.pendingJournalPosting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ERROR' }),
        }),
      );
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('retry()', () => {
    it('re-attempts ERROR posting and succeeds', async () => {
      const errorPending = makePending({ status: 'ERROR' });
      (mockedPrisma.pendingJournalPosting.findFirst as jest.Mock)
        .mockResolvedValueOnce(errorPending) // fetch for retry
        .mockResolvedValueOnce({ // fetch after retry for return value
          ...errorPending,
          status: 'COMPLETED',
          journalEntryId: 'entry-1',
          errorMessage: null,
          processedAt: new Date(),
        });

      (mockedPrisma.accountingRule.findFirst as jest.Mock).mockResolvedValueOnce(makeRule());

      // update to PROCESSING
      (mockedPrisma.pendingJournalPosting.update as jest.Mock).mockResolvedValueOnce({
        ...errorPending,
        status: 'PROCESSING',
      });

      (mockedPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValueOnce(makeExtractedPayrollData());
      (mockedPrisma.accountingPeriod.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'period-1',
        fiscalYearId: 'fy-1',
        month: 1,
        status: 'OPEN',
      });

      (mockedPrisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const tx = {
          journalEntry: {
            aggregate: jest.fn().mockResolvedValue({ _max: { entryNumber: 3 } }),
            create: jest.fn().mockResolvedValue({
              id: 'entry-1',
              lines: [{ accountId: 'account-1', side: 'DEBIT', amount: { toString: () => '5000' } }],
            }),
          },
          accountBalance: { upsert: jest.fn().mockResolvedValue({}) },
          pendingJournalPosting: { update: jest.fn().mockResolvedValue({}) },
          $executeRaw: jest.fn().mockResolvedValue(1),
        } as unknown as typeof prisma;
        return fn(tx);
      });

      const result = await service.retry('pending-1', 'org-1');

      expect(result.status).toBe('COMPLETED');
      expect(result.journalEntryId).toBe('entry-1');
    });
  });

  describe('listRules()', () => {
    it('returns all rules for org', async () => {
      const mockRules = [makeRule()];
      (mockedPrisma.accountingRule.findMany as jest.Mock).mockResolvedValueOnce(mockRules);

      const result = await service.listRules('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rule-1');
      expect(result[0].sourceType).toBe('PAYROLL_RUN_CLOSE');
      expect(result[0].lines).toHaveLength(2);
      expect(result[0].lines[0].accountCode).toBe('6.1.01');
    });
  });

  describe('updateRule()', () => {
    it('updates isActive flag, history template, and rule lines', async () => {
      (mockedPrisma.accountingRule.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'rule-1' }) // existence check
        .mockResolvedValueOnce(makeRule({ isActive: false, historyTemplate: 'Novo template {{referenceMonth}}' })); // after update

      (mockedPrisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        const tx = {
          accountingRule: { update: jest.fn().mockResolvedValue({}) },
          accountingRuleLine: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        } as unknown as typeof prisma;
        return fn(tx);
      });

      const result = await service.updateRule('org-1', 'rule-1', {
        isActive: false,
        historyTemplate: 'Novo template {{referenceMonth}}',
        lines: [
          { lineOrder: 1, side: 'DEBIT', accountId: 'account-1' },
          { lineOrder: 2, side: 'CREDIT', accountId: 'account-2' },
        ],
      });

      expect(result.id).toBe('rule-1');
      expect(result.isActive).toBe(false);
      expect(mockedPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('previewRule()', () => {
    it('returns resolved template with last operation data', async () => {
      (mockedPrisma.accountingRule.findFirst as jest.Mock).mockResolvedValueOnce(makeRule());

      // Last COMPLETED posting
      (mockedPrisma.pendingJournalPosting.findFirst as jest.Mock).mockResolvedValueOnce({
        sourceId: 'payroll-run-1',
      });

      // Data from extractor
      (mockedPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValueOnce(makeExtractedPayrollData());

      // No cost center (no farmId)
      (mockedPrisma.costCenter.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.previewRule('org-1', 'rule-1');

      expect(result).not.toBeNull();
      expect(result!.description).toBe('Folha 2026-01');
      expect(result!.lines).toHaveLength(2);
      expect(result!.lines[0].accountCode).toBe('6.1.01');
      expect(result!.lines[0].side).toBe('DEBIT');
      expect(result!.costCenterName).toBeNull();
    });
  });
});
