// ─── Financial Statements Routes Tests ───────────────────────────────────────
// Integration tests for DRE, Balance Sheet, and cross-validation endpoints.
// Pattern: mock service + auth, use supertest against Express app.

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

jest.mock('./financial-statements.service', () => ({
  getDre: jest.fn(),
  getBalanceSheet: jest.fn(),
  getCrossValidation: jest.fn(),
  getDfc: jest.fn(),
}));

import request from 'supertest';
import { app } from '../../app';
import * as service from './financial-statements.service';
import * as authService from '../auth/auth.service';
import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockedService = jest.mocked(service);
const mockedAuth = jest.mocked(authService);
const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const ORG_ID = 'org-1';
const BASE = `/api/org/${ORG_ID}/financial-statements`;

// ─── Mock data helpers ────────────────────────────────────────────────────────

function makeSection(id: string) {
  return {
    id,
    label: id,
    rows: [],
    total: {
      accountId: null,
      code: id,
      name: id,
      currentMonth: '0.00',
      ytd: '0.00',
      priorYear: '0.00',
      avPercent: null,
      ahPercent: null,
      isSubtotal: true,
      isCpc29: false,
      level: 0,
    },
  };
}

function makeDreOutput() {
  return {
    sections: [
      makeSection('receita-bruta-agricola'),
      makeSection('receita-bruta-pecuaria'),
      makeSection('lucro-bruto'),
    ],
    resultadoLiquido: {
      accountId: null,
      code: 'resultado-liquido',
      name: 'Resultado Liquido',
      currentMonth: '10000.00',
      ytd: '10000.00',
      priorYear: '8000.00',
      avPercent: '100.00',
      ahPercent: '25.00',
      isSubtotal: true,
      isCpc29: false,
      level: 0,
    },
    marginRanking: [],
  };
}

function makeBpGroup(id: string) {
  return {
    id,
    label: id,
    rows: [],
    total: {
      accountId: null,
      code: id,
      name: id,
      currentBalance: '100000.00',
      priorBalance: '90000.00',
      isSubtotal: true,
      level: 0,
    },
  };
}

function makeBpOutput() {
  return {
    ativo: [makeBpGroup('ac'), makeBpGroup('anc')],
    passivo: [makeBpGroup('pc'), makeBpGroup('pnc'), makeBpGroup('pl')],
    totalAtivo: {
      accountId: null,
      code: 'total-ativo',
      name: 'Total Ativo',
      currentBalance: '200000.00',
      priorBalance: '180000.00',
      isSubtotal: true,
      level: 0,
    },
    totalPassivo: {
      accountId: null,
      code: 'total-passivo',
      name: 'Total Passivo + PL',
      currentBalance: '200000.00',
      priorBalance: '180000.00',
      isSubtotal: true,
      level: 0,
    },
    indicators: {
      liquidezCorrente: '2.50',
      liquidezSeca: '2.00',
      endividamentoGeral: '0.30',
      composicaoEndividamento: '0.40',
      roe: '0.15',
      plPorHectare: '1000.00',
      sparklines: {},
    },
  };
}

function makeCrossValidationOutput() {
  return {
    invariants: [
      {
        id: 'dre-lucros-acumulados',
        title: 'Resultado Liquido DRE = Variacao Lucros Acumulados BP',
        status: 'PASSED',
        expected: '10000.00',
        found: '10000.00',
        difference: '0.00',
        investigateUrl: null,
      },
      {
        id: 'dfc-caixa-bp',
        title: 'Variacao Caixa DFC = Variacao Caixa/Bancos BP',
        status: 'PENDING',
        expected: null,
        found: null,
        difference: null,
        investigateUrl: null,
      },
      {
        id: 'ativo-passivo-pl',
        title: 'Ativo Total = Passivo Total + Patrimonio Liquido',
        status: 'PASSED',
        expected: '200000.00',
        found: '200000.00',
        difference: '0.00',
        investigateUrl: null,
      },
      {
        id: 'debitos-creditos',
        title: 'Total Debitos = Total Creditos (Balancete)',
        status: 'PASSED',
        expected: '500000.00',
        found: '500000.00',
        difference: '0.00',
        investigateUrl: null,
      },
    ],
    allPassed: true,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Financial Statements Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── GET /dre ─────────────────────────────────────────────────────────────

  it('GET /dre returns 200 with DreOutput shape', async () => {
    const dreOutput = makeDreOutput();
    (mockedService.getDre as jest.Mock).mockResolvedValue(dreOutput);

    const res = await request(app)
      .get(`${BASE}/dre`)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sections');
    expect(res.body).toHaveProperty('resultadoLiquido');
    expect(res.body.resultadoLiquido.currentMonth).toBe('10000.00');
    expect(mockedService.getDre).toHaveBeenCalledWith('org-1', {
      fiscalYearId: 'fy-1',
      month: 3,
      costCenterId: undefined,
    });
  });

  it('GET /dre with costCenterId passes filter to service', async () => {
    const dreOutput = makeDreOutput();
    (mockedService.getDre as jest.Mock).mockResolvedValue(dreOutput);

    const res = await request(app)
      .get(`${BASE}/dre`)
      .query({ fiscalYearId: 'fy-1', month: '3', costCenterId: 'cc-1' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.getDre).toHaveBeenCalledWith('org-1', {
      fiscalYearId: 'fy-1',
      month: 3,
      costCenterId: 'cc-1',
    });
  });

  it('GET /dre returns 400 without fiscalYearId', async () => {
    const res = await request(app)
      .get(`${BASE}/dre`)
      .query({ month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
  });

  it('GET /dre returns 400 without month', async () => {
    const res = await request(app)
      .get(`${BASE}/dre`)
      .query({ fiscalYearId: 'fy-1' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_MONTH');
  });

  it('GET /dre returns 401 without auth', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app).get(`${BASE}/dre`).query({ fiscalYearId: 'fy-1', month: '3' });

    expect(res.status).toBe(401);
  });

  // ─── GET /balance-sheet ──────────────────────────────────────────────────

  it('GET /balance-sheet returns 200 with BpOutput shape', async () => {
    const bpOutput = makeBpOutput();
    (mockedService.getBalanceSheet as jest.Mock).mockResolvedValue(bpOutput);

    const res = await request(app)
      .get(`${BASE}/balance-sheet`)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ativo');
    expect(res.body).toHaveProperty('passivo');
    expect(res.body).toHaveProperty('totalAtivo');
    expect(res.body).toHaveProperty('indicators');
    expect(res.body.indicators.liquidezCorrente).toBe('2.50');
    expect(res.body.ativo).toHaveLength(2); // AC and ANC
    expect(res.body.passivo).toHaveLength(3); // PC, PNC, PL
  });

  it('GET /balance-sheet returns 400 without fiscalYearId', async () => {
    const res = await request(app)
      .get(`${BASE}/balance-sheet`)
      .query({ month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
  });

  // ─── GET /cross-validation ───────────────────────────────────────────────

  it('GET /cross-validation returns 200 with 4 invariants', async () => {
    const cvOutput = makeCrossValidationOutput();
    (mockedService.getCrossValidation as jest.Mock).mockResolvedValue(cvOutput);

    const res = await request(app)
      .get(`${BASE}/cross-validation`)
      .query({ fiscalYearId: 'fy-1', month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('invariants');
    expect(res.body.invariants).toHaveLength(4);
    expect(res.body.allPassed).toBe(true);

    // DFC invariant should be PENDING
    const dfcInvariant = res.body.invariants.find((i: { id: string }) => i.id === 'dfc-caixa-bp');
    expect(dfcInvariant).toBeDefined();
    expect(dfcInvariant.status).toBe('PENDING');
  });

  it('GET /cross-validation returns 400 without fiscalYearId', async () => {
    const res = await request(app)
      .get(`${BASE}/cross-validation`)
      .query({ month: '3' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FISCAL_YEAR_ID');
  });

  it('GET /cross-validation returns 400 without month', async () => {
    const res = await request(app)
      .get(`${BASE}/cross-validation`)
      .query({ fiscalYearId: 'fy-1' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_MONTH');
  });
});
