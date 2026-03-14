import type {
  AdministrationRoute,
  AnimalCategory,
  CalendarFrequency,
  DosageUnit,
  SanitaryEventTrigger,
  SanitaryProcedureType,
  SanitaryProtocolStatus,
  SanitaryTriggerType,
} from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  SanitaryProtocolError,
  PROCEDURE_TYPES,
  PROCEDURE_TYPE_LABELS,
  TRIGGER_TYPES,
  TRIGGER_TYPE_LABELS,
  EVENT_TRIGGERS,
  EVENT_TRIGGER_LABELS,
  CALENDAR_FREQUENCIES,
  CALENDAR_FREQUENCY_LABELS,
  SANITARY_PROTOCOL_STATUSES,
  SANITARY_PROTOCOL_STATUS_LABELS,
  TARGET_CATEGORIES,
  TARGET_CATEGORY_LABELS,
  type CreateSanitaryProtocolInput,
  type UpdateSanitaryProtocolInput,
  type ListSanitaryProtocolsQuery,
  type SanitaryProtocolResponse,
  type ProtocolItemResponse,
  type ItemInput,
  SEED_SANITARY_PROTOCOLS,
} from './sanitary-protocols.types';
import {
  ADMINISTRATION_ROUTE_LABELS,
  DOSAGE_UNIT_LABELS,
} from '../treatment-protocols/treatment-protocols.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toItemResponse(row: Record<string, unknown>): ProtocolItemResponse {
  const procedureType = row.procedureType as string;
  const dosageUnit = (row.dosageUnit as string) ?? null;
  const administrationRoute = (row.administrationRoute as string) ?? null;
  const triggerType = row.triggerType as string;
  const triggerEvent = (row.triggerEvent as string) ?? null;
  const calendarFrequency = (row.calendarFrequency as string) ?? null;

  return {
    id: row.id as string,
    order: row.order as number,
    procedureType,
    procedureTypeLabel: PROCEDURE_TYPE_LABELS[procedureType] ?? procedureType,
    productId: (row.productId as string) ?? null,
    productName: row.productName as string,
    dosage: (row.dosage as number) ?? null,
    dosageUnit,
    dosageUnitLabel: dosageUnit ? (DOSAGE_UNIT_LABELS[dosageUnit] ?? dosageUnit) : null,
    administrationRoute,
    administrationRouteLabel: administrationRoute
      ? (ADMINISTRATION_ROUTE_LABELS[administrationRoute] ?? administrationRoute)
      : null,
    triggerType,
    triggerTypeLabel: TRIGGER_TYPE_LABELS[triggerType] ?? triggerType,
    triggerAgeDays: (row.triggerAgeDays as number) ?? null,
    triggerAgeMaxDays: (row.triggerAgeMaxDays as number) ?? null,
    triggerEvent,
    triggerEventLabel: triggerEvent ? (EVENT_TRIGGER_LABELS[triggerEvent] ?? triggerEvent) : null,
    triggerEventOffsetDays: (row.triggerEventOffsetDays as number) ?? null,
    calendarFrequency,
    calendarFrequencyLabel: calendarFrequency
      ? (CALENDAR_FREQUENCY_LABELS[calendarFrequency] ?? calendarFrequency)
      : null,
    calendarMonths: (row.calendarMonths as number[]) ?? [],
    isReinforcement: (row.isReinforcement as boolean) ?? false,
    reinforcementIntervalDays: (row.reinforcementIntervalDays as number) ?? null,
    reinforcementDoseNumber: (row.reinforcementDoseNumber as number) ?? null,
    withdrawalMeatDays: (row.withdrawalMeatDays as number) ?? null,
    withdrawalMilkDays: (row.withdrawalMilkDays as number) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

function toResponse(row: Record<string, unknown>): SanitaryProtocolResponse {
  const status = row.status as string;
  const targetCategories = (row.targetCategories as string[]) ?? [];
  const items = (row.items as Record<string, unknown>[]) ?? [];

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    authorName: row.authorName as string,
    status,
    statusLabel: SANITARY_PROTOCOL_STATUS_LABELS[status] ?? status,
    version: row.version as number,
    originalId: (row.originalId as string) ?? null,
    isObligatory: (row.isObligatory as boolean) ?? false,
    targetCategories,
    targetCategoryLabels: targetCategories.map((c) => TARGET_CATEGORY_LABELS[c] ?? c),
    items: items.map((i) => toItemResponse(i)).sort((a, b) => a.order - b.order),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function validateInput(input: CreateSanitaryProtocolInput, isUpdate = false): void {
  if (!isUpdate) {
    if (!input.name?.trim()) {
      throw new SanitaryProtocolError('Nome do protocolo é obrigatório', 400);
    }
    if (!input.authorName?.trim()) {
      throw new SanitaryProtocolError('Nome do veterinário autor é obrigatório', 400);
    }
    if (!input.items || input.items.length === 0) {
      throw new SanitaryProtocolError('O protocolo deve ter pelo menos um procedimento', 400);
    }
  }

  if (input.status !== undefined) {
    if (
      !SANITARY_PROTOCOL_STATUSES.includes(
        input.status as (typeof SANITARY_PROTOCOL_STATUSES)[number],
      )
    ) {
      throw new SanitaryProtocolError(
        `Status inválido. Use: ${SANITARY_PROTOCOL_STATUSES.join(', ')}`,
        400,
      );
    }
  }

  if (input.targetCategories) {
    for (const cat of input.targetCategories) {
      if (!TARGET_CATEGORIES.includes(cat as (typeof TARGET_CATEGORIES)[number])) {
        throw new SanitaryProtocolError(
          `Categoria de animal inválida: ${cat}. Use: ${TARGET_CATEGORIES.join(', ')}`,
          400,
        );
      }
    }
  }

  if (input.items) {
    for (const item of input.items) {
      validateItem(item);
    }
  }
}

function validateItem(item: ItemInput): void {
  if (!item.productName?.trim()) {
    throw new SanitaryProtocolError('Nome do produto é obrigatório em cada procedimento', 400);
  }

  if (!PROCEDURE_TYPES.includes(item.procedureType as (typeof PROCEDURE_TYPES)[number])) {
    throw new SanitaryProtocolError(
      `Tipo de procedimento inválido. Use: ${PROCEDURE_TYPES.join(', ')}`,
      400,
    );
  }

  if (!TRIGGER_TYPES.includes(item.triggerType as (typeof TRIGGER_TYPES)[number])) {
    throw new SanitaryProtocolError(
      `Tipo de gatilho inválido. Use: ${TRIGGER_TYPES.join(', ')}`,
      400,
    );
  }

  if (item.triggerType === 'AGE') {
    if (item.triggerAgeDays == null || item.triggerAgeDays < 0) {
      throw new SanitaryProtocolError('Idade em dias é obrigatória para gatilho por idade', 400);
    }
  }

  if (item.triggerType === 'EVENT') {
    if (
      !item.triggerEvent ||
      !EVENT_TRIGGERS.includes(item.triggerEvent as (typeof EVENT_TRIGGERS)[number])
    ) {
      throw new SanitaryProtocolError(
        `Evento gatilho inválido. Use: ${EVENT_TRIGGERS.join(', ')}`,
        400,
      );
    }
  }

  if (item.triggerType === 'CALENDAR') {
    if (
      !item.calendarFrequency ||
      !CALENDAR_FREQUENCIES.includes(
        item.calendarFrequency as (typeof CALENDAR_FREQUENCIES)[number],
      )
    ) {
      throw new SanitaryProtocolError(
        `Frequência de calendário inválida. Use: ${CALENDAR_FREQUENCIES.join(', ')}`,
        400,
      );
    }
  }
}

function buildItemData(item: ItemInput) {
  return {
    order: item.order,
    procedureType: item.procedureType as SanitaryProcedureType,
    productId: item.productId || null,
    productName: item.productName.trim(),
    dosage: item.dosage ?? null,
    dosageUnit: (item.dosageUnit as DosageUnit) || null,
    administrationRoute: (item.administrationRoute as AdministrationRoute) || null,
    triggerType: item.triggerType as SanitaryTriggerType,
    triggerAgeDays: item.triggerAgeDays ?? null,
    triggerAgeMaxDays: item.triggerAgeMaxDays ?? null,
    triggerEvent: (item.triggerEvent as SanitaryEventTrigger) || null,
    triggerEventOffsetDays: item.triggerEventOffsetDays ?? null,
    calendarFrequency: (item.calendarFrequency as CalendarFrequency) || null,
    calendarMonths: item.calendarMonths ?? [],
    isReinforcement: item.isReinforcement ?? false,
    reinforcementIntervalDays: item.reinforcementIntervalDays ?? null,
    reinforcementDoseNumber: item.reinforcementDoseNumber ?? null,
    withdrawalMeatDays: item.withdrawalMeatDays ?? null,
    withdrawalMilkDays: item.withdrawalMilkDays ?? null,
    notes: item.notes?.trim() || null,
  };
}

const INCLUDE_RELATIONS = {
  items: { orderBy: { order: 'asc' as const } },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createSanitaryProtocol(
  ctx: RlsContext,
  input: CreateSanitaryProtocolInput,
): Promise<SanitaryProtocolResponse> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.sanitaryProtocol.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        version: 1,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new SanitaryProtocolError('Já existe um protocolo sanitário com esse nome', 409);
    }

    const row = await tx.sanitaryProtocol.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        authorName: input.authorName.trim(),
        status: (input.status as SanitaryProtocolStatus) || 'ACTIVE',
        isObligatory: input.isObligatory ?? false,
        targetCategories: (input.targetCategories as AnimalCategory[]) ?? [],
        items: {
          create: input.items.map((item) => buildItemData(item)),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toResponse(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listSanitaryProtocols(
  ctx: RlsContext,
  query: ListSanitaryProtocolsQuery,
): Promise<{
  data: SanitaryProtocolResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.procedureType) {
      where.items = { some: { procedureType: query.procedureType } };
    }

    if (query.targetCategory) {
      where.targetCategories = { has: query.targetCategory };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { authorName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const [rows, total] = await Promise.all([
      tx.sanitaryProtocol.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
        skip,
        take: limit,
      }),
      tx.sanitaryProtocol.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toResponse(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getSanitaryProtocol(
  ctx: RlsContext,
  protocolId: string,
): Promise<SanitaryProtocolResponse> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.sanitaryProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new SanitaryProtocolError('Protocolo sanitário não encontrado', 404);
    }
    return toResponse(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE (with versioning — CA14) ────────────────────────────────

export async function updateSanitaryProtocol(
  ctx: RlsContext,
  protocolId: string,
  input: UpdateSanitaryProtocolInput,
): Promise<SanitaryProtocolResponse> {
  validateInput(input as CreateSanitaryProtocolInput, true);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.sanitaryProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!existing) {
      throw new SanitaryProtocolError('Protocolo sanitário não encontrado', 404);
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;

    if (input.name !== undefined && input.name.trim() !== existing.name) {
      const duplicate = await tx.sanitaryProtocol.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: newName,
          deletedAt: null,
          id: { not: protocolId },
        },
      });
      if (duplicate) {
        throw new SanitaryProtocolError('Já existe um protocolo sanitário com esse nome', 409);
      }
    }

    // If items are being updated, create a new version
    const hasItemsChange = input.items !== undefined;
    if (hasItemsChange) {
      const originalId = existing.originalId ?? existing.id;
      const latestVersion = await tx.sanitaryProtocol.findFirst({
        where: {
          OR: [
            { id: originalId, organizationId: ctx.organizationId },
            { originalId, organizationId: ctx.organizationId },
          ],
          deletedAt: null,
        },
        orderBy: { version: 'desc' },
      });
      const newVersion = (latestVersion?.version ?? existing.version) + 1;

      const newRow = await tx.sanitaryProtocol.create({
        data: {
          organizationId: ctx.organizationId,
          name: newName,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : existing.description,
          authorName:
            input.authorName !== undefined ? input.authorName.trim() : existing.authorName,
          status:
            input.status !== undefined ? (input.status as SanitaryProtocolStatus) : existing.status,
          version: newVersion,
          originalId,
          isObligatory:
            input.isObligatory !== undefined ? input.isObligatory : existing.isObligatory,
          targetCategories:
            input.targetCategories !== undefined
              ? (input.targetCategories as AnimalCategory[])
              : existing.targetCategories,
          items: {
            create: input.items!.map((item) => buildItemData(item)),
          },
        },
        include: INCLUDE_RELATIONS,
      });

      return toResponse(newRow as unknown as Record<string, unknown>);
    }

    // Simple update (no items change, no new version)
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = newName;
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.authorName !== undefined) data.authorName = input.authorName.trim();
    if (input.status !== undefined) data.status = input.status as SanitaryProtocolStatus;
    if (input.isObligatory !== undefined) data.isObligatory = input.isObligatory;
    if (input.targetCategories !== undefined)
      data.targetCategories = input.targetCategories as AnimalCategory[];

    const row = await tx.sanitaryProtocol.update({
      where: { id: protocolId },
      data,
      include: INCLUDE_RELATIONS,
    });

    return toResponse(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteSanitaryProtocol(ctx: RlsContext, protocolId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.sanitaryProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new SanitaryProtocolError('Protocolo sanitário não encontrado', 404);
    }

    await tx.sanitaryProtocol.update({
      where: { id: protocolId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── DUPLICATE ──────────────────────────────────────────────────────

export async function duplicateSanitaryProtocol(
  ctx: RlsContext,
  protocolId: string,
): Promise<SanitaryProtocolResponse> {
  return withRlsContext(ctx, async (tx) => {
    const source = await tx.sanitaryProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!source) {
      throw new SanitaryProtocolError('Protocolo sanitário não encontrado', 404);
    }

    let copyName = `${source.name} (cópia)`;
    let counter = 2;
    while (true) {
      const dup = await tx.sanitaryProtocol.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: copyName,
          deletedAt: null,
        },
      });
      if (!dup) break;
      copyName = `${source.name} (cópia ${counter})`;
      counter++;
    }

    const items = (source as unknown as Record<string, unknown>).items as Array<
      Record<string, unknown>
    >;

    const row = await tx.sanitaryProtocol.create({
      data: {
        organizationId: ctx.organizationId,
        name: copyName,
        description: source.description,
        authorName: source.authorName,
        status: 'ACTIVE' as SanitaryProtocolStatus,
        isObligatory: source.isObligatory,
        targetCategories: source.targetCategories,
        items: {
          create: items.map((i) => ({
            order: i.order as number,
            procedureType: i.procedureType as SanitaryProcedureType,
            productId: (i.productId as string) || null,
            productName: i.productName as string,
            dosage: (i.dosage as number) ?? null,
            dosageUnit: (i.dosageUnit as DosageUnit) || null,
            administrationRoute: (i.administrationRoute as AdministrationRoute) || null,
            triggerType: i.triggerType as SanitaryTriggerType,
            triggerAgeDays: (i.triggerAgeDays as number) ?? null,
            triggerAgeMaxDays: (i.triggerAgeMaxDays as number) ?? null,
            triggerEvent: (i.triggerEvent as SanitaryEventTrigger) || null,
            triggerEventOffsetDays: (i.triggerEventOffsetDays as number) ?? null,
            calendarFrequency: (i.calendarFrequency as CalendarFrequency) || null,
            calendarMonths: (i.calendarMonths as number[]) ?? [],
            isReinforcement: (i.isReinforcement as boolean) ?? false,
            reinforcementIntervalDays: (i.reinforcementIntervalDays as number) ?? null,
            reinforcementDoseNumber: (i.reinforcementDoseNumber as number) ?? null,
            withdrawalMeatDays: (i.withdrawalMeatDays as number) ?? null,
            withdrawalMilkDays: (i.withdrawalMilkDays as number) ?? null,
            notes: (i.notes as string) ?? null,
          })),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toResponse(row as unknown as Record<string, unknown>);
  });
}

// ─── VERSION HISTORY ────────────────────────────────────────────────

export async function listSanitaryProtocolVersions(
  ctx: RlsContext,
  protocolId: string,
): Promise<SanitaryProtocolResponse[]> {
  return withRlsContext(ctx, async (tx) => {
    const protocol = await tx.sanitaryProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!protocol) {
      throw new SanitaryProtocolError('Protocolo sanitário não encontrado', 404);
    }

    const originalId = protocol.originalId ?? protocol.id;

    const versions = await tx.sanitaryProtocol.findMany({
      where: {
        OR: [{ id: originalId }, { originalId }],
        organizationId: ctx.organizationId,
      },
      include: INCLUDE_RELATIONS,
      orderBy: { version: 'desc' },
    });

    return versions.map((r: unknown) => toResponse(r as Record<string, unknown>));
  });
}

// ─── SEED (CA8, CA9, CA10) ──────────────────────────────────────────

export async function seedSanitaryProtocols(
  ctx: RlsContext,
): Promise<{ created: number; total: number }> {
  let created = 0;

  for (const seed of SEED_SANITARY_PROTOCOLS) {
    try {
      await createSanitaryProtocol(ctx, {
        name: seed.name,
        description: seed.description,
        authorName: seed.authorName,
        isObligatory: seed.isObligatory,
        targetCategories: seed.targetCategories,
        items: seed.items.map((item) => ({ ...item, productId: null })),
      });
      created++;
    } catch {
      // Skip duplicates silently
    }
  }

  return { created, total: SEED_SANITARY_PROTOCOLS.length };
}

// ─── METADATA ──────────────────────────────────────────────────────

export function listProcedureTypes(): { value: string; label: string }[] {
  return PROCEDURE_TYPES.map((t) => ({ value: t, label: PROCEDURE_TYPE_LABELS[t] }));
}

export function listTriggerTypes(): { value: string; label: string }[] {
  return TRIGGER_TYPES.map((t) => ({ value: t, label: TRIGGER_TYPE_LABELS[t] }));
}

export function listEventTriggers(): { value: string; label: string }[] {
  return EVENT_TRIGGERS.map((e) => ({ value: e, label: EVENT_TRIGGER_LABELS[e] }));
}

export function listCalendarFrequencies(): { value: string; label: string }[] {
  return CALENDAR_FREQUENCIES.map((f) => ({ value: f, label: CALENDAR_FREQUENCY_LABELS[f] }));
}

export function listSanitaryStatuses(): { value: string; label: string }[] {
  return SANITARY_PROTOCOL_STATUSES.map((s) => ({
    value: s,
    label: SANITARY_PROTOCOL_STATUS_LABELS[s],
  }));
}

export function listTargetCategories(): { value: string; label: string }[] {
  return TARGET_CATEGORIES.map((c) => ({ value: c, label: TARGET_CATEGORY_LABELS[c] }));
}
