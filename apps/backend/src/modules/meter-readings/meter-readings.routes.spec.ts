import request from 'supertest';
import { app } from '../../app';
import * as meterReadingsService from './meter-readings.service';
import * as authService from '../auth/auth.service';
import { MeterReadingError } from './meter-readings.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./meter-readings.service', () => ({
  createMeterReading: jest.fn(),
  listMeterReadings: jest.fn(),
  getLatestReadings: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(meterReadingsService);
const mockedAuth = jest.mocked(authService);

const ORG_ID = 'org-1';

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: ORG_ID,
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: ORG_ID,
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const VALID_READING = {
  id: 'mr-1',
  organizationId: ORG_ID,
  assetId: 'asset-1',
  readingDate: new Date('2026-01-15').toISOString(),
  readingType: 'HOURMETER',
  value: '1500.00',
  previousValue: '1400.00',
  createdBy: 'manager-1',
  createdAt: new Date().toISOString(),
  asset: { name: 'Trator John Deere' },
};

describe('Meter Readings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authAs(MANAGER_PAYLOAD);
  });

  describe('POST /api/org/:orgId/meter-readings', () => {
    it('creates first reading (no previous) successfully', async () => {
      const firstReading = { ...VALID_READING, previousValue: null };
      mockedService.createMeterReading.mockResolvedValue(firstReading as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/meter-readings`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          readingDate: '2026-01-15',
          readingType: 'HOURMETER',
          value: 1500,
        });

      expect(res.status).toBe(201);
      expect(res.body.previousValue).toBeNull();
    });

    it('creates reading and updates Asset.currentHourmeter', async () => {
      mockedService.createMeterReading.mockResolvedValue(VALID_READING as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/meter-readings`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          readingDate: '2026-01-15',
          readingType: 'HOURMETER',
          value: 1500,
        });

      expect(res.status).toBe(201);
      expect(mockedService.createMeterReading).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetId: 'asset-1', readingType: 'HOURMETER', value: 1500 }),
      );
    });

    it('rejects value less than previous (400)', async () => {
      mockedService.createMeterReading.mockRejectedValue(
        new MeterReadingError(
          'Leitura nao pode ser menor ou igual a ultima registrada (1500.00 h).',
          400,
        ),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/meter-readings`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          readingDate: '2026-01-20',
          readingType: 'HOURMETER',
          value: 1300,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Leitura nao pode ser menor ou igual/i);
    });

    it('rejects value equal to previous (400)', async () => {
      mockedService.createMeterReading.mockRejectedValue(
        new MeterReadingError(
          'Leitura nao pode ser menor ou igual a ultima registrada (1500.00 h).',
          400,
        ),
      );

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/meter-readings`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          readingDate: '2026-01-20',
          readingType: 'HOURMETER',
          value: 1500,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Leitura nao pode ser menor ou igual/i);
    });

    it('stores previousValue from last reading', async () => {
      mockedService.createMeterReading.mockResolvedValue(VALID_READING as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/meter-readings`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          readingDate: '2026-01-20',
          readingType: 'HOURMETER',
          value: 1500,
        });

      expect(res.status).toBe(201);
      expect(res.body.previousValue).toBe('1400.00');
    });

    it('allows OPERATOR to create meter readings', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.createMeterReading.mockResolvedValue(VALID_READING as never);

      const res = await request(app)
        .post(`/api/org/${ORG_ID}/meter-readings`)
        .set('Authorization', 'Bearer token')
        .send({
          assetId: 'asset-1',
          readingDate: '2026-01-20',
          readingType: 'HOURMETER',
          value: 1500,
        });

      // OPERATOR has assets:update permission
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/org/:orgId/meter-readings', () => {
    it('returns paginated list filtered by assetId', async () => {
      const mockList = {
        data: [VALID_READING],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockedService.listMeterReadings.mockResolvedValue(mockList as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/meter-readings?assetId=asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMeterReadings).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID }),
        expect.objectContaining({ assetId: 'asset-1' }),
      );
      expect(res.body.data).toHaveLength(1);
    });

    it('filters by readingType', async () => {
      const mockList = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      mockedService.listMeterReadings.mockResolvedValue(mockList as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/meter-readings?readingType=ODOMETER`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(mockedService.listMeterReadings).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ readingType: 'ODOMETER' }),
      );
    });
  });

  describe('GET /api/org/:orgId/meter-readings/latest/:assetId', () => {
    it('returns latest HOURMETER and ODOMETER readings', async () => {
      const mockLatest = {
        hourmeter: { ...VALID_READING, readingType: 'HOURMETER', value: '1500.00' },
        odometer: { ...VALID_READING, readingType: 'ODOMETER', value: '45000.00' },
      };
      mockedService.getLatestReadings.mockResolvedValue(mockLatest as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/meter-readings/latest/asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.hourmeter.readingType).toBe('HOURMETER');
      expect(res.body.odometer.readingType).toBe('ODOMETER');
    });

    it('returns null for readings that do not exist', async () => {
      const mockLatest = { hourmeter: null, odometer: null };
      mockedService.getLatestReadings.mockResolvedValue(mockLatest as never);

      const res = await request(app)
        .get(`/api/org/${ORG_ID}/meter-readings/latest/asset-1`)
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(200);
      expect(res.body.hourmeter).toBeNull();
      expect(res.body.odometer).toBeNull();
    });
  });
});
