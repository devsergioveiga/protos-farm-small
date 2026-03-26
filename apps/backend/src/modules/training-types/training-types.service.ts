import { prisma } from '../../database/prisma';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  TrainingTypeError,
  NR31_TRAINING_TYPES,
  type CreateTrainingTypeInput,
  type UpdateTrainingTypeInput,
  type TrainingTypeOutput,
  type CreatePositionTrainingRequirementInput,
  type PositionTrainingRequirementOutput,
} from './training-types.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Mappers ─────────────────────────────────────────────────────────

function mapTrainingType(row: TxClient): TrainingTypeOutput {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    minHours: row.minHours,
    defaultValidityMonths: row.defaultValidityMonths,
    nrReference: row.nrReference ?? null,
    isSystem: row.isSystem,
    isGlobal: row.isGlobal,
    organizationId: row.organizationId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPositionRequirement(row: TxClient): PositionTrainingRequirementOutput {
  return {
    id: row.id,
    positionId: row.positionId,
    positionName: row.position?.name ?? '',
    trainingTypeId: row.trainingTypeId,
    trainingTypeName: row.trainingType?.name ?? '',
  };
}

// ─── CA: Seed NR-31 system training types ───────────────────────────

export async function seedNr31TrainingTypes(): Promise<void> {
  for (const tt of NR31_TRAINING_TYPES) {
    // Use findFirst + create because @@unique([organizationId, name]) does not
    // work reliably with null in Postgres (null != null in unique constraints).
    const existing = await prisma.trainingType.findFirst({
      where: { name: tt.name, isSystem: true },
    });

    if (!existing) {
      await prisma.trainingType.create({
        data: {
          name: tt.name,
          description: `Treinamento obrigatório ${tt.nrReference}`,
          minHours: tt.minHours,
          defaultValidityMonths: tt.defaultValidityMonths,
          nrReference: tt.nrReference,
          isSystem: true,
          isGlobal: tt.isGlobal,
          // organizationId is omitted → null (system type)
        },
      });
    }
  }
}

// ─── List training types (system + org-scoped) ───────────────────────

export async function listTrainingTypes(ctx: RlsContext): Promise<TrainingTypeOutput[]> {
  // isSystem = true OR organizationId = $orgId
  const rows = await prisma.trainingType.findMany({
    where: {
      OR: [{ isSystem: true }, { organizationId: ctx.organizationId }],
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  return rows.map(mapTrainingType);
}

// ─── Get single training type ─────────────────────────────────────────

export async function getTrainingType(
  ctx: RlsContext,
  id: string,
): Promise<TrainingTypeOutput> {
  const row = await prisma.trainingType.findFirst({
    where: {
      id,
      OR: [{ isSystem: true }, { organizationId: ctx.organizationId }],
    },
  });

  if (!row) throw new TrainingTypeError('Tipo de treinamento não encontrado', 'NOT_FOUND');
  return mapTrainingType(row);
}

// ─── Create custom training type ─────────────────────────────────────

export async function createTrainingType(
  ctx: RlsContext,
  input: CreateTrainingTypeInput,
): Promise<TrainingTypeOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Validate name unique within org
    const existing = await tx.trainingType.findFirst({
      where: { name: input.name, organizationId: ctx.organizationId },
    });
    if (existing) {
      throw new TrainingTypeError(
        'Já existe um tipo de treinamento com esse nome nesta organização',
        'NAME_CONFLICT',
      );
    }

    const created = await tx.trainingType.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        description: input.description ?? null,
        minHours: input.minHours,
        defaultValidityMonths: input.defaultValidityMonths,
        nrReference: input.nrReference ?? null,
        isSystem: false,
        isGlobal: input.isGlobal ?? false,
      },
    });

    return mapTrainingType(created);
  });
}

// ─── Update training type (custom only) ──────────────────────────────

export async function updateTrainingType(
  ctx: RlsContext,
  id: string,
  input: UpdateTrainingTypeInput,
): Promise<TrainingTypeOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.trainingType.findFirst({
      where: {
        id,
        OR: [{ isSystem: true }, { organizationId: ctx.organizationId }],
      },
    });

    if (!existing) {
      throw new TrainingTypeError('Tipo de treinamento não encontrado', 'NOT_FOUND');
    }

    if (existing.isSystem) {
      throw new TrainingTypeError(
        'Treinamentos do sistema não podem ser editados',
        'SYSTEM_TYPE_READONLY',
      );
    }

    // Check name conflict if name is being changed
    if (input.name && input.name !== existing.name) {
      const nameConflict = await tx.trainingType.findFirst({
        where: {
          name: input.name,
          organizationId: ctx.organizationId,
          id: { not: id },
        },
      });
      if (nameConflict) {
        throw new TrainingTypeError(
          'Já existe um tipo de treinamento com esse nome nesta organização',
          'NAME_CONFLICT',
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.minHours !== undefined) data.minHours = input.minHours;
    if (input.defaultValidityMonths !== undefined)
      data.defaultValidityMonths = input.defaultValidityMonths;
    if (input.nrReference !== undefined) data.nrReference = input.nrReference;
    if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal;

    const updated = await tx.trainingType.update({ where: { id }, data });
    return mapTrainingType(updated);
  });
}

// ─── Delete training type (custom only) ──────────────────────────────

export async function deleteTrainingType(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.trainingType.findFirst({
      where: {
        id,
        OR: [{ isSystem: true }, { organizationId: ctx.organizationId }],
      },
    });

    if (!existing) {
      throw new TrainingTypeError('Tipo de treinamento não encontrado', 'NOT_FOUND');
    }

    if (existing.isSystem) {
      throw new TrainingTypeError(
        'Treinamentos do sistema não podem ser excluídos',
        'SYSTEM_TYPE_READONLY',
      );
    }

    // Check if referenced by training records
    const recordCount = await tx.trainingRecord.count({ where: { trainingTypeId: id } });
    if (recordCount > 0) {
      throw new TrainingTypeError(
        'Tipo de treinamento não pode ser excluído pois possui registros vinculados',
        'HAS_RECORDS',
      );
    }

    await tx.trainingType.delete({ where: { id } });
  });
}

// ─── Position Training Requirements ──────────────────────────────────

const POSITION_REQUIREMENT_INCLUDE = {
  position: { select: { id: true, name: true } },
  trainingType: { select: { id: true, name: true } },
} as const;

export async function listPositionTrainingRequirements(
  ctx: RlsContext,
  positionId?: string,
): Promise<PositionTrainingRequirementOutput[]> {
  const where: TxClient = { organizationId: ctx.organizationId };
  if (positionId) where.positionId = positionId;

  const rows = await prisma.positionTrainingRequirement.findMany({
    where,
    include: POSITION_REQUIREMENT_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

  return rows.map(mapPositionRequirement);
}

export async function createPositionTrainingRequirement(
  ctx: RlsContext,
  input: CreatePositionTrainingRequirementInput,
): Promise<PositionTrainingRequirementOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Verify position belongs to org
    const position = await tx.position.findFirst({
      where: { id: input.positionId, organizationId: ctx.organizationId },
    });
    if (!position) {
      throw new TrainingTypeError('Cargo não encontrado', 'POSITION_NOT_FOUND');
    }

    // Verify training type exists (system or org-scoped)
    const trainingType = await tx.trainingType.findFirst({
      where: {
        id: input.trainingTypeId,
        OR: [{ isSystem: true }, { organizationId: ctx.organizationId }],
      },
    });
    if (!trainingType) {
      throw new TrainingTypeError('Tipo de treinamento não encontrado', 'NOT_FOUND');
    }

    // Check duplicate
    const existing = await tx.positionTrainingRequirement.findFirst({
      where: {
        positionId: input.positionId,
        trainingTypeId: input.trainingTypeId,
      },
    });
    if (existing) {
      throw new TrainingTypeError(
        'Este tipo de treinamento já está vinculado a este cargo',
        'DUPLICATE_REQUIREMENT',
      );
    }

    const created = await tx.positionTrainingRequirement.create({
      data: {
        organizationId: ctx.organizationId,
        positionId: input.positionId,
        trainingTypeId: input.trainingTypeId,
      },
      include: POSITION_REQUIREMENT_INCLUDE,
    });

    return mapPositionRequirement(created);
  });
}

export async function deletePositionTrainingRequirement(
  ctx: RlsContext,
  id: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.positionTrainingRequirement.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new TrainingTypeError('Requisito de treinamento não encontrado', 'NOT_FOUND');
    }

    await tx.positionTrainingRequirement.delete({ where: { id } });
  });
}
