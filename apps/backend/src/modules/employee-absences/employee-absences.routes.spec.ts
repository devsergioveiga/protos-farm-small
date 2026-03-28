// ─── Employee Absences Tests ──────────────────────────────────────────
// Tests for absence type auto-computation, overlap validation,
// employee status transitions, payroll impact calculation, and return registration.

// ─── Setup mocks before imports ──────────────────────────────────────

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn(),
}));

jest.mock('../../database/prisma', () => ({
  prisma: {
    employeeAbsence: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employeeStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import {
  createAbsence,
  registerReturn,
  getAbsenceImpactForMonth,
  listAbsences,
  getAbsenceById,
} from './employee-absences.service';
import { AbsenceError } from './employee-absences.types';
import { withRlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';

// ─── Typed mocks ───────────────────────────────────────────────────────

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockWithRlsContext = withRlsContext as jest.MockedFunction<typeof withRlsContext>;

const rls = { organizationId: 'org-1', userId: 'user-1' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAbsence(overrides: Record<string, any> = {}) {
  return {
    id: 'abs-1',
    organizationId: 'org-1',
    employeeId: 'emp-1',
    absenceType: 'MEDICAL_CERTIFICATE',
    startDate: new Date('2026-01-05'),
    endDate: new Date('2026-01-10'),
    totalDays: 6,
    catNumber: null,
    inssStartDate: null,
    stabilityEndsAt: null,
    returnDate: null,
    asoRequired: false,
    asoDocumentId: null,
    payrollImpact: JSON.stringify({
      companyPaidDays: 6,
      inssPaidDays: 0,
      suspendedDays: 0,
      fgtsFullMonth: true,
    }),
    notes: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    employee: { name: 'Maria Souza' },
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('createAbsence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue(null); // no overlap
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue({
      id: 'emp-1',
      status: 'ATIVO',
    });
    (mockPrisma.employee.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.employeeStatusHistory.create as jest.Mock).mockResolvedValue({});
  });

  // Test 1: MEDICAL_CERTIFICATE — proRataDeduct capped at 15
  it('Test 1: MEDICAL_CERTIFICATE sets companyPaidDays capped at 15', async () => {
    const absence = makeAbsence({
      absenceType: 'MEDICAL_CERTIFICATE',
      totalDays: 20,
      payrollImpact: JSON.stringify({
        companyPaidDays: 15,
        inssPaidDays: 5,
        suspendedDays: 0,
        fgtsFullMonth: true,
      }),
    });
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    const result = await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'MEDICAL_CERTIFICATE',
        startDate: '2026-01-05',
        endDate: '2026-01-24',
        createdBy: 'user-1',
      },
      rls,
    );

    expect(result.payrollImpact?.companyPaidDays).toBe(15);
    expect(result.payrollImpact?.inssPaidDays).toBe(5);
  });

  // Test 2: INSS_LEAVE — inssStartDate = startDate + 15 days
  it('Test 2: INSS_LEAVE sets inssStartDate = startDate + 15 days', async () => {
    const absence = makeAbsence({
      absenceType: 'INSS_LEAVE',
      inssStartDate: new Date('2026-01-20'),
      endDate: null,
      totalDays: null,
    });
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    const _result = await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'INSS_LEAVE',
        startDate: '2026-01-05',
        createdBy: 'user-1',
      },
      rls,
    );

    // Check that create was called with inssStartDate = startDate + 15
    const createCall = (mockPrisma.employeeAbsence.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.inssStartDate).toEqual(new Date('2026-01-20'));
  });

  // Test 3: WORK_ACCIDENT requires catNumber
  it('Test 3: WORK_ACCIDENT requires catNumber — throws 422 if missing', async () => {
    await expect(
      createAbsence(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          absenceType: 'WORK_ACCIDENT',
          startDate: '2026-01-05',
          createdBy: 'user-1',
          // catNumber missing
        },
        rls,
      ),
    ).rejects.toThrow(AbsenceError);

    await expect(
      createAbsence(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          absenceType: 'WORK_ACCIDENT',
          startDate: '2026-01-05',
          createdBy: 'user-1',
        },
        rls,
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'CAT_REQUIRED' });
  });

  // Test 4: MATERNITY — totalDays = 120
  it('Test 4: MATERNITY sets totalDays = 120', async () => {
    const absence = makeAbsence({ absenceType: 'MATERNITY', totalDays: 120 });
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'MATERNITY',
        startDate: '2026-01-05',
        createdBy: 'user-1',
      },
      rls,
    );

    const createCall = (mockPrisma.employeeAbsence.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.totalDays).toBe(120);
  });

  // Test 5: PATERNITY — totalDays = 5
  it('Test 5: PATERNITY sets totalDays = 5', async () => {
    const absence = makeAbsence({ absenceType: 'PATERNITY', totalDays: 5 });
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'PATERNITY',
        startDate: '2026-01-05',
        createdBy: 'user-1',
      },
      rls,
    );

    const createCall = (mockPrisma.employeeAbsence.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.totalDays).toBe(5);
  });

  // Test 6: MARRIAGE — totalDays = 3
  it('Test 6: MARRIAGE sets totalDays = 3', async () => {
    const absence = makeAbsence({ absenceType: 'MARRIAGE', totalDays: 3 });
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'MARRIAGE',
        startDate: '2026-01-05',
        createdBy: 'user-1',
      },
      rls,
    );

    const createCall = (mockPrisma.employeeAbsence.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.totalDays).toBe(3);
  });

  // Test 7: BEREAVEMENT — totalDays = 2
  it('Test 7: BEREAVEMENT sets totalDays = 2', async () => {
    const absence = makeAbsence({ absenceType: 'BEREAVEMENT', totalDays: 2 });
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'BEREAVEMENT',
        startDate: '2026-01-05',
        createdBy: 'user-1',
      },
      rls,
    );

    const createCall = (mockPrisma.employeeAbsence.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.totalDays).toBe(2);
  });

  // Test 8: transitions employee status to AFASTADO
  it('Test 8: transitions employee status to AFASTADO and creates status history', async () => {
    const absence = makeAbsence();
    (mockPrisma.employeeAbsence.create as jest.Mock).mockResolvedValue(absence);

    await createAbsence(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        absenceType: 'MEDICAL_CERTIFICATE',
        startDate: '2026-01-05',
        endDate: '2026-01-10',
        createdBy: 'user-1',
      },
      rls,
    );

    expect(mockPrisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'AFASTADO' } }),
    );
    expect(mockPrisma.employeeStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'ATIVO',
          toStatus: 'AFASTADO',
        }),
      }),
    );
  });

  // Test 12: cannot create overlapping absence
  it('Test 12: rejects overlapping absence for same employee', async () => {
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue({
      id: 'existing-abs',
      returnDate: null,
    });

    await expect(
      createAbsence(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          absenceType: 'MEDICAL_CERTIFICATE',
          startDate: '2026-01-05',
          createdBy: 'user-1',
        },
        rls,
      ),
    ).rejects.toThrow(AbsenceError);

    await expect(
      createAbsence(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          absenceType: 'MEDICAL_CERTIFICATE',
          startDate: '2026-01-05',
          createdBy: 'user-1',
        },
        rls,
      ),
    ).rejects.toMatchObject({ code: 'OVERLAPPING_ABSENCE' });
  });
});

// ─── registerReturn ────────────────────────────────────────────────────

describe('registerReturn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
    (mockPrisma.employee.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.employeeStatusHistory.create as jest.Mock).mockResolvedValue({});
  });

  // Test 9: sets returnDate, transitions employee back to ATIVO
  it('Test 9: sets returnDate and transitions employee status to ATIVO', async () => {
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue(
      makeAbsence({ returnDate: null, absenceType: 'MEDICAL_CERTIFICATE' }),
    );
    (mockPrisma.employeeAbsence.update as jest.Mock).mockResolvedValue(
      makeAbsence({ returnDate: new Date('2026-01-11') }),
    );

    await registerReturn('abs-1', { returnDate: '2026-01-11' }, rls);

    expect(mockPrisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ATIVO' } }),
    );
    expect(mockPrisma.employeeStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'AFASTADO',
          toStatus: 'ATIVO',
        }),
      }),
    );
  });

  // WORK_ACCIDENT: stabilityEndsAt = returnDate + 12 months
  it('WORK_ACCIDENT: sets stabilityEndsAt = returnDate + 12 months', async () => {
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue(
      makeAbsence({ returnDate: null, absenceType: 'WORK_ACCIDENT', asoRequired: true }),
    );
    (mockPrisma.employeeAbsence.update as jest.Mock).mockResolvedValue(
      makeAbsence({ returnDate: new Date('2026-02-01'), stabilityEndsAt: new Date('2027-02-01') }),
    );

    await registerReturn('abs-1', { returnDate: '2026-02-01' }, rls);

    const updateCall = (mockPrisma.employeeAbsence.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.stabilityEndsAt).toEqual(new Date('2027-02-01'));
  });

  it('throws 400 if return already registered', async () => {
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue(
      makeAbsence({ returnDate: new Date('2026-01-10') }),
    );

    await expect(registerReturn('abs-1', { returnDate: '2026-01-11' }, rls)).rejects.toThrow(
      AbsenceError,
    );
  });
});

// ─── getAbsenceImpactForMonth ─────────────────────────────────────────

describe('getAbsenceImpactForMonth', () => {
  // Test 10: correctly splits company-paid vs INSS-paid days
  it('Test 10: splits company-paid vs INSS-paid days for INSS_LEAVE', async () => {
    const mockTx = {
      employeeAbsence: {
        findMany: jest.fn().mockResolvedValue([
          {
            employeeId: 'emp-1',
            absenceType: 'INSS_LEAVE',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-01-31'),
          },
        ]),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getAbsenceImpactForMonth('emp-1', new Date('2026-01-01'), mockTx as any);

    // 31 days total: 15 company-paid, 16 INSS-paid
    expect(result.companyPaidDays).toBe(15);
    expect(result.inssPaidDays).toBeGreaterThan(0);
    expect(result.fgtsFullMonth).toBe(true);
  });

  it('returns zero impact when no absences', async () => {
    const mockTx = {
      employeeAbsence: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getAbsenceImpactForMonth('emp-1', new Date('2026-01-01'), mockTx as any);

    expect(result.companyPaidDays).toBe(0);
    expect(result.inssPaidDays).toBe(0);
    expect(result.fgtsFullMonth).toBe(false);
  });
});

// ─── listAbsences ─────────────────────────────────────────────────────

describe('listAbsences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 11: filters by type, employee, date range
  it('Test 11: filters by type, employee, and date range', async () => {
    (mockPrisma.employeeAbsence.findMany as jest.Mock).mockResolvedValue([]);

    await listAbsences(
      'org-1',
      {
        employeeId: 'emp-1',
        absenceType: 'MEDICAL_CERTIFICATE',
        from: '2026-01-01',
        to: '2026-01-31',
      },
      rls,
    );

    expect(mockPrisma.employeeAbsence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'emp-1',
          absenceType: 'MEDICAL_CERTIFICATE',
        }),
      }),
    );
  });
});

// ─── getAbsenceById ───────────────────────────────────────────────────

describe('getAbsenceById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  it('returns absence with employee name', async () => {
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue(makeAbsence());

    const result = await getAbsenceById('abs-1', 'org-1', rls);

    expect(result.employeeName).toBe('Maria Souza');
    expect(result.absenceType).toBe('MEDICAL_CERTIFICATE');
  });

  it('throws 404 when not found', async () => {
    (mockPrisma.employeeAbsence.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getAbsenceById('nonexistent', 'org-1', rls)).rejects.toThrow(AbsenceError);
  });
});
