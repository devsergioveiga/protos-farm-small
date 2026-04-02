import { withRlsContext, type RlsContext } from '../../database/rls';
import { SEMEN_TYPE_LABELS, type SemenTypeValue } from '../bulls/bulls.types';
import {
  IatfExecutionError,
  LOT_STATUSES,
  LOT_STATUS_LABELS,
  STEP_STATUSES,
  STEP_STATUS_LABELS,
  INSEMINATION_TYPES,
  INSEMINATION_TYPE_LABELS,
  CERVICAL_MUCUS_TYPES,
  CERVICAL_MUCUS_LABELS,
  type CreateLotInput,
  type ExecuteStepInput,
  type RecordInseminationInput,
  type ListLotsQuery,
  type ListInseminationsQuery,
  type ReproductiveLotItem,
  type LotDetailItem,
  type LotStepItem,
  type LotAnimalItem,
  type InseminationItem,
  type UpcomingStepItem,
  type LotStatusValue,
  type StepStatusValue,
  type InseminationTypeValue,
  type CervicalMucusValue,
} from './iatf-execution.types';

// ─── Helpers ────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateToIso(d: Date | string): string {
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 10);
}

function toInseminationItem(row: Record<string, unknown>): InseminationItem {
  const insType = row.inseminationType as string;
  const mucus = (row.cervicalMucus as string) ?? null;
  const animal = row.animal as Record<string, unknown> | undefined;
  const bull = row.bull as Record<string, unknown> | undefined;
  const semenBatch = row.semenBatch as Record<string, unknown> | undefined;
  const iatfProtocol = row.iatfProtocol as Record<string, unknown> | undefined;
  const lotStep = row.lotStep as Record<string, unknown> | undefined;
  const lot = lotStep?.lot as Record<string, unknown> | undefined;

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    farmId: row.farmId as string,
    animalId: row.animalId as string,
    animalEarTag: animal ? (animal.earTag as string) : '',
    animalName: animal ? ((animal.name as string) ?? null) : null,
    lotStepId: (row.lotStepId as string) ?? null,
    lotId: lot ? (lot.id as string) : null,
    lotName: lot ? (lot.name as string) : null,
    protocolId: iatfProtocol ? (iatfProtocol.id as string) : null,
    protocolName: iatfProtocol ? (iatfProtocol.name as string) : null,
    inseminationType: insType,
    inseminationTypeLabel: INSEMINATION_TYPE_LABELS[insType as InseminationTypeValue] ?? insType,
    bullId: (row.bullId as string) ?? null,
    bullName: bull ? (bull.name as string) : null,
    semenBatchId: (row.semenBatchId as string) ?? null,
    semenBatchNumber: semenBatch ? (semenBatch.batchNumber as string) : null,
    semenType: (row.semenType as string) ?? (semenBatch ? (semenBatch.semenType as string) : null),
    semenTypeLabel: (() => {
      const st =
        (row.semenType as string) ?? (semenBatch ? (semenBatch.semenType as string) : null);
      return st ? (SEMEN_TYPE_LABELS[st as SemenTypeValue] ?? st) : null;
    })(),
    dosesUsed: row.dosesUsed as number,
    inseminatorName: row.inseminatorName as string,
    inseminatorId: (row.inseminatorId as string) ?? null,
    inseminationDate: dateToIso(row.inseminationDate as Date),
    inseminationTime: (row.inseminationTime as string) ?? null,
    cervicalMucus: mucus,
    cervicalMucusLabel: mucus
      ? (CERVICAL_MUCUS_LABELS[mucus as CervicalMucusValue] ?? mucus)
      : null,
    heatRecordId: (row.heatRecordId as string) ?? null,
    matingPairId: (row.matingPairId as string) ?? null,
    plannedBullId: (row.plannedBullId as string) ?? null,
    wasPlannedBull: (row.wasPlannedBull as boolean) ?? null,
    substitutionReason: (row.substitutionReason as string) ?? null,
    observations: (row.observations as string) ?? null,
    recordedBy: row.recordedBy as string,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toLotStepItem(row: Record<string, unknown>): LotStepItem {
  const dayNumber = row.dayNumber as number;
  const status = row.status as string;
  const inseminations = (row.inseminations as Record<string, unknown>[]) ?? [];

  return {
    id: row.id as string,
    lotId: row.lotId as string,
    protocolStepId: (row.protocolStepId as string) ?? null,
    dayNumber,
    dayLabel: `D${dayNumber}`,
    scheduledDate: dateToIso(row.scheduledDate as Date),
    description: row.description as string,
    isAiDay: row.isAiDay as boolean,
    status: status as StepStatusValue,
    statusLabel: STEP_STATUS_LABELS[status as StepStatusValue] ?? status,
    executedAt: row.executedAt ? (row.executedAt as Date).toISOString() : null,
    responsibleName: (row.responsibleName as string) ?? null,
    notes: (row.notes as string) ?? null,
    inseminations: inseminations.map((i) => toInseminationItem(i)),
  };
}

function toLotAnimalItem(row: Record<string, unknown>): LotAnimalItem {
  const animal = row.animal as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    lotId: row.lotId as string,
    animalId: row.animalId as string,
    animalEarTag: animal ? (animal.earTag as string) : '',
    animalName: animal ? ((animal.name as string) ?? null) : null,
    removedAt: row.removedAt ? (row.removedAt as Date).toISOString() : null,
    removalReason: (row.removalReason as string) ?? null,
  };
}

function toLotItem(row: Record<string, unknown>): ReproductiveLotItem {
  const status = row.status as string;
  const protocol = row.protocol as Record<string, unknown> | undefined;
  const creator = row.creator as Record<string, unknown> | undefined;
  const animals = (row.animals as unknown[]) ?? [];
  const steps = (row.steps as unknown[]) ?? [];
  const _count = row._count as Record<string, number> | undefined;

  return {
    id: row.id as string,
    organizationId: row.organizationId as string,
    farmId: row.farmId as string,
    name: row.name as string,
    protocolId: row.protocolId as string,
    protocolName: protocol ? (protocol.name as string) : '',
    d0Date: dateToIso(row.d0Date as Date),
    status: status as LotStatusValue,
    statusLabel: LOT_STATUS_LABELS[status as LotStatusValue] ?? status,
    totalCostCents: (row.totalCostCents as number) ?? 0,
    notes: (row.notes as string) ?? null,
    animalsCount: _count?.animals ?? animals.length,
    stepsCount: _count?.steps ?? steps.length,
    createdBy: row.createdBy as string,
    creatorName: creator ? (creator.name as string) : null,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toLotDetailItem(row: Record<string, unknown>): LotDetailItem {
  const base = toLotItem(row);
  const animals = (row.animals as Record<string, unknown>[]) ?? [];
  const steps = (row.steps as Record<string, unknown>[]) ?? [];

  return {
    ...base,
    animals: animals.map((a) => toLotAnimalItem(a)),
    steps: steps.map((s) => toLotStepItem(s)).sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

const LOT_LIST_INCLUDE = {
  protocol: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  _count: { select: { animals: true, steps: true } },
};

const LOT_DETAIL_INCLUDE = {
  protocol: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  animals: {
    include: {
      animal: { select: { id: true, earTag: true, name: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  steps: {
    include: {
      inseminations: {
        include: {
          animal: { select: { id: true, earTag: true, name: true } },
          bull: { select: { id: true, name: true } },
          semenBatch: { select: { id: true, batchNumber: true } },
        },
      },
    },
    orderBy: { dayNumber: 'asc' as const },
  },
};

const INSEMINATION_INCLUDE = {
  animal: { select: { id: true, earTag: true, name: true } },
  bull: { select: { id: true, name: true } },
  semenBatch: { select: { id: true, batchNumber: true, semenType: true } },
  iatfProtocol: { select: { id: true, name: true } },
  lotStep: {
    select: {
      id: true,
      lot: {
        select: {
          id: true,
          name: true,
          protocolId: true,
        },
      },
    },
  },
};

// ─── CREATE LOT ─────────────────────────────────────────────────────

export async function createReproductiveLot(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateLotInput,
): Promise<LotDetailItem> {
  if (!input.name?.trim()) {
    throw new IatfExecutionError('Nome do lote é obrigatório', 400);
  }
  if (!input.protocolId) {
    throw new IatfExecutionError('Protocolo IATF é obrigatório', 400);
  }
  if (!input.d0Date) {
    throw new IatfExecutionError('Data D0 é obrigatória', 400);
  }
  if (!input.animalIds || input.animalIds.length === 0) {
    throw new IatfExecutionError('Selecione pelo menos um animal', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate farm
    const farm = await tx.farm.findFirst({
      where: { id: farmId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!farm) {
      throw new IatfExecutionError('Fazenda não encontrada', 404);
    }

    // Validate protocol
    const protocol = await tx.iatfProtocol.findFirst({
      where: {
        id: input.protocolId,
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        steps: {
          include: { products: true },
          orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });
    if (!protocol) {
      throw new IatfExecutionError('Protocolo IATF não encontrado ou inativo', 404);
    }

    // Validate animals
    const animals = await tx.animal.findMany({
      where: {
        id: { in: input.animalIds },
        farmId,
        deletedAt: null,
      },
    });

    if (animals.length !== input.animalIds.length) {
      throw new IatfExecutionError('Um ou mais animais não foram encontrados nesta fazenda', 400);
    }

    // Validate all are female
    const nonFemale = animals.filter((a) => a.sex !== 'FEMALE');
    if (nonFemale.length > 0) {
      const tags = nonFemale.map((a) => a.earTag).join(', ');
      throw new IatfExecutionError(`Os seguintes animais não são fêmeas: ${tags}`, 400);
    }

    // Validate all are reproductively released
    const notReleased = animals.filter((a) => !a.reproductivelyReleased);
    if (notReleased.length > 0) {
      const tags = notReleased.map((a) => a.earTag).join(', ');
      throw new IatfExecutionError(
        `Os seguintes animais não estão liberados para reprodução: ${tags}`,
        400,
      );
    }

    // Parse D0 date
    const d0Date = new Date(input.d0Date);

    // Create lot with animals and steps
    const row = await tx.reproductiveLot.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        name: input.name.trim(),
        protocolId: input.protocolId,
        d0Date,
        notes: input.notes?.trim() || null,
        createdBy: userId,
        animals: {
          create: input.animalIds.map((animalId) => ({ animalId })),
        },
        steps: {
          create: protocol.steps.map((step) => ({
            protocolStepId: step.id,
            dayNumber: step.dayNumber,
            scheduledDate: addDays(d0Date, step.dayNumber),
            description: step.description,
            isAiDay: step.isAiDay,
          })),
        },
      },
      include: LOT_DETAIL_INCLUDE,
    });

    return toLotDetailItem(row as unknown as Record<string, unknown>);
  });
}

// ─── LIST LOTS ──────────────────────────────────────────────────────

export async function listLots(
  ctx: RlsContext,
  farmId: string,
  query: ListLotsQuery,
): Promise<{
  data: ReproductiveLotItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      farmId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [{ name: { contains: query.search, mode: 'insensitive' } }];
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const [rows, total] = await Promise.all([
      tx.reproductiveLot.findMany({
        where,
        include: LOT_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      tx.reproductiveLot.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toLotItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── GET LOT ────────────────────────────────────────────────────────

export async function getLot(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
): Promise<LotDetailItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.reproductiveLot.findFirst({
      where: {
        id: lotId,
        organizationId: ctx.organizationId,
        farmId,
      },
      include: LOT_DETAIL_INCLUDE,
    });
    if (!row) {
      throw new IatfExecutionError('Lote reprodutivo não encontrado', 404);
    }
    return toLotDetailItem(row as unknown as Record<string, unknown>);
  });
}

// ─── EXECUTE STEP ───────────────────────────────────────────────────

export async function executeStep(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
  stepId: string,
  input: ExecuteStepInput,
): Promise<LotStepItem> {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.reproductiveLot.findFirst({
      where: {
        id: lotId,
        organizationId: ctx.organizationId,
        farmId,
      },
    });
    if (!lot) {
      throw new IatfExecutionError('Lote reprodutivo não encontrado', 404);
    }
    if (lot.status !== 'ACTIVE') {
      throw new IatfExecutionError('Lote não está ativo', 400);
    }

    const step = await tx.reproductiveLotStep.findFirst({
      where: { id: stepId, lotId },
    });
    if (!step) {
      throw new IatfExecutionError('Etapa não encontrada neste lote', 404);
    }
    if (step.status === 'DONE') {
      throw new IatfExecutionError('Etapa já foi executada', 400);
    }

    const updated = await tx.reproductiveLotStep.update({
      where: { id: stepId },
      data: {
        status: 'DONE' as const,
        executedAt: new Date(),
        responsibleName: input.responsibleName?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      include: {
        inseminations: {
          include: INSEMINATION_INCLUDE,
        },
      },
    });

    return toLotStepItem(updated as unknown as Record<string, unknown>);
  });
}

// ─── RECORD INSEMINATION ────────────────────────────────────────────

export async function recordInsemination(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: RecordInseminationInput,
): Promise<InseminationItem> {
  // Validate required fields
  if (!input.animalId) {
    throw new IatfExecutionError('Animal é obrigatório', 400);
  }
  if (!input.inseminationType) {
    throw new IatfExecutionError('Tipo de inseminação é obrigatório', 400);
  }
  if (!INSEMINATION_TYPES.includes(input.inseminationType as InseminationTypeValue)) {
    throw new IatfExecutionError(
      `Tipo de inseminação inválido. Use: ${INSEMINATION_TYPES.join(', ')}`,
      400,
    );
  }
  if (!input.inseminationDate) {
    throw new IatfExecutionError('Data da inseminação é obrigatória', 400);
  }
  if (
    input.cervicalMucus &&
    !CERVICAL_MUCUS_TYPES.includes(input.cervicalMucus as CervicalMucusValue)
  ) {
    throw new IatfExecutionError(
      `Classificação de muco cervical inválida. Use: ${CERVICAL_MUCUS_TYPES.join(', ')}`,
      400,
    );
  }

  const dosesUsed = input.dosesUsed ?? 1;
  if (dosesUsed < 1) {
    throw new IatfExecutionError('Doses utilizadas deve ser no mínimo 1', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Validate animal
    const animal = await tx.animal.findFirst({
      where: {
        id: input.animalId,
        farmId,
        deletedAt: null,
      },
    });
    if (!animal) {
      throw new IatfExecutionError('Animal não encontrado nesta fazenda', 404);
    }
    if (animal.sex !== 'FEMALE') {
      throw new IatfExecutionError('Inseminação só pode ser registrada em fêmeas', 400);
    }

    // Validate lot step if provided
    let resolvedLotStepId = input.lotStepId || null;
    let resolvedProtocolId = input.iatfProtocolId || null;

    if (resolvedLotStepId) {
      const step = await tx.reproductiveLotStep.findFirst({
        where: { id: resolvedLotStepId },
        include: { lot: { include: { protocol: { select: { id: true } } } } },
      });
      if (!step) {
        throw new IatfExecutionError('Etapa do lote não encontrada', 404);
      }
      if (step.lot.farmId !== farmId) {
        throw new IatfExecutionError('Etapa pertence a outra fazenda', 400);
      }
      // Auto-fill protocolId from lot if not manually set
      if (!resolvedProtocolId) {
        resolvedProtocolId = step.lot.protocol.id;
      }
    } else {
      // Auto-detect: find active reproductive lot for this animal and link to the AI day step
      const activeLotAnimal = await tx.reproductiveLotAnimal.findFirst({
        where: {
          animalId: input.animalId,
          removedAt: null,
          lot: {
            farmId,
            organizationId: ctx.organizationId,
            status: 'ACTIVE',
          },
        },
        include: {
          lot: {
            include: {
              protocol: { select: { id: true } },
              steps: {
                where: { isAiDay: true },
                orderBy: { dayNumber: 'asc' as const },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' as const },
      });

      if (activeLotAnimal) {
        if (activeLotAnimal.lot.steps.length > 0) {
          resolvedLotStepId = activeLotAnimal.lot.steps[0].id;
        }
        // Auto-fill protocolId from detected lot
        if (!resolvedProtocolId) {
          resolvedProtocolId = activeLotAnimal.lot.protocol.id;
        }
      }
    }

    // Validate manually-set protocolId
    if (resolvedProtocolId && !resolvedLotStepId && !input.lotStepId) {
      const protocol = await tx.iatfProtocol.findFirst({
        where: {
          id: resolvedProtocolId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });
      if (!protocol) {
        throw new IatfExecutionError('Protocolo IATF não encontrado', 404);
      }
    }

    // Validate semen batch and auto-deduct
    let resolvedSemenType = input.semenType || null;

    if (input.semenBatchId) {
      const batch = await tx.semenBatch.findFirst({
        where: {
          id: input.semenBatchId,
          organizationId: ctx.organizationId,
        },
      });
      if (!batch) {
        throw new IatfExecutionError('Lote de sêmen não encontrado', 404);
      }
      if (batch.currentDoses < dosesUsed) {
        throw new IatfExecutionError(
          `Doses insuficientes no lote de sêmen. Disponível: ${batch.currentDoses}, solicitado: ${dosesUsed}`,
          400,
        );
      }

      // Auto-fill semenType from batch if not manually set
      if (!resolvedSemenType) {
        resolvedSemenType = batch.semenType;
      }

      // Auto-deduct semen doses
      await tx.semenBatch.update({
        where: { id: input.semenBatchId },
        data: { currentDoses: { decrement: dosesUsed } },
      });
    }

    // Validate inseminator (employee with INSEMINATOR function)
    let resolvedInseminatorName = input.inseminatorName?.trim() || '';
    if (input.inseminatorId) {
      const inseminator = await tx.employee.findFirst({
        where: {
          id: input.inseminatorId,
          organizationId: ctx.organizationId,
          status: 'ATIVO' as const,
        },
        select: {
          id: true,
          name: true,
          functions: { where: { function: 'INSEMINATOR' as const } },
        },
      });
      if (!inseminator) {
        throw new IatfExecutionError('Inseminador não encontrado ou inativo', 404);
      }
      if (inseminator.functions.length === 0) {
        throw new IatfExecutionError(
          'Colaborador selecionado não possui a função de inseminador',
          400,
        );
      }
      // Auto-fill name from employee if not provided
      if (!resolvedInseminatorName) {
        resolvedInseminatorName = inseminator.name;
      }
    }

    if (!resolvedInseminatorName) {
      throw new IatfExecutionError('Nome do inseminador é obrigatório', 400);
    }

    // Validate bull
    if (input.bullId) {
      const bull = await tx.bull.findFirst({
        where: {
          id: input.bullId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });
      if (!bull) {
        throw new IatfExecutionError('Touro não encontrado', 404);
      }
    }

    // Find active mating plan pair for this animal
    let matingPairId: string | null = null;
    let plannedBullId: string | null = null;
    let wasPlannedBull: boolean | null = null;

    const activePair = await tx.matingPair.findFirst({
      where: {
        animalId: input.animalId,
        status: 'PLANNED',
        plan: {
          farmId,
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
        },
      },
      include: { plan: true },
    });

    if (activePair) {
      matingPairId = activePair.id;
      plannedBullId = activePair.primaryBullId;
      wasPlannedBull = input.bullId ? input.bullId === activePair.primaryBullId : null;

      // Update mating pair status to EXECUTED
      await tx.matingPair.update({
        where: { id: activePair.id },
        data: {
          status: 'EXECUTED',
          executedBullId: input.bullId || null,
          executionDate: new Date(input.inseminationDate),
          substitutionReason:
            wasPlannedBull === false ? input.substitutionReason?.trim() || null : null,
        },
      });
    }

    // Update heat record status to AI_DONE if linked
    if (input.heatRecordId) {
      const heatRecord = await tx.heatRecord.findFirst({
        where: {
          id: input.heatRecordId,
          farmId,
          organizationId: ctx.organizationId,
        },
      });
      if (heatRecord) {
        await tx.heatRecord.update({
          where: { id: input.heatRecordId },
          data: { status: 'AI_DONE' },
        });
      }
    }

    // Create insemination record
    const row = await tx.insemination.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        lotStepId: resolvedLotStepId,
        iatfProtocolId: resolvedProtocolId,
        inseminationType: input.inseminationType,
        bullId: input.bullId || null,
        semenBatchId: input.semenBatchId || null,
        semenType: resolvedSemenType,
        dosesUsed,
        inseminatorName: resolvedInseminatorName,
        inseminatorId: input.inseminatorId || null,
        inseminationDate: new Date(input.inseminationDate),
        inseminationTime: input.inseminationTime?.trim() || null,
        cervicalMucus: input.cervicalMucus || null,
        heatRecordId: input.heatRecordId || null,
        matingPairId,
        plannedBullId,
        wasPlannedBull,
        substitutionReason: input.substitutionReason?.trim() || null,
        observations: input.observations?.trim() || null,
        recordedBy: userId,
      },
      include: INSEMINATION_INCLUDE,
    });

    // Also create entry in animal_reproductive_records timeline
    const bull = input.bullId
      ? await tx.bull.findUnique({ where: { id: input.bullId }, select: { name: true } })
      : null;

    await tx.animalReproductiveRecord.create({
      data: {
        animalId: input.animalId,
        farmId,
        type: 'AI',
        eventDate: new Date(input.inseminationDate),
        sireName: bull?.name || null,
        technicianName: resolvedInseminatorName,
        semenBatch: input.semenBatchId || null,
        notes: input.observations?.trim() || null,
        recordedBy: userId,
      },
    });

    return toInseminationItem(row as unknown as Record<string, unknown>);
  });
}

// ─── REMOVE ANIMAL FROM LOT ─────────────────────────────────────────

export async function removeAnimalFromLot(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
  animalId: string,
  reason?: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.reproductiveLot.findFirst({
      where: {
        id: lotId,
        organizationId: ctx.organizationId,
        farmId,
      },
    });
    if (!lot) {
      throw new IatfExecutionError('Lote reprodutivo não encontrado', 404);
    }
    if (lot.status !== 'ACTIVE') {
      throw new IatfExecutionError('Lote não está ativo', 400);
    }

    const lotAnimal = await tx.reproductiveLotAnimal.findFirst({
      where: { lotId, animalId },
    });
    if (!lotAnimal) {
      throw new IatfExecutionError('Animal não pertence a este lote', 404);
    }
    if (lotAnimal.removedAt) {
      throw new IatfExecutionError('Animal já foi removido deste lote', 400);
    }

    await tx.reproductiveLotAnimal.update({
      where: { id: lotAnimal.id },
      data: {
        removedAt: new Date(),
        removalReason: reason?.trim() || null,
      },
    });
  });
}

// ─── COMPLETE LOT ───────────────────────────────────────────────────

export async function completeLot(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
): Promise<ReproductiveLotItem> {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.reproductiveLot.findFirst({
      where: {
        id: lotId,
        organizationId: ctx.organizationId,
        farmId,
      },
      include: {
        steps: {
          include: {
            inseminations: {
              include: {
                semenBatch: true,
              },
            },
          },
        },
        protocol: {
          include: {
            steps: { include: { products: true } },
          },
        },
      },
    });
    if (!lot) {
      throw new IatfExecutionError('Lote reprodutivo não encontrado', 404);
    }
    if (lot.status !== 'ACTIVE') {
      throw new IatfExecutionError('Lote não está ativo', 400);
    }

    // Count active animals
    const activeAnimals = await tx.reproductiveLotAnimal.count({
      where: { lotId, removedAt: null },
    });

    // Calculate total cost: semen + protocol products cost per animal
    let totalCostCents = 0;

    // Semen cost from inseminations
    for (const step of lot.steps) {
      for (const ins of step.inseminations) {
        if (ins.semenBatch) {
          totalCostCents += ins.semenBatch.costPerDose * ins.dosesUsed;
        }
      }
    }

    // Protocol hormone cost (estimatedCostCents * number of active animals)
    if (lot.protocol.estimatedCostCents > 0) {
      totalCostCents += lot.protocol.estimatedCostCents * activeAnimals;
    }

    const updated = await tx.reproductiveLot.update({
      where: { id: lotId },
      data: {
        status: 'COMPLETED',
        totalCostCents,
      },
      include: LOT_LIST_INCLUDE,
    });

    return toLotItem(updated as unknown as Record<string, unknown>);
  });
}

// ─── CANCEL LOT ─────────────────────────────────────────────────────

export async function cancelLot(
  ctx: RlsContext,
  farmId: string,
  lotId: string,
): Promise<ReproductiveLotItem> {
  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.reproductiveLot.findFirst({
      where: {
        id: lotId,
        organizationId: ctx.organizationId,
        farmId,
      },
    });
    if (!lot) {
      throw new IatfExecutionError('Lote reprodutivo não encontrado', 404);
    }
    if (lot.status !== 'ACTIVE') {
      throw new IatfExecutionError('Lote não está ativo', 400);
    }

    const updated = await tx.reproductiveLot.update({
      where: { id: lotId },
      data: { status: 'CANCELLED' },
      include: LOT_LIST_INCLUDE,
    });

    return toLotItem(updated as unknown as Record<string, unknown>);
  });
}

// ─── UPCOMING STEPS (ALERTS) ────────────────────────────────────────

export async function getUpcomingSteps(
  ctx: RlsContext,
  farmId: string,
  daysAhead?: number,
): Promise<UpcomingStepItem[]> {
  const days = daysAhead ?? 7;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = addDays(today, days);

  return withRlsContext(ctx, async (tx) => {
    const steps = await tx.reproductiveLotStep.findMany({
      where: {
        status: 'PENDING',
        scheduledDate: {
          gte: today,
          lte: futureDate,
        },
        lot: {
          farmId,
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
        },
      },
      include: {
        lot: {
          select: {
            id: true,
            name: true,
            _count: { select: { animals: true } },
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    return steps.map((s) => ({
      stepId: s.id,
      lotId: s.lot.id,
      lotName: s.lot.name,
      dayNumber: s.dayNumber,
      dayLabel: `D${s.dayNumber}`,
      scheduledDate: dateToIso(s.scheduledDate),
      description: s.description,
      isAiDay: s.isAiDay,
      animalsCount: s.lot._count.animals,
    }));
  });
}

// ─── LIST INSEMINATIONS ─────────────────────────────────────────────

export async function listInseminations(
  ctx: RlsContext,
  farmId: string,
  query: ListInseminationsQuery,
): Promise<{
  data: InseminationItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      farmId,
    };

    if (query.animalId) {
      where.animalId = query.animalId;
    }
    if (query.inseminationType) {
      where.inseminationType = query.inseminationType;
    }
    if (query.dateFrom || query.dateTo) {
      where.inseminationDate = {};
      if (query.dateFrom) where.inseminationDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.inseminationDate.lte = new Date(query.dateTo);
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const [rows, total] = await Promise.all([
      tx.insemination.findMany({
        where,
        include: INSEMINATION_INCLUDE,
        orderBy: { inseminationDate: 'desc' },
        skip,
        take: limit,
      }),
      tx.insemination.count({ where }),
    ]);

    return {
      data: rows.map((r: unknown) => toInseminationItem(r as Record<string, unknown>)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

// ─── ACTIVE LOTS FOR ANIMALS ───────────────────────────────────────

export interface AnimalActiveLotInfo {
  animalId: string;
  lotId: string;
  lotName: string;
  protocolId: string;
  protocolName: string;
  aiStepId: string | null;
}

export async function getActiveLotsForAnimals(
  ctx: RlsContext,
  farmId: string,
  animalIds: string[],
): Promise<AnimalActiveLotInfo[]> {
  if (animalIds.length === 0) return [];

  return withRlsContext(ctx, async (tx) => {
    const lotAnimals = await tx.reproductiveLotAnimal.findMany({
      where: {
        animalId: { in: animalIds },
        removedAt: null,
        lot: {
          farmId,
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
        },
      },
      include: {
        lot: {
          include: {
            protocol: { select: { id: true, name: true } },
            steps: {
              where: { isAiDay: true },
              orderBy: { dayNumber: 'asc' as const },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' as const },
    });

    return lotAnimals.map((la) => ({
      animalId: la.animalId,
      lotId: la.lot.id,
      lotName: la.lot.name,
      protocolId: la.lot.protocol.id,
      protocolName: la.lot.protocol.name,
      aiStepId: la.lot.steps[0]?.id ?? null,
    }));
  });
}

// ─── METADATA ───────────────────────────────────────────────────────

export function listLotStatuses(): { value: string; label: string }[] {
  return LOT_STATUSES.map((s) => ({ value: s, label: LOT_STATUS_LABELS[s] }));
}

export function listStepStatuses(): { value: string; label: string }[] {
  return STEP_STATUSES.map((s) => ({ value: s, label: STEP_STATUS_LABELS[s] }));
}

export function listInseminationTypes(): { value: string; label: string }[] {
  return INSEMINATION_TYPES.map((t) => ({
    value: t,
    label: INSEMINATION_TYPE_LABELS[t],
  }));
}

export function listCervicalMucusTypes(): { value: string; label: string }[] {
  return CERVICAL_MUCUS_TYPES.map((m) => ({
    value: m,
    label: CERVICAL_MUCUS_LABELS[m],
  }));
}
