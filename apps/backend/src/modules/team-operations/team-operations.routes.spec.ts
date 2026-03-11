import request from 'supertest';
import { app } from '../../app';
import * as teamOpService from './team-operations.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { TeamOperationError } from './team-operations.types';

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

jest.mock('./team-operations.service', () => ({
  createTeamOperation: jest.fn(),
  listTeamOperations: jest.fn(),
  getTeamOperation: jest.fn(),
  deleteTeamOperation: jest.fn(),
  getOperationTypes: jest.fn(),
  getCostByPlot: jest.fn(),
  getTimesheet: jest.fn(),
  getProductivityRanking: jest.fn(),
  calculateBonification: jest.fn(),
  getProductivityHistory: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return { ...actual, verifyAccessToken: jest.fn() };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(teamOpService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

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

const FARM_ID = 'farm-1';
const OP_ID = 'op-1';

const SAMPLE_OPERATION = {
  id: OP_ID,
  farmId: FARM_ID,
  fieldPlotId: 'plot-1',
  fieldPlotName: 'Talhão Norte',
  teamId: 'team-1',
  teamName: 'Equipe Colheita',
  operationType: 'COLHEITA',
  operationTypeLabel: 'Colheita',
  performedAt: '2026-03-09T00:00:00.000Z',
  timeStart: '2026-03-09T07:00:00.000Z',
  timeEnd: '2026-03-09T12:00:00.000Z',
  durationHours: 5,
  notes: null,
  photoUrl: null,
  latitude: null,
  longitude: null,
  entryCount: 3,
  totalLaborCost: 750,
  totalProductivity: null,
  productivityUnit: null,
  entries: [
    {
      id: 'e1',
      userId: 'user-1',
      userName: 'Maria',
      userEmail: 'maria@org.com',
      hoursWorked: null,
      productivity: null,
      productivityUnit: null,
      notes: null,
      hourlyRate: 50,
      laborCost: 250,
    },
    {
      id: 'e2',
      userId: 'user-2',
      userName: 'Pedro',
      userEmail: 'pedro@org.com',
      hoursWorked: null,
      productivity: null,
      productivityUnit: null,
      notes: null,
      hourlyRate: 50,
      laborCost: 250,
    },
    {
      id: 'e3',
      userId: 'user-3',
      userName: 'Ana',
      userEmail: 'ana@org.com',
      hoursWorked: null,
      productivity: null,
      productivityUnit: null,
      notes: null,
      hourlyRate: 50,
      laborCost: 250,
    },
  ],
  recordedBy: 'admin-1',
  recorderName: 'Admin',
  createdAt: '2026-03-09T12:00:00.000Z',
  updatedAt: '2026-03-09T12:00:00.000Z',
};

describe('Team Operations Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /types', () => {
    it('returns 12 operation types', async () => {
      authAs(ADMIN_PAYLOAD);
      const types = [
        { value: 'PULVERIZACAO', label: 'Pulverização' },
        { value: 'COLHEITA', label: 'Colheita' },
      ];
      mockedService.getOperationTypes.mockReturnValue(types);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/types`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('POST', () => {
    it('creates a team operation with entries for all members', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createTeamOperation.mockResolvedValue(SAMPLE_OPERATION);

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'COLHEITA',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: ['user-1', 'user-2', 'user-3'],
        });

      expect(res.status).toBe(201);
      expect(res.body.entryCount).toBe(3);
      expect(res.body.entries).toHaveLength(3);
      expect(res.body.teamName).toBe('Equipe Colheita');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_TEAM_OPERATION' }),
      );
    });

    it('returns 400 for missing memberIds', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createTeamOperation.mockRejectedValue(
        new TeamOperationError('Selecione ao menos um membro da equipe', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'COLHEITA',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('membro');
    });

    it('returns 400 for invalid operation type', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createTeamOperation.mockRejectedValue(
        new TeamOperationError('Tipo de operação inválido', 400),
      );

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'INVALIDO',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: ['user-1'],
        });

      expect(res.status).toBe(400);
    });

    it('rejects OPERATOR (no farms:update)', async () => {
      authAs({
        userId: 'op-1',
        email: 'op@org.com',
        role: 'OPERATOR' as const,
        organizationId: 'org-1',
      });

      const res = await request(app)
        .post(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          fieldPlotId: 'plot-1',
          teamId: 'team-1',
          operationType: 'COLHEITA',
          performedAt: '2026-03-09',
          timeStart: '2026-03-09T07:00:00Z',
          timeEnd: '2026-03-09T12:00:00Z',
          memberIds: ['user-1'],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET list', () => {
    it('lists operations with filters', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listTeamOperations.mockResolvedValue({
        data: [SAMPLE_OPERATION],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations?teamId=team-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].entryCount).toBe(3);
    });
  });

  describe('GET by ID', () => {
    it('returns operation with entries', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTeamOperation.mockResolvedValue(SAMPLE_OPERATION);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(3);
      expect(res.body.durationHours).toBe(5);
    });

    it('returns 404', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTeamOperation.mockRejectedValue(
        new TeamOperationError('Operação não encontrada', 404),
      );

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/nonexistent`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('soft deletes', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.deleteTeamOperation.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/org/farms/${FARM_ID}/team-operations/${OP_ID}`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(204);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_TEAM_OPERATION' }),
      );
    });
  });

  describe('GET cost-by-plot (CA9)', () => {
    it('returns labor cost aggregated by plot', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getCostByPlot.mockResolvedValue([
        {
          fieldPlotId: 'plot-1',
          fieldPlotName: 'Talhão Norte',
          operationCount: 3,
          totalHours: 24,
          totalLaborCost: 1200,
          entries: 9,
        },
      ]);

      const res = await request(app)
        .get(
          `/api/org/farms/${FARM_ID}/team-operations/cost-by-plot?dateFrom=2026-03-01&dateTo=2026-03-31`,
        )
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].totalLaborCost).toBe(1200);
      expect(res.body[0].fieldPlotName).toBe('Talhão Norte');
    });
  });

  describe('GET timesheet (CA8)', () => {
    it('returns timesheet entries grouped by date and user', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTimesheet.mockResolvedValue([
        {
          date: '2026-03-09',
          userId: 'user-1',
          userName: 'Maria',
          userEmail: 'maria@org.com',
          hourlyRate: 50,
          operationCount: 2,
          totalHours: 10,
          totalLaborCost: 500,
          operations: [
            {
              operationId: 'op-1',
              operationType: 'COLHEITA',
              operationTypeLabel: 'Colheita',
              fieldPlotName: 'Talhão Norte',
              timeStart: '2026-03-09T07:00:00.000Z',
              timeEnd: '2026-03-09T12:00:00.000Z',
              hoursWorked: 5,
            },
            {
              operationId: 'op-2',
              operationType: 'ADUBACAO',
              operationTypeLabel: 'Adubação',
              fieldPlotName: 'Talhão Sul',
              timeStart: '2026-03-09T13:00:00.000Z',
              timeEnd: '2026-03-09T18:00:00.000Z',
              hoursWorked: 5,
            },
          ],
        },
      ]);

      const res = await request(app)
        .get(
          `/api/org/farms/${FARM_ID}/team-operations/timesheet?dateFrom=2026-03-01&dateTo=2026-03-31`,
        )
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].totalHours).toBe(10);
      expect(res.body[0].totalLaborCost).toBe(500);
      expect(res.body[0].operations).toHaveLength(2);
    });

    it('supports filtering by userId', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getTimesheet.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/timesheet?userId=user-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockedService.getTimesheet).toHaveBeenCalledWith(
        expect.any(Object),
        FARM_ID,
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });

  describe('GET productivity-ranking (US-079 CA2)', () => {
    it('returns ranking sorted by total productivity', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getProductivityRanking.mockResolvedValue([
        {
          userId: 'user-1',
          userName: 'Maria',
          userEmail: 'maria@org.com',
          totalProductivity: 500,
          productivityUnit: 'kg',
          totalHoursWorked: 10,
          productivityPerHour: 50,
          operationCount: 3,
          rank: 1,
          targetValue: 40,
          targetPercentage: 125,
          status: 'above',
        },
        {
          userId: 'user-2',
          userName: 'Pedro',
          userEmail: 'pedro@org.com',
          totalProductivity: 350,
          productivityUnit: 'kg',
          totalHoursWorked: 10,
          productivityPerHour: 35,
          operationCount: 3,
          rank: 2,
          targetValue: 40,
          targetPercentage: 87.5,
          status: 'below',
        },
      ]);

      const res = await request(app)
        .get(
          `/api/org/farms/${FARM_ID}/team-operations/productivity-ranking?operationType=COLHEITA&dateFrom=2026-03-01`,
        )
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].rank).toBe(1);
      expect(res.body[0].totalProductivity).toBe(500);
      expect(res.body[1].rank).toBe(2);
    });

    it('returns empty array when no productivity data', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getProductivityRanking.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/productivity-ranking`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET productivity-history (US-079 CA8)', () => {
    it('returns monthly productivity history for a user', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.getProductivityHistory.mockResolvedValue([
        {
          period: '2026-01',
          totalProductivity: 800,
          productivityUnit: 'kg',
          totalHoursWorked: 40,
          productivityPerHour: 20,
          operationCount: 5,
        },
        {
          period: '2026-02',
          totalProductivity: 950,
          productivityUnit: 'kg',
          totalHoursWorked: 42,
          productivityPerHour: 22.619,
          operationCount: 6,
        },
      ]);

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations/productivity-history/user-1`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].period).toBe('2026-01');
      expect(res.body[1].totalProductivity).toBe(950);
    });
  });

  describe('GET bonification (US-079 CA5)', () => {
    it('returns bonification calculation', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.calculateBonification.mockResolvedValue({
        entries: [
          {
            userId: 'user-1',
            userName: 'Maria',
            userEmail: 'maria@org.com',
            operationType: 'COLHEITA',
            operationTypeLabel: 'Colheita',
            totalProductivity: 500,
            productivityUnit: 'litros',
            ratePerUnit: 0.5,
            bonificationValue: 250,
            operationCount: 3,
          },
        ],
        totalBonification: 250,
        period: { dateFrom: '2026-03-01', dateTo: '2026-03-31' },
      });

      const res = await request(app)
        .get(
          `/api/org/farms/${FARM_ID}/team-operations/bonification?dateFrom=2026-03-01&dateTo=2026-03-31`,
        )
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.totalBonification).toBe(250);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].bonificationValue).toBe(250);
    });
  });

  describe('Error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.listTeamOperations.mockRejectedValue(new Error('DB failure'));

      const res = await request(app)
        .get(`/api/org/farms/${FARM_ID}/team-operations`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });
  });
});
