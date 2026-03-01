import request from 'supertest';
import { app } from '../../app';
import * as producersService from './producers.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { ProducerError } from './producers.types';

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

jest.mock('./producers.service', () => ({
  createProducer: jest.fn(),
  listProducers: jest.fn(),
  getProducer: jest.fn(),
  updateProducer: jest.fn(),
  toggleProducerStatus: jest.fn(),
  addParticipant: jest.fn(),
  updateParticipant: jest.fn(),
  deleteParticipant: jest.fn(),
  addIe: jest.fn(),
  updateIe: jest.fn(),
  deleteIe: jest.fn(),
  setDefaultIeForFarm: jest.fn(),
  addFarmLink: jest.fn(),
  listFarmLinks: jest.fn(),
  updateFarmLink: jest.fn(),
  deleteFarmLink: jest.fn(),
  getProducersByFarm: jest.fn(),
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

const mockedService = jest.mocked(producersService);
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

const COWBOY_PAYLOAD = {
  userId: 'cowboy-1',
  email: 'cowboy@org.com',
  role: 'COWBOY' as const,
  organizationId: 'org-1',
};

function authAs(payload: authService.TokenPayload) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  const rolePerms =
    DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
  mockGetUserPermissions.mockResolvedValue(rolePerms);
}

describe('Producers endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── Auth guard ─────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/org/producers');
      expect(response.status).toBe(401);
    });

    it('should return 403 for COWBOY trying to read producers', async () => {
      authAs(COWBOY_PAYLOAD);

      const response = await request(app)
        .get('/api/org/producers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
    });

    it('should allow OPERATOR to read producers', async () => {
      authAs(OPERATOR_PAYLOAD);
      mockedService.listProducers.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      } as never);

      const response = await request(app)
        .get('/api/org/producers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should return 403 for OPERATOR trying to create producer', async () => {
      authAs(OPERATOR_PAYLOAD);

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', type: 'PF', document: '12345678909' });

      expect(response.status).toBe(403);
    });
  });

  // ─── POST /api/org/producers ──────────────────────────────────────

  describe('POST /api/org/producers', () => {
    const validPF = { name: 'João Silva', type: 'PF', document: '529.982.247-25' };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success (PF)', async () => {
      const created = { id: 'prod-1', ...validPF, status: 'ACTIVE' };
      mockedService.createProducer.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send(validPF);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('prod-1');
      expect(mockedService.createProducer).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        expect.objectContaining({ name: 'João Silva', type: 'PF' }),
      );
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          action: 'CREATE_PRODUCER',
          targetType: 'producer',
          targetId: 'prod-1',
        }),
      );
    });

    it('should return 201 on success (PJ)', async () => {
      const body = { name: 'Agro Ltda', type: 'PJ', document: '11.222.333/0001-81' };
      const created = { id: 'prod-2', ...body, status: 'ACTIVE' };
      mockedService.createProducer.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send(body);

      expect(response.status).toBe(201);
    });

    it('should return 201 on success (SOCIEDADE_EM_COMUM)', async () => {
      const body = { name: 'Irmãos Silva', type: 'SOCIEDADE_EM_COMUM' };
      const created = { id: 'prod-3', ...body, status: 'ACTIVE' };
      mockedService.createProducer.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send(body);

      expect(response.status).toBe(201);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send({ type: 'PF' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Nome é obrigatório');
    });

    it('should return 400 when type is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tipo é obrigatório');
    });

    it('should return 400 on invalid CPF for PF', async () => {
      mockedService.createProducer.mockRejectedValue(new ProducerError('CPF inválido', 400));

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', type: 'PF', document: '000.000.000-00' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CPF inválido');
    });

    it('should return 400 on invalid CNPJ for PJ', async () => {
      mockedService.createProducer.mockRejectedValue(new ProducerError('CNPJ inválido', 400));

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', type: 'PJ', document: '00.000.000/0000-00' });

      expect(response.status).toBe(400);
    });

    it('should return 409 on duplicate document', async () => {
      mockedService.createProducer.mockRejectedValue(
        new ProducerError('Já existe um produtor com este documento nesta organização', 409),
      );

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send(validPF);

      expect(response.status).toBe(409);
    });

    it('should return 500 on unexpected error', async () => {
      mockedService.createProducer.mockRejectedValue(new Error('DB down'));

      const response = await request(app)
        .post('/api/org/producers')
        .set('Authorization', 'Bearer valid-token')
        .send(validPF);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Erro interno do servidor');
    });
  });

  // ─── GET /api/org/producers ───────────────────────────────────────

  describe('GET /api/org/producers', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with paginated list', async () => {
      const result = {
        data: [{ id: 'prod-1', name: 'João' }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockedService.listProducers.mockResolvedValue(result as never);

      const response = await request(app)
        .get('/api/org/producers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
    });

    it('should pass query params to service', async () => {
      mockedService.listProducers.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      } as never);

      await request(app)
        .get('/api/org/producers?page=2&limit=10&status=ACTIVE&type=PF&search=joao')
        .set('Authorization', 'Bearer valid-token');

      expect(mockedService.listProducers).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        { page: 2, limit: 10, search: 'joao', status: 'ACTIVE', type: 'PF' },
      );
    });
  });

  // ─── GET /api/org/producers/:producerId ───────────────────────────

  describe('GET /api/org/producers/:producerId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with producer details', async () => {
      const producer = {
        id: 'prod-1',
        name: 'João',
        participants: [],
        stateRegistrations: [],
        farmLinks: [],
      };
      mockedService.getProducer.mockResolvedValue(producer as never);

      const response = await request(app)
        .get('/api/org/producers/prod-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('prod-1');
    });

    it('should return 404 when producer not found', async () => {
      mockedService.getProducer.mockRejectedValue(
        new ProducerError('Produtor não encontrado', 404),
      );

      const response = await request(app)
        .get('/api/org/producers/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/producers/:producerId ─────────────────────────

  describe('PATCH /api/org/producers/:producerId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'prod-1', name: 'Updated Name' };
      mockedService.updateProducer.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/producers/prod-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_PRODUCER',
          targetId: 'prod-1',
        }),
      );
    });

    it('should return 404 when producer not found', async () => {
      mockedService.updateProducer.mockRejectedValue(
        new ProducerError('Produtor não encontrado', 404),
      );

      const response = await request(app)
        .patch('/api/org/producers/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  // ─── PATCH /api/org/producers/:producerId/status ──────────────────

  describe('PATCH /api/org/producers/:producerId/status', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on deactivate', async () => {
      const updated = { id: 'prod-1', status: 'INACTIVE' };
      mockedService.toggleProducerStatus.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/producers/prod-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('INACTIVE');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PRODUCER_STATUS' }),
      );
    });

    it('should return 400 when status is invalid', async () => {
      const response = await request(app)
        .patch('/api/org/producers/prod-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({ status: 'SUSPENDED' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Status deve ser ACTIVE ou INACTIVE');
    });

    it('should return 400 when status is missing', async () => {
      const response = await request(app)
        .patch('/api/org/producers/prod-1/status')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ─── Participants ─────────────────────────────────────────────────

  describe('POST /api/org/producers/:producerId/participants', () => {
    const validParticipant = {
      name: 'Maria Silva',
      cpf: '529.982.247-25',
      participationPct: 50,
    };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'part-1', ...validParticipant, producerId: 'prod-1' };
      mockedService.addParticipant.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send(validParticipant);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('part-1');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADD_PRODUCER_PARTICIPANT' }),
      );
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send({ cpf: '529.982.247-25', participationPct: 50 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Nome é obrigatório');
    });

    it('should return 400 when cpf is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', participationPct: 50 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CPF é obrigatório');
    });

    it('should return 400 when participationPct is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', cpf: '529.982.247-25' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Percentual de participação é obrigatório');
    });

    it('should return 400 for non-SC producer', async () => {
      mockedService.addParticipant.mockRejectedValue(
        new ProducerError('Participantes só podem ser adicionados a Sociedade em Comum', 400),
      );

      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send(validParticipant);

      expect(response.status).toBe(400);
    });

    it('should return 400 when percentage exceeds 100%', async () => {
      mockedService.addParticipant.mockRejectedValue(
        new ProducerError(
          'Soma dos percentuais excede 100%. Atual: 80%, tentando adicionar: 30%',
          400,
        ),
      );

      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validParticipant, participationPct: 30 });

      expect(response.status).toBe(400);
    });

    it('should return 409 on duplicate CPF', async () => {
      mockedService.addParticipant.mockRejectedValue(
        new ProducerError('Já existe um participante com este CPF', 409),
      );

      const response = await request(app)
        .post('/api/org/producers/prod-1/participants')
        .set('Authorization', 'Bearer valid-token')
        .send(validParticipant);

      expect(response.status).toBe(409);
    });
  });

  describe('PATCH /api/org/producers/:producerId/participants/:pid', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'part-1', name: 'Updated' };
      mockedService.updateParticipant.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/producers/prod-1/participants/part-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PRODUCER_PARTICIPANT' }),
      );
    });

    it('should return 404 when participant not found', async () => {
      mockedService.updateParticipant.mockRejectedValue(
        new ProducerError('Participante não encontrado', 404),
      );

      const response = await request(app)
        .patch('/api/org/producers/prod-1/participants/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/org/producers/:producerId/participants/:pid', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful delete', async () => {
      mockedService.deleteParticipant.mockResolvedValue({
        message: 'Participante removido com sucesso',
      } as never);

      const response = await request(app)
        .delete('/api/org/producers/prod-1/participants/part-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Participante removido com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_PRODUCER_PARTICIPANT' }),
      );
    });
  });

  // ─── State Registrations (IEs) ────────────────────────────────────

  describe('POST /api/org/producers/:producerId/ies', () => {
    const validIe = { number: '12345678', state: 'SP' };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = { id: 'ie-1', ...validIe, producerId: 'prod-1', situation: 'ACTIVE' };
      mockedService.addIe.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/producers/prod-1/ies')
        .set('Authorization', 'Bearer valid-token')
        .send(validIe);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('ie-1');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADD_PRODUCER_IE' }),
      );
    });

    it('should return 400 when number is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/ies')
        .set('Authorization', 'Bearer valid-token')
        .send({ state: 'SP' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Número da IE é obrigatório');
    });

    it('should return 400 when state is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/ies')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '12345678' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('UF é obrigatória');
    });

    it('should return 409 on duplicate IE', async () => {
      mockedService.addIe.mockRejectedValue(
        new ProducerError('Já existe uma IE com este número e UF para este produtor', 409),
      );

      const response = await request(app)
        .post('/api/org/producers/prod-1/ies')
        .set('Authorization', 'Bearer valid-token')
        .send(validIe);

      expect(response.status).toBe(409);
    });

    it('should return 400 on invalid IE number', async () => {
      mockedService.addIe.mockRejectedValue(
        new ProducerError('Número da IE inválido. Esperado: 8 a 14 dígitos', 400),
      );

      const response = await request(app)
        .post('/api/org/producers/prod-1/ies')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '123', state: 'SP' });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/org/producers/:producerId/ies/:ieId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'ie-1', number: '99999999' };
      mockedService.updateIe.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/producers/prod-1/ies/ie-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '99999999' });

      expect(response.status).toBe(200);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PRODUCER_IE' }),
      );
    });

    it('should return 404 when IE not found', async () => {
      mockedService.updateIe.mockRejectedValue(
        new ProducerError('Inscrição estadual não encontrada', 404),
      );

      const response = await request(app)
        .patch('/api/org/producers/prod-1/ies/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ number: '99999999' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/org/producers/:producerId/ies/:ieId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful delete', async () => {
      mockedService.deleteIe.mockResolvedValue({
        message: 'Inscrição estadual removida com sucesso',
      } as never);

      const response = await request(app)
        .delete('/api/org/producers/prod-1/ies/ie-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Inscrição estadual removida com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_PRODUCER_IE' }),
      );
    });
  });

  describe('PATCH /api/org/producers/:producerId/ies/:ieId/default', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on setting default IE', async () => {
      const updated = { id: 'ie-1', isDefaultForFarm: true, farmId: 'farm-1' };
      mockedService.setDefaultIeForFarm.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/producers/prod-1/ies/ie-1/default')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.isDefaultForFarm).toBe(true);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SET_DEFAULT_PRODUCER_IE' }),
      );
    });

    it('should return 400 when IE has no farm', async () => {
      mockedService.setDefaultIeForFarm.mockRejectedValue(
        new ProducerError('Esta IE não está vinculada a uma fazenda', 400),
      );

      const response = await request(app)
        .patch('/api/org/producers/prod-1/ies/ie-1/default')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
    });
  });

  // ─── Farm Links ───────────────────────────────────────────────────

  describe('POST /api/org/producers/:producerId/farms', () => {
    const validLink = { farmId: 'farm-1', bondType: 'PROPRIETARIO' };

    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 201 on success', async () => {
      const created = {
        id: 'link-1',
        ...validLink,
        producerId: 'prod-1',
        farm: { id: 'farm-1', name: 'Fazenda 1', nickname: null, state: 'SP' },
      };
      mockedService.addFarmLink.mockResolvedValue(created as never);

      const response = await request(app)
        .post('/api/org/producers/prod-1/farms')
        .set('Authorization', 'Bearer valid-token')
        .send(validLink);

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('link-1');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ADD_PRODUCER_FARM_LINK' }),
      );
    });

    it('should return 400 when farmId is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ bondType: 'PROPRIETARIO' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ID da fazenda é obrigatório');
    });

    it('should return 400 when bondType is missing', async () => {
      const response = await request(app)
        .post('/api/org/producers/prod-1/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ farmId: 'farm-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Tipo de vínculo é obrigatório');
    });

    it('should return 409 on duplicate link', async () => {
      mockedService.addFarmLink.mockRejectedValue(
        new ProducerError('Já existe um vínculo com este tipo para esta fazenda', 409),
      );

      const response = await request(app)
        .post('/api/org/producers/prod-1/farms')
        .set('Authorization', 'Bearer valid-token')
        .send(validLink);

      expect(response.status).toBe(409);
    });

    it('should return 404 when farm not found', async () => {
      mockedService.addFarmLink.mockRejectedValue(new ProducerError('Fazenda não encontrada', 404));

      const response = await request(app)
        .post('/api/org/producers/prod-1/farms')
        .set('Authorization', 'Bearer valid-token')
        .send({ farmId: 'non-existent', bondType: 'PROPRIETARIO' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/org/producers/:producerId/farms', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with farm links', async () => {
      const links = [
        {
          id: 'link-1',
          farmId: 'farm-1',
          bondType: 'PROPRIETARIO',
          farm: { id: 'farm-1', name: 'Fazenda 1' },
        },
      ];
      mockedService.listFarmLinks.mockResolvedValue(links as never);

      const response = await request(app)
        .get('/api/org/producers/prod-1/farms')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });
  });

  describe('PATCH /api/org/producers/:producerId/farms/:linkId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful update', async () => {
      const updated = { id: 'link-1', bondType: 'ARRENDATARIO' };
      mockedService.updateFarmLink.mockResolvedValue(updated as never);

      const response = await request(app)
        .patch('/api/org/producers/prod-1/farms/link-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ bondType: 'ARRENDATARIO' });

      expect(response.status).toBe(200);
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_PRODUCER_FARM_LINK' }),
      );
    });
  });

  describe('DELETE /api/org/producers/:producerId/farms/:linkId', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 on successful delete', async () => {
      mockedService.deleteFarmLink.mockResolvedValue({
        message: 'Vínculo removido com sucesso',
      } as never);

      const response = await request(app)
        .delete('/api/org/producers/prod-1/farms/link-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Vínculo removido com sucesso');
      expect(mockedAudit.logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_PRODUCER_FARM_LINK' }),
      );
    });
  });

  // ─── Reverse: Farm → Producers ────────────────────────────────────

  describe('GET /api/org/farms/:farmId/producers', () => {
    beforeEach(() => authAs(ADMIN_PAYLOAD));

    it('should return 200 with producers for farm', async () => {
      const links = [
        {
          id: 'link-1',
          bondType: 'PROPRIETARIO',
          producer: { id: 'prod-1', name: 'João', type: 'PF' },
        },
      ];
      mockedService.getProducersByFarm.mockResolvedValue(links as never);

      const response = await request(app)
        .get('/api/org/farms/farm-1/producers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].producer.name).toBe('João');
    });

    it('should return 404 when farm not found', async () => {
      mockedService.getProducersByFarm.mockRejectedValue(
        new ProducerError('Fazenda não encontrada', 404),
      );

      const response = await request(app)
        .get('/api/org/farms/non-existent/producers')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });
});
