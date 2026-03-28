// ─── Income Statements Service Tests ─────────────────────────────────────────
// Covers: generateStatements, listStatements, downloadStatement, sendStatements,
// getRaisConsistency, upsert idempotency, PayrollRunItem aggregation.

import { IncomeStatementsService } from './income-statements.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {},
}));

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn((ctx: unknown, fn: (tx: unknown) => unknown) => fn(mockTx)),
}));

jest.mock('../../shared/mail/mail.service', () => ({
  sendMail: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockTx: any = {
  payrollRun: { findMany: jest.fn() },
  payrollRunItem: { findMany: jest.fn() },
  incomeStatement: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  esocialEvent: { findMany: jest.fn() },
  employee: { findMany: jest.fn() },
};

const { withRlsContext } = jest.requireMock('../../database/rls') as {
  withRlsContext: jest.Mock;
};

const { sendMail } = jest.requireMock('../../shared/mail/mail.service') as {
  sendMail: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  withRlsContext.mockImplementation((ctx: unknown, fn: (tx: typeof mockTx) => unknown) =>
    fn(mockTx),
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org-001';
const USER_ID = 'user-001';
const YEAR_BASE = 2025;
const EMP_ID = 'emp-001';
const EMP_NAME = 'Joao da Silva';
const EMP_CPF = '12345678901';

function makeEmployee(overrides: Partial<any> = {}): any {
  return {
    id: EMP_ID,
    name: EMP_NAME,
    cpf: EMP_CPF,
    email: 'joao@fazenda.com',
    pisPassep: '12345678901',
    admissionDate: new Date('2020-01-01'),
    terminationDate: null,
    dependents: [],
    ...overrides,
  };
}

function makePayrollRun(month: string, id: string = `run-${month}`): any {
  return {
    id,
    referenceMonth: new Date(`${month}-01`),
    runType: 'MONTHLY',
    status: 'COMPLETED',
    items: [],
  };
}

function makePayrollRunItem(overrides: Partial<any> = {}): any {
  return {
    id: 'item-001',
    payrollRunId: 'run-2025-01',
    employeeId: EMP_ID,
    grossSalary: { toNumber: () => 3000, toString: () => '3000.00' },
    inssAmount: { toNumber: () => 270, toString: () => '270.00' },
    irrfAmount: { toNumber: () => 150, toString: () => '150.00' },
    fgtsAmount: { toNumber: () => 240, toString: () => '240.00' },
    salaryFamily: { toNumber: () => 0, toString: () => '0.00' },
    lineItemsJson: null,
    employee: makeEmployee(),
    payrollRun: { runType: 'MONTHLY', referenceMonth: new Date('2025-01-01') },
    ...overrides,
  };
}

function makeIncomeStatement(overrides: Partial<any> = {}): any {
  return {
    id: 'stmt-001',
    organizationId: ORG_ID,
    employeeId: EMP_ID,
    yearBase: YEAR_BASE,
    totalTaxable: { toString: () => '36000.00' },
    totalInss: { toString: () => '3240.00' },
    totalIrrf: { toString: () => '1800.00' },
    totalExempt: { toString: () => '0.00' },
    dependentDeduction: { toString: () => '0.00' },
    pdfKey: null,
    sentAt: null,
    sentTo: null,
    createdBy: USER_ID,
    createdAt: new Date(),
    employee: makeEmployee(),
    ...overrides,
  };
}

// ─── generateStatements ────────────────────────────────────────────────────────

describe('IncomeStatementsService.generateStatements', () => {
  it('creates an IncomeStatement per employee aggregating 12 months of PayrollRunItems', async () => {
    const service = new IncomeStatementsService();

    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

    const runs = months.map((m) => makePayrollRun(`2025-${m}`));
    mockTx.payrollRun.findMany.mockResolvedValue(runs);

    // 12 items one per month, grossSalary=3000, inss=270, irrf=150
    const items = months.map((m) =>
      makePayrollRunItem({
        payrollRunId: `run-2025-${m}`,
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        fgtsAmount: { toNumber: () => 240 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
    );
    mockTx.payrollRunItem.findMany.mockResolvedValue(items);

    const expectedStatement = makeIncomeStatement();
    mockTx.incomeStatement.upsert.mockResolvedValue(expectedStatement);

    const result = await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    expect(mockTx.payrollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          status: 'COMPLETED',
        }),
      }),
    );
    expect(mockTx.incomeStatement.upsert).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('totalTaxable equals sum of grossSalary across all COMPLETED runs', async () => {
    const service = new IncomeStatementsService();

    mockTx.payrollRun.findMany.mockResolvedValue([makePayrollRun('2025-01')]);

    const items = [
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
      makePayrollRunItem({
        id: 'item-002',
        employeeId: 'emp-002',
        grossSalary: { toNumber: () => 2000 },
        inssAmount: { toNumber: () => 180 },
        irrfAmount: { toNumber: () => 0 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
        employee: makeEmployee({ id: 'emp-002', name: 'Maria', cpf: '98765432100', email: null }),
      }),
    ];
    mockTx.payrollRunItem.findMany.mockResolvedValue(items);
    mockTx.incomeStatement.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({
        ...makeIncomeStatement(),
        ...create,
        totalTaxable: { toString: () => create.totalTaxable },
      }),
    );

    const _result = await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    // emp-001: totalTaxable=3000, emp-002: totalTaxable=2000
    expect(mockTx.incomeStatement.upsert).toHaveBeenCalledTimes(2);
    const emp1Call = mockTx.incomeStatement.upsert.mock.calls.find(
      (c: any[]) => c[0].create?.employeeId === EMP_ID,
    );
    expect(emp1Call).toBeTruthy();
    expect(Number(emp1Call[0].create.totalTaxable)).toBe(3000);
  });

  it('totalInss equals sum of inssAmount for employee in the year', async () => {
    const service = new IncomeStatementsService();

    mockTx.payrollRun.findMany.mockResolvedValue([
      makePayrollRun('2025-01'),
      makePayrollRun('2025-02'),
    ]);
    mockTx.payrollRunItem.findMany.mockResolvedValue([
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
      makePayrollRunItem({
        id: 'item-m2',
        payrollRunId: 'run-2025-02',
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
    ]);
    mockTx.incomeStatement.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({
        ...makeIncomeStatement(),
        totalInss: { toString: () => String(create.totalInss) },
      }),
    );

    await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    const call = mockTx.incomeStatement.upsert.mock.calls[0];
    expect(Number(call[0].create.totalInss)).toBe(540); // 270+270
  });

  it('totalIrrf equals sum of irrfAmount for employee in the year', async () => {
    const service = new IncomeStatementsService();

    mockTx.payrollRun.findMany.mockResolvedValue([makePayrollRun('2025-03')]);
    mockTx.payrollRunItem.findMany.mockResolvedValue([
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
    ]);
    mockTx.incomeStatement.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({
        ...makeIncomeStatement(),
        totalIrrf: { toString: () => String(create.totalIrrf) },
      }),
    );

    await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    const call = mockTx.incomeStatement.upsert.mock.calls[0];
    expect(Number(call[0].create.totalIrrf)).toBe(150);
  });

  it('totalExempt includes salaryFamily (non-taxable benefit)', async () => {
    const service = new IncomeStatementsService();

    mockTx.payrollRun.findMany.mockResolvedValue([makePayrollRun('2025-01')]);
    mockTx.payrollRunItem.findMany.mockResolvedValue([
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 58.06 },
        lineItemsJson: null,
      }),
    ]);
    mockTx.incomeStatement.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({
        ...makeIncomeStatement(),
        totalExempt: { toString: () => String(create.totalExempt) },
      }),
    );

    await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    const call = mockTx.incomeStatement.upsert.mock.calls[0];
    expect(Number(call[0].create.totalExempt)).toBeGreaterThanOrEqual(58.06);
  });

  it('dependentDeduction = dependent count * annual deduction (2275.08 per dependent)', async () => {
    const service = new IncomeStatementsService();

    mockTx.payrollRun.findMany.mockResolvedValue([makePayrollRun('2025-01')]);
    const empWith2Dependents = makeEmployee({
      dependents: [{ id: 'd1' }, { id: 'd2' }],
    });
    mockTx.payrollRunItem.findMany.mockResolvedValue([
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
        employee: empWith2Dependents,
      }),
    ]);
    mockTx.incomeStatement.upsert.mockImplementation(({ create }: any) =>
      Promise.resolve({
        ...makeIncomeStatement(),
        dependentDeduction: { toString: () => String(create.dependentDeduction) },
      }),
    );

    await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    const call = mockTx.incomeStatement.upsert.mock.calls[0];
    expect(Number(call[0].create.dependentDeduction)).toBeCloseTo(4550.16, 1); // 2 * 2275.08
  });

  it('upserts via unique constraint — duplicate generation updates existing record', async () => {
    const service = new IncomeStatementsService();

    mockTx.payrollRun.findMany.mockResolvedValue([makePayrollRun('2025-01')]);
    mockTx.payrollRunItem.findMany.mockResolvedValue([
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
    ]);
    mockTx.incomeStatement.upsert.mockResolvedValue(makeIncomeStatement());

    // Call twice
    await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);
    mockTx.payrollRun.findMany.mockResolvedValue([makePayrollRun('2025-01')]);
    mockTx.payrollRunItem.findMany.mockResolvedValue([
      makePayrollRunItem({
        grossSalary: { toNumber: () => 3000 },
        inssAmount: { toNumber: () => 270 },
        irrfAmount: { toNumber: () => 150 },
        salaryFamily: { toNumber: () => 0 },
        lineItemsJson: null,
      }),
    ]);
    await service.generateStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    // upsert called twice (once per generate call per employee)
    expect(mockTx.incomeStatement.upsert).toHaveBeenCalledTimes(2);
    // Both use the same where clause key
    const call1 = mockTx.incomeStatement.upsert.mock.calls[0][0].where;
    const call2 = mockTx.incomeStatement.upsert.mock.calls[1][0].where;
    expect(call1).toEqual(call2);
  });
});

// ─── downloadStatement ────────────────────────────────────────────────────────

describe('IncomeStatementsService.downloadStatement', () => {
  it('returns PDF buffer with filename containing employee name and yearBase', async () => {
    const service = new IncomeStatementsService();

    const stmt = makeIncomeStatement({ pdfKey: null });
    mockTx.incomeStatement.findFirst.mockResolvedValue(stmt);

    const { buffer, filename } = await service.downloadStatement(ORG_ID, 'stmt-001');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(filename).toContain(String(YEAR_BASE));
    expect(filename).toMatch(/\.pdf$/);
  });
});

// ─── sendStatements ────────────────────────────────────────────────────────────

describe('IncomeStatementsService.sendStatements', () => {
  it('sends email to employees with email addresses', async () => {
    const service = new IncomeStatementsService();

    const stmt = makeIncomeStatement({ employee: makeEmployee({ email: 'joao@fazenda.com' }) });
    mockTx.incomeStatement.findMany.mockResolvedValue([stmt]);
    mockTx.incomeStatement.findFirst.mockResolvedValue(stmt);
    mockTx.incomeStatement.upsert.mockResolvedValue(stmt);
    sendMail.mockResolvedValue(undefined);

    const result = await service.sendStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'joao@fazenda.com',
        attachments: expect.arrayContaining([
          expect.objectContaining({ contentType: 'application/pdf' }),
        ]),
      }),
    );
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips employees without email address', async () => {
    const service = new IncomeStatementsService();

    const stmt = makeIncomeStatement({ employee: makeEmployee({ email: null }) });
    mockTx.incomeStatement.findMany.mockResolvedValue([stmt]);

    const result = await service.sendStatements(ORG_ID, { yearBase: YEAR_BASE }, USER_ID);

    expect(sendMail).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ─── getRaisConsistency ────────────────────────────────────────────────────────

describe('IncomeStatementsService.getRaisConsistency', () => {
  it('returns isConsistent=true when all employees have S-2200 and S-1200 events', async () => {
    const service = new IncomeStatementsService();

    const emp = makeEmployee();
    mockTx.employee.findMany.mockResolvedValue([emp]);
    mockTx.esocialEvent.findMany.mockImplementation(({ where }: any) => {
      if (where.eventType === 'S-2200') return Promise.resolve([{ sourceId: EMP_ID }]);
      if (where.eventType === 'S-1200') return Promise.resolve([{ sourceId: EMP_ID }]);
      if (where.eventType === 'S-2299') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    const result = await service.getRaisConsistency(ORG_ID, YEAR_BASE);

    expect(result.isConsistent).toBe(true);
    expect(result.missingAdmissionEvents).toHaveLength(0);
    expect(result.missingRemunerationEvents).toHaveLength(0);
    expect(result.totalEmployees).toBe(1);
  });

  it('returns isConsistent=false listing employees missing eSocial events', async () => {
    const service = new IncomeStatementsService();

    const emp1 = makeEmployee({ id: EMP_ID, name: EMP_NAME });
    const emp2 = makeEmployee({ id: 'emp-002', name: 'Maria' });
    mockTx.employee.findMany.mockResolvedValue([emp1, emp2]);

    mockTx.esocialEvent.findMany.mockImplementation(({ where }: any) => {
      if (where.eventType === 'S-2200') {
        // emp1 has admission, emp2 does not
        return Promise.resolve([{ sourceId: EMP_ID }]);
      }
      if (where.eventType === 'S-1200') {
        return Promise.resolve([{ sourceId: EMP_ID }, { sourceId: 'emp-002' }]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getRaisConsistency(ORG_ID, YEAR_BASE);

    expect(result.isConsistent).toBe(false);
    expect(result.missingAdmissionEvents).toContain('Maria');
    expect(result.missingAdmissionEvents).not.toContain(EMP_NAME);
    expect(result.totalEmployees).toBe(2);
  });
});
