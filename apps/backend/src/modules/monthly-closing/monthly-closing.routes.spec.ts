// ─── Monthly Closing Routes Tests ────────────────────────────────────────────
// Integration tests for /org/:orgId/monthly-closing endpoints.
// Tests: start, validate-step (all 6), complete, reopen, get.

// ─── Setup mocks before imports ──────────────────────────────────────────────

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('./monthly-closing.service', () => ({
  startClosing: jest.fn(),
  getClosing: jest.fn(),
  validateStep: jest.fn(),
  completeClosing: jest.fn(),
  reopenClosing: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './monthly-closing.service';
import * as authService from '../auth/auth.service';
import { getUserPermissions } from '../../shared/rbac/rbac.service';

const mockedService = jest.mocked(service);
const mockedAuth = jest.mocked(authService);
const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

// ─── Auth helpers ──────────────────────────────────────────────────────

const FINANCIAL_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'FINANCIAL' as const,
  organizationId: 'org-1',
};

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue([
    'financial:read',
    'financial:manage',
  ] as any);
}

// ─── Test data helpers ────────────────────────────────────────────────

function makeClosingOutput(overrides: Partial<any> = {}) {
  return {
    id: 'closing-1',
    organizationId: 'org-1',
    periodId: 'period-1',
    status: 'IN_PROGRESS',
    stepResults: {},
    periodMonth: 3,
    periodYear: 2026,
    completedAt: null,
    completedBy: null,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
    createdAt: '2026-03-28T10:00:00.000Z',
    ...overrides,
  };
}

const ORG = 'org-1';
const TOKEN = 'Bearer valid-token';

// ─── POST /start ──────────────────────────────────────────────────────

describe('POST /org/:orgId/monthly-closing/start', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates MonthlyClosing IN_PROGRESS for OPEN period, returns 201', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.startClosing.mockResolvedValue({
      closing: makeClosingOutput({ status: 'IN_PROGRESS' }),
      created: true,
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/start`)
      .set('Authorization', TOKEN)
      .send({ periodId: 'period-1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'IN_PROGRESS', periodId: 'period-1' });
  });

  it('returns existing IN_PROGRESS closing if already started (D-04)', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.startClosing.mockResolvedValue({
      closing: makeClosingOutput({ status: 'IN_PROGRESS' }),
      created: false,
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/start`)
      .set('Authorization', TOKEN)
      .send({ periodId: 'period-1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'IN_PROGRESS', id: 'closing-1' });
  });

  it('returns 422 if period is not OPEN', async () => {
    authAs(FINANCIAL_PAYLOAD);
    const { MonthlyClosingError } = jest.requireActual('./monthly-closing.types') as any;
    mockedService.startClosing.mockRejectedValue(
      new MonthlyClosingError('Periodo nao esta aberto', 'PERIOD_NOT_OPEN', 422),
    );

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/start`)
      .set('Authorization', TOKEN)
      .send({ periodId: 'period-1' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PERIOD_NOT_OPEN');
  });
});

// ─── POST /:closingId/validate-step/1 ────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/1', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when all timesheets are APPROVED/LOCKED', async () => {
    authAs(FINANCIAL_PAYLOAD);
    const stepResult = {
      status: 'OK',
      summary: 'Pontos aprovados',
      validatedAt: new Date().toISOString(),
    };
    mockedService.validateStep.mockResolvedValue(stepResult as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/1`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('returns FAILED when pending timesheets exist', async () => {
    authAs(FINANCIAL_PAYLOAD);
    const stepResult = {
      status: 'FAILED',
      summary: '3 ponto(s) pendente(s) de aprovacao',
      validatedAt: new Date().toISOString(),
    };
    mockedService.validateStep.mockResolvedValue(stepResult as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/1`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FAILED');
  });
});

// ─── POST /:closingId/validate-step/2 ────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/2', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when payroll run COMPLETED exists', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.validateStep.mockResolvedValue({
      status: 'OK',
      summary: '1 folha(s) fechada(s)',
      validatedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/2`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ─── POST /:closingId/validate-step/3 ────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/3', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when depreciation run COMPLETED exists', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.validateStep.mockResolvedValue({
      status: 'OK',
      summary: 'Depreciacao processada — 5 ativo(s)',
      validatedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/3`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('returns 422 when step 2 not yet validated (D-03)', async () => {
    authAs(FINANCIAL_PAYLOAD);
    const { MonthlyClosingError } = jest.requireActual('./monthly-closing.types') as any;
    mockedService.validateStep.mockRejectedValue(
      new MonthlyClosingError('Etapa 2 deve ser OK antes de validar etapa 3', 'STEP_DEPENDENCY', 422),
    );

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/3`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('STEP_DEPENDENCY');
  });
});

// ─── POST /:closingId/validate-step/4 ────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/4', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when pending+error counts are 0', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.validateStep.mockResolvedValue({
      status: 'OK',
      summary: 'Lancamentos processados, 0 pendente(s)',
      validatedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/4`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ─── POST /:closingId/validate-step/5 ────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/5', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when no PENDING bank statement lines', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.validateStep.mockResolvedValue({
      status: 'OK',
      summary: '5 linha(s) conciliada(s)',
      validatedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/5`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('returns OK with N/A summary when no bank imports exist', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.validateStep.mockResolvedValue({
      status: 'OK',
      summary: 'Nenhum extrato importado — etapa nao aplicavel',
      validatedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/5`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.summary).toMatch(/nao aplicavel/i);
  });
});

// ─── POST /:closingId/validate-step/6 ────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/validate-step/6', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns OK when trial balance isBalanced=true', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.validateStep.mockResolvedValue({
      status: 'OK',
      summary: 'Balancete equilibrado',
      validatedAt: new Date().toISOString(),
    } as any);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/validate-step/6`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

// ─── POST /:closingId/complete ────────────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/complete', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 and closes period when all 6 steps OK', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.completeClosing.mockResolvedValue(
      makeClosingOutput({ status: 'COMPLETED', completedAt: '2026-03-28T12:00:00.000Z', completedBy: 'user-1' }) as any,
    );

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/complete`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('returns 422 when not all steps are OK', async () => {
    authAs(FINANCIAL_PAYLOAD);
    const { MonthlyClosingError } = jest.requireActual('./monthly-closing.types') as any;
    mockedService.completeClosing.mockRejectedValue(
      new MonthlyClosingError('Etapa 2 esta FAILED', 'INCOMPLETE_STEPS', 422),
    );

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/complete`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INCOMPLETE_STEPS');
  });
});

// ─── POST /:closingId/reopen ──────────────────────────────────────────

describe('POST /org/:orgId/monthly-closing/:closingId/reopen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires ADMIN role, returns 403 for non-admin (MANAGER role)', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/reopen`)
      .set('Authorization', TOKEN)
      .send({ reason: 'Correction needed' });

    expect(res.status).toBe(403);
  });

  it('with ADMIN marks status REOPENED, saves reason + reopenedBy', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.reopenClosing.mockResolvedValue(
      makeClosingOutput({
        status: 'REOPENED',
        reopenedBy: 'admin-1',
        reopenReason: 'Correction needed',
        reopenedAt: '2026-03-28T14:00:00.000Z',
      }) as any,
    );

    const res = await request(app)
      .post(`/api/org/${ORG}/monthly-closing/closing-1/reopen`)
      .set('Authorization', TOKEN)
      .send({ reason: 'Correction needed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REOPENED');
    expect(mockedService.reopenClosing).toHaveBeenCalledWith(
      ORG,
      'closing-1',
      'admin-1',
      'Correction needed',
    );
  });
});

// ─── GET / ────────────────────────────────────────────────────────────

describe('GET /org/:orgId/monthly-closing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns MonthlyClosing for the period', async () => {
    authAs(FINANCIAL_PAYLOAD);
    mockedService.getClosing.mockResolvedValue(makeClosingOutput() as any);

    const res = await request(app)
      .get(`/api/org/${ORG}/monthly-closing?periodId=period-1`)
      .set('Authorization', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'closing-1', status: 'IN_PROGRESS' });
  });
});
