import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  WorkScheduleError,
  type CreateWorkScheduleInput,
  type UpdateWorkScheduleInput,
  type ListWorkSchedulesParams,
  type WorkScheduleOutput,
} from './work-schedules.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

const TIME_REGEX = /^([0-1]\d|2[0-3]):[0-5]\d$/;

function toIso(date: unknown): string {
  if (date instanceof Date) return date.toISOString();
  return String(date);
}

function mapSchedule(row: TxClient): WorkScheduleOutput {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    type: row.type,
    workDays: row.workDays,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    isTemplate: row.isTemplate,
    notes: row.notes ?? null,
    contractsCount: row._count?.contracts ?? 0,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function validateInput(input: CreateWorkScheduleInput | UpdateWorkScheduleInput): void {
  if ('workDays' in input && input.workDays !== undefined) {
    for (const day of input.workDays) {
      if (day < 0 || day > 6) {
        throw new WorkScheduleError(
          'workDays deve conter apenas valores entre 0 (domingo) e 6 (sábado)',
          400,
        );
      }
    }
  }

  if ('startTime' in input && input.startTime && !TIME_REGEX.test(input.startTime)) {
    throw new WorkScheduleError('startTime deve estar no formato HH:mm', 400);
  }

  if ('endTime' in input && input.endTime && !TIME_REGEX.test(input.endTime)) {
    throw new WorkScheduleError('endTime deve estar no formato HH:mm', 400);
  }
}

export async function createWorkSchedule(
  ctx: RlsContext,
  input: CreateWorkScheduleInput,
): Promise<WorkScheduleOutput> {
  validateInput(input);

  return withRlsContext(ctx, async (tx: TxClient) => {
    const existing = await tx.workSchedule.findFirst({
      where: { organizationId: ctx.organizationId, name: input.name },
    });
    if (existing) {
      throw new WorkScheduleError('Já existe uma escala com esse nome nesta organização', 409);
    }

    const schedule = await tx.workSchedule.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        type: input.type,
        workDays: input.workDays,
        startTime: input.startTime,
        endTime: input.endTime,
        breakMinutes: input.breakMinutes ?? 60,
        isTemplate: input.isTemplate ?? false,
        notes: input.notes ?? null,
        createdBy: ctx.userId ?? 'system',
      },
      include: {
        _count: { select: { contracts: true } },
      },
    });

    return mapSchedule(schedule);
  });
}

export async function listWorkSchedules(
  ctx: RlsContext,
  params: ListWorkSchedulesParams,
): Promise<{ data: WorkScheduleOutput[]; total: number; page: number; limit: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx: TxClient) => {
    const where: TxClient = { organizationId: ctx.organizationId };

    if (params.type) where.type = params.type;
    if (params.isTemplate !== undefined) where.isTemplate = params.isTemplate;
    if (params.search) {
      where.name = { contains: params.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      tx.workSchedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { contracts: true } },
        },
      }),
      tx.workSchedule.count({ where }),
    ]);

    return { data: data.map(mapSchedule), total, page, limit };
  });
}

export async function getWorkSchedule(ctx: RlsContext, id: string): Promise<WorkScheduleOutput> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const schedule = await tx.workSchedule.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        _count: { select: { contracts: true } },
      },
    });

    if (!schedule) {
      throw new WorkScheduleError('Escala de trabalho não encontrada', 404);
    }

    return mapSchedule(schedule);
  });
}

export async function updateWorkSchedule(
  ctx: RlsContext,
  id: string,
  input: UpdateWorkScheduleInput,
): Promise<WorkScheduleOutput> {
  validateInput(input);

  return withRlsContext(ctx, async (tx: TxClient) => {
    const existing = await tx.workSchedule.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new WorkScheduleError('Escala de trabalho não encontrada', 404);
    }

    if (input.name && input.name !== existing.name) {
      const duplicate = await tx.workSchedule.findFirst({
        where: { organizationId: ctx.organizationId, name: input.name, id: { not: id } },
      });
      if (duplicate) {
        throw new WorkScheduleError('Já existe uma escala com esse nome nesta organização', 409);
      }
    }

    const schedule = await tx.workSchedule.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name : undefined,
        type: input.type !== undefined ? input.type : undefined,
        workDays: input.workDays !== undefined ? input.workDays : undefined,
        startTime: input.startTime !== undefined ? input.startTime : undefined,
        endTime: input.endTime !== undefined ? input.endTime : undefined,
        breakMinutes: input.breakMinutes !== undefined ? input.breakMinutes : undefined,
        isTemplate: input.isTemplate !== undefined ? input.isTemplate : undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
      },
      include: {
        _count: { select: { contracts: true } },
      },
    });

    return mapSchedule(schedule);
  });
}

export async function deleteWorkSchedule(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx: TxClient) => {
    const schedule = await tx.workSchedule.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        _count: { select: { contracts: true } },
      },
    });

    if (!schedule) {
      throw new WorkScheduleError('Escala de trabalho não encontrada', 404);
    }

    if (schedule._count.contracts > 0) {
      throw new WorkScheduleError(
        'Esta escala está sendo usada em contratos ativos e não pode ser removida',
        400,
      );
    }

    await tx.workSchedule.delete({ where: { id } });
  });
}

export async function seedTemplates(
  ctx: RlsContext,
): Promise<{ created: number; skipped: number }> {
  const templates: CreateWorkScheduleInput[] = [
    {
      name: '5x2 Padrao',
      type: 'FIXED',
      workDays: [1, 2, 3, 4, 5],
      startTime: '07:00',
      endTime: '17:00',
      breakMinutes: 60,
      isTemplate: true,
    },
    {
      name: '6x1 Rural',
      type: 'FIXED',
      workDays: [1, 2, 3, 4, 5, 6],
      startTime: '07:00',
      endTime: '15:20',
      breakMinutes: 60,
      isTemplate: true,
    },
    {
      name: '12x36 Turno',
      type: 'SHIFT',
      workDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '06:00',
      endTime: '18:00',
      breakMinutes: 60,
      isTemplate: true,
    },
    {
      name: 'Ordenha 2x',
      type: 'CUSTOM',
      workDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '04:00',
      endTime: '08:00',
      breakMinutes: 0,
      isTemplate: true,
      notes: 'Segundo turno 15:00-19:00',
    },
  ];

  return withRlsContext(ctx, async (tx: TxClient) => {
    let created = 0;
    let skipped = 0;

    for (const template of templates) {
      const existing = await tx.workSchedule.findFirst({
        where: { organizationId: ctx.organizationId, name: template.name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await tx.workSchedule.create({
        data: {
          organizationId: ctx.organizationId,
          name: template.name,
          type: template.type,
          workDays: template.workDays,
          startTime: template.startTime,
          endTime: template.endTime,
          breakMinutes: template.breakMinutes ?? 60,
          isTemplate: true,
          notes: template.notes ?? null,
          createdBy: ctx.userId ?? 'system',
        },
      });
      created++;
    }

    return { created, skipped };
  });
}
