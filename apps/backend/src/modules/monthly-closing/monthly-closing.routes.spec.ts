// ─── Monthly Closing Routes Tests ────────────────────────────────────────────
// Integration tests for /org/:orgId/monthly-closing endpoints.
// Tests: start, validate-step (all 6), complete, reopen, get.

jest.mock('../../database/prisma', () => ({
  prisma: {
    monthlyClosing: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
    },
    timesheet: {
      count: jest.fn(),
    },
    payrollRun: {
      findMany: jest.fn(),
    },
    depreciationRun: {
      findFirst: jest.fn(),
    },
    bankStatementLine: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../auto-posting/auto-posting.service', () => ({
  getPendingCounts: jest.fn(),
}));

jest.mock('../ledger/ledger.service', () => ({
  getTrialBalance: jest.fn(),
}));

jest.mock('../fiscal-periods/fiscal-periods.service', () => ({
  closePeriod: jest.fn(),
  reopenPeriod: jest.fn(),
}));

import request from 'supertest';
import express from 'express';
import { monthlyClosingRouter } from './monthly-closing.routes';
import { prisma } from '../../database/prisma';
import { getPendingCounts } from '../auto-posting/auto-posting.service';
import { getTrialBalance } from '../ledger/ledger.service';
import { closePeriod, reopenPeriod } from '../fiscal-periods/fiscal-periods.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockPrisma = prisma as any;
const mockGetPendingCounts = getPendingCounts as jest.Mock;
const mockGetTrialBalance = getTrialBalance as jest.Mock;
const mockClosePeriod = closePeriod as jest.Mock;
const mockReopenPeriod = reopenPeriod as jest.Mock;

// ─── Test app setup ───────────────────────────────────────────────────

function makeApp(userRole: string = 'FINANCIAL') {
  const app = express();
  app.use(express.json());
  // Mock authentication
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', role: userRole };
    next();
  });
  app.use('/api', monthlyClosingRouter);
  return app;
}

// ─── Test data helpers ────────────────────────────────────────────────

function makePeriod(overrides: Partial<any> = {}) {
  return {
    id: 'period-1',
    organizationId: 'org-1',
    fiscalYearId: 'year-1',
    month: 3,
    year: 2026,
    status: 'OPEN',
    ...overrides,
  };
}

function makeClosing(overrides: Partial<any> = {}) {
  return {
    id: 'closing-1',
    organizationId: 'org-1',
    periodId: 'period-1',
    status: 'IN_PROGRESS',
    stepResults: {},
    completedAt: null,
    completedBy: null,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
    createdAt: new Date('2026-03-28T10:00:00.000Z'),
    updatedAt: new Date('2026-03-28T10:00:00.000Z'),
    period: makePeriod(),
    ...overrides,
  };
}

// ─── POST /start ──────────────────────────────────────────────────────

describe('POST /org/:orgId/monthly-closing/start', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates MonthlyClosing IN_PROGRESS for OPEN period, returns 201', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValueOnce(null); // no existing
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(makePeriod());
    mockPrisma.monthlyClosing.create.mockResolvedValue(makeClosing());

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/start')
      .send({ periodId: 'period-1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'IN_PROGRESS', periodId: 'period-1' });
  });

  it('returns existing IN_PROGRESS closing if already started (D-04)', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValueOnce(makeClosing());

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/start')
      .send({ periodId: 'period-1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'IN_PROGRESS', id: 'closing-1' });
    expect(mockPrisma.monthlyClosing.create).not.toHaveBeenCalled();
  });

  it('returns 422 if period is not OPEN', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValueOnce(null);
    mockPrisma.accountingPeriod.findFirst.mockResolvedValue(makePeriod({ status: 'CLOSED' }));

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/start')
      .send({ periodId: 'period-1' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PERIOD_NOT_OPEN');
  });
});

// ─── POST /:closingId/validate-step/:stepNumber ───────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/1', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when all timesheets are APPROVED/LOCKED', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: {} }));
    mockPrisma.timesheet.count.mockResolvedValue(0); // 0 pending
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { step1: { status: 'OK', summary: 'Pontos aprovados', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('returns FAILED when pending timesheets exist', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: {} }));
    mockPrisma.timesheet.count.mockResolvedValue(3); // 3 pending
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { step1: { status: 'FAILED', summary: '3 pontos pendentes', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FAILED');
  });
});

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when payroll run COMPLETED exists', async () => {
    const step1OK = { step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() } };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: step1OK }));
    mockPrisma.payrollRun.findMany.mockResolvedValue([{ status: 'COMPLETED' }]);
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { ...step1OK, step2: { status: 'OK', summary: '1 folha(s) fechada(s)', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/2');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/3', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when depreciation run COMPLETED exists', async () => {
    const prevSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step2: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: prevSteps }));
    mockPrisma.depreciationRun.findFirst.mockResolvedValue({ id: 'dep-1', totalAssets: 5, status: 'COMPLETED' });
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { ...prevSteps, step3: { status: 'OK', summary: 'Depreciacao processada — 5 ativos', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/3');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('returns 422 when step 2 not yet validated (D-03)', async () => {
    const prevSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      // step2 missing
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: prevSteps }));

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/3');

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('STEP_DEPENDENCY');
  });
});

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/4', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when pending+error counts are 0', async () => {
    const prevSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step2: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step3: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: prevSteps }));
    mockGetPendingCounts.mockResolvedValue({ pending: 0, error: 0, processed: 10, total: 10 });
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { ...prevSteps, step4: { status: 'OK', summary: '10 lancamento(s) processado(s), 0 pendente(s)', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/4');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/5', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when no PENDING bank statement lines', async () => {
    const prevSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step2: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step3: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step4: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: prevSteps }));
    // First call: total lines count, second: pending count
    mockPrisma.bankStatementLine.count
      .mockResolvedValueOnce(5)  // total
      .mockResolvedValueOnce(0); // pending
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { ...prevSteps, step5: { status: 'OK', summary: '5 linhas conciliadas', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/5');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('returns OK with N/A summary when no bank imports exist', async () => {
    const prevSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step2: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step3: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step4: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: prevSteps }));
    mockPrisma.bankStatementLine.count
      .mockResolvedValueOnce(0)  // total = 0
      .mockResolvedValueOnce(0); // pending = 0
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { ...prevSteps, step5: { status: 'OK', summary: 'Nenhum extrato importado — etapa nao aplicavel', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/5');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.summary).toMatch(/nao aplicavel/i);
  });
});

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/6', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when trial balance isBalanced=true', async () => {
    const prevSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step2: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step3: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step4: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step5: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: prevSteps }));
    mockGetTrialBalance.mockResolvedValue({ isBalanced: true, rows: [] });
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ stepResults: { ...prevSteps, step6: { status: 'OK', summary: 'Balancete equilibrado', validatedAt: new Date().toISOString() } } }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/validate-step/6');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ─── POST /:closingId/complete ────────────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/complete', () => {
  beforeEach(() => jest.clearAllMocks());

  const allStepsOK = {
    step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    step2: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    step3: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    step4: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    step5: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
    step6: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
  };

  it('returns 200 and closes period when all 6 steps OK', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: allStepsOK }));
    mockClosePeriod.mockResolvedValue({ id: 'period-1', status: 'CLOSED' });
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ status: 'COMPLETED', stepResults: allStepsOK, completedAt: new Date(), completedBy: 'user-1' }),
    );

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/complete');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(mockClosePeriod).toHaveBeenCalled();
  });

  it('returns 422 when not all steps are OK', async () => {
    const incompleteSteps = {
      step1: { status: 'OK', summary: 'ok', validatedAt: new Date().toISOString() },
      step2: { status: 'FAILED', summary: 'failed', validatedAt: new Date().toISOString() },
      // steps 3-6 missing
    };
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ stepResults: incompleteSteps }));

    const res = await request(makeApp())
      .post('/api/org/org-1/monthly-closing/closing-1/complete');

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INCOMPLETE_STEPS');
  });
});

// ─── POST /:closingId/reopen ──────────────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/reopen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires ADMIN role, returns 403 for non-admin (FINANCIAL role)', async () => {
    const res = await request(makeApp('FINANCIAL'))
      .post('/api/org/org-1/monthly-closing/closing-1/reopen')
      .send({ reason: 'Correction needed' });

    expect(res.status).toBe(403);
  });

  it('with ADMIN marks status REOPENED, saves reason + reopenedBy', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing({ status: 'COMPLETED' }));
    mockReopenPeriod.mockResolvedValue({ id: 'period-1', status: 'OPEN' });
    mockPrisma.monthlyClosing.update.mockResolvedValue(
      makeClosing({ status: 'REOPENED', reopenedBy: 'user-1', reopenReason: 'Correction needed', reopenedAt: new Date() }),
    );

    const res = await request(makeApp('ADMIN'))
      .post('/api/org/org-1/monthly-closing/closing-1/reopen')
      .send({ reason: 'Correction needed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REOPENED');
    expect(mockReopenPeriod).toHaveBeenCalled();
  });
});

// ─── GET / ────────────────────────────────────────────────────────────

describe('GET /org/:orgId/monthly-closing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns MonthlyClosing for the period', async () => {
    mockPrisma.monthlyClosing.findFirst.mockResolvedValue(makeClosing());

    const res = await request(makeApp())
      .get('/api/org/org-1/monthly-closing?periodId=period-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'closing-1', status: 'IN_PROGRESS' });
  });
});
