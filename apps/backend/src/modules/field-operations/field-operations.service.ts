import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  FieldOperationError,
  FIELD_OPERATION_TYPES,
  LOCATION_TYPES,
  type CreateFieldOperationInput,
  type FieldOperationItem,
} from './field-operations.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateInput(input: CreateFieldOperationInput): void {
  if (!(FIELD_OPERATION_TYPES as readonly string[]).includes(input.operationType)) {
    throw new FieldOperationError(`Tipo de operação inválido: ${input.operationType}`, 400);
  }
  if (input.locationType && !(LOCATION_TYPES as readonly string[]).includes(input.locationType)) {
    throw new FieldOperationError(`Tipo de local inválido: ${input.locationType}`, 400);
  }
  const date = new Date(input.recordedAt);
  if (isNaN(date.getTime())) {
    throw new FieldOperationError('Data de registro inválida', 400);
  }
}

function toItem(row: Record<string, unknown>): FieldOperationItem {
  return {
    id: row.id as string,
    farmId: row.farmId as string,
    locationId: (row.locationId as string) ?? null,
    locationType: (row.locationType as string) ?? null,
    locationName: (row.locationName as string) ?? null,
    operationType: row.operationType as string,
    notes: (row.notes as string) ?? null,
    photoUri: (row.photoUri as string) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    recordedAt: (row.recordedAt as Date).toISOString(),
    recordedBy: row.recordedBy as string,
    recorderName: ((row as Record<string, unknown>).recorder as { name: string })?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function createFieldOperation(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateFieldOperationInput,
): Promise<FieldOperationItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const farm = await tx.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      select: { id: true },
    });
    if (!farm) {
      throw new FieldOperationError('Fazenda não encontrada', 404);
    }

    const data: Record<string, unknown> = {
      farmId,
      operationType: input.operationType,
      recordedAt: new Date(input.recordedAt),
      recordedBy: userId,
      locationId: input.locationId ?? null,
      locationType: input.locationType ?? null,
      locationName: input.locationName ?? null,
      notes: input.notes ?? null,
      photoUri: input.photoUri ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    };

    if (input.id) {
      (data as Record<string, unknown>).id = input.id;
    }

    const row = await tx.fieldOperation.create({
      data: data as Parameters<typeof tx.fieldOperation.create>[0]['data'],
      include: { recorder: { select: { name: true } } },
    });

    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function listFieldOperations(
  ctx: RlsContext,
  farmId: string,
  page = 1,
  limit = 50,
): Promise<{
  data: FieldOperationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  return withRlsContext(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.fieldOperation.findMany({
        where: { farmId },
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { recorder: { select: { name: true } } },
      }),
      tx.fieldOperation.count({ where: { farmId } }),
    ]);

    return {
      data: rows.map((r) => toItem(r as unknown as Record<string, unknown>)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

export async function getFieldOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<FieldOperationItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.fieldOperation.findFirst({
      where: { id: operationId, farmId },
      include: { recorder: { select: { name: true } } },
    });
    if (!row) {
      throw new FieldOperationError('Operação não encontrada', 404);
    }
    return toItem(row as unknown as Record<string, unknown>);
  });
}

export async function deleteFieldOperation(
  ctx: RlsContext,
  farmId: string,
  operationId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.fieldOperation.findFirst({
      where: { id: operationId, farmId },
      select: { id: true },
    });
    if (!row) {
      throw new FieldOperationError('Operação não encontrada', 404);
    }
    await tx.fieldOperation.delete({ where: { id: operationId } });
  });
}
