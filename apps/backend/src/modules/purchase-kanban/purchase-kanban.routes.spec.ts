import request from 'supertest';
import { app } from '../../app';
import * as purchaseKanbanService from './purchase-kanban.service';
import * as authService from '../auth/auth.service';
import type { KanbanCard } from './purchase-kanban.types';

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./purchase-kanban.service', () => ({
  getKanbanCards: jest.fn(),
  transitionCard: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(purchaseKanbanService);
const mockedAuth = jest.mocked(authService);

// ─── Test fixtures ────────────────────────────────────────────────────

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

const VALID_KANBAN_CARDS: KanbanCard[] = [
  {
    id: 'rc-1',
    column: 'RC_PENDENTE',
    number: 'RC-2026/0001',
    type: 'INSUMOS',
    requester: 'João Silva',
    totalValue: 1500.0,
    urgency: 'NORMAL',
    daysInStage: 2,
    isOverdue: false,
    purchaseRequestId: 'rc-1',
    quotationId: null,
    purchaseOrderId: null,
    goodsReceiptId: null,
    payableId: null,
    isEmergency: false,
  },
  {
    id: 'po-emergency-1',
    column: 'OC_EMITIDA',
    number: 'OC-2026/0010',
    type: 'EMERGENCIAL',
    requester: 'Maria Souza',
    totalValue: 800.0,
    urgency: 'EMERGENCIAL',
    daysInStage: 1,
    isOverdue: false,
    purchaseRequestId: null,
    quotationId: null,
    purchaseOrderId: 'po-emergency-1',
    goodsReceiptId: null,
    payableId: null,
    isEmergency: true,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────

describe('GET /api/org/purchase-kanban', () => {
  it('returns 200 with array of kanban cards', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getKanbanCards.mockResolvedValue(VALID_KANBAN_CARDS);

    const res = await request(app)
      .get('/api/org/purchase-kanban')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('cards have all required fields', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getKanbanCards.mockResolvedValue(VALID_KANBAN_CARDS);

    const res = await request(app)
      .get('/api/org/purchase-kanban')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    const card = res.body[0];
    expect(card).toMatchObject({
      id: expect.any(String),
      column: expect.any(String),
      number: expect.any(String),
      type: expect.any(String),
      requester: expect.any(String),
      totalValue: expect.any(Number),
      urgency: expect.any(String),
      daysInStage: expect.any(Number),
      isOverdue: expect.any(Boolean),
    });
  });

  it('passes farmId filter from query string to service', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getKanbanCards.mockResolvedValue([]);

    await request(app)
      .get('/api/org/purchase-kanban?farmId=farm-123')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getKanbanCards).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ farmId: 'farm-123' }),
    );
  });

  it('passes urgency filter from query string to service', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.getKanbanCards.mockResolvedValue([]);

    await request(app)
      .get('/api/org/purchase-kanban?urgency=URGENTE')
      .set('Authorization', 'Bearer token');

    expect(mockedService.getKanbanCards).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ urgency: 'URGENTE' }),
    );
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockedAuth.verifyAccessToken.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const res = await request(app)
      .get('/api/org/purchase-kanban')
      .set('Authorization', 'Bearer invalid');

    expect(res.status).toBe(401);
  });

  it('returns 403 for operator without purchases:read', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockGetUserPermissions.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/org/purchase-kanban')
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(403);
  });
});

describe('POST /api/org/purchase-kanban/transition', () => {
  it('returns 400 when targetColumn is invalid', async () => {
    authAs(MANAGER_PAYLOAD);

    const res = await request(app)
      .post('/api/org/purchase-kanban/transition')
      .set('Authorization', 'Bearer token')
      .send({ cardId: 'rc-1', targetColumn: 'COLUNA_INVALIDA' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/targetColumn invalido/);
  });

  it('dispatches approval when RC_PENDENTE -> APROVADA transition is valid', async () => {
    authAs(MANAGER_PAYLOAD);
    mockedService.transitionCard.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/org/purchase-kanban/transition')
      .set('Authorization', 'Bearer token')
      .send({ cardId: 'rc-1', targetColumn: 'APROVADA' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockedService.transitionCard).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      'rc-1',
      'APROVADA',
    );
  });

  it('returns 403 when transition is not allowed by ALLOWED_TRANSITIONS', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PurchaseKanbanError } = await import('./purchase-kanban.types');
    mockedService.transitionCard.mockRejectedValue(
      new PurchaseKanbanError('Transicao nao permitida de RC_PENDENTE para PAGO', 403),
    );

    const res = await request(app)
      .post('/api/org/purchase-kanban/transition')
      .set('Authorization', 'Bearer token')
      .send({ cardId: 'rc-1', targetColumn: 'PAGO' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Transicao nao permitida/);
  });

  it('returns 400 when targeting non-RC column that requires domain page', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PurchaseKanbanError } = await import('./purchase-kanban.types');
    mockedService.transitionCard.mockRejectedValue(
      new PurchaseKanbanError('Use a pagina de cotacoes para criar uma cotacao', 400),
    );

    const res = await request(app)
      .post('/api/org/purchase-kanban/transition')
      .set('Authorization', 'Bearer token')
      .send({ cardId: 'rc-2', targetColumn: 'EM_COTACAO' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cotacoes/);
  });

  it('returns 404 when card is not found', async () => {
    authAs(MANAGER_PAYLOAD);
    const { PurchaseKanbanError } = await import('./purchase-kanban.types');
    mockedService.transitionCard.mockRejectedValue(
      new PurchaseKanbanError('Card nao encontrado', 404),
    );

    const res = await request(app)
      .post('/api/org/purchase-kanban/transition')
      .set('Authorization', 'Bearer token')
      .send({ cardId: 'nonexistent', targetColumn: 'APROVADA' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/nao encontrado/);
  });

  it('returns 403 for operator without purchases:manage', async () => {
    authAs(OPERATOR_PAYLOAD);
    mockGetUserPermissions.mockResolvedValue(['purchases:read']);

    const res = await request(app)
      .post('/api/org/purchase-kanban/transition')
      .set('Authorization', 'Bearer token')
      .send({ cardId: 'rc-1', targetColumn: 'APROVADA' });

    expect(res.status).toBe(403);
  });
});
