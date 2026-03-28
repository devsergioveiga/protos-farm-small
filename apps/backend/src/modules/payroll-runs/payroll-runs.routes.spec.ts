// ─── PayrollRuns Service Tests ────────────────────────────────────────
// Tests for the PayrollRun orchestrator: create, process, recalculate,
// close, revert, list, get, downloadPayslipsZip.

// ─── Setup mocks before imports ──────────────────────────────────────
jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn(),
}));

jest.mock('../../database/prisma', () => ({
  prisma: {
    payrollRun: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    payrollRunItem: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    timesheet: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    salaryAdvance: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    payable: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    payableCostCenterItem: {
      createMany: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
    },
    employeeContract: {
      findFirst: jest.fn(),
    },
    taxGuide: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../payroll-tables/payroll-tables.service', () => ({
  payrollTablesService: { getEffective: jest.fn() },
}));

jest.mock('../employee-absences/employee-absences.service', () => ({
  getAbsenceImpactForMonth: jest.fn().mockResolvedValue({
    companyPaidDays: 0,
    inssPaidDays: 0,
    suspendedDays: 0,
    fgtsFullMonth: false,
  }),
}));

jest.mock('./payroll-calculation.service', () => ({
  calculateEmployeePayroll: jest.fn(),
  calculateThirteenthSalary: jest.fn(),
}));

jest.mock('./payroll-pdf.service', () => ({
  generatePayslipPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')),
}));

jest.mock('../../shared/mail/mail.service', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

import { PayrollRunError } from './payroll-runs.types';
import {
  createRun,
  processRun,
  recalculateEmployee,
  closeRun,
  revertRun,
  listRuns,
  getRun,
  downloadPayslipsZip,
  cpPreview,
} from './payroll-runs.service';
import { payrollTablesService } from '../payroll-tables/payroll-tables.service';
import {
  calculateEmployeePayroll,
  calculateThirteenthSalary,
} from './payroll-calculation.service';
import { prisma } from '../../database/prisma';
import { withRlsContext } from '../../database/rls';
import Decimal from 'decimal.js';

// ─── Typed mocks ───────────────────────────────────────────────────────

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockWithRlsContext = withRlsContext as jest.MockedFunction<typeof withRlsContext>;

const rls = { organizationId: 'org-1', userId: 'user-1' };

const mockCalcResult = {
  baseSalary: new Decimal(3000),
  proRataDays: null,
  overtime50: new Decimal(0),
  overtime100: new Decimal(0),
  dsrValue: new Decimal(0),
  nightPremium: new Decimal(0),
  salaryFamily: new Decimal(0),
  otherProvisions: new Decimal(0),
  grossSalary: new Decimal(3000),
  inssAmount: new Decimal(330),
  irrfAmount: new Decimal(0),
  vtDeduction: new Decimal(0),
  housingDeduction: new Decimal(0),
  foodDeduction: new Decimal(0),
  advanceDeduction: new Decimal(0),
  otherDeductions: new Decimal(0),
  netSalary: new Decimal(2670),
  fgtsAmount: new Decimal(240),
  inssPatronal: new Decimal(690),
  lineItems: [
    {
      code: '0001',
      description: 'Salário Base',
      reference: '31 dias',
      type: 'PROVENTO' as const,
      value: new Decimal(3000),
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────

describe('PayrollRuns Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: withRlsContext passes through to fn with a tx-like object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));

    // Default: $transaction calls fn with prisma as tx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockPrisma.$transaction as jest.Mock).mockImplementation((fn: any) =>
      typeof fn === 'function' ? fn(mockPrisma) : Promise.resolve(),
    );

    // Default: timeEntry and employeeContract return empty (no cost-center data)
    (mockPrisma.timeEntry.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.employeeContract.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.payableCostCenterItem.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.payable.findMany as jest.Mock).mockResolvedValue([]);
  });

  // ─── Test 1: createRun ──────────────────────────────────────────────

  describe('createRun', () => {
    it('creates run with status PENDING', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(null);
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY',
        status: 'PENDING',
        triggeredBy: 'user-1',
        employeeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (mockPrisma.payrollRun.create as jest.Mock).mockResolvedValue(mockRun);

      const result = await createRun(rls, {
        referenceMonth: '2026-03',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runType: 'MONTHLY' as any,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).status).toBe('PENDING');
      expect(mockPrisma.payrollRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            triggeredBy: 'user-1',
          }),
        }),
      );
    });

    it('throws DUPLICATE_RUN if same org+month+type exists', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-run' });

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createRun(rls, { referenceMonth: '2026-03', runType: 'MONTHLY' as any }),
      ).rejects.toThrow(PayrollRunError);

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createRun(rls, { referenceMonth: '2026-03', runType: 'MONTHLY' as any }),
      ).rejects.toMatchObject({ code: 'DUPLICATE_RUN' });
    });
  });

  // ─── Test 2: processRun ────────────────────────────────────────────

  describe('processRun', () => {
    const mockRun = {
      id: 'run-1',
      organizationId: 'org-1',
      referenceMonth: new Date('2026-03-01'),
      runType: 'MONTHLY' as const,
      status: 'PENDING' as const,
    };

    const mockEmployees = [
      {
        id: 'emp-1',
        name: 'João Silva',
        cpf: '12345678901',
        admissionDate: new Date('2020-01-01'),
        email: 'joao@farm.com',
        dependents: [],
        salaryHistory: [{ salary: new Decimal(3000), effectiveAt: new Date('2026-01-01') }],
        farms: [{ farmId: 'farm-1' }],
      },
      {
        id: 'emp-2',
        name: 'Maria Santos',
        cpf: '98765432100',
        admissionDate: new Date('2021-06-01'),
        email: null,
        dependents: [],
        salaryHistory: [{ salary: new Decimal(2800), effectiveAt: new Date('2026-01-01') }],
        farms: [{ farmId: 'farm-1' }],
      },
      {
        id: 'emp-3',
        name: 'Pedro Costa',
        cpf: '11122233344',
        admissionDate: new Date('2022-03-15'),
        email: null,
        dependents: [],
        salaryHistory: [{ salary: new Decimal(2500), effectiveAt: new Date('2026-01-01') }],
        farms: [{ farmId: 'farm-1' }],
      },
    ];

    it('iterates 3 employees — 2 with APPROVED timesheet get CALCULATED items, 1 without gets PENDING_TIMESHEET', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun });
      (mockPrisma.employee.findMany as jest.Mock).mockResolvedValue(mockEmployees);

      // Mock payroll tables
      (payrollTablesService.getEffective as jest.Mock).mockResolvedValue({
        brackets: [],
        scalarValues: [],
      });

      // emp-1 and emp-2 have APPROVED timesheets, emp-3 does not
      (mockPrisma.timesheet.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: 'ts-1',
          status: 'APPROVED',
          totalOvertime50: 0,
          totalOvertime100: 0,
          totalNightMinutes: 0,
          totalAbsences: 0,
        })
        .mockResolvedValueOnce({
          id: 'ts-2',
          status: 'APPROVED',
          totalOvertime50: 0,
          totalOvertime100: 0,
          totalNightMinutes: 0,
          totalAbsences: 0,
        })
        .mockResolvedValueOnce(null); // emp-3 has no approved timesheet

      (mockPrisma.salaryAdvance.findMany as jest.Mock).mockResolvedValue([]);
      (calculateEmployeePayroll as jest.Mock).mockReturnValue(mockCalcResult);

      (mockPrisma.payrollRunItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([
        { grossSalary: new Decimal(3000), netSalary: new Decimal(2670), inssPatronal: new Decimal(690), fgtsAmount: new Decimal(240), status: 'CALCULATED' },
        { grossSalary: new Decimal(2800), netSalary: new Decimal(2500), inssPatronal: new Decimal(644), fgtsAmount: new Decimal(224), status: 'CALCULATED' },
        { grossSalary: new Decimal(0), netSalary: new Decimal(0), inssPatronal: new Decimal(0), fgtsAmount: new Decimal(0), status: 'PENDING_TIMESHEET' },
      ]);

      await processRun(rls, 'run-1');

      expect(mockPrisma.payrollRunItem.create).toHaveBeenCalledTimes(3);

      const calls = (mockPrisma.payrollRunItem.create as jest.Mock).mock.calls;
      const pendingCall = calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c[0]?.data?.status === 'PENDING_TIMESHEET',
      );
      expect(pendingCall).toBeDefined();
    });

    it('transitions status PENDING→PROCESSING→CALCULATED', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun });
      (mockPrisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployees[0]]);
      (payrollTablesService.getEffective as jest.Mock).mockResolvedValue({ brackets: [], scalarValues: [] });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue({
        id: 'ts-1', status: 'APPROVED', totalOvertime50: 0, totalOvertime100: 0, totalNightMinutes: 0, totalAbsences: 0,
      });
      (mockPrisma.salaryAdvance.findMany as jest.Mock).mockResolvedValue([]);
      (calculateEmployeePayroll as jest.Mock).mockReturnValue(mockCalcResult);
      (mockPrisma.payrollRunItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([
        { grossSalary: new Decimal(3000), netSalary: new Decimal(2670), inssPatronal: new Decimal(690), fgtsAmount: new Decimal(240), status: 'CALCULATED' },
      ]);

      await processRun(rls, 'run-1');

      const updateCalls = (mockPrisma.payrollRun.update as jest.Mock).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusUpdates = updateCalls.map((c: any) => c[0]?.data?.status).filter(Boolean);
      expect(statusUpdates).toContain('PROCESSING');
      expect(statusUpdates).toContain('CALCULATED');
    });

    it('calls calculateThirteenthSalary for THIRTEENTH_FIRST run type', async () => {
      const thirteenthRun = { ...mockRun, runType: 'THIRTEENTH_FIRST' as const };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(thirteenthRun);
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue(thirteenthRun);
      (mockPrisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployees[0]]);
      (payrollTablesService.getEffective as jest.Mock).mockResolvedValue({ brackets: [], scalarValues: [] });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.salaryAdvance.findMany as jest.Mock).mockResolvedValue([]);
      (calculateThirteenthSalary as jest.Mock).mockReturnValue(mockCalcResult);
      (mockPrisma.payrollRunItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([
        { grossSalary: new Decimal(1500), netSalary: new Decimal(1500), inssPatronal: new Decimal(300), fgtsAmount: new Decimal(120), status: 'CALCULATED' },
      ]);

      await processRun(rls, 'run-1');

      expect(calculateThirteenthSalary).toHaveBeenCalled();
      expect(calculateEmployeePayroll).not.toHaveBeenCalled();
    });
  });

  // ─── Test 3: recalculateEmployee ───────────────────────────────────

  describe('recalculateEmployee', () => {
    it('recalculates and updates item for one employee', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'CALCULATED' as const,
      };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue({
        id: 'emp-1',
        name: 'João Silva',
        cpf: '12345678901',
        admissionDate: new Date('2020-01-01'),
        email: 'joao@farm.com',
        dependents: [],
        salaryHistory: [{ salary: new Decimal(3000), effectiveAt: new Date('2026-01-01') }],
        farms: [{ farmId: 'farm-1' }],
      });
      (payrollTablesService.getEffective as jest.Mock).mockResolvedValue({ brackets: [], scalarValues: [] });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue({
        id: 'ts-1',
        status: 'APPROVED',
        totalOvertime50: 0,
        totalOvertime100: 0,
        totalNightMinutes: 0,
        totalAbsences: 0,
      });
      (mockPrisma.salaryAdvance.findMany as jest.Mock).mockResolvedValue([]);
      (calculateEmployeePayroll as jest.Mock).mockReturnValue(mockCalcResult);
      (mockPrisma.payrollRunItem.create as jest.Mock).mockResolvedValue({ id: 'item-new' });
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([
        { grossSalary: new Decimal(3000), netSalary: new Decimal(2670), inssPatronal: new Decimal(690), fgtsAmount: new Decimal(240), status: 'CALCULATED' },
      ]);

      await recalculateEmployee(rls, 'run-1', 'emp-1');

      expect(mockPrisma.payrollRunItem.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'emp-1' }),
        }),
      );
      expect(mockPrisma.payrollRunItem.create).toHaveBeenCalled();
    });
  });

  // ─── Test 4: closeRun ──────────────────────────────────────────────

  describe('closeRun', () => {
    it('creates Payables, locks timesheets, creates employer CPs, transitions to COMPLETED', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'CALCULATED' as const,
      };

      const mockItems = [
        {
          id: 'item-1',
          employeeId: 'emp-1',
          status: 'CALCULATED',
          grossSalary: new Decimal(3000),
          netSalary: new Decimal(2670),
          inssPatronal: new Decimal(690),
          fgtsAmount: new Decimal(240),
          irrfAmount: new Decimal(0),
          vtDeduction: new Decimal(0),
          alimonyDeduction: null,
          lineItemsJson: mockCalcResult.lineItems.map(li => ({ ...li, value: li.value.toNumber() })),
          employee: {
            id: 'emp-1',
            name: 'João Silva',
            cpf: '12345678901',
            email: 'joao@farm.com',
            admissionDate: new Date('2020-01-01'),
            contracts: [{ position: { name: 'Tratorista' } }],
            farms: [{ farmId: 'farm-1' }],
          },
        },
        {
          id: 'item-2',
          employeeId: 'emp-2',
          status: 'CALCULATED',
          grossSalary: new Decimal(2800),
          netSalary: new Decimal(2500),
          inssPatronal: new Decimal(644),
          fgtsAmount: new Decimal(224),
          irrfAmount: new Decimal(0),
          vtDeduction: new Decimal(0),
          alimonyDeduction: null,
          lineItemsJson: [],
          employee: {
            id: 'emp-2',
            name: 'Maria Santos',
            cpf: '98765432100',
            email: null,
            admissionDate: new Date('2021-06-01'),
            contracts: [{ position: { name: 'Auxiliar' } }],
            farms: [{ farmId: 'farm-1' }],
          },
        },
      ];

      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue(mockItems);
      (mockPrisma.payable.create as jest.Mock).mockResolvedValue({ id: 'payable-1' });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue({ id: 'ts-1' });
      (mockPrisma.timesheet.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.salaryAdvance.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.salaryAdvance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun, status: 'COMPLETED' });
      (mockPrisma.payrollRunItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await closeRun(rls, 'run-1');

      const payableCreates = (mockPrisma.payable.create as jest.Mock).mock.calls;
      const employeePayableCall = payableCreates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c[0]?.data?.originType === 'PAYROLL_RUN_ITEM',
      );
      expect(employeePayableCall).toBeDefined();

      const inssPatronalCall = payableCreates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c[0]?.data?.originType === 'PAYROLL_EMPLOYER_INSS',
      );
      const fgtsCall = payableCreates.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c[0]?.data?.originType === 'PAYROLL_EMPLOYER_FGTS',
      );
      expect(inssPatronalCall).toBeDefined();
      expect(fgtsCall).toBeDefined();

      const timeUpdateCalls = (mockPrisma.timesheet.update as jest.Mock).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lockCall = timeUpdateCalls.find((c: any) => c[0]?.data?.status === 'LOCKED');
      expect(lockCall).toBeDefined();

      const updateCalls = (mockPrisma.payrollRun.update as jest.Mock).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completedCall = updateCalls.find((c: any) => c[0]?.data?.status === 'COMPLETED');
      expect(completedCall).toBeDefined();
    });
  });

  // ─── Test 5: revertRun ─────────────────────────────────────────────

  describe('revertRun', () => {
    it('sets status=REVERTED, cancels CPs, unlocks timesheets', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'COMPLETED' as const,
        items: [{ id: 'item-1' }, { id: 'item-2' }],
      };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payable.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
      (mockPrisma.timesheet.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrisma.salaryAdvance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun, status: 'REVERTED' });

      await revertRun(rls, 'run-1');

      expect(mockPrisma.payable.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );

      expect(mockPrisma.timesheet.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED', payrollRunId: null }),
        }),
      );

      expect(mockPrisma.payrollRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REVERTED' }),
        }),
      );
    });
  });

  // ─── Test 6: listRuns ──────────────────────────────────────────────

  describe('listRuns', () => {
    it('returns paginated list with filters (month, type, status)', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'CALCULATED', runType: 'MONTHLY', referenceMonth: new Date('2026-03-01') },
        { id: 'run-2', status: 'COMPLETED', runType: 'MONTHLY', referenceMonth: new Date('2026-02-01') },
      ];
      (mockPrisma.payrollRun.findMany as jest.Mock).mockResolvedValue(mockRuns);

      const result = await listRuns(rls, { page: 1, limit: 20, status: 'CALCULATED' });

      expect(Array.isArray(result.data)).toBe(true);
      expect(mockPrisma.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        }),
      );
    });
  });

  // ─── Test 7: getRun ────────────────────────────────────────────────

  describe('getRun', () => {
    it('returns run with items including employee name', async () => {
      const mockRun = {
        id: 'run-1',
        status: 'CALCULATED',
        items: [
          {
            id: 'item-1',
            employeeId: 'emp-1',
            employee: { name: 'João Silva', cpf: '12345678901' },
          },
        ],
      };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);

      const result = await getRun(rls, 'run-1');

      expect(result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).items[0].employee.name).toBe('João Silva');
    });
  });

  // ─── Test 8b: cpPreview ────────────────────────────────────────────

  describe('cpPreview', () => {
    const mockRun = {
      id: 'run-1',
      organizationId: 'org-1',
      referenceMonth: new Date('2026-03-01'),
      runType: 'MONTHLY' as const,
      status: 'CALCULATED' as const,
      totalNet: new Decimal(2670),
    };

    const baseItem = {
      id: 'item-1',
      employeeId: 'emp-1',
      status: 'CALCULATED' as const,
      grossSalary: new Decimal(3000),
      netSalary: new Decimal(2670),
      inssPatronal: new Decimal(690),
      fgtsAmount: new Decimal(240),
      irrfAmount: new Decimal(0),
      vtDeduction: new Decimal(0),
      alimonyDeduction: null,
      lineItemsJson: [],
      employee: {
        id: 'emp-1',
        name: 'João Silva',
        farms: [{ farmId: 'farm-1' }],
      },
    };

    it('returns correct structure with items and taxGuideItems array', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([baseItem]);
      (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([]);

      const result = await cpPreview(rls, 'run-1');

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('taxGuideItems');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('totalTaxGuides');
      expect(result).toHaveProperty('runTotalNet');
      expect(result).toHaveProperty('reconciled');
      expect(Array.isArray(result.items)).toBe(true);
      expect(Array.isArray(result.taxGuideItems)).toBe(true);
    });

    it('includes Salario Liquido, INSS Patronal, and FGTS entries', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([baseItem]);
      (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([]);

      const result = await cpPreview(rls, 'run-1');

      const types = result.items.map((i) => i.type);
      expect(types).toContain('Salario Liquido');
      expect(types).toContain('INSS Patronal');
      expect(types).toContain('FGTS');
    });

    it('includes IRRF entry when irrfAmount > 0', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([
        { ...baseItem, irrfAmount: new Decimal(150) },
      ]);
      (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([]);

      const result = await cpPreview(rls, 'run-1');

      const irrfEntry = result.items.find((i) => i.type === 'IRRF');
      expect(irrfEntry).toBeDefined();
      expect(irrfEntry!.amount).toBe(150);
    });

    it('includes VT entry when vtDeduction > 0', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([
        { ...baseItem, vtDeduction: new Decimal(100) },
      ]);
      (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([]);

      const result = await cpPreview(rls, 'run-1');

      const vtEntry = result.items.find((i) => i.type === 'VT');
      expect(vtEntry).toBeDefined();
      expect(vtEntry!.employeeName).toBe('João Silva');
    });

    it('includes taxGuideItems with FUNRURAL when tax guides exist', async () => {
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([baseItem]);
      (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([
        {
          guideType: 'FUNRURAL' as const,
          totalAmount: new Decimal(300),
          dueDate: new Date('2026-04-20'),
          referenceMonth: new Date('2026-03-01'),
        },
      ]);

      const result = await cpPreview(rls, 'run-1');

      expect(result.taxGuideItems.length).toBe(1);
      expect(result.taxGuideItems[0].type).toBe('FUNRURAL');
      expect(result.taxGuideItems[0].amount).toBe(300);
      expect(result.totalTaxGuides).toBe(300);
    });

    it('reconciliation flag is true when totalAmount matches runTotalNet', async () => {
      // run.totalNet = 2670, item.netSalary = 2670 → both equal after adding INSS/FGTS
      // Actually reconciliation compares totalAmount (all CPs) vs runTotalNet (run.totalNet)
      // With inssPatronal=690 and fgtsAmount=240, totalAmount = 2670+690+240 = 3600
      // runTotalNet from DB = 2670 → reconciled = false (expected difference > 0.01)
      // We test reconciled=true by setting totalNet equal to what we'll compute
      const runWithMatchingNet = {
        ...mockRun,
        totalNet: new Decimal(3600), // matches totalAmount
      };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(runWithMatchingNet);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([baseItem]);
      (mockPrisma.taxGuide.findMany as jest.Mock).mockResolvedValue([]);

      const result = await cpPreview(rls, 'run-1');

      expect(result.reconciled).toBe(true);
    });
  });

  // ─── Test 8c: closeRun creates 7 CP types ─────────────────────────

  describe('closeRun with new CP types', () => {
    it('creates IRRF CP when irrfAmount > 0', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'CALCULATED' as const,
      };
      const mockItems = [
        {
          id: 'item-1',
          employeeId: 'emp-1',
          status: 'CALCULATED' as const,
          grossSalary: new Decimal(5000),
          netSalary: new Decimal(4200),
          inssPatronal: new Decimal(1000),
          fgtsAmount: new Decimal(400),
          irrfAmount: new Decimal(250),
          vtDeduction: new Decimal(0),
          alimonyDeduction: null,
          lineItemsJson: [],
          employee: {
            id: 'emp-1',
            name: 'Carlos Pereira',
            cpf: '11122233344',
            email: null,
            admissionDate: new Date('2020-01-01'),
            contracts: [],
            farms: [{ farmId: 'farm-1' }],
          },
        },
      ];

      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue(mockItems);
      (mockPrisma.payable.create as jest.Mock).mockResolvedValue({ id: 'payable-x' });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.salaryAdvance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun, status: 'COMPLETED' });

      await closeRun(rls, 'run-1');

      const payableCreates = (mockPrisma.payable.create as jest.Mock).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const irrfCall = payableCreates.find((c: any) => c[0]?.data?.originType === 'PAYROLL_EMPLOYEE_IRRF');
      expect(irrfCall).toBeDefined();
      expect(irrfCall![0].data.totalAmount.toNumber()).toBe(250);
    });

    it('creates VT CP when vtDeduction > 0', async () => {
      const mockRun = {
        id: 'run-2',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'CALCULATED' as const,
      };
      const mockItems = [
        {
          id: 'item-2',
          employeeId: 'emp-2',
          status: 'CALCULATED' as const,
          grossSalary: new Decimal(2000),
          netSalary: new Decimal(1800),
          inssPatronal: new Decimal(460),
          fgtsAmount: new Decimal(160),
          irrfAmount: new Decimal(0),
          vtDeduction: new Decimal(80),
          alimonyDeduction: null,
          lineItemsJson: [],
          employee: {
            id: 'emp-2',
            name: 'Ana Lima',
            cpf: '22233344455',
            email: null,
            admissionDate: new Date('2021-01-01'),
            contracts: [],
            farms: [{ farmId: 'farm-1' }],
          },
        },
      ];

      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue(mockItems);
      (mockPrisma.payable.create as jest.Mock).mockResolvedValue({ id: 'payable-y' });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.salaryAdvance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun, status: 'COMPLETED' });

      await closeRun(rls, 'run-2');

      const payableCreates = (mockPrisma.payable.create as jest.Mock).mock.calls;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vtCall = payableCreates.find((c: any) => c[0]?.data?.originType === 'PAYROLL_EMPLOYEE_VT');
      expect(vtCall).toBeDefined();
      expect(vtCall![0].data.totalAmount.toNumber()).toBe(80);
    });

    it('creates PayableCostCenterItem entries when employee has contract cost center', async () => {
      const mockRun = {
        id: 'run-3',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'CALCULATED' as const,
      };
      const mockItems = [
        {
          id: 'item-3',
          employeeId: 'emp-3',
          status: 'CALCULATED' as const,
          grossSalary: new Decimal(2500),
          netSalary: new Decimal(2200),
          inssPatronal: new Decimal(575),
          fgtsAmount: new Decimal(200),
          irrfAmount: new Decimal(0),
          vtDeduction: new Decimal(0),
          alimonyDeduction: null,
          lineItemsJson: [],
          employee: {
            id: 'emp-3',
            name: 'Fernanda Costa',
            cpf: '33344455566',
            email: null,
            admissionDate: new Date('2022-01-01'),
            contracts: [],
            farms: [{ farmId: 'farm-1' }],
          },
        },
      ];

      // Employee has an active contract with a cost center
      (mockPrisma.employeeContract.findFirst as jest.Mock).mockResolvedValue({
        costCenterId: 'cc-1',
      });

      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue(mockItems);
      (mockPrisma.payable.create as jest.Mock).mockResolvedValue({ id: 'payable-z' });
      (mockPrisma.timesheet.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.salaryAdvance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun, status: 'COMPLETED' });

      await closeRun(rls, 'run-3');

      expect(mockPrisma.payableCostCenterItem.createMany).toHaveBeenCalled();
      const ccCall = (mockPrisma.payableCostCenterItem.createMany as jest.Mock).mock.calls[0];
      expect(ccCall[0].data[0].costCenterId).toBe('cc-1');
      expect(ccCall[0].data[0].percentage.toNumber()).toBe(100);
    });
  });

  // ─── Test 8d: revertRun cancels all 7 originTypes ────────────────

  describe('revertRun with 7 originTypes', () => {
    it('cancels all 7 PAYROLL_ originTypes using in-array filter', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY' as const,
        status: 'COMPLETED' as const,
        items: [{ id: 'item-1' }, { id: 'item-2' }],
      };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.payable.updateMany as jest.Mock).mockResolvedValue({ count: 7 });
      (mockPrisma.timesheet.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrisma.salaryAdvance.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (mockPrisma.payrollRun.update as jest.Mock).mockResolvedValue({ ...mockRun, status: 'REVERTED' });

      await revertRun(rls, 'run-1');

      const updateCall = (mockPrisma.payable.updateMany as jest.Mock).mock.calls[0][0];
      // The OR filter should include both item-level and run-level originTypes
      const originTypeFilter = updateCall.where.OR[0].originType;
      expect(originTypeFilter.in).toContain('PAYROLL_EMPLOYEE_IRRF');
      expect(originTypeFilter.in).toContain('PAYROLL_EMPLOYEE_VT');
      expect(originTypeFilter.in).toContain('PAYROLL_EMPLOYEE_PENSION');
      expect(originTypeFilter.in).toContain('PAYROLL_EMPLOYEE_SINDICAL');
      expect(originTypeFilter.in).toContain('PAYROLL_RUN_ITEM');
      expect(originTypeFilter.in).toContain('PAYROLL_EMPLOYER_INSS');
      expect(originTypeFilter.in).toContain('PAYROLL_EMPLOYER_FGTS');
    });
  });

  // ─── Test 8: downloadPayslipsZip ───────────────────────────────────

  describe('downloadPayslipsZip', () => {
    it('returns a Buffer (zip archive) for a completed run', async () => {
      const mockRun = {
        id: 'run-1',
        organizationId: 'org-1',
        status: 'COMPLETED',
        referenceMonth: new Date('2026-03-01'),
        runType: 'MONTHLY',
        organization: { name: 'Fazenda Teste', cnpj: '00000000000100' },
        items: [
          {
            id: 'item-1',
            status: 'CALCULATED',
            lineItemsJson: [],
            grossSalary: new Decimal(3000),
            netSalary: new Decimal(2670),
            inssAmount: new Decimal(330),
            irrfAmount: new Decimal(0),
            fgtsAmount: new Decimal(240),
            advanceDeduction: new Decimal(0),
            employee: {
              name: 'João Silva',
              cpf: '12345678901',
              admissionDate: new Date('2020-01-01'),
              contracts: [{ position: { name: 'Tratorista' } }],
            },
            payrollRun: { runType: 'MONTHLY' },
          },
        ],
      };
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue(mockRun);

      const buffer = await downloadPayslipsZip(rls, 'run-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
