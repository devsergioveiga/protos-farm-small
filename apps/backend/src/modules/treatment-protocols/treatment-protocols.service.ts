import type {
  AdministrationRoute,
  DosageUnit,
  DiseaseSeverity,
  ProtocolStatus,
} from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  TreatmentProtocolError,
  ADMINISTRATION_ROUTES,
  ADMINISTRATION_ROUTE_LABELS,
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  PROTOCOL_STATUSES,
  PROTOCOL_STATUS_LABELS,
  SEED_PROTOCOLS,
  type CreateProtocolInput,
  type UpdateProtocolInput,
  type ListProtocolsQuery,
  type ProtocolItem,
  type StepItem,
  type ProtocolDiseaseItem,
  type StepInput,
} from './treatment-protocols.types';
import { DISEASE_SEVERITY_LABELS } from '../diseases/diseases.types';

// ─── Helpers ────────────────────────────────────────────────────────

function toStepItem(row: Record<string, unknown>): StepItem {
  const dosageUnit = row.dosageUnit as string;
  const administrationRoute = row.administrationRoute as string;
  return {
    id: row.id as string,
    order: row.order as number,
    productId: (row.productId as string) ?? null,
    productName: row.productName as string,
    dosage: row.dosage as number,
    dosageUnit,
    dosageUnitLabel: DOSAGE_UNIT_LABELS[dosageUnit] ?? dosageUnit,
    administrationRoute,
    administrationRouteLabel:
      ADMINISTRATION_ROUTE_LABELS[administrationRoute] ?? administrationRoute,
    frequencyPerDay: row.frequencyPerDay as number,
    startDay: row.startDay as number,
    durationDays: row.durationDays as number,
    withdrawalMeatDays: (row.withdrawalMeatDays as number) ?? null,
    withdrawalMilkDays: (row.withdrawalMilkDays as number) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

function toDiseaseItem(row: Record<string, unknown>): ProtocolDiseaseItem {
  const disease = row.disease as Record<string, unknown>;
  return {
    id: row.id as string,
    diseaseId: row.diseaseId as string,
    diseaseName: disease.name as string,
  };
}

function toItem(row: Record<string, unknown>): ProtocolItem {
  const severity = (row.severity as string) ?? null;
  const status = row.status as string;
  const diseases = (row.diseases as Record<string, unknown>[]) ?? [];
  const steps = (row.steps as Record<string, unknown>[]) ?? [];

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    notes: (row.notes as string) ?? null,
    severity,
    severityLabel: severity ? (DISEASE_SEVERITY_LABELS[severity] ?? severity) : null,
    authorName: row.authorName as string,
    status,
    statusLabel: PROTOCOL_STATUS_LABELS[status] ?? status,
    version: row.version as number,
    originalId: (row.originalId as string) ?? null,
    withdrawalMeatDays: (row.withdrawalMeatDays as number) ?? null,
    withdrawalMilkDays: (row.withdrawalMilkDays as number) ?? null,
    estimatedCostCents: (row.estimatedCostCents as number) ?? null,
    diseases: diseases.map((d) => toDiseaseItem(d)),
    steps: steps.map((s) => toStepItem(s)).sort((a, b) => a.order - b.order),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function computeWithdrawals(steps: StepInput[]): {
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
} {
  let maxMeat: number | null = null;
  let maxMilk: number | null = null;

  for (const step of steps) {
    if (step.withdrawalMeatDays != null) {
      maxMeat = Math.max(maxMeat ?? 0, step.withdrawalMeatDays);
    }
    if (step.withdrawalMilkDays != null) {
      maxMilk = Math.max(maxMilk ?? 0, step.withdrawalMilkDays);
    }
  }

  return { withdrawalMeatDays: maxMeat, withdrawalMilkDays: maxMilk };
}

function validateInput(input: CreateProtocolInput, isUpdate = false): void {
  if (!isUpdate) {
    if (!input.name?.trim()) {
      throw new TreatmentProtocolError('Nome do protocolo é obrigatório', 400);
    }
    if (!input.authorName?.trim()) {
      throw new TreatmentProtocolError('Nome do veterinário autor é obrigatório', 400);
    }
    if (!input.steps || input.steps.length === 0) {
      throw new TreatmentProtocolError('O protocolo deve ter pelo menos uma etapa', 400);
    }
  }

  if (input.severity !== undefined && input.severity !== null) {
    const validSeverities = ['MILD', 'MODERATE', 'SEVERE'];
    if (!validSeverities.includes(input.severity)) {
      throw new TreatmentProtocolError(
        `Gravidade inválida. Use: ${validSeverities.join(', ')}`,
        400,
      );
    }
  }

  if (input.status !== undefined) {
    if (!PROTOCOL_STATUSES.includes(input.status as (typeof PROTOCOL_STATUSES)[number])) {
      throw new TreatmentProtocolError(
        `Status inválido. Use: ${PROTOCOL_STATUSES.join(', ')}`,
        400,
      );
    }
  }

  if (input.steps) {
    for (const step of input.steps) {
      if (!step.productName?.trim()) {
        throw new TreatmentProtocolError('Nome do produto é obrigatório em cada etapa', 400);
      }
      if (step.dosage == null || step.dosage <= 0) {
        throw new TreatmentProtocolError('Dosagem deve ser um número positivo', 400);
      }
      if (!DOSAGE_UNITS.includes(step.dosageUnit as (typeof DOSAGE_UNITS)[number])) {
        throw new TreatmentProtocolError(
          `Unidade de dosagem inválida. Use: ${DOSAGE_UNITS.join(', ')}`,
          400,
        );
      }
      if (
        !ADMINISTRATION_ROUTES.includes(
          step.administrationRoute as (typeof ADMINISTRATION_ROUTES)[number],
        )
      ) {
        throw new TreatmentProtocolError(
          `Via de administração inválida. Use: ${ADMINISTRATION_ROUTES.join(', ')}`,
          400,
        );
      }
      if (step.durationDays == null || step.durationDays < 1) {
        throw new TreatmentProtocolError('Duração em dias deve ser pelo menos 1', 400);
      }
    }
  }
}

const INCLUDE_RELATIONS = {
  diseases: { include: { disease: true } },
  steps: { orderBy: { order: 'asc' as const } },
};

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createProtocol(
  ctx: RlsContext,
  input: CreateProtocolInput,
): Promise<ProtocolItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate name (same org, version 1, not deleted)
    const existing = await tx.treatmentProtocol.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        version: 1,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new TreatmentProtocolError('Já existe um protocolo com esse nome', 409);
    }

    // Validate disease IDs
    if (input.diseaseIds && input.diseaseIds.length > 0) {
      const diseases = await tx.disease.findMany({
        where: {
          id: { in: input.diseaseIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });
      if (diseases.length !== input.diseaseIds.length) {
        throw new TreatmentProtocolError('Uma ou mais doenças não foram encontradas', 400);
      }
    }

    const withdrawals = computeWithdrawals(input.steps);

    const row = await tx.treatmentProtocol.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        notes: input.notes?.trim() || null,
        severity: (input.severity as DiseaseSeverity) || null,
        authorName: input.authorName.trim(),
        status: (input.status as ProtocolStatus) || 'ACTIVE',
        withdrawalMeatDays: withdrawals.withdrawalMeatDays,
        withdrawalMilkDays: withdrawals.withdrawalMilkDays,
        diseases:
          input.diseaseIds && input.diseaseIds.length > 0
            ? {
                create: input.diseaseIds.map((diseaseId) => ({ diseaseId })),
              }
            : undefined,
        steps: {
          create: input.steps.map((step) => ({
            order: step.order,
            productId: step.productId || null,
            productName: step.productName.trim(),
            dosage: step.dosage,
            dosageUnit: step.dosageUnit as DosageUnit,
            administrationRoute: step.administrationRoute as AdministrationRoute,
            frequencyPerDay: step.frequencyPerDay ?? 1,
            startDay: step.startDay ?? 1,
            durationDays: step.durationDays,
            withdrawalMeatDays: step.withdrawalMeatDays ?? null,
            withdrawalMilkDays: step.withdrawalMilkDays ?? null,
            notes: step.notes?.trim() || null,
          })),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listProtocols(
  ctx: RlsContext,
  query: ListProtocolsQuery,
): Promise<{
  data: ProtocolItem[];
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

    if (query.diseaseId) {
      where.diseases = { some: { diseaseId: query.diseaseId } };
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
      tx.treatmentProtocol.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
        skip,
        take: limit,
      }),
      tx.treatmentProtocol.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getProtocol(ctx: RlsContext, protocolId: string): Promise<ProtocolItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.treatmentProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!row) {
      throw new TreatmentProtocolError('Protocolo não encontrado', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE (with versioning — CA8) ────────────────────────────────

export async function updateProtocol(
  ctx: RlsContext,
  protocolId: string,
  input: UpdateProtocolInput,
): Promise<ProtocolItem> {
  validateInput(input as CreateProtocolInput, true);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.treatmentProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!existing) {
      throw new TreatmentProtocolError('Protocolo não encontrado', 404);
    }

    const newName = input.name !== undefined ? input.name.trim() : existing.name;

    // Check for duplicate name if name changed
    if (input.name !== undefined && input.name.trim() !== existing.name) {
      const duplicate = await tx.treatmentProtocol.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: newName,
          deletedAt: null,
          id: { not: protocolId },
        },
      });
      if (duplicate) {
        throw new TreatmentProtocolError('Já existe um protocolo com esse nome', 409);
      }
    }

    // Validate disease IDs
    if (input.diseaseIds && input.diseaseIds.length > 0) {
      const diseases = await tx.disease.findMany({
        where: {
          id: { in: input.diseaseIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });
      if (diseases.length !== input.diseaseIds.length) {
        throw new TreatmentProtocolError('Uma ou mais doenças não foram encontradas', 400);
      }
    }

    // If steps are being updated, create a new version (CA8)
    const hasStepsChange = input.steps !== undefined;
    if (hasStepsChange) {
      const originalId = existing.originalId ?? existing.id;
      const latestVersion = await tx.treatmentProtocol.findFirst({
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

      const steps = input.steps!;
      const withdrawals = computeWithdrawals(steps);
      const diseaseIds =
        (input.diseaseIds ?? (existing as unknown as Record<string, unknown>).diseases)
          ? (
              (existing as unknown as Record<string, unknown>).diseases as Array<{
                diseaseId: string;
              }>
            ).map((d) => d.diseaseId)
          : [];

      const newRow = await tx.treatmentProtocol.create({
        data: {
          organizationId: ctx.organizationId,
          name: newName,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : existing.description,
          notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
          severity:
            input.severity !== undefined
              ? (input.severity as DiseaseSeverity) || null
              : existing.severity,
          authorName:
            input.authorName !== undefined ? input.authorName.trim() : existing.authorName,
          status: input.status !== undefined ? (input.status as ProtocolStatus) : existing.status,
          version: newVersion,
          originalId,
          withdrawalMeatDays: withdrawals.withdrawalMeatDays,
          withdrawalMilkDays: withdrawals.withdrawalMilkDays,
          diseases:
            (diseaseIds as string[]).length > 0
              ? { create: (diseaseIds as string[]).map((diseaseId: string) => ({ diseaseId })) }
              : undefined,
          steps: {
            create: steps.map((step) => ({
              order: step.order,
              productId: step.productId || null,
              productName: step.productName.trim(),
              dosage: step.dosage,
              dosageUnit: step.dosageUnit as DosageUnit,
              administrationRoute: step.administrationRoute as AdministrationRoute,
              frequencyPerDay: step.frequencyPerDay ?? 1,
              startDay: step.startDay ?? 1,
              durationDays: step.durationDays,
              withdrawalMeatDays: step.withdrawalMeatDays ?? null,
              withdrawalMilkDays: step.withdrawalMilkDays ?? null,
              notes: step.notes?.trim() || null,
            })),
          },
        },
        include: INCLUDE_RELATIONS,
      });

      return toItem(newRow as unknown as Record<string, unknown>);
    }

    // Simple update (no step change, no new version)
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = newName;
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.severity !== undefined) data.severity = (input.severity as DiseaseSeverity) || null;
    if (input.authorName !== undefined) data.authorName = input.authorName.trim();
    if (input.status !== undefined) data.status = input.status as ProtocolStatus;

    // Update disease links if provided
    if (input.diseaseIds !== undefined) {
      await tx.treatmentProtocolDisease.deleteMany({ where: { protocolId } });
      if (input.diseaseIds.length > 0) {
        await tx.treatmentProtocolDisease.createMany({
          data: input.diseaseIds.map((diseaseId) => ({ protocolId, diseaseId })),
        });
      }
    }

    const row = await tx.treatmentProtocol.update({
      where: { id: protocolId },
      data,
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteProtocol(ctx: RlsContext, protocolId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.treatmentProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new TreatmentProtocolError('Protocolo não encontrado', 404);
    }

    await tx.treatmentProtocol.update({
      where: { id: protocolId },
      data: { deletedAt: new Date() },
    });
  });
}

// ─── DUPLICATE (CA6) ───────────────────────────────────────────────

export async function duplicateProtocol(
  ctx: RlsContext,
  protocolId: string,
): Promise<ProtocolItem> {
  return withRlsContext(ctx, async (tx) => {
    const source = await tx.treatmentProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      include: INCLUDE_RELATIONS,
    });
    if (!source) {
      throw new TreatmentProtocolError('Protocolo não encontrado', 404);
    }

    // Find unique name
    let copyName = `${source.name} (cópia)`;
    let counter = 2;
    while (true) {
      const dup = await tx.treatmentProtocol.findFirst({
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

    const steps = (source as unknown as Record<string, unknown>).steps as Array<
      Record<string, unknown>
    >;
    const diseases = (source as unknown as Record<string, unknown>).diseases as Array<
      Record<string, unknown>
    >;

    const row = await tx.treatmentProtocol.create({
      data: {
        organizationId: ctx.organizationId,
        name: copyName,
        description: source.description,
        notes: source.notes,
        severity: source.severity,
        authorName: source.authorName,
        status: 'ACTIVE' as ProtocolStatus,
        withdrawalMeatDays: source.withdrawalMeatDays,
        withdrawalMilkDays: source.withdrawalMilkDays,
        diseases:
          diseases.length > 0
            ? {
                create: diseases.map((d) => ({
                  diseaseId: d.diseaseId as string,
                })),
              }
            : undefined,
        steps: {
          create: steps.map((s) => ({
            order: s.order as number,
            productId: (s.productId as string) || null,
            productName: s.productName as string,
            dosage: s.dosage as number,
            dosageUnit: s.dosageUnit as DosageUnit,
            administrationRoute: s.administrationRoute as AdministrationRoute,
            frequencyPerDay: s.frequencyPerDay as number,
            startDay: s.startDay as number,
            durationDays: s.durationDays as number,
            withdrawalMeatDays: (s.withdrawalMeatDays as number) ?? null,
            withdrawalMilkDays: (s.withdrawalMilkDays as number) ?? null,
            notes: (s.notes as string) ?? null,
          })),
        },
      },
      include: INCLUDE_RELATIONS,
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

// ─── VERSION HISTORY (CA8) ─────────────────────────────────────────

export async function listVersions(ctx: RlsContext, protocolId: string): Promise<ProtocolItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const protocol = await tx.treatmentProtocol.findFirst({
      where: {
        id: protocolId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (!protocol) {
      throw new TreatmentProtocolError('Protocolo não encontrado', 404);
    }

    const originalId = protocol.originalId ?? protocol.id;

    const versions = await tx.treatmentProtocol.findMany({
      where: {
        OR: [{ id: originalId }, { originalId }],
        organizationId: ctx.organizationId,
      },
      include: INCLUDE_RELATIONS,
      orderBy: { version: 'desc' },
    });

    return versions.map((r: unknown) => toItem(r as Record<string, unknown>));
  });
}

// ─── METADATA ──────────────────────────────────────────────────────

export function listAdministrationRoutes(): { value: string; label: string }[] {
  return ADMINISTRATION_ROUTES.map((r) => ({ value: r, label: ADMINISTRATION_ROUTE_LABELS[r] }));
}

export function listDosageUnits(): { value: string; label: string }[] {
  return DOSAGE_UNITS.map((u) => ({ value: u, label: DOSAGE_UNIT_LABELS[u] }));
}

export function listProtocolStatuses(): { value: string; label: string }[] {
  return PROTOCOL_STATUSES.map((s) => ({ value: s, label: PROTOCOL_STATUS_LABELS[s] }));
}

// ─── SEED (CA5) ────────────────────────────────────────────────────

export { SEED_PROTOCOLS };
