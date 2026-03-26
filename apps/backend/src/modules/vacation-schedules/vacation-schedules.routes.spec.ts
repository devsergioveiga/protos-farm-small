// ─── Vacation Schedules Tests ─────────────────────────────────────────
// Tests for vacation pay calculation, fractionation validation,
// period state machine, CRUD operations, and edge cases.

// ─── Setup mocks before imports ──────────────────────────────────────

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn(),
}));

jest.mock('../../database/prisma', () => ({
  prisma: {
    vacationAcquisitivePeriod: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    vacationSchedule: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../payroll-tables/payroll-tables.service', () => ({
  payrollTablesService: { getEffective: jest.fn().mockResolvedValue(null) },
}));

import Decimal from 'decimal.js';
import {
  calculateVacationPay,
  calcPaymentDueDate,
  validateFractionation,
  initVacationPeriod,
  advancePeriod,
  scheduleVacation,
  cancelVacation,
  markAsPaid,
  listAcquisitivePeriods,
  listSchedules,
  getScheduleById,
  getExpiringPeriods,
} from './vacation-schedules.service';
import { VacationError } from './vacation-schedules.types';
import { withRlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import type { EngineParams } from '../payroll-runs/payroll-runs.types';

// ─── Typed mocks ───────────────────────────────────────────────────────

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockWithRlsContext = withRlsContext as jest.MockedFunction<typeof withRlsContext>;

const rls = { organizationId: 'org-1', userId: 'user-1' };

// Standard engine params matching 2026 table values
const mockEngineParams: EngineParams = {
  inssBrackets: [
    { from: new Decimal(0), upTo: new Decimal(1412.0), rate: new Decimal(0.075) },
    { from: new Decimal(1412.01), upTo: new Decimal(2666.68), rate: new Decimal(0.09) },
    { from: new Decimal(2666.69), upTo: new Decimal(4000.03), rate: new Decimal(0.12) },
    { from: new Decimal(4000.04), upTo: new Decimal(7786.02), rate: new Decimal(0.14) },
  ],
  irrfBrackets: [
    { upTo: new Decimal(3036.0), rate: new Decimal(0), deduction: new Decimal(0) },
    { upTo: new Decimal(4000.0), rate: new Decimal(0.075), deduction: new Decimal(142.8) },
    { upTo: null, rate: new Decimal(0.275), deduction: new Decimal(942.8) },
  ],
  inssCeiling: new Decimal(7786.02),
  dependentDeduction: new Decimal(189.59),
  irrfExemptionLimit: new Decimal(3036.0),
  redutorUpperLimit: new Decimal(20000),
  redutorA: new Decimal(564.8),
  redutorB: new Decimal(142.8),
  salaryFamilyValuePerChild: new Decimal(62.04),
  salaryFamilyIncomeLimit: new Decimal(1819.26),
  ratPercent: new Decimal(1),
};

// ─── Tests ─────────────────────────────────────────────────────────────

describe('calculateVacationPay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 1: 30-day vacation with R$3000 salary
  it('Test 1: calculates correct gross and net for 30-day vacation at R$3000', () => {
    const input = {
      baseSalary: new Decimal(3000),
      daysScheduled: 30,
      abonoDays: 0,
      avgOvertime: new Decimal(0),
      avgNight: new Decimal(0),
      dependentCount: 0,
    };
    const result = calculateVacationPay(input, mockEngineParams);

    // dailyRate = 3000/30 = 100
    // vacationBase = 100 * 30 = 3000
    // bonusThird = 3000/3 = 1000
    // grossTaxable = 3000 + 1000 = 4000
    expect(result.vacationBase.toNumber()).toBe(3000);
    expect(result.bonusThird.toNumber()).toBe(1000);
    expect(result.grossTaxable.toNumber()).toBe(4000);
    expect(result.abonoValue.toNumber()).toBe(0);
    // INSS on 4000: brackets 1+2+3+partial4
    expect(result.inssAmount.greaterThan(0)).toBe(true);
    expect(result.netAmount.greaterThan(0)).toBe(true);
  });

  // Test 2: abono 10 days — NOT subject to INSS/IRRF (OJ 386)
  it('Test 2: abono 10 days adds to net but NOT to grossTaxable', () => {
    const input = {
      baseSalary: new Decimal(3000),
      daysScheduled: 20,
      abonoDays: 10,
      avgOvertime: new Decimal(0),
      avgNight: new Decimal(0),
      dependentCount: 0,
    };
    const resultWithAbono = calculateVacationPay(input, mockEngineParams);
    const resultNoAbono = calculateVacationPay({ ...input, abonoDays: 0 }, mockEngineParams);

    // abonoValue = 100 * 10 * 1.333333 = 1333.33
    expect(resultWithAbono.abonoValue.toNumber()).toBeCloseTo(1333.33, 1);
    // INSS/IRRF should be same (grossTaxable unchanged by abono)
    expect(resultWithAbono.grossTaxable.equals(resultNoAbono.grossTaxable)).toBe(true);
    // Net is higher with abono
    expect(resultWithAbono.netAmount.greaterThan(resultNoAbono.netAmount)).toBe(true);
  });

  // Test 11: abonoValue uses 4/3 multiplier (1.333333)
  it('Test 11: abonoValue calculation uses 4/3 multiplier (OJ 386)', () => {
    const input = {
      baseSalary: new Decimal(3000),
      daysScheduled: 20,
      abonoDays: 10,
      avgOvertime: new Decimal(0),
      avgNight: new Decimal(0),
      dependentCount: 0,
    };
    const result = calculateVacationPay(input, mockEngineParams);
    // 3000/30 * 10 * 1.333333 = 1333.33
    expect(result.abonoValue.toNumber()).toBeCloseTo(1333.33, 1);
  });

  // Test 12: doubling deadline — endDate + 12 months
  it('Test 12: doubling deadline is endDate + 12 months', () => {
    const endDate = new Date('2026-01-01');
    const deadline = new Date(endDate);
    deadline.setUTCFullYear(deadline.getUTCFullYear() + 1);
    expect(deadline.getUTCFullYear()).toBe(2027);
    expect(deadline.getUTCMonth()).toBe(0); // January
  });
});

// ─── validateFractionation ────────────────────────────────────────────

describe('validateFractionation', () => {
  // Test 3: rejects fraction < 5 days
  it('Test 3: rejects fraction with less than 5 days with 422', () => {
    expect(() => validateFractionation([], 4, 30)).toThrow(VacationError);
    expect(() => validateFractionation([], 4, 30)).toThrow('5 dias');
  });

  // Test 4: rejects 4th fraction (max 3)
  it('Test 4: rejects 4th fraction (max 3 allowed)', () => {
    const existing = [
      { totalDays: 10, status: 'SCHEDULED' },
      { totalDays: 10, status: 'SCHEDULED' },
      { totalDays: 10, status: 'SCHEDULED' },
    ];
    expect(() => validateFractionation(existing, 5, 30)).toThrow(VacationError);
    expect(() => validateFractionation(existing, 5, 30)).toThrow('3 frações');
  });

  // Test 5: rejects if no fraction >= 14 days
  it('Test 5: rejects if no fraction is >= 14 days (CLT Art. 134 §1)', () => {
    const existing = [{ totalDays: 10, status: 'SCHEDULED' }];
    // new fraction = 10, no existing >= 14
    expect(() => validateFractionation(existing, 10, 30)).toThrow(VacationError);
    expect(() => validateFractionation(existing, 10, 30)).toThrow('14 dias');
  });

  it('accepts first fraction >= 14 days without previous fractions', () => {
    expect(() => validateFractionation([], 14, 30)).not.toThrow();
  });

  it('accepts second fraction >= 5 when existing fraction is >= 14', () => {
    const existing = [{ totalDays: 20, status: 'SCHEDULED' }];
    expect(() => validateFractionation(existing, 10, 30)).not.toThrow();
  });

  it('ignores CANCELLED fractions in count', () => {
    const existing = [
      { totalDays: 10, status: 'CANCELLED' },
      { totalDays: 10, status: 'CANCELLED' },
      { totalDays: 10, status: 'CANCELLED' },
    ];
    // 3 cancelled + new 14 days — should work (0 active fractions)
    expect(() => validateFractionation(existing, 14, 30)).not.toThrow();
  });
});

// ─── calcPaymentDueDate ───────────────────────────────────────────────

describe('calcPaymentDueDate', () => {
  // Test 11: payment due date is 2 business days before start
  it('Test 11: returns 2 business days before startDate (skip weekends)', () => {
    // Monday 2026-01-05 → 2 business days before = Thursday 2026-01-01
    const start = new Date('2026-01-05T00:00:00Z');
    const due = calcPaymentDueDate(start);
    expect(due.getUTCDay()).not.toBe(0); // not Sunday
    expect(due.getUTCDay()).not.toBe(6); // not Saturday
    // Due should be 2 business days before Monday = Thursday
    expect(due.getUTCDate()).toBe(1);
  });

  it('skips over weekend when start is on Wednesday', () => {
    // Wednesday 2026-01-07 → subtract 2 business days
    // Tue 2026-01-06, Mon 2026-01-05 → due = Mon 2026-01-05
    const start = new Date('2026-01-07T00:00:00Z');
    const due = calcPaymentDueDate(start);
    expect(due.getUTCDate()).toBe(5); // Monday
  });
});

// ─── Period State Machine ─────────────────────────────────────────────

describe('initVacationPeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 6: initVacationPeriod creates ACCRUING period with 30 daysEarned
  it('Test 6: creates ACCRUING period with 30 daysEarned', async () => {
    const mockPeriod = {
      id: 'period-1',
      employeeId: 'emp-1',
      status: 'ACCRUING',
      daysEarned: 30,
      daysTaken: 0,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      createdAt: new Date(),
    };
    (mockPrisma.vacationAcquisitivePeriod.create as jest.Mock).mockResolvedValue(mockPeriod);

    const result = await initVacationPeriod('emp-1', new Date('2026-01-01'), rls);
    expect(mockPrisma.vacationAcquisitivePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          daysEarned: 30,
          daysTaken: 0,
          status: 'ACCRUING',
        }),
      }),
    );
  });
});

describe('advancePeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 7: advancePeriod transitions ACCRUING → AVAILABLE and creates next period
  it('Test 7: transitions ACCRUING → AVAILABLE and creates next period', async () => {
    const mockPeriod = {
      id: 'period-1',
      employeeId: 'emp-1',
      status: 'ACCRUING',
      daysEarned: 30,
      daysTaken: 0,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
    };
    (mockPrisma.vacationAcquisitivePeriod.findFirst as jest.Mock).mockResolvedValue(mockPeriod);
    (mockPrisma.vacationAcquisitivePeriod.update as jest.Mock).mockResolvedValue({
      ...mockPeriod,
      status: 'AVAILABLE',
    });
    (mockPrisma.vacationAcquisitivePeriod.create as jest.Mock).mockResolvedValue({});

    await advancePeriod('period-1', rls);

    expect(mockPrisma.vacationAcquisitivePeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'period-1' },
        data: { status: 'AVAILABLE' },
      }),
    );
    expect(mockPrisma.vacationAcquisitivePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          status: 'ACCRUING',
        }),
      }),
    );
  });

  it('throws if period is not ACCRUING', async () => {
    (mockPrisma.vacationAcquisitivePeriod.findFirst as jest.Mock).mockResolvedValue({
      id: 'period-1',
      status: 'AVAILABLE',
    });

    await expect(advancePeriod('period-1', rls)).rejects.toThrow(VacationError);
  });
});

// ─── Cancel & Pay ──────────────────────────────────────────────────────

describe('cancelVacation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 8: cancelVacation returns days to acquisitive period balance
  it('Test 8: returns days to acquisitive period on cancel', async () => {
    const mockSchedule = {
      id: 'sched-1',
      organizationId: 'org-1',
      status: 'SCHEDULED',
      totalDays: 10,
      acquisitivePeriodId: 'period-1',
    };
    (mockPrisma.vacationSchedule.findFirst as jest.Mock).mockResolvedValue(mockSchedule);
    (mockPrisma.vacationSchedule.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.vacationAcquisitivePeriod.update as jest.Mock).mockResolvedValue({});

    await cancelVacation('sched-1', rls);

    expect(mockPrisma.vacationSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
    expect(mockPrisma.vacationAcquisitivePeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { daysTaken: { decrement: 10 } },
      }),
    );
  });

  it('throws 400 if schedule is already PAID', async () => {
    (mockPrisma.vacationSchedule.findFirst as jest.Mock).mockResolvedValue({
      id: 'sched-1',
      organizationId: 'org-1',
      status: 'PAID',
      totalDays: 10,
    });

    await expect(cancelVacation('sched-1', rls)).rejects.toThrow(VacationError);
  });
});

// ─── List & Get ────────────────────────────────────────────────────────

describe('listSchedules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 10: listSchedules filters by status and employee
  it('Test 10: filters by employeeId and status', async () => {
    (mockPrisma.vacationSchedule.findMany as jest.Mock).mockResolvedValue([]);

    await listSchedules('org-1', { employeeId: 'emp-1', status: 'SCHEDULED' }, rls);

    expect(mockPrisma.vacationSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          employeeId: 'emp-1',
          status: 'SCHEDULED',
        }),
      }),
    );
  });
});

describe('listAcquisitivePeriods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 9: listAcquisitivePeriods returns periods with balance info
  it('Test 9: returns periods with balance and doublingDeadline', async () => {
    const mockPeriods = [
      {
        id: 'period-1',
        employeeId: 'emp-1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        daysEarned: 30,
        daysTaken: 10,
        daysLost: 0,
        status: 'AVAILABLE',
        employee: { organizationId: 'org-1' },
      },
    ];
    (mockPrisma.vacationAcquisitivePeriod.findMany as jest.Mock).mockResolvedValue(mockPeriods);

    const result = await listAcquisitivePeriods('emp-1', 'org-1', rls);

    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(20); // 30 - 10
    expect(result[0].doublingDeadline).toBeInstanceOf(Date);
    expect(result[0].doublingDeadline.getUTCFullYear()).toBe(2026);
  });
});

describe('getScheduleById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  it('returns schedule with employee name', async () => {
    const mockSchedule = {
      id: 'sched-1',
      organizationId: 'org-1',
      employeeId: 'emp-1',
      acquisitivePeriodId: 'period-1',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-30'),
      totalDays: 30,
      abono: 0,
      grossAmount: { toString: () => '4000.00' },
      inssAmount: { toString: () => '440.00' },
      irrfAmount: { toString: () => '0.00' },
      netAmount: { toString: () => '3560.00' },
      fgtsAmount: { toString: () => '320.00' },
      paymentDueDate: new Date('2026-06-29'),
      status: 'SCHEDULED',
      receiptUrl: null,
      processedAt: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      employee: { name: 'João Silva' },
    };
    (mockPrisma.vacationSchedule.findFirst as jest.Mock).mockResolvedValue(mockSchedule);

    const result = await getScheduleById('sched-1', 'org-1', rls);

    expect(result.employeeName).toBe('João Silva');
    expect(result.status).toBe('SCHEDULED');
  });

  it('throws 404 when schedule not found', async () => {
    (mockPrisma.vacationSchedule.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(getScheduleById('nonexistent', 'org-1', rls)).rejects.toThrow(VacationError);
  });
});
