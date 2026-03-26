// ─── eSocial Events Service — Tests ──────────────────────────────────────────
// Tests for service state machine, generate, download (XSD gate), reprocess,
// S-1299 guard, dashboard, and listing.

import { prisma } from '../../database/prisma';
import {
  generateEvent,
  downloadEvent,
  updateStatus,
  reprocessEvent,
  getDashboard,
  listEvents,
} from './esocial-events.service';
import type { EsocialStatus, EsocialGroup } from '@prisma/client';

// ─── Mock prisma ─────────────────────────────────────────────────────────────

jest.mock('../../database/prisma', () => ({
  prisma: {
    esocialEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    employee: {
      findFirst: jest.fn(),
    },
    payrollRunItem: {
      findFirst: jest.fn(),
    },
    payrollRun: {
      findFirst: jest.fn(),
    },
    medicalExam: {
      findFirst: jest.fn(),
    },
    employeeAbsence: {
      findFirst: jest.fn(),
    },
    employeeTermination: {
      findFirst: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
    farm: {
      findFirst: jest.fn(),
    },
    payrollRubrica: {
      findFirst: jest.fn(),
    },
    position: {
      findFirst: jest.fn(),
    },
    contractAmendment: {
      findFirst: jest.fn(),
    },
    epiDelivery: {
      findFirst: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Test data ───────────────────────────────────────────────────────────────

const orgId = 'org-001';
const userId = 'user-001';

const mockOrg = {
  id: orgId,
  name: 'Fazenda Boa Vista Ltda',
  cnpj: '12345678000195',
  cnae: '0111301',
};

const mockEmployee = {
  id: 'emp-001',
  name: 'José da Silva',
  cpf: '12345678901',
  pisPassep: '12345678901',
  birthDate: new Date('1985-06-15'),
  admissionDate: new Date('2024-01-02'),
  organizationId: orgId,
  contracts: [{
    salary: 3000,
    weeklyHours: 44,
    contractType: 'CLT_INDETERMINATE',
    isActive: true,
    position: { id: 'pos-001', name: 'Operador', cbo: '612210' },
  }],
  farms: [{ farmId: 'farm-001', status: 'ATIVO' }],
};

const mockPayrollRunItem = {
  id: 'item-001',
  payrollRunId: 'run-001',
  employeeId: 'emp-001',
  lineItemsJson: JSON.stringify([
    { code: '0001', description: 'Salário Base', type: 'PROVENTO', value: '3000.00', eSocialCode: '1100' },
  ]),
  employee: mockEmployee,
  payrollRun: {
    id: 'run-001',
    referenceMonth: new Date('2024-03-01'),
    organizationId: orgId,
    organization: mockOrg,
  },
};

const mockEsocialEventPendente = {
  id: 'event-001',
  organizationId: orgId,
  eventType: 'S-2200',
  eventGroup: 'NAO_PERIODICO' as EsocialGroup,
  referenceMonth: null,
  sourceType: 'EMPLOYEE',
  sourceId: 'emp-001',
  status: 'PENDENTE' as EsocialStatus,
  version: 1,
  xmlContent: '<?xml version="1.0" encoding="UTF-8"?><eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00"><evtAdmissao Id="ID11234567800019520240101000000000001"><ideEvento><indRetif>1</indRetif><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento><ideEmpregador><tpInsc>1</tpInsc><nrInsc>12345678</nrInsc></ideEmpregador><trabalhador><cpfTrab>12345678901</cpfTrab><nisTrab>12345678901</nisTrab><nmTrab>José da Silva</nmTrab></trabalhador><vinculo><dtAdm>2024-01-02</dtAdm><codCBO>612210</codCBO><remuneracao><vrSalFx>3000.00</vrSalFx><undSalFixo>5</undSalFixo></remuneracao></vinculo></evtAdmissao></eSocial>',
  rejectionReason: null,
  exportedAt: null,
  acceptedAt: null,
  rejectedAt: null,
  createdBy: userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEsocialEventExportado = {
  ...mockEsocialEventPendente,
  id: 'event-002',
  status: 'EXPORTADO' as EsocialStatus,
  exportedAt: new Date(),
};

const mockEsocialEventRejeitado = {
  ...mockEsocialEventPendente,
  id: 'event-003',
  status: 'REJEITADO' as EsocialStatus,
  rejectionReason: 'CPF inválido',
  rejectedAt: new Date(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EsocialEventsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.organization.findFirst as jest.Mock).mockResolvedValue(mockOrg);
    (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue(mockEmployee);
    (mockPrisma.payrollRunItem.findFirst as jest.Mock).mockResolvedValue(mockPayrollRunItem);
  });

  // ─── generateEvent ─────────────────────────────────────────────────────────

  describe('generateEvent', () => {
    it('creates EsocialEvent with PENDENTE status and xmlContent for S-2200', async () => {
      (mockPrisma.esocialEvent.create as jest.Mock).mockResolvedValue(mockEsocialEventPendente);

      const result = await generateEvent(
        orgId,
        { eventType: 'S-2200', sourceType: 'EMPLOYEE', sourceId: 'emp-001' },
        userId,
      );

      expect(mockPrisma.esocialEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDENTE',
            version: 1,
            organizationId: orgId,
            eventType: 'S-2200',
          }),
        }),
      );
      expect(result.status).toBe('PENDENTE');
    });

    it('returns validationErrors without creating event when employee has no PIS', async () => {
      (mockPrisma.employee.findFirst as jest.Mock).mockResolvedValue({
        ...mockEmployee,
        pisPassep: null,
      });

      const result = await generateEvent(
        orgId,
        { eventType: 'S-2200', sourceType: 'EMPLOYEE', sourceId: 'emp-001' },
        userId,
      );

      expect(mockPrisma.esocialEvent.create).not.toHaveBeenCalled();
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.some((e) => e.field === 'nisTrab')).toBe(true);
    });

    it('generates S-1200 from PayrollRunItem.lineItemsJson', async () => {
      (mockPrisma.esocialEvent.create as jest.Mock).mockResolvedValue({
        ...mockEsocialEventPendente,
        eventType: 'S-1200',
        eventGroup: 'PERIODICO' as EsocialGroup,
        sourceType: 'PAYROLL_RUN_ITEM',
        sourceId: 'item-001',
      });

      const result = await generateEvent(
        orgId,
        { eventType: 'S-1200', sourceType: 'PAYROLL_RUN_ITEM', sourceId: 'item-001', referenceMonth: '2024-03' },
        userId,
      );

      expect(result.eventType).toBe('S-1200');
    });
  });

  // ─── downloadEvent ─────────────────────────────────────────────────────────

  describe('downloadEvent (XSD gate per D-06)', () => {
    it('transitions from PENDENTE to EXPORTADO when XSD validation passes', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(mockEsocialEventPendente);
      (mockPrisma.esocialEvent.update as jest.Mock).mockResolvedValue({
        ...mockEsocialEventPendente,
        status: 'EXPORTADO',
        exportedAt: new Date(),
      });

      const result = await downloadEvent(orgId, 'event-001');

      expect(result.status).toBe('EXPORTADO');
      expect(result.xmlContent).toBeDefined();
    });

    it('blocks download and returns XSD errors if XML fails validation (per D-06)', async () => {
      // Event with malformed XML (missing cpfTrab)
      const eventWithInvalidXml = {
        ...mockEsocialEventPendente,
        xmlContent: '<?xml version="1.0" encoding="UTF-8"?><eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00"><evtAdmissao Id="ID1"><ideEvento><indRetif>1</indRetif><procEmi>1</procEmi><verProc>1.0</verProc></ideEvento></evtAdmissao></eSocial>',
      };
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(eventWithInvalidXml);

      const result = await downloadEvent(orgId, 'event-001');

      expect(mockPrisma.esocialEvent.update).not.toHaveBeenCalled(); // status not changed
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('returns 404 when event not found', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(downloadEvent(orgId, 'nonexistent')).rejects.toThrow();
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus (state machine)', () => {
    it('transitions EXPORTADO to ACEITO and sets acceptedAt', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(mockEsocialEventExportado);
      (mockPrisma.esocialEvent.update as jest.Mock).mockResolvedValue({
        ...mockEsocialEventExportado,
        status: 'ACEITO',
        acceptedAt: new Date(),
      });

      const result = await updateStatus(orgId, 'event-002', { status: 'ACEITO' });

      expect(result.status).toBe('ACEITO');
    });

    it('fails when transitioning PENDENTE to ACEITO (invalid transition)', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(mockEsocialEventPendente);

      await expect(
        updateStatus(orgId, 'event-001', { status: 'ACEITO' }),
      ).rejects.toThrow();
    });

    it('stores rejectionReason when transitioning to REJEITADO', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(mockEsocialEventExportado);
      (mockPrisma.esocialEvent.update as jest.Mock).mockResolvedValue({
        ...mockEsocialEventExportado,
        status: 'REJEITADO',
        rejectionReason: 'CPF inválido',
        rejectedAt: new Date(),
      });

      const result = await updateStatus(orgId, 'event-002', {
        status: 'REJEITADO',
        rejectionReason: 'CPF inválido',
      });

      expect(result.status).toBe('REJEITADO');
      expect(result.rejectionReason).toBe('CPF inválido');
    });
  });

  // ─── reprocessEvent ────────────────────────────────────────────────────────

  describe('reprocessEvent', () => {
    it('creates new event with version+1 from REJEITADO (per D-11)', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(mockEsocialEventRejeitado);
      (mockPrisma.esocialEvent.create as jest.Mock).mockResolvedValue({
        ...mockEsocialEventPendente,
        id: 'event-004',
        version: 2,
        status: 'PENDENTE',
      });

      const result = await reprocessEvent(orgId, 'event-003', userId);

      expect(mockPrisma.esocialEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: 2,
            status: 'PENDENTE',
          }),
        }),
      );
      expect(result.version).toBe(2);
    });

    it('fails when event is not REJEITADO', async () => {
      (mockPrisma.esocialEvent.findFirst as jest.Mock).mockResolvedValue(mockEsocialEventPendente);

      await expect(reprocessEvent(orgId, 'event-001', userId)).rejects.toThrow();
    });
  });

  // ─── S-1299 guard ──────────────────────────────────────────────────────────

  describe('S-1299 guard (per Pitfall 5)', () => {
    it('blocks S-1299 generation when S-1200 events are still PENDENTE for same period', async () => {
      // Simulate S-1200 events still in PENDENTE for March 2024
      (mockPrisma.esocialEvent.findMany as jest.Mock).mockResolvedValue([
        { id: 's1200-001', status: 'PENDENTE', eventType: 'S-1200' },
      ]);
      (mockPrisma.payrollRun.findFirst as jest.Mock).mockResolvedValue({
        id: 'run-001',
        referenceMonth: new Date('2024-03-01'),
        organization: mockOrg,
      });

      const result = await generateEvent(
        orgId,
        { eventType: 'S-1299', sourceType: 'PAYROLL_RUN', sourceId: 'run-001', referenceMonth: '2024-03' },
        userId,
      );

      expect(mockPrisma.esocialEvent.create).not.toHaveBeenCalled();
      expect(result.validationErrors?.some((e) => e.message.includes('S-1200'))).toBe(true);
    });
  });

  // ─── getDashboard ──────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns counts by status and group for reference month', async () => {
      (mockPrisma.esocialEvent.findMany as jest.Mock).mockResolvedValue([
        { status: 'PENDENTE', eventGroup: 'NAO_PERIODICO' },
        { status: 'EXPORTADO', eventGroup: 'PERIODICO' },
        { status: 'ACEITO', eventGroup: 'PERIODICO' },
        { status: 'REJEITADO', eventGroup: 'NAO_PERIODICO' },
      ]);

      const result = await getDashboard(orgId, '2024-03');

      expect(result.total).toBe(4);
      expect(result.pendente).toBe(1);
      expect(result.exportado).toBe(1);
      expect(result.aceito).toBe(1);
      expect(result.rejeitado).toBe(1);
      expect(result.byGroup).toBeDefined();
    });
  });

  // ─── listEvents ────────────────────────────────────────────────────────────

  describe('listEvents', () => {
    it('filters by eventGroup', async () => {
      (mockPrisma.esocialEvent.findMany as jest.Mock).mockResolvedValue([mockEsocialEventPendente]);
      (mockPrisma.esocialEvent.count as jest.Mock).mockResolvedValue(1);

      const result = await listEvents(orgId, { eventGroup: 'NAO_PERIODICO' });

      expect(mockPrisma.esocialEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventGroup: 'NAO_PERIODICO' }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('filters by status', async () => {
      (mockPrisma.esocialEvent.findMany as jest.Mock).mockResolvedValue([mockEsocialEventPendente]);
      (mockPrisma.esocialEvent.count as jest.Mock).mockResolvedValue(1);

      await listEvents(orgId, { status: 'PENDENTE' });

      expect(mockPrisma.esocialEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDENTE' }),
        }),
      );
    });
  });
});
