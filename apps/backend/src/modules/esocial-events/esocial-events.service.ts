// ─── eSocial Events Service ───────────────────────────────────────────────────
// Full lifecycle: generate (with pre-validation), download (XSD gate per D-06),
// update status (state machine), reprocess (version increment per D-11),
// S-1299 guard (per Pitfall 5), dashboard aggregation, and listing.

import { prisma } from '../../database/prisma';
import { getBuilder, getValidator, validateXmlAgainstXsd } from './esocial-builders/index';
import {
  EsocialEventError,
  VALID_ESOCIAL_TRANSITIONS,
  EVENT_GROUP_MAP,
  SOURCE_TYPE_MAP,
} from './esocial-events.types';
import type {
  EsocialEventOutput,
  EsocialDashboardOutput,
  EsocialValidationError,
  GenerateEsocialEventInput,
  ListEsocialEventsQuery,
  UpdateEsocialStatusInput,
} from './esocial-events.types';
import type { EsocialGroup, EsocialStatus } from '@prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapEvent(row: Record<string, unknown>): EsocialEventOutput {
  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    eventType: row.eventType as string,
    eventGroup: row.eventGroup as EsocialGroup,
    referenceMonth: row.referenceMonth
      ? (row.referenceMonth instanceof Date
          ? row.referenceMonth.toISOString().slice(0, 7)
          : String(row.referenceMonth))
      : null,
    sourceType: row.sourceType as string,
    sourceId: row.sourceId as string,
    status: row.status as EsocialStatus,
    version: row.version as number,
    xmlContent: (row.xmlContent as string) ?? null,
    rejectionReason: (row.rejectionReason as string) ?? null,
    exportedAt: row.exportedAt
      ? (row.exportedAt instanceof Date ? row.exportedAt.toISOString() : String(row.exportedAt))
      : null,
    acceptedAt: row.acceptedAt
      ? (row.acceptedAt instanceof Date ? row.acceptedAt.toISOString() : String(row.acceptedAt))
      : null,
    rejectedAt: row.rejectedAt
      ? (row.rejectedAt instanceof Date ? row.rejectedAt.toISOString() : String(row.rejectedAt))
      : null,
    createdBy: row.createdBy as string,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

/**
 * Load source data based on sourceType for the given sourceId.
 * Returns a data object ready to be passed to the builder.
 */
async function loadSourceData(
  orgId: string,
  eventType: string,
  sourceType: string,
  sourceId: string,
): Promise<Record<string, unknown>> {
  const org = await prisma.organization.findFirst({ where: { id: orgId } });
  if (!org) throw new EsocialEventError('Organização não encontrada', 404);

  switch (sourceType) {
    case 'EMPLOYEE': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const employee = await (prisma.employee as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
        include: {
          contracts: {
            where: { isActive: true },
            include: { position: true },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
          farms: {
            where: { status: 'ATIVO' },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
        },
      });
      if (!employee) throw new EsocialEventError('Colaborador não encontrado', 404);
      const contract = employee.contracts?.[0] ?? { salary: 0, weeklyHours: 44 };
      const position = contract.position ?? { id: '', name: '', cbo: null };
      return { employee, contract, position, organization: org };
    }

    case 'PAYROLL_RUN_ITEM': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = await (prisma.payrollRunItem as any).findFirst({
        where: { id: sourceId },
        include: {
          employee: { include: { contracts: { where: { isActive: true }, orderBy: { startDate: 'desc' }, take: 1 } } },
          payrollRun: { include: { organization: true } },
        },
      });
      if (!item) throw new EsocialEventError('Item de folha não encontrado', 404);
      return { item, employee: item.employee, organization: org };
    }

    case 'PAYROLL_RUN': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const run = await (prisma.payrollRun as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
        include: { organization: true },
      });
      if (!run) throw new EsocialEventError('Folha de pagamento não encontrada', 404);
      return { payrollRun: run, organization: org };
    }

    case 'MEDICAL_EXAM': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exam = await (prisma.medicalExam as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
        include: { employee: true },
      });
      if (!exam) throw new EsocialEventError('Exame médico não encontrado', 404);
      return { exam, employee: exam.employee, organization: org };
    }

    case 'EMPLOYEE_ABSENCE': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const absence = await (prisma.employeeAbsence as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
        include: { employee: true },
      });
      if (!absence) throw new EsocialEventError('Afastamento não encontrado', 404);
      return { absence, employee: absence.employee, organization: org };
    }

    case 'EMPLOYEE_TERMINATION': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const termination = await (prisma.employeeTermination as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
        include: { employee: true },
      });
      if (!termination) throw new EsocialEventError('Rescisão não encontrada', 404);
      return { termination, employee: termination.employee, organization: org };
    }

    case 'ORGANIZATION': {
      return { organization: org };
    }

    case 'FARM': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const farm = await (prisma.farm as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
      });
      if (!farm) throw new EsocialEventError('Fazenda não encontrada', 404);
      return { farm, organization: org };
    }

    case 'PAYROLL_RUBRICA': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rubrica = await (prisma.payrollRubrica as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
      });
      if (!rubrica) throw new EsocialEventError('Rubrica não encontrada', 404);
      return { rubrica, organization: org };
    }

    case 'POSITION': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const position = await (prisma.position as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
      });
      if (!position) throw new EsocialEventError('Cargo não encontrado', 404);
      return { position, organization: org };
    }

    case 'CONTRACT_AMENDMENT': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const amendment = await (prisma.contractAmendment as any).findFirst({
        where: { id: sourceId },
        include: {
          contract: {
            include: {
              employee: true,
              position: true,
            },
          },
        },
      });
      if (!amendment) throw new EsocialEventError('Aditivo de contrato não encontrado', 404);
      return {
        amendment,
        employee: amendment.contract?.employee,
        contract: amendment.contract,
        position: amendment.contract?.position,
        organization: org,
      };
    }

    case 'EPI_DELIVERY': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delivery = await (prisma.epiDelivery as any).findFirst({
        where: { id: sourceId, organizationId: orgId },
        include: { employee: true },
      });
      if (!delivery) throw new EsocialEventError('Entrega de EPI não encontrada', 404);
      return { epiDelivery: delivery, employee: delivery.employee, organization: org };
    }

    default:
      throw new EsocialEventError(`Tipo de fonte desconhecido: ${sourceType}`, 400);
  }
}

// ─── generateEvent ───────────────────────────────────────────────────────────

export async function generateEvent(
  orgId: string,
  input: GenerateEsocialEventInput,
  userId: string,
): Promise<EsocialEventOutput & { validationErrors?: EsocialValidationError[] }> {
  const { eventType, sourceType, sourceId, referenceMonth } = input;

  const eventGroup = EVENT_GROUP_MAP[eventType];
  if (!eventGroup) {
    throw new EsocialEventError(`Tipo de evento desconhecido: ${eventType}`, 400);
  }

  // ─── S-1299 guard (per Pitfall 5) ─────────────────────────────────────────
  if (eventType === 'S-1299') {
    if (!referenceMonth) {
      return {
        id: '',
        organizationId: orgId,
        eventType,
        eventGroup,
        referenceMonth: null,
        sourceType,
        sourceId,
        status: 'PENDENTE',
        version: 1,
        xmlContent: null,
        rejectionReason: null,
        exportedAt: null,
        acceptedAt: null,
        rejectedAt: null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validationErrors: [{ field: 'referenceMonth', message: 'Competência (referenceMonth) é obrigatória para S-1299' }],
      };
    }

    // Parse referenceMonth (e.g. "2024-03" → Date)
    const [yearStr, monthStr] = referenceMonth.split('-');
    const refDate = new Date(Date.UTC(parseInt(yearStr ?? '2024'), parseInt(monthStr ?? '1') - 1, 1));

    // Check for any PENDENTE S-1200 or S-1210 for the same period + org
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingPeriodic = await (prisma.esocialEvent as any).findMany({
      where: {
        organizationId: orgId,
        eventType: { in: ['S-1200', 'S-1210'] },
        status: 'PENDENTE',
        referenceMonth: refDate,
      },
    });

    if (pendingPeriodic.length > 0) {
      return {
        id: '',
        organizationId: orgId,
        eventType,
        eventGroup,
        referenceMonth: referenceMonth ?? null,
        sourceType,
        sourceId,
        status: 'PENDENTE',
        version: 1,
        xmlContent: null,
        rejectionReason: null,
        exportedAt: null,
        acceptedAt: null,
        rejectedAt: null,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validationErrors: [{
          field: 'S-1299',
          message: `Exporte todos os eventos S-1200/S-1210 da competencia antes de gerar o S-1299. Encontrado(s) ${pendingPeriodic.length} evento(s) PENDENTE(s).`,
        }],
      };
    }
  }

  // ─── Load source data ──────────────────────────────────────────────────────
  const resolvedSourceType = sourceType || SOURCE_TYPE_MAP[eventType] || sourceType;
  const data = await loadSourceData(orgId, eventType, resolvedSourceType, sourceId);

  // ─── Pre-generation validation ─────────────────────────────────────────────
  const validator = getValidator(eventType);
  const validationErrors = validator ? validator(data) : [];

  if (validationErrors.length > 0) {
    return {
      id: '',
      organizationId: orgId,
      eventType,
      eventGroup,
      referenceMonth: referenceMonth ?? null,
      sourceType: resolvedSourceType,
      sourceId,
      status: 'PENDENTE',
      version: 1,
      xmlContent: null,
      rejectionReason: null,
      exportedAt: null,
      acceptedAt: null,
      rejectedAt: null,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validationErrors,
    };
  }

  // ─── Build XML ─────────────────────────────────────────────────────────────
  const builder = getBuilder(eventType);
  if (!builder) {
    throw new EsocialEventError(`Builder não encontrado para: ${eventType}`, 500);
  }
  const xmlContent = builder(data);

  // ─── Resolve referenceMonth to Date for DB ─────────────────────────────────
  let referenceMonthDate: Date | null = null;
  if (referenceMonth) {
    const [y, m] = referenceMonth.split('-');
    referenceMonthDate = new Date(Date.UTC(parseInt(y ?? '2024'), parseInt(m ?? '1') - 1, 1));
  }

  // ─── Create record ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await (prisma.esocialEvent as any).create({
    data: {
      organizationId: orgId,
      eventType,
      eventGroup,
      referenceMonth: referenceMonthDate,
      sourceType: resolvedSourceType,
      sourceId,
      status: 'PENDENTE',
      version: 1,
      xmlContent,
      createdBy: userId,
    },
  });

  return mapEvent(created as Record<string, unknown>);
}

// ─── generateBatch ────────────────────────────────────────────────────────────

export async function generateBatch(
  orgId: string,
  eventType: string,
  referenceMonth?: string,
  userId?: string,
): Promise<Array<EsocialEventOutput & { validationErrors?: EsocialValidationError[] }>> {
  const results: Array<EsocialEventOutput & { validationErrors?: EsocialValidationError[] }> = [];
  const uid = userId ?? 'system';

  if (eventType === 'S-1200' || eventType === 'S-1210') {
    // Generate one event per PayrollRunItem for the reference month
    if (!referenceMonth) return results;

    const [y, m] = referenceMonth.split('-');
    const refDate = new Date(Date.UTC(parseInt(y ?? '2024'), parseInt(m ?? '1') - 1, 1));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await (prisma.payrollRunItem as any).findMany({
      where: {
        payrollRun: {
          organizationId: orgId,
          referenceMonth: refDate,
          status: 'COMPLETED',
        },
        status: 'CALCULATED',
      },
      select: { id: true },
    });

    for (const item of items) {
      const result = await generateEvent(
        orgId,
        { eventType, sourceType: 'PAYROLL_RUN_ITEM', sourceId: item.id, referenceMonth },
        uid,
      );
      results.push(result);
    }
  } else if (eventType === 'S-1299') {
    // Generate one closing event per payroll run for the reference month
    if (!referenceMonth) return results;

    const [y, m] = referenceMonth.split('-');
    const refDate = new Date(Date.UTC(parseInt(y ?? '2024'), parseInt(m ?? '1') - 1, 1));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = await (prisma.payrollRun as any).findMany({
      where: { organizationId: orgId, referenceMonth: refDate, status: 'COMPLETED' },
      select: { id: true },
    });

    for (const run of runs) {
      const result = await generateEvent(
        orgId,
        { eventType: 'S-1299', sourceType: 'PAYROLL_RUN', sourceId: run.id, referenceMonth },
        uid,
      );
      results.push(result);
    }
  }

  return results;
}

// ─── listEvents ───────────────────────────────────────────────────────────────

export async function listEvents(
  orgId: string,
  query: ListEsocialEventsQuery,
): Promise<{ data: EsocialEventOutput[]; total: number; page: number; limit: number }> {
  const { eventGroup, eventType, status, referenceMonth, page = 1, limit = 20 } = query;

  const where: Record<string, unknown> = { organizationId: orgId };
  if (eventGroup) where.eventGroup = eventGroup;
  if (eventType) where.eventType = eventType;
  if (status) where.status = status;

  if (referenceMonth) {
    const [y, m] = referenceMonth.split('-');
    where.referenceMonth = new Date(Date.UTC(parseInt(y ?? '2024'), parseInt(m ?? '1') - 1, 1));
  }

  const [rows, total] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.esocialEvent as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.esocialEvent as any).count({ where }),
  ]);

  return {
    data: (rows as Record<string, unknown>[]).map(mapEvent),
    total,
    page,
    limit,
  };
}

// ─── downloadEvent (per D-06 — XSD validation gate) ──────────────────────────

export async function downloadEvent(
  orgId: string,
  eventId: string,
): Promise<EsocialEventOutput & { validationErrors?: EsocialValidationError[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = await (prisma.esocialEvent as any).findFirst({
    where: { id: eventId, organizationId: orgId },
  });

  if (!event) throw new EsocialEventError('Evento eSocial não encontrado', 404);

  if (!event.xmlContent) {
    throw new EsocialEventError('Evento sem XML gerado — gere o evento primeiro', 400);
  }

  // ─── XSD validation gate (per D-06) ─────────────────────────────────────
  const xsdErrors = validateXmlAgainstXsd(event.eventType, event.xmlContent);
  if (xsdErrors.length > 0) {
    // Block download — return errors without transitioning status
    return {
      ...mapEvent(event as Record<string, unknown>),
      validationErrors: xsdErrors,
    };
  }

  // ─── Transition to EXPORTADO ─────────────────────────────────────────────
  const transition = VALID_ESOCIAL_TRANSITIONS['EXPORT'];
  const currentStatus = event.status as string;
  if (!transition?.[currentStatus]) {
    // Allow download if already EXPORTADO
    if (currentStatus === 'EXPORTADO') {
      return mapEvent(event as Record<string, unknown>);
    }
    throw new EsocialEventError(
      `Transição inválida: não é possível exportar evento com status '${currentStatus}'`,
      400,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.esocialEvent as any).update({
    where: { id: eventId },
    data: { status: 'EXPORTADO', exportedAt: new Date() },
  });

  return mapEvent(updated as Record<string, unknown>);
}

// ─── downloadBatch ────────────────────────────────────────────────────────────

export async function downloadBatch(
  orgId: string,
  query: { referenceMonth?: string; eventGroup?: string; eventType?: string },
): Promise<{
  validEvents: EsocialEventOutput[];
  invalidEvents: Array<EsocialEventOutput & { validationErrors: EsocialValidationError[] }>;
}> {
  const where: Record<string, unknown> = { organizationId: orgId, status: 'PENDENTE' };
  if (query.eventGroup) where.eventGroup = query.eventGroup;
  if (query.eventType) where.eventType = query.eventType;
  if (query.referenceMonth) {
    const [y, m] = query.referenceMonth.split('-');
    where.referenceMonth = new Date(Date.UTC(parseInt(y ?? '2024'), parseInt(m ?? '1') - 1, 1));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = await (prisma.esocialEvent as any).findMany({ where });

  const validEvents: EsocialEventOutput[] = [];
  const invalidEvents: Array<EsocialEventOutput & { validationErrors: EsocialValidationError[] }> = [];

  for (const event of events as Record<string, unknown>[]) {
    const xmlContent = event.xmlContent as string;
    if (!xmlContent) {
      invalidEvents.push({
        ...mapEvent(event),
        validationErrors: [{ field: 'xmlContent', message: 'XML não gerado' }],
      });
      continue;
    }

    const xsdErrors = validateXmlAgainstXsd(event.eventType as string, xmlContent);
    if (xsdErrors.length > 0) {
      invalidEvents.push({ ...mapEvent(event), validationErrors: xsdErrors });
    } else {
      // Transition to EXPORTADO
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (prisma.esocialEvent as any).update({
        where: { id: event.id },
        data: { status: 'EXPORTADO', exportedAt: new Date() },
      });
      validEvents.push(mapEvent(updated as Record<string, unknown>));
    }
  }

  return { validEvents, invalidEvents };
}

// ─── updateStatus ─────────────────────────────────────────────────────────────

export async function updateStatus(
  orgId: string,
  eventId: string,
  input: UpdateEsocialStatusInput,
): Promise<EsocialEventOutput> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = await (prisma.esocialEvent as any).findFirst({
    where: { id: eventId, organizationId: orgId },
  });

  if (!event) throw new EsocialEventError('Evento eSocial não encontrado', 404);

  const { status, rejectionReason } = input;

  // Validate state machine transition
  const action = status === 'ACEITO' ? 'ACCEPT' : 'REJECT';
  const transition = VALID_ESOCIAL_TRANSITIONS[action];
  const currentStatus = event.status as string;

  if (!transition?.[currentStatus]) {
    throw new EsocialEventError(
      `Transição inválida: não é possível marcar como ${status} um evento com status '${currentStatus}'`,
      400,
    );
  }

  if (status === 'REJEITADO' && !rejectionReason) {
    throw new EsocialEventError('Motivo da rejeição é obrigatório', 400);
  }

  const updateData: Record<string, unknown> = { status };
  if (status === 'ACEITO') updateData.acceptedAt = new Date();
  if (status === 'REJEITADO') {
    updateData.rejectedAt = new Date();
    updateData.rejectionReason = rejectionReason;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = await (prisma.esocialEvent as any).update({
    where: { id: eventId },
    data: updateData,
  });

  return mapEvent(updated as Record<string, unknown>);
}

// ─── reprocessEvent (per D-11) ────────────────────────────────────────────────

export async function reprocessEvent(
  orgId: string,
  eventId: string,
  userId: string,
): Promise<EsocialEventOutput & { validationErrors?: EsocialValidationError[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = await (prisma.esocialEvent as any).findFirst({
    where: { id: eventId, organizationId: orgId },
  });

  if (!event) throw new EsocialEventError('Evento eSocial não encontrado', 404);

  // Validate: must be REJEITADO to reprocess
  const transition = VALID_ESOCIAL_TRANSITIONS['REPROCESS'];
  if (!transition?.[event.status as string]) {
    throw new EsocialEventError(
      `Reprocessamento apenas disponível para eventos REJEITADOS (atual: ${event.status})`,
      400,
    );
  }

  // Load current source data (may have been corrected since original generation)
  const data = await loadSourceData(orgId, event.eventType, event.sourceType, event.sourceId);

  // Run validation again
  const validator = getValidator(event.eventType);
  const validationErrors = validator ? validator(data) : [];

  if (validationErrors.length > 0) {
    return {
      ...mapEvent(event as Record<string, unknown>),
      validationErrors,
    };
  }

  // Build new XML with corrected data
  const builder = getBuilder(event.eventType);
  if (!builder) throw new EsocialEventError(`Builder não encontrado para: ${event.eventType}`, 500);
  const xmlContent = builder(data);

  // Create NEW event record with version+1 (old record preserved for history per D-11)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newEvent = await (prisma.esocialEvent as any).create({
    data: {
      organizationId: orgId,
      eventType: event.eventType,
      eventGroup: event.eventGroup,
      referenceMonth: event.referenceMonth,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      status: 'PENDENTE',
      version: (event.version as number) + 1,
      xmlContent,
      createdBy: userId,
    },
  });

  return mapEvent(newEvent as Record<string, unknown>);
}

// ─── getDashboard ─────────────────────────────────────────────────────────────

export async function getDashboard(
  orgId: string,
  referenceMonth: string,
): Promise<EsocialDashboardOutput> {
  // Parse referenceMonth
  const [y, m] = referenceMonth.split('-');
  const refDate = new Date(Date.UTC(parseInt(y ?? '2024'), parseInt(m ?? '1') - 1, 1));

  // Fetch all events for this period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = await (prisma.esocialEvent as any).findMany({
    where: {
      organizationId: orgId,
      OR: [
        { referenceMonth: refDate },
        { referenceMonth: null }, // table events have no referenceMonth
      ],
    },
    select: { status: true, eventGroup: true },
  }) as Array<{ status: string; eventGroup: string }>;

  const total = events.length;
  const pendente = events.filter((e) => e.status === 'PENDENTE').length;
  const exportado = events.filter((e) => e.status === 'EXPORTADO').length;
  const aceito = events.filter((e) => e.status === 'ACEITO').length;
  const rejeitado = events.filter((e) => e.status === 'REJEITADO').length;

  const groups: EsocialGroup[] = ['TABELA', 'NAO_PERIODICO', 'PERIODICO', 'SST'];
  const byGroup = {} as EsocialDashboardOutput['byGroup'];

  for (const grp of groups) {
    const grpEvents = events.filter((e) => e.eventGroup === grp);
    byGroup[grp] = {
      total: grpEvents.length,
      pendente: grpEvents.filter((e) => e.status === 'PENDENTE').length,
      exportado: grpEvents.filter((e) => e.status === 'EXPORTADO').length,
      aceito: grpEvents.filter((e) => e.status === 'ACEITO').length,
      rejeitado: grpEvents.filter((e) => e.status === 'REJEITADO').length,
    };
  }

  return { referenceMonth, total, pendente, exportado, aceito, rejeitado, byGroup };
}
