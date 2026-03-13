import request from 'supertest';
import { app } from '../../app';
import * as prescriptionService from './pesticide-prescriptions.service';
import { PrescriptionError } from './pesticide-prescriptions.types';
import * as authService from '../auth/auth.service';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./pesticide-prescriptions.service', () => {
  const actual = jest.requireActual('./pesticide-prescriptions.service');
  return {
    ...actual,
    createPrescription: jest.fn(),
    listPrescriptions: jest.fn(),
    getPrescription: jest.fn(),
    updatePrescription: jest.fn(),
    cancelPrescription: jest.fn(),
    generatePrescriptionPdf: jest.fn(),
    prescriptionsToCsv: jest.fn(),
  };
});

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(prescriptionService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const VIEWER_PAYLOAD = {
  userId: 'viewer-1',
  email: 'viewer@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

// ─── Fixtures ───────────────────────────────────────────────────────

const PRODUCT_ITEM = {
  id: 'pp-1',
  productId: 'prod-1',
  productName: 'Roundup Original',
  activeIngredient: 'Glifosato',
  dose: 3.0,
  doseUnit: 'L_HA',
  withdrawalPeriodDays: 30,
  safetyIntervalDays: 1,
  toxicityClass: 'IV',
  mapaRegistration: '1234',
  environmentalClass: 'III',
};

const PRESCRIPTION_RESPONSE = {
  id: 'presc-1',
  organizationId: 'org-1',
  farmId: 'farm-1',
  fieldPlotId: 'plot-1',
  sequentialNumber: 1,
  issuedAt: '2026-03-12T00:00:00.000Z',
  farmName: 'Fazenda São José',
  fieldPlotName: 'Talhão A1',
  cultureName: 'Soja',
  areaHa: 45.5,
  targetPest: 'Buva',
  targetType: 'PLANTA_DANINHA',
  sprayVolume: 200,
  numberOfApplications: 2,
  applicationInterval: 15,
  agronomistName: 'Dr. João Silva',
  agronomistCrea: 'SP-12345/D',
  agronomistSignatureUrl: null,
  pesticideApplicationId: null,
  stockOutputId: null,
  technicalJustification: 'Infestação de buva resistente',
  notes: null,
  status: 'ACTIVE',
  createdBy: 'admin-1',
  creatorName: 'Admin User',
  products: [PRODUCT_ITEM],
  createdAt: '2026-03-12T00:00:00.000Z',
  updatedAt: '2026-03-12T00:00:00.000Z',
};

const VALID_CREATE_INPUT = {
  fieldPlotId: 'plot-1',
  cultureName: 'Soja',
  targetPest: 'Buva',
  targetType: 'PLANTA_DANINHA',
  sprayVolume: 200,
  numberOfApplications: 2,
  applicationInterval: 15,
  agronomistName: 'Dr. João Silva',
  agronomistCrea: 'SP-12345/D',
  technicalJustification: 'Infestação de buva resistente',
  products: [
    {
      productName: 'Roundup Original',
      activeIngredient: 'Glifosato',
      dose: 3.0,
      doseUnit: 'L_HA',
      withdrawalPeriodDays: 30,
      safetyIntervalDays: 1,
      toxicityClass: 'IV',
      mapaRegistration: '1234',
      environmentalClass: 'III',
    },
  ],
};

const BASE_URL = '/api/org/farms/farm-1/pesticide-prescriptions';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── CA1+CA2+CA3+CA4+CA5+CA7+CA8: POST (criar receituário) ─────────

describe('POST /org/farms/:farmId/pesticide-prescriptions', () => {
  it('should create a prescription (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockResolvedValue(PRESCRIPTION_RESPONSE);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('presc-1');
    expect(res.body.sequentialNumber).toBe(1);
    expect(res.body.farmName).toBe('Fazenda São José');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].productName).toBe('Roundup Original');
    expect(mockedService.createPrescription).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'farm-1',
      expect.objectContaining({ cultureName: 'Soja' }),
      'admin-1',
    );
  });

  it('should return 400 on validation error', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockRejectedValue(
      new PrescriptionError('Ao menos um produto é obrigatório', 400),
    );

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_CREATE_INPUT, products: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('produto');
  });

  it('should return 403 for CONSULTANT role', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).post(BASE_URL).send(VALID_CREATE_INPUT);
    expect(res.status).toBe(401);
  });
});

// ─── GET list ───────────────────────────────────────────────────────

describe('GET /org/farms/:farmId/pesticide-prescriptions', () => {
  it('should list prescriptions with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPrescriptions.mockResolvedValue({
      data: [PRESCRIPTION_RESPONSE],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('should pass query params to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPrescriptions.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

    await request(app)
      .get(`${BASE_URL}?page=2&limit=10&status=ACTIVE&search=buva&fieldPlotId=plot-1`)
      .set('Authorization', 'Bearer tok');

    expect(mockedService.listPrescriptions).toHaveBeenCalledWith(
      { organizationId: 'org-1' },
      'farm-1',
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'ACTIVE',
        search: 'buva',
        fieldPlotId: 'plot-1',
      }),
    );
  });

  it('should allow CONSULTANT role to read', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listPrescriptions.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const res = await request(app).get(BASE_URL).set('Authorization', 'Bearer tok');
    expect(res.status).toBe(200);
  });
});

// ─── GET by ID ──────────────────────────────────────────────────────

describe('GET /org/farms/:farmId/pesticide-prescriptions/:id', () => {
  it('should return a single prescription', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPrescription.mockResolvedValue(PRESCRIPTION_RESPONSE);

    const res = await request(app).get(`${BASE_URL}/presc-1`).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('presc-1');
    expect(res.body.agronomistCrea).toBe('SP-12345/D');
  });

  it('should return 404 when not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPrescription.mockRejectedValue(
      new PrescriptionError('Receituário não encontrado', 404),
    );

    const res = await request(app)
      .get(`${BASE_URL}/nonexistent`)
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH ──────────────────────────────────────────────────────────

describe('PATCH /org/farms/:farmId/pesticide-prescriptions/:id', () => {
  it('should update a prescription', async () => {
    authAs(ADMIN_PAYLOAD);
    const updated = { ...PRESCRIPTION_RESPONSE, notes: 'Atualizado' };
    mockedService.updatePrescription.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`${BASE_URL}/presc-1`)
      .set('Authorization', 'Bearer tok')
      .send({ notes: 'Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Atualizado');
  });

  it('should return 400 on invalid status', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updatePrescription.mockRejectedValue(
      new PrescriptionError('Status inválido: INVALID', 400),
    );

    const res = await request(app)
      .patch(`${BASE_URL}/presc-1`)
      .set('Authorization', 'Bearer tok')
      .send({ status: 'INVALID' });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE (cancel) ────────────────────────────────────────────────

describe('DELETE /org/farms/:farmId/pesticide-prescriptions/:id', () => {
  it('should cancel a prescription', async () => {
    authAs(ADMIN_PAYLOAD);
    const cancelled = { ...PRESCRIPTION_RESPONSE, status: 'CANCELLED' };
    mockedService.cancelPrescription.mockResolvedValue(cancelled);

    const res = await request(app).delete(`${BASE_URL}/presc-1`).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('should return 404 when prescription not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.cancelPrescription.mockRejectedValue(
      new PrescriptionError('Receituário não encontrado', 404),
    );

    const res = await request(app)
      .delete(`${BASE_URL}/nonexistent`)
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });
});

// ─── CA6: PDF export ────────────────────────────────────────────────

describe('GET /org/farms/:farmId/pesticide-prescriptions/:id/pdf', () => {
  it('should return a PDF buffer', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPrescription.mockResolvedValue(PRESCRIPTION_RESPONSE);
    mockedService.generatePrescriptionPdf.mockResolvedValue(Buffer.from('%PDF-1.4 fake'));

    const res = await request(app)
      .get(`${BASE_URL}/presc-1/pdf`)
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('receituario_000001.pdf');
  });

  it('should return 404 when prescription not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getPrescription.mockRejectedValue(
      new PrescriptionError('Receituário não encontrado', 404),
    );

    const res = await request(app)
      .get(`${BASE_URL}/nonexistent/pdf`)
      .set('Authorization', 'Bearer tok');
    expect(res.status).toBe(404);
  });
});

// ─── CSV export ─────────────────────────────────────────────────────

describe('GET /org/farms/:farmId/pesticide-prescriptions/export/csv', () => {
  it('should return CSV content', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listPrescriptions.mockResolvedValue({
      data: [PRESCRIPTION_RESPONSE],
      total: 1,
      page: 1,
      limit: 1000,
    });
    mockedService.prescriptionsToCsv.mockReturnValue('Nº;Data\n1;12/03/2026');

    const res = await request(app).get(`${BASE_URL}/export/csv`).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Nº;Data');
  });
});

// ─── CA2: Auto-fill validation ──────────────────────────────────────

describe('CA2: Auto-fill from farm/plot data', () => {
  it('should auto-fill farmName, fieldPlotName, areaHa from database', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockResolvedValue(PRESCRIPTION_RESPONSE);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.body.farmName).toBe('Fazenda São José');
    expect(res.body.fieldPlotName).toBe('Talhão A1');
    expect(res.body.areaHa).toBe(45.5);
  });
});

// ─── CA4: Agronomist data ───────────────────────────────────────────

describe('CA4: Agronomist data validation', () => {
  it('should require agronomist name and CREA', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockRejectedValue(
      new PrescriptionError('Nome e CREA do agrônomo são obrigatórios', 400),
    );

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_CREATE_INPUT, agronomistName: '', agronomistCrea: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('agrônomo');
  });
});

// ─── CA5: Withdrawal periods ────────────────────────────────────────

describe('CA5: Withdrawal and safety intervals', () => {
  it('should include withdrawal and safety interval in product data', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockResolvedValue(PRESCRIPTION_RESPONSE);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.body.products[0].withdrawalPeriodDays).toBe(30);
    expect(res.body.products[0].safetyIntervalDays).toBe(1);
  });
});

// ─── CA7: Linkage ───────────────────────────────────────────────────

describe('CA7: Prescription-application-stock linkage', () => {
  it('should accept pesticideApplicationId and stockOutputId', async () => {
    authAs(ADMIN_PAYLOAD);
    const linked = {
      ...PRESCRIPTION_RESPONSE,
      pesticideApplicationId: 'app-1',
      stockOutputId: 'out-1',
    };
    mockedService.createPrescription.mockResolvedValue(linked);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send({ ...VALID_CREATE_INPUT, pesticideApplicationId: 'app-1', stockOutputId: 'out-1' });

    expect(res.body.pesticideApplicationId).toBe('app-1');
    expect(res.body.stockOutputId).toBe('out-1');
  });
});

// ─── CA8: Sequential numbering ──────────────────────────────────────

describe('CA8: Sequential numbering', () => {
  it('should assign sequential number per farm', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockResolvedValue(PRESCRIPTION_RESPONSE);

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.body.sequentialNumber).toBe(1);
  });

  it('should increment sequential number for subsequent prescriptions', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createPrescription.mockResolvedValue({
      ...PRESCRIPTION_RESPONSE,
      id: 'presc-2',
      sequentialNumber: 2,
    });

    const res = await request(app)
      .post(BASE_URL)
      .set('Authorization', 'Bearer tok')
      .send(VALID_CREATE_INPUT);

    expect(res.body.sequentialNumber).toBe(2);
  });
});
