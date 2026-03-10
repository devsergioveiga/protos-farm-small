import request from 'supertest';
import { app } from '../../app';
import * as phenoService from './phenological-records.service';
import * as authService from '../auth/auth.service';
import { PhenoRecordError, PhenoRecordItem } from './phenological-records.types';

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

jest.mock('./phenological-records.service', () => ({
  listPhenoRecords: jest.fn(),
  getCurrentStage: jest.fn(),
  createPhenoRecord: jest.fn(),
  deletePhenoRecord: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

const mockedService = jest.mocked(phenoService);
const mockedAuth = jest.mocked(authService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'op-1',
  email: 'op@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const SAMPLE_RECORD: PhenoRecordItem = {
  id: 'rec-1',
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão 5',
  crop: 'Milho',
  stageCode: 'V6',
  stageName: 'Sexta folha',
  recordedAt: '2026-03-10T10:00:00.000Z',
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  notes: 'Bom desenvolvimento',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CA9: Plot phenological records', () => {
  describe('GET /api/org/phenological-records', () => {
    it('should list records', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listPhenoRecords.mockResolvedValue([SAMPLE_RECORD]);

      const res = await request(app)
        .get('/api/org/phenological-records?fieldPlotId=plot-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].stageCode).toBe('V6');
    });

    it('should filter by crop', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listPhenoRecords.mockResolvedValue([SAMPLE_RECORD]);

      await request(app)
        .get('/api/org/phenological-records?crop=Milho')
        .set('Authorization', 'Bearer token');

      expect(mockedService.listPhenoRecords).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ crop: 'Milho' }),
      );
    });
  });

  describe('GET /api/org/phenological-records/current/:fieldPlotId', () => {
    it('should return current stage', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCurrentStage.mockResolvedValue(SAMPLE_RECORD);

      const res = await request(app)
        .get('/api/org/phenological-records/current/plot-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.stageCode).toBe('V6');
      expect(res.body.fieldPlotName).toBe('Talhão 5');
    });

    it('should return 404 when no records exist', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCurrentStage.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/org/phenological-records/current/plot-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('should filter by crop', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCurrentStage.mockResolvedValue(SAMPLE_RECORD);

      await request(app)
        .get('/api/org/phenological-records/current/plot-1?crop=Milho')
        .set('Authorization', 'Bearer token');

      expect(mockedService.getCurrentStage).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'plot-1',
        'Milho',
      );
    });
  });

  describe('POST /api/org/phenological-records', () => {
    it('should create a phenological record', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createPhenoRecord.mockResolvedValue(SAMPLE_RECORD);

      const res = await request(app)
        .post('/api/org/phenological-records')
        .set('Authorization', 'Bearer token')
        .send({
          fieldPlotId: 'plot-1',
          crop: 'Milho',
          stageCode: 'V6',
          stageName: 'Sexta folha',
          notes: 'Bom desenvolvimento',
        });

      expect(res.status).toBe(201);
      expect(res.body.stageCode).toBe('V6');
      expect(mockedService.createPhenoRecord).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        'admin-1',
        expect.objectContaining({ stageCode: 'V6' }),
      );
    });

    it('should return 404 for non-existent plot', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createPhenoRecord.mockRejectedValue(
        new PhenoRecordError('Talhão não encontrado', 404),
      );

      const res = await request(app)
        .post('/api/org/phenological-records')
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: 'bad', crop: 'Milho', stageCode: 'V6', stageName: 'Sexta' });

      expect(res.status).toBe(404);
    });

    it('should return 400 for missing fields', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createPhenoRecord.mockRejectedValue(
        new PhenoRecordError('Código da fase é obrigatório', 400),
      );

      const res = await request(app)
        .post('/api/org/phenological-records')
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: 'plot-1', crop: 'Milho' });

      expect(res.status).toBe(400);
    });

    it('should deny access without farms:update', async () => {
      authAs(OPERATOR_PAYLOAD);

      const res = await request(app)
        .post('/api/org/phenological-records')
        .set('Authorization', 'Bearer token')
        .send({ fieldPlotId: 'plot-1', crop: 'Milho', stageCode: 'V6', stageName: 'Sexta' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/org/phenological-records/:id', () => {
    it('should delete a record', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deletePhenoRecord.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/phenological-records/rec-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deletePhenoRecord.mockRejectedValue(
        new PhenoRecordError('Registro fenológico não encontrado', 404),
      );

      const res = await request(app)
        .delete('/api/org/phenological-records/bad')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });
});
