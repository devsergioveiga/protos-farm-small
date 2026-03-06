import request from 'supertest';
import { app } from '../../app';
import * as farmLocationsService from './farm-locations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FarmLocationError } from './farm-locations.types';

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

jest.mock('./farm-locations.service', () => ({
  createLocation: jest.fn(),
  listLocations: jest.fn(),
  getLocation: jest.fn(),
  updateLocation: jest.fn(),
  softDeleteLocation: jest.fn(),
  uploadLocationBoundary: jest.fn(),
  getLocationBoundary: jest.fn(),
  deleteLocationBoundary: jest.fn(),
  getLocationOccupancy: jest.fn(),
  listLocationsForMap: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(farmLocationsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

const CONSULTANT_PAYLOAD = {
  userId: 'consult-1',
  email: 'consult@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(
  payload: typeof ADMIN_PAYLOAD | typeof OPERATOR_PAYLOAD | typeof CONSULTANT_PAYLOAD,
) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const FARM_ID = 'farm-1';
const LOCATION_ID = 'loc-1';

const mockPasture = {
  id: LOCATION_ID,
  farmId: FARM_ID,
  name: 'Pasto Norte',
  type: 'PASTURE',
  boundaryAreaHa: null,
  capacityUA: 25,
  capacityAnimals: null,
  forageType: 'BRACHIARIA_BRIZANTHA',
  pastureStatus: 'EM_USO',
  facilityType: null,
  facilityStatus: null,
  description: 'Pasto principal',
  notes: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: { lots: 1 },
};

const mockFacility = {
  id: 'loc-2',
  farmId: FARM_ID,
  name: 'Curral Principal',
  type: 'FACILITY',
  boundaryAreaHa: null,
  capacityUA: null,
  capacityAnimals: 50,
  forageType: null,
  pastureStatus: null,
  facilityType: 'CURRAL',
  facilityStatus: 'ATIVO',
  description: null,
  notes: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: { lots: 0 },
};

// ─── POST /org/farms/:farmId/locations ──────────────────────────────

describe('POST /org/farms/:farmId/locations', () => {
  const url = `/api/org/farms/${FARM_ID}/locations`;

  it('should create a pasture location (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createLocation.mockResolvedValue(mockPasture as never);

    const res = await request(app).post(url).set('Authorization', 'Bearer token').send({
      name: 'Pasto Norte',
      type: 'PASTURE',
      capacityUA: 25,
      forageType: 'BRACHIARIA_BRIZANTHA',
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Pasto Norte');
    expect(mockedService.createLocation).toHaveBeenCalledTimes(1);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_LOCATION' }),
    );
  });

  it('should create a facility location (201)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createLocation.mockResolvedValue(mockFacility as never);

    const res = await request(app).post(url).set('Authorization', 'Bearer token').send({
      name: 'Curral Principal',
      type: 'FACILITY',
      facilityType: 'CURRAL',
      capacityAnimals: 50,
    });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('FACILITY');
  });

  it('should return 409 for duplicate name', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createLocation.mockRejectedValue(
      new FarmLocationError('Já existe um local com o nome "Pasto Norte" nesta fazenda', 409),
    );

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Pasto Norte', type: 'PASTURE' });

    expect(res.status).toBe(409);
  });

  it('should deny access for CONSULTANT (403)', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post(url)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Pasto', type: 'PASTURE' });

    expect(res.status).toBe(403);
  });
});

// ─── GET /org/farms/:farmId/locations ───────────────────────────────

describe('GET /org/farms/:farmId/locations', () => {
  const url = `/api/org/farms/${FARM_ID}/locations`;

  it('should list locations (200)', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.listLocations.mockResolvedValue({
      data: [mockPasture, mockFacility],
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    } as never);

    const res = await request(app).get(url).set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('should filter by type', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.listLocations.mockResolvedValue({
      data: [mockPasture],
      meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
    } as never);

    const res = await request(app)
      .get(url)
      .query({ type: 'PASTURE' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listLocations).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ type: 'PASTURE' }),
    );
  });

  it('should search by name', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.listLocations.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
    } as never);

    const res = await request(app)
      .get(url)
      .query({ search: 'Norte' })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(mockedService.listLocations).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ search: 'Norte' }),
    );
  });
});

// ─── GET /org/farms/:farmId/locations/map ───────────────────────────

describe('GET /org/farms/:farmId/locations/map', () => {
  it('should return locations for map (200)', async () => {
    authAs(OPERATOR_PAYLOAD);
    const mapData = [
      {
        id: LOCATION_ID,
        name: 'Pasto Norte',
        type: 'PASTURE',
        boundaryGeoJSON: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
        boundaryAreaHa: 10,
        pastureStatus: 'EM_USO',
        occupancy: { totalAnimals: 5, capacityUA: 25, occupancyPercent: 20, level: 'green' },
      },
    ];
    mockedService.listLocationsForMap.mockResolvedValue(mapData as never);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/map`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].occupancy.level).toBe('green');
  });
});

// ─── GET /org/farms/:farmId/locations/:locationId ───────────────────

describe('GET /org/farms/:farmId/locations/:locationId', () => {
  it('should get location detail (200)', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.getLocation.mockResolvedValue({
      ...mockPasture,
      _count: { lots: 1, animals: 3 },
      lots: [
        { id: 'lot-1', name: 'Lote 1', predominantCategory: 'BEZERRA', _count: { animals: 3 } },
      ],
    } as never);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Pasto Norte');
    expect(res.body.lots).toHaveLength(1);
  });

  it('should return 404 for non-existent location', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.getLocation.mockRejectedValue(new FarmLocationError('Local não encontrado', 404));

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/non-existent`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /org/farms/:farmId/locations/:locationId ─────────────────

describe('PATCH /org/farms/:farmId/locations/:locationId', () => {
  it('should update location (200)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateLocation.mockResolvedValue({
      ...mockPasture,
      name: 'Pasto Norte Atualizado',
    } as never);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Pasto Norte Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Pasto Norte Atualizado');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_LOCATION' }),
    );
  });

  it('should deny CONSULTANT (403)', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'X' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /org/farms/:farmId/locations/:locationId ─────────────────

describe('DELETE /org/farms/:farmId/locations/:locationId', () => {
  it('should soft delete location (204)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.softDeleteLocation.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_LOCATION' }),
    );
  });

  it('should return 404 for non-existent', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.softDeleteLocation.mockRejectedValue(
      new FarmLocationError('Local não encontrado', 404),
    );

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/locations/non-existent`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(404);
  });
});

// ─── GET /org/farms/:farmId/locations/:locationId/boundary ──────────

describe('GET /org/farms/:farmId/locations/:locationId/boundary', () => {
  it('should return boundary info (200)', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.getLocationBoundary.mockResolvedValue({
      hasBoundary: true,
      boundaryAreaHa: 10.5,
      boundaryGeoJSON: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    } as never);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/boundary`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.hasBoundary).toBe(true);
    expect(res.body.boundaryAreaHa).toBe(10.5);
  });

  it('should return no boundary (200)', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.getLocationBoundary.mockResolvedValue({
      hasBoundary: false,
      boundaryAreaHa: null,
      boundaryGeoJSON: null,
    } as never);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/boundary`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.hasBoundary).toBe(false);
  });
});

// ─── DELETE /org/farms/:farmId/locations/:locationId/boundary ────────

describe('DELETE /org/farms/:farmId/locations/:locationId/boundary', () => {
  it('should delete boundary (204)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteLocationBoundary.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/boundary`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(204);
  });
});

// ─── GET /org/farms/:farmId/locations/:locationId/occupancy ─────────

describe('GET /org/farms/:farmId/locations/:locationId/occupancy', () => {
  it('should return occupancy (200) - green', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.getLocationOccupancy.mockResolvedValue({
      totalAnimals: 5,
      capacityUA: 25,
      capacityAnimals: null,
      occupancyPercent: 20,
      level: 'green',
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/occupancy`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.level).toBe('green');
    expect(res.body.occupancyPercent).toBe(20);
  });

  it('should return occupancy (200) - red', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockedService.getLocationOccupancy.mockResolvedValue({
      totalAnimals: 48,
      capacityUA: null,
      capacityAnimals: 50,
      occupancyPercent: 96,
      level: 'red',
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/occupancy`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.level).toBe('red');
  });
});

// ─── POST /org/farms/:farmId/locations/:locationId/boundary ─────────

describe('POST /org/farms/:farmId/locations/:locationId/boundary', () => {
  it('should return 400 when no file is sent', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/boundary`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Nenhum arquivo enviado');
  });

  it('should upload boundary file (200)', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.uploadLocationBoundary.mockResolvedValue({
      boundaryAreaHa: 15.3,
      warnings: [],
    } as never);

    const geojson = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [-47, -15],
          [-46, -15],
          [-46, -14],
          [-47, -14],
          [-47, -15],
        ],
      ],
    });

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/locations/${LOCATION_ID}/boundary`)
      .set('Authorization', 'Bearer token')
      .attach('file', Buffer.from(geojson), 'boundary.geojson');

    expect(res.status).toBe(200);
    expect(res.body.boundaryAreaHa).toBe(15.3);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPLOAD_LOCATION_BOUNDARY' }),
    );
  });
});
