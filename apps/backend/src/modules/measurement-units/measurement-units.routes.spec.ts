import request from 'supertest';
import { app } from '../../app';
import * as measurementUnitsService from './measurement-units.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { MeasurementUnitError } from './measurement-units.types';

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

jest.mock('./measurement-units.service', () => ({
  createUnit: jest.fn(),
  listUnits: jest.fn(),
  getUnit: jest.fn(),
  updateUnit: jest.fn(),
  deleteUnit: jest.fn(),
  createConversion: jest.fn(),
  listConversions: jest.fn(),
  updateConversion: jest.fn(),
  deleteConversion: jest.fn(),
  convert: jest.fn(),
  importConversions: jest.fn(),
  ensureSystemUnits: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(measurementUnitsService);
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

const NOW = new Date().toISOString();

const SAMPLE_UNIT = {
  id: 'unit-1',
  organizationId: 'org-1',
  name: 'Quilograma',
  abbreviation: 'kg',
  category: 'WEIGHT',
  isSystem: true,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const SAMPLE_CONVERSION = {
  id: 'conv-1',
  organizationId: 'org-1',
  fromUnitId: 'unit-t',
  fromUnitName: 'Tonelada',
  fromUnitAbbreviation: 't',
  toUnitId: 'unit-kg',
  toUnitName: 'Quilograma',
  toUnitAbbreviation: 'kg',
  factor: 1000,
  isSystem: true,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
};

// ═══════════════════════════════════════════════════════════════════════
// CA1: Cadastro de unidades base com categorias
// ═══════════════════════════════════════════════════════════════════════

describe('US-088: Measurement Units (CA1-CA2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(ADMIN_PAYLOAD);
  });

  // ─── Units CRUD ───────────────────────────────────────────────────

  describe('POST /api/org/measurement-units', () => {
    it('creates a custom unit', async () => {
      mockedService.createUnit.mockResolvedValue({
        ...SAMPLE_UNIT,
        id: 'unit-new',
        name: 'Barril',
        abbreviation: 'brl',
        isSystem: false,
      });

      const res = await request(app)
        .post('/api/org/measurement-units')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Barril', abbreviation: 'brl', category: 'VOLUME' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Barril');
      expect(res.body.abbreviation).toBe('brl');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_MEASUREMENT_UNIT' }),
      );
    });

    it('rejects unauthenticated requests', async () => {
      mockedAuth.verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid');
      });

      const res = await request(app)
        .post('/api/org/measurement-units')
        .send({ name: 'Test', abbreviation: 'tst', category: 'WEIGHT' });

      expect(res.status).toBe(401);
    });

    it('rejects CONSULTANT (read-only) users', async () => {
      authAs(VIEWER_PAYLOAD);

      const res = await request(app)
        .post('/api/org/measurement-units')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test', abbreviation: 'tst', category: 'WEIGHT' });

      expect(res.status).toBe(403);
    });

    it('returns 409 for duplicate abbreviation', async () => {
      mockedService.createUnit.mockRejectedValue(
        new MeasurementUnitError('Já existe uma unidade com a abreviação "kg"', 409),
      );

      const res = await request(app)
        .post('/api/org/measurement-units')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Quilograma2', abbreviation: 'kg', category: 'WEIGHT' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/org/measurement-units', () => {
    it('lists units with pagination', async () => {
      mockedService.listUnits.mockResolvedValue({
        data: [SAMPLE_UNIT],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/org/measurement-units')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].abbreviation).toBe('kg');
    });

    it('filters by category', async () => {
      mockedService.listUnits.mockResolvedValue({
        data: [SAMPLE_UNIT],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/org/measurement-units?category=WEIGHT')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listUnits).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ category: 'WEIGHT' }),
      );
    });

    it('searches by name', async () => {
      mockedService.listUnits.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/measurement-units?search=quilo')
        .set('Authorization', 'Bearer token');

      expect(mockedService.listUnits).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ search: 'quilo' }),
      );
    });
  });

  describe('GET /api/org/measurement-units/:unitId', () => {
    it('returns a single unit', async () => {
      mockedService.getUnit.mockResolvedValue(SAMPLE_UNIT);

      const res = await request(app)
        .get('/api/org/measurement-units/unit-1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('unit-1');
    });

    it('returns 404 for unknown unit', async () => {
      mockedService.getUnit.mockRejectedValue(
        new MeasurementUnitError('Unidade não encontrada', 404),
      );

      const res = await request(app)
        .get('/api/org/measurement-units/unknown')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/org/measurement-units/:unitId', () => {
    it('updates a custom unit', async () => {
      mockedService.updateUnit.mockResolvedValue({
        ...SAMPLE_UNIT,
        isSystem: false,
        name: 'Updated',
      });

      const res = await request(app)
        .patch('/api/org/measurement-units/unit-1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });

    it('rejects modifying system unit fields', async () => {
      mockedService.updateUnit.mockRejectedValue(
        new MeasurementUnitError(
          'Unidades do sistema não podem ter nome, abreviação ou categoria alterados',
          403,
        ),
      );

      const res = await request(app)
        .patch('/api/org/measurement-units/unit-1')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('allows toggling isActive on system units', async () => {
      mockedService.updateUnit.mockResolvedValue({ ...SAMPLE_UNIT, isActive: false });

      const res = await request(app)
        .patch('/api/org/measurement-units/unit-1')
        .set('Authorization', 'Bearer token')
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('DELETE /api/org/measurement-units/:unitId', () => {
    it('deletes a custom unit', async () => {
      mockedService.deleteUnit.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/measurement-units/unit-custom')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });

    it('rejects deleting system unit', async () => {
      mockedService.deleteUnit.mockRejectedValue(
        new MeasurementUnitError('Unidades do sistema não podem ser excluídas', 403),
      );

      const res = await request(app)
        .delete('/api/org/measurement-units/unit-kg')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });
  });

  // ─── Conversions CRUD ─────────────────────────────────────────────

  describe('POST /api/org/unit-conversions', () => {
    it('creates a conversion with bidirectional factor', async () => {
      mockedService.createConversion.mockResolvedValue(SAMPLE_CONVERSION);

      const res = await request(app)
        .post('/api/org/unit-conversions')
        .set('Authorization', 'Bearer token')
        .send({ fromUnitId: 'unit-t', toUnitId: 'unit-kg', factor: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.factor).toBe(1000);
      expect(res.body.fromUnitAbbreviation).toBe('t');
      expect(res.body.toUnitAbbreviation).toBe('kg');
    });

    it('returns 409 for duplicate conversion', async () => {
      mockedService.createConversion.mockRejectedValue(
        new MeasurementUnitError('Já existe conversão de t para kg', 409),
      );

      const res = await request(app)
        .post('/api/org/unit-conversions')
        .set('Authorization', 'Bearer token')
        .send({ fromUnitId: 'unit-t', toUnitId: 'unit-kg', factor: 1000 });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/org/unit-conversions', () => {
    it('lists all conversions', async () => {
      mockedService.listConversions.mockResolvedValue({
        data: [SAMPLE_CONVERSION],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/org/unit-conversions')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('filters by unitId', async () => {
      mockedService.listConversions.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await request(app)
        .get('/api/org/unit-conversions?unitId=unit-kg')
        .set('Authorization', 'Bearer token');

      expect(mockedService.listConversions).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ unitId: 'unit-kg' }),
      );
    });
  });

  describe('PATCH /api/org/unit-conversions/:conversionId', () => {
    it('updates conversion factor', async () => {
      mockedService.updateConversion.mockResolvedValue({ ...SAMPLE_CONVERSION, factor: 999 });

      const res = await request(app)
        .patch('/api/org/unit-conversions/conv-1')
        .set('Authorization', 'Bearer token')
        .send({ factor: 999 });

      expect(res.status).toBe(200);
      expect(res.body.factor).toBe(999);
    });

    it('rejects modifying system conversion factor', async () => {
      mockedService.updateConversion.mockRejectedValue(
        new MeasurementUnitError('Conversões do sistema não podem ter o fator alterado', 403),
      );

      const res = await request(app)
        .patch('/api/org/unit-conversions/conv-1')
        .set('Authorization', 'Bearer token')
        .send({ factor: 500 });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/org/unit-conversions/:conversionId', () => {
    it('deletes a custom conversion', async () => {
      mockedService.deleteConversion.mockResolvedValue(undefined);

      const res = await request(app)
        .delete('/api/org/unit-conversions/conv-custom')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(204);
    });

    it('rejects deleting system conversion', async () => {
      mockedService.deleteConversion.mockRejectedValue(
        new MeasurementUnitError('Conversões do sistema não podem ser excluídas', 403),
      );

      const res = await request(app)
        .delete('/api/org/unit-conversions/conv-sys')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(403);
    });
  });

  // ─── Convert endpoint (CA5 — bidirectional) ───────────────────────

  describe('GET /api/org/unit-conversions/convert', () => {
    it('converts between units directly', async () => {
      mockedService.convert.mockResolvedValue({
        fromValue: 2,
        fromUnit: 't',
        toValue: 2000,
        toUnit: 'kg',
        factor: 1000,
        path: ['t', 'kg'],
      });

      const res = await request(app)
        .get('/api/org/unit-conversions/convert?fromUnitId=unit-t&toUnitId=unit-kg&value=2')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.toValue).toBe(2000);
      expect(res.body.path).toEqual(['t', 'kg']);
    });

    it('converts using 2-hop path', async () => {
      mockedService.convert.mockResolvedValue({
        fromValue: 1,
        fromUnit: 't',
        toValue: 1000000,
        toUnit: 'g',
        factor: 1000000,
        path: ['t', 'kg', 'g'],
      });

      const res = await request(app)
        .get('/api/org/unit-conversions/convert?fromUnitId=unit-t&toUnitId=unit-g&value=1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.path).toEqual(['t', 'kg', 'g']);
      expect(res.body.toValue).toBe(1000000);
    });

    it('returns 400 when conversion not configured', async () => {
      mockedService.convert.mockRejectedValue(
        new MeasurementUnitError(
          'Conversão não configurada entre estas unidades. Configure o fator de conversão primeiro.',
          400,
        ),
      );

      const res = await request(app)
        .get('/api/org/unit-conversions/convert?fromUnitId=unit-ha&toUnitId=unit-kg&value=1')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Conversão não configurada');
    });

    it('returns 400 when missing required params', async () => {
      const res = await request(app)
        .get('/api/org/unit-conversions/convert?fromUnitId=unit-t')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(400);
    });
  });

  // ─── Import CSV (CA9) ─────────────────────────────────────────────

  describe('POST /api/org/unit-conversions/import', () => {
    it('imports conversions from CSV payload', async () => {
      mockedService.importConversions.mockResolvedValue({
        imported: 2,
        skipped: 0,
        errors: [],
      });

      const res = await request(app)
        .post('/api/org/unit-conversions/import')
        .set('Authorization', 'Bearer token')
        .send({
          conversions: [
            { fromAbbreviation: 'brl', toAbbreviation: 'L', factor: 159 },
            { fromAbbreviation: 'gal', toAbbreviation: 'L', factor: 3.785 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(2);
    });

    it('rejects empty list', async () => {
      const res = await request(app)
        .post('/api/org/unit-conversions/import')
        .set('Authorization', 'Bearer token')
        .send({ conversions: [] });

      expect(res.status).toBe(400);
    });

    it('rejects >500 items', async () => {
      const bigList = Array.from({ length: 501 }, (_, i) => ({
        fromAbbreviation: `u${i}`,
        toAbbreviation: 'kg',
        factor: 1,
      }));

      const res = await request(app)
        .post('/api/org/unit-conversions/import')
        .set('Authorization', 'Bearer token')
        .send({ conversions: bigList });

      expect(res.status).toBe(400);
    });
  });

  // ─── System units seed (CA2) ──────────────────────────────────────

  describe('System units constants', () => {
    it('has all required system units', () => {
      const { SYSTEM_UNITS } = jest.requireActual(
        './measurement-units.types',
      ) as typeof import('./measurement-units.types');
      const abbreviations = SYSTEM_UNITS.map((u) => u.abbreviation);

      // Required base units from spec
      expect(abbreviations).toContain('kg');
      expect(abbreviations).toContain('g');
      expect(abbreviations).toContain('L');
      expect(abbreviations).toContain('mL');
      expect(abbreviations).toContain('un');
      expect(abbreviations).toContain('sc');
      expect(abbreviations).toContain('t');
      expect(abbreviations).toContain('@');
      expect(abbreviations).toContain('cx');
      expect(abbreviations).toContain('ha');
    });

    it('has all required global conversions', () => {
      const { SYSTEM_CONVERSIONS } = jest.requireActual(
        './measurement-units.types',
      ) as typeof import('./measurement-units.types');
      const convKeys = SYSTEM_CONVERSIONS.map((c) => `${c.from}→${c.to}`);

      expect(convKeys).toContain('t→kg'); // 1 t = 1000 kg
      expect(convKeys).toContain('kg→g'); // 1 kg = 1000 g
      expect(convKeys).toContain('sc→kg'); // 1 sc = 60 kg
      expect(convKeys).toContain('@→kg'); // 1 @ = 15 kg
      expect(convKeys).toContain('L→mL'); // 1 L = 1000 mL
      expect(convKeys).toContain('cx→kg'); // 1 cx = 40.8 kg
      expect(convKeys).toContain('alq→ha'); // 1 alq = 2.42 ha
    });

    it('has correct conversion factors', () => {
      const { SYSTEM_CONVERSIONS } = jest.requireActual(
        './measurement-units.types',
      ) as typeof import('./measurement-units.types');
      const find = (from: string, to: string) =>
        SYSTEM_CONVERSIONS.find((c) => c.from === from && c.to === to);

      expect(find('t', 'kg')?.factor).toBe(1000);
      expect(find('sc', 'kg')?.factor).toBe(60);
      expect(find('cx', 'kg')?.factor).toBe(40.8);
      expect(find('alq', 'ha')?.factor).toBe(2.42);
    });
  });
});
