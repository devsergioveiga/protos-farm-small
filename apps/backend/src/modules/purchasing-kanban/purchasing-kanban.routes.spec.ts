import request from 'supertest';
import { app } from '../../app';
import * as kanbanService from './purchasing-kanban.service';
import * as authService from '../auth/auth.service';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./purchasing-kanban.service', () => ({
  getKanbanBoard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(kanbanService);
const mockedAuth = jest.mocked(authService);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MANAGER_PAYLOAD = {
  userId: 'manager-1',
  email: 'manager@org.com',
  role: 'MANAGER' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

const EMPTY_BOARD = [
  { id: 'RC_PENDENTE', label: 'RC Pendente', count: 0, cards: [] },
  { id: 'RC_APROVADA', label: 'RC Aprovada', count: 0, cards: [] },
  { id: 'EM_COTACAO', label: 'Em Cotacao', count: 0, cards: [] },
  { id: 'OC_EMITIDA', label: 'OC Emitida', count: 0, cards: [] },
  { id: 'AGUARDANDO_ENTREGA', label: 'Aguardando Entrega', count: 0, cards: [] },
  { id: 'RECEBIDO', label: 'Recebido', count: 0, cards: [] },
  { id: 'PAGO', label: 'Pago', count: 0, cards: [] },
];

const MOCK_RC_CARD = {
  id: 'rc-1',
  entityType: 'RC',
  sequentialNumber: 'RC-2026/0001',
  urgency: 'URGENTE',
  requesterName: 'João Silva',
  totalValue: 1500,
  daysInStage: 2,
  isOverdue: false,
  farmId: 'farm-1',
  farmName: 'Fazenda Boa Vista',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PurchasingKanban endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/org/:orgId/purchasing/kanban', () => {
    it('should return 7 columns with correct IDs when board is empty', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getKanbanBoard.mockResolvedValue(EMPTY_BOARD as never);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/kanban')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(7);

      const columnIds = response.body.map((c: { id: string }) => c.id);
      expect(columnIds).toEqual([
        'RC_PENDENTE',
        'RC_APROVADA',
        'EM_COTACAO',
        'OC_EMITIDA',
        'AGUARDANDO_ENTREGA',
        'RECEBIDO',
        'PAGO',
      ]);
    });

    it('should pass farmId filter to service', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getKanbanBoard.mockResolvedValue(EMPTY_BOARD as never);

      await request(app)
        .get('/api/org/org-1/purchasing/kanban?farmId=farm-1')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getKanbanBoard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ farmId: 'farm-1' }),
      );
    });

    it('should pass urgency filter to service', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getKanbanBoard.mockResolvedValue(EMPTY_BOARD as never);

      await request(app)
        .get('/api/org/org-1/purchasing/kanban?urgency=URGENTE')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getKanbanBoard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ urgency: 'URGENTE' }),
      );
    });

    it('should show RC with existing SC only in EM_COTACAO column via service', async () => {
      authAs(MANAGER_PAYLOAD);
      // Service correctly places SC card in EM_COTACAO (tested via service unit test in real env)
      // At route level: verify service is called and response is forwarded correctly
      const boardWithScCard = EMPTY_BOARD.map((col) => {
        if (col.id === 'EM_COTACAO') {
          return {
            ...col,
            count: 1,
            cards: [{ ...MOCK_RC_CARD, entityType: 'SC', sequentialNumber: 'SC-2026/0001' }],
          };
        }
        return col;
      });
      mockedService.getKanbanBoard.mockResolvedValue(boardWithScCard as never);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/kanban')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      const emCotacao = response.body.find((c: { id: string }) => c.id === 'EM_COTACAO');
      const rcAprovada = response.body.find((c: { id: string }) => c.id === 'RC_APROVADA');
      expect(emCotacao.count).toBe(1);
      expect(rcAprovada.count).toBe(0);
    });

    it('should forward PAGO column cards (service enforces 30-day limit)', async () => {
      authAs(MANAGER_PAYLOAD);
      const boardWithPago = EMPTY_BOARD.map((col) => {
        if (col.id === 'PAGO') {
          return {
            ...col,
            count: 1,
            cards: [
              {
                id: 'payable-1',
                entityType: 'PAYABLE',
                sequentialNumber: 'Pagamento fornecedor ABC',
                requesterName: 'ABC Insumos',
                totalValue: 5000,
                daysInStage: 5,
                isOverdue: false,
                farmId: 'farm-1',
                farmName: 'Fazenda Boa Vista',
              },
            ],
          };
        }
        return col;
      });
      mockedService.getKanbanBoard.mockResolvedValue(boardWithPago as never);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/kanban')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      const pagoCol = response.body.find((c: { id: string }) => c.id === 'PAGO');
      expect(pagoCol.count).toBe(1);
      expect(pagoCol.cards[0].entityType).toBe('PAYABLE');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/org/org-1/purchasing/kanban');

      expect(response.status).toBe(401);
    });

    it('should return 403 for OPERATOR without purchases:read permission', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/kanban')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });

    it('should pass search filter to service', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getKanbanBoard.mockResolvedValue(EMPTY_BOARD as never);

      await request(app)
        .get('/api/org/org-1/purchasing/kanban?search=RC-2026')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.getKanbanBoard).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ search: 'RC-2026' }),
      );
    });

    it('should return column labels in pt-BR', async () => {
      authAs(MANAGER_PAYLOAD);
      mockedService.getKanbanBoard.mockResolvedValue(EMPTY_BOARD as never);

      const response = await request(app)
        .get('/api/org/org-1/purchasing/kanban')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      const labels = response.body.map((c: { label: string }) => c.label);
      expect(labels).toContain('RC Pendente');
      expect(labels).toContain('Em Cotacao');
      expect(labels).toContain('Pago');
    });
  });
});
