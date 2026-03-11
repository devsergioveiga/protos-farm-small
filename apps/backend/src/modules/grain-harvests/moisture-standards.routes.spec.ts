import request from 'supertest';
import { app } from '../../app';
import * as moistureService from './moisture-standards.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { GrainHarvestError } from './grain-harvests.types';

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

jest.mock('./moisture-standards.service', () => ({
  listMoistureStandards: jest.fn(),
  upsertMoistureStandard: jest.fn(),
  deleteMoistureStandard: jest.fn(),
  resolveStandardMoisture: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(moistureService);
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

const SAMPLE_STANDARD = {
  id: 'std-1',
  organizationId: 'org-1',
  crop: 'SOJA',
  moisturePct: 14,
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── LIST ───────────────────────────────────────────────────────────

describe('GET /api/org/moisture-standards', () => {
  const url = '/api/org/moisture-standards';

  it('200 — lista padrões customizados + defaults', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listMoistureStandards.mockResolvedValue({
      data: [SAMPLE_STANDARD],
      defaults: { SOJA: 13, MILHO: 14, FEIJAO: 13, TRIGO: 13 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].crop).toBe('SOJA');
    expect(res.body.data[0].moisturePct).toBe(14);
    expect(res.body.defaults.MILHO).toBe(14);
  });

  it('200 — CONSULTANT pode listar', async () => {
    authAs(VIEWER_PAYLOAD);
    mockedService.listMoistureStandards.mockResolvedValue({
      data: [],
      defaults: { SOJA: 13 },
    });

    const res = await request(app).get(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
  });
});

// ─── UPSERT ─────────────────────────────────────────────────────────

describe('PUT /api/org/moisture-standards', () => {
  const url = '/api/org/moisture-standards';

  it('200 — cria/atualiza padrão de umidade', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.upsertMoistureStandard.mockResolvedValue(SAMPLE_STANDARD);

    const res = await request(app)
      .put(url)
      .set('Authorization', 'Bearer tok')
      .send({ crop: 'Soja', moisturePct: 14 });

    expect(res.status).toBe(200);
    expect(res.body.crop).toBe('SOJA');
    expect(res.body.moisturePct).toBe(14);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPSERT_MOISTURE_STANDARD' }),
    );
  });

  it('400 — umidade fora do range', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.upsertMoistureStandard.mockRejectedValue(
      new GrainHarvestError('Umidade padrão deve estar entre 0 e 50%', 400),
    );

    const res = await request(app)
      .put(url)
      .set('Authorization', 'Bearer tok')
      .send({ crop: 'Soja', moisturePct: 60 });

    expect(res.status).toBe(400);
  });

  it('403 — CONSULTANT sem permissão', async () => {
    authAs(VIEWER_PAYLOAD);

    const res = await request(app)
      .put(url)
      .set('Authorization', 'Bearer tok')
      .send({ crop: 'Soja', moisturePct: 14 });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────

describe('DELETE /api/org/moisture-standards/:standardId', () => {
  const url = '/api/org/moisture-standards/std-1';

  it('204 — remove padrão customizado (volta ao default)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteMoistureStandard.mockResolvedValue(undefined);

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_MOISTURE_STANDARD' }),
    );
  });

  it('404 — não encontrado', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteMoistureStandard.mockRejectedValue(
      new GrainHarvestError('Padrão de umidade não encontrado', 404),
    );

    const res = await request(app).delete(url).set('Authorization', 'Bearer tok');

    expect(res.status).toBe(404);
  });
});
