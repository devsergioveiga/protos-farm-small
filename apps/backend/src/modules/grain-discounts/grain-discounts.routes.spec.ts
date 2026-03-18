import request from 'supertest';
import { app } from '../../app';
import * as discountService from './grain-discounts.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { GrainDiscountError } from './grain-discounts.types';

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

jest.mock('./grain-discounts.service', () => ({
  listDiscountTables: jest.fn(),
  upsertDiscountTable: jest.fn(),
  deleteDiscountTable: jest.fn(),
  listClassifications: jest.fn(),
  upsertClassification: jest.fn(),
  deleteClassification: jest.fn(),
  calculateDiscount: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(discountService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

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

const SAMPLE_DISCOUNT_TABLE = {
  id: 'dt-1',
  organizationId: 'org-1',
  crop: 'SOJA',
  discountType: 'MOISTURE',
  discountTypeLabel: 'Umidade',
  thresholdPct: 14,
  discountPctPerPoint: 1.5,
  maxPct: 30,
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
};

const SAMPLE_CLASSIFICATION = {
  id: 'gc-1',
  organizationId: 'org-1',
  crop: 'SOJA',
  gradeType: 'TIPO_1',
  gradeTypeLabel: 'Tipo 1',
  maxMoisturePct: 14,
  maxImpurityPct: 1,
  maxDamagedPct: 8,
  maxBrokenPct: 30,
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// CA1: DISCOUNT TABLES
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/org/grain-discount-tables', () => {
  const url = '/api/org/grain-discount-tables';

  it('200 — lista tabelas de desconto + defaults ANEC', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listDiscountTables.mockResolvedValue({
      data: [SAMPLE_DISCOUNT_TABLE],
      defaults: {
        SOJA: {
          MOISTURE: { thresholdPct: 14, discountPctPerPoint: 1.5, maxPct: 30 },
          IMPURITY: { thresholdPct: 1, discountPctPerPoint: 1.0, maxPct: 5 },
          DAMAGED: { thresholdPct: 8, discountPctPerPoint: 1.0, maxPct: 40 },
        },
      },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].crop).toBe('SOJA');
    expect(res.body.data[0].discountType).toBe('MOISTURE');
    expect(res.body.data[0].thresholdPct).toBe(14);
    expect(res.body.defaults.SOJA).toBeDefined();
  });

  it('200 — filtra por cultura', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listDiscountTables.mockResolvedValue({
      data: [SAMPLE_DISCOUNT_TABLE],
      defaults: {},
    });

    const res = await request(app).get(`${url}?crop=SOJA`).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listDiscountTables).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'SOJA',
    );
  });

  it('200 — CONSULTANT pode listar', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listDiscountTables.mockResolvedValue({ data: [], defaults: {} });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

describe('PUT /api/org/grain-discount-tables', () => {
  const url = '/api/org/grain-discount-tables';

  it('200 — cria/atualiza tabela de desconto', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.upsertDiscountTable.mockResolvedValue(SAMPLE_DISCOUNT_TABLE);

    const res = await request(app).put(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      discountType: 'MOISTURE',
      thresholdPct: 14,
      discountPctPerPoint: 1.5,
      maxPct: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.crop).toBe('SOJA');
    expect(res.body.discountType).toBe('MOISTURE');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPSERT_GRAIN_DISCOUNT_TABLE' }),
    );
  });

  it('400 — tipo de desconto inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.upsertDiscountTable.mockRejectedValue(
      new GrainDiscountError('Tipo de desconto inválido. Use: MOISTURE, IMPURITY, DAMAGED', 400),
    );

    const res = await request(app).put(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      discountType: 'INVALID',
      thresholdPct: 14,
      discountPctPerPoint: 1.5,
    });

    expect(res.status).toBe(400);
  });

  it('403 — CONSULTANT sem permissão', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).put(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      discountType: 'MOISTURE',
      thresholdPct: 14,
      discountPctPerPoint: 1.5,
    });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/org/grain-discount-tables/:tableId', () => {
  const url = '/api/org/grain-discount-tables/dt-1';

  it('204 — remove tabela de desconto customizada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteDiscountTable.mockResolvedValue(undefined);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_GRAIN_DISCOUNT_TABLE' }),
    );
  });

  it('404 — não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteDiscountTable.mockRejectedValue(
      new GrainDiscountError('Tabela de desconto não encontrada', 404),
    );

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CA2+CA3: CLASSIFICATIONS
// ═══════════════════════════════════════════════════════════════════

describe('GET /api/org/grain-classifications', () => {
  const url = '/api/org/grain-classifications';

  it('200 — lista classificações + defaults MAPA', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listClassifications.mockResolvedValue({
      data: [SAMPLE_CLASSIFICATION],
      defaults: {
        SOJA: {
          TIPO_1: { maxMoisturePct: 14, maxImpurityPct: 1, maxDamagedPct: 8, maxBrokenPct: 30 },
        },
      },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].gradeType).toBe('TIPO_1');
    expect(res.body.data[0].gradeTypeLabel).toBe('Tipo 1');
    expect(res.body.defaults.SOJA).toBeDefined();
  });

  it('200 — filtra por cultura', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listClassifications.mockResolvedValue({ data: [], defaults: {} });

    const res = await request(app).get(`${url}?crop=MILHO`).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(mockedService.listClassifications).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'MILHO',
    );
  });
});

describe('PUT /api/org/grain-classifications', () => {
  const url = '/api/org/grain-classifications';

  it('200 — cria/atualiza classificação', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.upsertClassification.mockResolvedValue(SAMPLE_CLASSIFICATION);

    const res = await request(app).put(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      gradeType: 'TIPO_1',
      maxMoisturePct: 14,
      maxImpurityPct: 1,
      maxDamagedPct: 8,
      maxBrokenPct: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.gradeType).toBe('TIPO_1');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPSERT_GRAIN_CLASSIFICATION' }),
    );
  });

  it('400 — tipo de classificação inválido', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.upsertClassification.mockRejectedValue(
      new GrainDiscountError(
        'Tipo de classificação inválido. Use: TIPO_1, TIPO_2, TIPO_3, FORA_DE_TIPO',
        400,
      ),
    );

    const res = await request(app).put(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      gradeType: 'PREMIUM',
      maxMoisturePct: 14,
      maxImpurityPct: 1,
      maxDamagedPct: 8,
      maxBrokenPct: 30,
    });

    expect(res.status).toBe(400);
  });

  it('403 — CONSULTANT sem permissão', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app).put(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      gradeType: 'TIPO_1',
      maxMoisturePct: 14,
      maxImpurityPct: 1,
      maxDamagedPct: 8,
      maxBrokenPct: 30,
    });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/org/grain-classifications/:classificationId', () => {
  const url = '/api/org/grain-classifications/gc-1';

  it('204 — remove classificação customizada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteClassification.mockResolvedValue(undefined);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_GRAIN_CLASSIFICATION' }),
    );
  });

  it('404 — não encontrada', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteClassification.mockRejectedValue(
      new GrainDiscountError('Classificação não encontrada', 404),
    );

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CA4: CALCULATE DISCOUNT
// ═══════════════════════════════════════════════════════════════════

describe('POST /api/org/grain-discounts/calculate', () => {
  const url = '/api/org/grain-discounts/calculate';

  it('200 — calcula breakdown de descontos', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.calculateDiscount.mockResolvedValue({
      crop: 'SOJA',
      grossProductionKg: 10000,
      moisturePct: 18,
      impurityPct: 2,
      damagedPct: 5,
      brokenPct: 10,
      moistureDiscount: {
        thresholdPct: 14,
        excessPoints: 4,
        discountPctPerPoint: 1.5,
        discountPct: 6,
        discountKg: 600,
      },
      impurityDiscount: {
        thresholdPct: 1,
        excessPoints: 1,
        discountPctPerPoint: 1,
        discountPct: 1,
        discountKg: 100,
      },
      damagedDiscount: {
        thresholdPct: 8,
        excessPoints: 0,
        discountPctPerPoint: 1,
        discountPct: 0,
        discountKg: 0,
      },
      totalDiscountPct: 7,
      totalDiscountKg: 700,
      netProductionKg: 9300,
      classification: 'TIPO_1',
      classificationLabel: 'Tipo 1',
      warnings: [],
    });

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      grossProductionKg: 10000,
      moisturePct: 18,
      impurityPct: 2,
      damagedPct: 5,
      brokenPct: 10,
    });

    expect(res.status).toBe(200);
    expect(res.body.crop).toBe('SOJA');
    expect(res.body.totalDiscountKg).toBe(700);
    expect(res.body.netProductionKg).toBe(9300);
    expect(res.body.classification).toBe('TIPO_1');
    expect(res.body.moistureDiscount.excessPoints).toBe(4);
  });

  it('200 — CONSULTANT pode calcular', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.calculateDiscount.mockResolvedValue({
      crop: 'SOJA',
      grossProductionKg: 5000,
      moisturePct: 13,
      impurityPct: 0.5,
      damagedPct: 0,
      brokenPct: 0,
      moistureDiscount: {
        thresholdPct: 14,
        excessPoints: 0,
        discountPctPerPoint: 1.5,
        discountPct: 0,
        discountKg: 0,
      },
      impurityDiscount: {
        thresholdPct: 1,
        excessPoints: 0,
        discountPctPerPoint: 1,
        discountPct: 0,
        discountKg: 0,
      },
      damagedDiscount: {
        thresholdPct: 8,
        excessPoints: 0,
        discountPctPerPoint: 1,
        discountPct: 0,
        discountKg: 0,
      },
      totalDiscountPct: 0,
      totalDiscountKg: 0,
      netProductionKg: 5000,
      classification: 'TIPO_1',
      classificationLabel: 'Tipo 1',
      warnings: [],
    });

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      grossProductionKg: 5000,
      moisturePct: 13,
      impurityPct: 0.5,
    });

    expect(res.status).toBe(200);
    expect(res.body.totalDiscountKg).toBe(0);
  });

  it('200 — retorna warnings quando excede limites', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.calculateDiscount.mockResolvedValue({
      crop: 'SOJA',
      grossProductionKg: 10000,
      moisturePct: 35,
      impurityPct: 6,
      damagedPct: 45,
      brokenPct: 50,
      moistureDiscount: {
        thresholdPct: 14,
        excessPoints: 21,
        discountPctPerPoint: 1.5,
        discountPct: 31.5,
        discountKg: 3150,
      },
      impurityDiscount: {
        thresholdPct: 1,
        excessPoints: 5,
        discountPctPerPoint: 1,
        discountPct: 5,
        discountKg: 500,
      },
      damagedDiscount: {
        thresholdPct: 8,
        excessPoints: 37,
        discountPctPerPoint: 1,
        discountPct: 37,
        discountKg: 3700,
      },
      totalDiscountPct: 73.5,
      totalDiscountKg: 7350,
      netProductionKg: 2650,
      classification: 'FORA_DE_TIPO',
      classificationLabel: 'Fora de Tipo',
      warnings: [
        'Umidade 35% excede limite máximo de 30%',
        'Impureza 6% excede limite máximo de 5%',
        'Avariados 45% excede limite máximo de 40%',
        'Lote classificado como Fora de Tipo — verificar padrões de qualidade',
      ],
    });

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      grossProductionKg: 10000,
      moisturePct: 35,
      impurityPct: 6,
      damagedPct: 45,
      brokenPct: 50,
    });

    expect(res.status).toBe(200);
    expect(res.body.classification).toBe('FORA_DE_TIPO');
    expect(res.body.warnings).toHaveLength(4);
    expect(res.body.warnings[0]).toContain('Umidade 35%');
  });

  it('400 — produção bruta inválida', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.calculateDiscount.mockRejectedValue(
      new GrainDiscountError('Produção bruta deve ser maior que zero', 400),
    );

    const res = await request(app).post(url).set('Authorization', 'Bearer tok').send({
      crop: 'Soja',
      grossProductionKg: 0,
      moisturePct: 14,
      impurityPct: 1,
    });

    expect(res.status).toBe(400);
  });
});
