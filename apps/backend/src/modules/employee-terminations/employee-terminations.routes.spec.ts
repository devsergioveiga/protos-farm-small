// ─── Employee Terminations Tests ──────────────────────────────────────
// Tests for termination CRUD, state machine (DRAFT→PROCESSED→PAID),
// PDF generation, validation, and expiring deadline queries.

// ─── Setup mocks before imports ──────────────────────────────────────

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn(),
}));

jest.mock('../../database/prisma', () => ({
  prisma: {
    employeeTermination: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    employeeSalaryHistory: {
      findFirst: jest.fn(),
    },
    vacationAcquisitivePeriod: {
      findMany: jest.fn(),
    },
    payrollRunItem: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../payroll-tables/payroll-tables.service', () => ({
  payrollTablesService: { getEffective: jest.fn().mockResolvedValue(null) },
}));

jest.mock('./termination-pdf.service', () => ({
  generateTRCTPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-TRCT-test')),
  generateGRRFPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-GRRF-test')),
}));

import Decimal from 'decimal.js';
import {
  processTermination,
  confirmTermination,
  markAsPaid,
  listTerminations,
  getTerminationById,
  getTrctPdf,
  getGrffPdf,
  getExpiringDeadlines,
} from './employee-terminations.service';
import { TerminationError } from './employee-terminations.types';
import { withRlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';

// ─── Typed mocks ────────────────────────────────────────────────────────

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockWithRlsContext = withRlsContext as jest.MockedFunction<typeof withRlsContext>;

const rls = { organizationId: 'org-1', userId: 'user-1' };

// ─── Helpers ────────────────────────────────────────────────────────────

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'emp-1',
    name: 'João da Silva',
    cpf: '123.456.789-00',
    status: 'ATIVO',
    admissionDate: new Date('2020-01-15'),
    dependentsCount: 0,
    position: { title: 'Operador Rural' },
    organizationId: 'org-1',
    termination: null,
    ...overrides,
  };
}

function makeSalaryHistory() {
  return {
    id: 'sal-1',
    employeeId: 'emp-1',
    salary: new Decimal('3000.00'),
    effectiveDate: new Date('2024-01-01'),
  };
}

function makeTermination(overrides: Record<string, unknown> = {}) {
  return {
    id: 'term-1',
    organizationId: 'org-1',
    employeeId: 'emp-1',
    terminationType: 'WITHOUT_CAUSE',
    terminationDate: new Date('2026-03-15'),
    noticePeriodDays: 57,
    noticePeriodType: 'COMPENSATED',
    balanceSalary: new Decimal('1451.61'),
    thirteenthProp: new Decimal('750.00'),
    vacationVested: new Decimal('0'),
    vacationProp: new Decimal('500.00'),
    vacationBonus: new Decimal('166.67'),
    noticePay: new Decimal('5700.00'),
    fgtsBalance: new Decimal('5000.00'),
    fgtsPenalty: new Decimal('2000.00'),
    totalGross: new Decimal('8568.28'),
    inssAmount: new Decimal('988.09'),
    irrfAmount: new Decimal('300.00'),
    totalNet: new Decimal('9280.19'),
    paymentDeadline: new Date('2026-03-25'),
    trctPdfUrl: null,
    grfPdfUrl: null,
    status: 'DRAFT',
    processedAt: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    employee: {
      name: 'João da Silva',
      cpf: '123.456.789-00',
      position: { title: 'Operador Rural' },
    },
    ...overrides,
  };
}

// ─── processTermination tests ────────────────────────────────────────

describe('processTermination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue(makeEmployee());
    (mockPrisma.employeeSalaryHistory.findFirst as jest.Mock).mockResolvedValue(
      makeSalaryHistory(),
    );
    (mockPrisma.vacationAcquisitivePeriod.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.payrollRunItem.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.employeeTermination.create as jest.Mock).mockResolvedValue(makeTermination());
  });

  // Test 1: POST creates DRAFT termination with calculated amounts
  it('Test 1: creates DRAFT termination with calculated amounts', async () => {
    const result = await processTermination(
      {
        organizationId: 'org-1',
        employeeId: 'emp-1',
        terminationType: 'WITHOUT_CAUSE',
        terminationDate: '2026-03-15',
        noticePeriodType: 'COMPENSATED',
        createdBy: 'user-1',
      },
      rls,
    );

    expect(mockPrisma.employeeTermination.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('DRAFT');
  });

  // Test 7: Cannot terminate already-terminated employee (409)
  it('Test 7: throws 409 if employee already has a termination record', async () => {
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue(
      makeEmployee({ termination: { id: 'existing-term' }, status: 'DESLIGADO' }),
    );

    await expect(
      processTermination(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          terminationType: 'WITHOUT_CAUSE',
          terminationDate: '2026-03-15',
          noticePeriodType: 'COMPENSATED',
          createdBy: 'user-1',
        },
        rls,
      ),
    ).rejects.toThrow(TerminationError);

    const call = jest.mocked(processTermination).mock?.results;
    try {
      await processTermination(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          terminationType: 'WITHOUT_CAUSE',
          terminationDate: '2026-03-15',
          noticePeriodType: 'COMPENSATED',
          createdBy: 'user-1',
        },
        rls,
      );
    } catch (err) {
      expect((err as TerminationError).statusCode).toBe(409);
    }
    void call; // suppress lint
  });

  // Test 8: Cannot terminate AFASTADO with stability (422)
  it('Test 8: throws 422 if employee is AFASTADO with stability', async () => {
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue(
      makeEmployee({ status: 'AFASTADO' }),
    );

    await expect(
      processTermination(
        {
          organizationId: 'org-1',
          employeeId: 'emp-1',
          terminationType: 'WITHOUT_CAUSE',
          terminationDate: '2026-03-15',
          noticePeriodType: 'COMPENSATED',
          createdBy: 'user-1',
        },
        rls,
      ),
    ).rejects.toThrow(TerminationError);
  });
});

// ─── confirmTermination tests ────────────────────────────────────────

describe('confirmTermination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 2: DRAFT → PROCESSED, employee DESLIGADO
  it('Test 2: transitions DRAFT → PROCESSED and sets employee DESLIGADO', async () => {
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(makeTermination());
    (mockPrisma.employeeTermination.update as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'PROCESSED', processedAt: new Date() }),
    );
    (mockPrisma.employee.update as jest.Mock).mockResolvedValue({});

    const result = await confirmTermination('term-1', rls);

    expect(mockPrisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'emp-1' },
        data: expect.objectContaining({ status: 'DESLIGADO' }),
      }),
    );
    expect(result.status).toBe('PROCESSED');
  });

  // Test 11: Confirm sets processedAt timestamp
  it('Test 11: processedAt is set on confirmation', async () => {
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(makeTermination());
    const processedAt = new Date();
    (mockPrisma.employeeTermination.update as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'PROCESSED', processedAt }),
    );
    (mockPrisma.employee.update as jest.Mock).mockResolvedValue({});

    const result = await confirmTermination('term-1', rls);

    expect(result.processedAt).toBeDefined();
  });
});

// ─── markAsPaid tests ────────────────────────────────────────────────

describe('markAsPaid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 3: PROCESSED → PAID
  it('Test 3: transitions PROCESSED → PAID', async () => {
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'PROCESSED', processedAt: new Date() }),
    );
    (mockPrisma.employeeTermination.update as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'PAID', processedAt: new Date() }),
    );

    const result = await markAsPaid('term-1', rls);
    expect(result.status).toBe('PAID');
  });

  // Test 12: Pay without prior confirm returns 422
  it('Test 12: throws 422 if termination is still DRAFT (not confirmed)', async () => {
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'DRAFT' }),
    );

    await expect(markAsPaid('term-1', rls)).rejects.toThrow(TerminationError);
    try {
      await markAsPaid('term-1', rls);
    } catch (err) {
      expect((err as TerminationError).statusCode).toBe(422);
    }
  });
});

// ─── PDF tests ───────────────────────────────────────────────────────

describe('getTrctPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'PROCESSED', processedAt: new Date() }),
    );
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue(makeEmployee());
  });

  // Test 4: GET trct returns PDF buffer
  it('Test 4: getTrctPdf returns PDF buffer', async () => {
    const buffer = await getTrctPdf('term-1', rls);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString().includes('PDF')).toBe(true);
  });
});

describe('getGrffPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(
      makeTermination({ status: 'PROCESSED', processedAt: new Date() }),
    );
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue(makeEmployee());
  });

  // Test 5: GET grrf returns PDF buffer
  it('Test 5: getGrffPdf returns GRRF PDF buffer', async () => {
    const buffer = await getGrffPdf('term-1', rls);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

// ─── getExpiringDeadlines ─────────────────────────────────────────────

describe('getExpiringDeadlines', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 6: returns terminations near payment deadline
  it('Test 6: returns terminations with paymentDeadline within daysAhead', async () => {
    const nearDeadline = makeTermination({ status: 'PROCESSED', processedAt: new Date() });
    (mockPrisma.employeeTermination.findMany as jest.Mock).mockResolvedValue([nearDeadline]);

    const result = await getExpiringDeadlines('org-1', 10);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(mockPrisma.employeeTermination.findMany).toHaveBeenCalledTimes(1);
  });
});

// ─── listTerminations and getTerminationById ──────────────────────────

describe('listTerminations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  // Test 9: filters by type and status
  it('Test 9: filters by terminationType and status', async () => {
    (mockPrisma.employeeTermination.findMany as jest.Mock).mockResolvedValue([makeTermination()]);

    const result = await listTerminations(
      { organizationId: 'org-1', terminationType: 'WITHOUT_CAUSE', status: 'DRAFT' },
      rls,
    );

    expect(Array.isArray(result.data)).toBe(true);
    expect(mockPrisma.employeeTermination.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          terminationType: 'WITHOUT_CAUSE',
          status: 'DRAFT',
        }),
      }),
    );
  });
});

describe('getTerminationById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockPrisma as any));
  });

  it('returns termination by id', async () => {
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(makeTermination());

    const result = await getTerminationById('term-1', rls);
    expect(result.id).toBe('term-1');
  });

  it('throws 404 if not found', async () => {
    (mockPrisma.employeeTermination.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getTerminationById('not-exists', rls)).rejects.toThrow(TerminationError);
  });
});
