import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  CalvingEventError,
  CALVING_EVENT_TYPE_LABELS,
  BIRTH_TYPE_LABELS,
  PRESENTATION_LABELS,
  CALF_CONDITION_LABELS,
  CALF_SEX_LABELS,
  ABORTION_CAUSE_LABELS,
  STILLBORN_REASON_LABELS,
  EVENT_PERIOD_LABELS,
  isValidEventType,
  isValidBirthType,
  isValidPresentation,
  isValidCalfCondition,
  isValidCalfSex,
  isValidAbortionCause,
  isValidStillbornReason,
  isValidEventPeriod,
  type CalvingEventTypeValue,
  type BirthTypeValue,
  type CalfConditionValue,
  type CalfSexValue,
  type AbortionCauseValue,
  type StillbornReasonValue,
  type EventPeriodValue,
  type CreateCalvingInput,
  type UpdateCalvingInput,
  type ListCalvingsQuery,
  type CalvingEventItem,
  type CalvingCalfItem,
  type UpcomingBirthItem,
  type CalvingIndicators,
} from './calving-events.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

const CALVING_INCLUDE = {
  mother: { select: { earTag: true, name: true } },
  father: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
  calves: {
    include: {
      createdAnimal: { select: { earTag: true } },
    },
  },
};

function toCalfItem(calf: any): CalvingCalfItem {
  const condition = calf.condition as CalfConditionValue;
  const sex = calf.sex as CalfSexValue;
  const stillbornReason = calf.stillbornReason as StillbornReasonValue | null;

  return {
    id: calf.id,
    sex,
    sexLabel: CALF_SEX_LABELS[sex] ?? sex,
    birthWeightKg: calf.birthWeightKg ?? null,
    condition,
    conditionLabel: CALF_CONDITION_LABELS[condition] ?? condition,
    stillbornReason: stillbornReason ?? null,
    stillbornReasonLabel: stillbornReason
      ? (STILLBORN_REASON_LABELS[stillbornReason] ?? stillbornReason)
      : null,
    createdAnimalId: calf.createdAnimalId ?? null,
    earTag: calf.earTag ?? calf.createdAnimal?.earTag ?? null,
    notes: calf.notes ?? null,
  };
}

function toCalvingItem(row: any): CalvingEventItem {
  const eventType = row.eventType as CalvingEventTypeValue;
  const birthType = row.birthType as BirthTypeValue | null;
  const presentation = row.presentation as string | null;
  const abortionCause = row.abortionCause as AbortionCauseValue | null;
  const eventPeriod = row.eventPeriod as EventPeriodValue | null;
  const calves = (row.calves ?? []).map(toCalfItem);

  return {
    id: row.id,
    farmId: row.farmId,
    motherId: row.motherId,
    motherEarTag: row.mother?.earTag ?? '',
    motherName: row.mother?.name ?? null,
    fatherId: row.fatherId ?? null,
    fatherEarTag: row.father?.earTag ?? null,
    fatherBreedName: row.fatherBreedName ?? null,
    eventType,
    eventTypeLabel: CALVING_EVENT_TYPE_LABELS[eventType] ?? eventType,
    eventDate: (row.eventDate as Date).toISOString().slice(0, 10),
    eventTime: row.eventTime ?? null,
    eventPeriod: eventPeriod ?? null,
    eventPeriodLabel: eventPeriod ? (EVENT_PERIOD_LABELS[eventPeriod] ?? eventPeriod) : null,
    birthType: birthType ?? null,
    birthTypeLabel: birthType ? (BIRTH_TYPE_LABELS[birthType] ?? birthType) : null,
    presentation: presentation ?? null,
    presentationLabel: presentation
      ? (PRESENTATION_LABELS[presentation as keyof typeof PRESENTATION_LABELS] ?? presentation)
      : null,
    abortionGestationDays: row.abortionGestationDays ?? null,
    abortionCause: abortionCause ?? null,
    abortionCauseLabel: abortionCause
      ? (ABORTION_CAUSE_LABELS[abortionCause] ?? abortionCause)
      : null,
    abortionCauseDetail: row.abortionCauseDetail ?? null,
    fetusFound: row.fetusFound ?? null,
    motherWeightKg: row.motherWeightKg ?? null,
    placentaRetention: row.placentaRetention ?? false,
    retentionHours: row.retentionHours ?? null,
    retentionIntervention: row.retentionIntervention ?? false,
    pregnancyDiagnosisId: row.pregnancyDiagnosisId ?? null,
    attendantName: row.attendantName,
    notes: row.notes ?? null,
    calvesCount: calves.length,
    calves,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateCalvingInput): void {
  if (!input.motherId) {
    throw new CalvingEventError('Mãe é obrigatória', 400);
  }
  if (!input.eventDate) {
    throw new CalvingEventError('Data do evento é obrigatória', 400);
  }
  const evDate = new Date(input.eventDate);
  if (isNaN(evDate.getTime())) {
    throw new CalvingEventError('Data do evento inválida', 400);
  }
  if (!input.eventType || !isValidEventType(input.eventType)) {
    throw new CalvingEventError('Tipo de evento inválido. Use BIRTH ou ABORTION', 400);
  }
  if (!input.attendantName?.trim()) {
    throw new CalvingEventError('Nome do responsável é obrigatório', 400);
  }
  if (input.eventPeriod && !isValidEventPeriod(input.eventPeriod)) {
    throw new CalvingEventError('Período do evento inválido', 400);
  }
  if (input.eventTime) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(input.eventTime)) {
      throw new CalvingEventError('Horário deve estar no formato HH:MM', 400);
    }
  }

  if (input.eventType === 'BIRTH') {
    if (input.birthType && !isValidBirthType(input.birthType)) {
      throw new CalvingEventError('Tipo de parto inválido', 400);
    }
    if (input.presentation && !isValidPresentation(input.presentation)) {
      throw new CalvingEventError('Apresentação inválida. Use ANTERIOR ou POSTERIOR', 400);
    }
    if (!input.calves || input.calves.length === 0) {
      throw new CalvingEventError('Parto deve ter pelo menos 1 cria', 400);
    }
    if (input.calves.length > 3) {
      throw new CalvingEventError('Máximo de 3 crias por parto', 400);
    }
    for (let i = 0; i < input.calves.length; i++) {
      const calf = input.calves[i];
      if (!calf.sex || !isValidCalfSex(calf.sex)) {
        throw new CalvingEventError(`Cria ${i + 1}: sexo inválido. Use MALE ou FEMALE`, 400);
      }
      if (!calf.condition || !isValidCalfCondition(calf.condition)) {
        throw new CalvingEventError(
          `Cria ${i + 1}: condição inválida. Use ALIVE ou STILLBORN`,
          400,
        );
      }
      if (
        calf.condition === 'STILLBORN' &&
        calf.stillbornReason &&
        !isValidStillbornReason(calf.stillbornReason)
      ) {
        throw new CalvingEventError(`Cria ${i + 1}: motivo de natimorto inválido`, 400);
      }
      if (calf.birthWeightKg !== undefined && calf.birthWeightKg !== null) {
        if (
          typeof calf.birthWeightKg !== 'number' ||
          calf.birthWeightKg <= 0 ||
          calf.birthWeightKg > 100
        ) {
          throw new CalvingEventError(
            `Cria ${i + 1}: peso ao nascer deve ser entre 0 e 100 kg`,
            400,
          );
        }
      }
    }
  }

  if (input.eventType === 'ABORTION') {
    if (input.abortionCause && !isValidAbortionCause(input.abortionCause)) {
      throw new CalvingEventError('Causa de aborto inválida', 400);
    }
    if (input.abortionGestationDays !== undefined && input.abortionGestationDays !== null) {
      if (
        typeof input.abortionGestationDays !== 'number' ||
        input.abortionGestationDays < 1 ||
        input.abortionGestationDays > 300
      ) {
        throw new CalvingEventError('Idade gestacional deve ser entre 1 e 300 dias', 400);
      }
    }
  }

  if (input.motherWeightKg !== undefined && input.motherWeightKg !== null) {
    if (
      typeof input.motherWeightKg !== 'number' ||
      input.motherWeightKg <= 0 ||
      input.motherWeightKg > 2000
    ) {
      throw new CalvingEventError('Peso da mãe deve ser entre 0 e 2000 kg', 400);
    }
  }

  if (input.retentionHours !== undefined && input.retentionHours !== null) {
    if (typeof input.retentionHours !== 'number' || input.retentionHours < 0) {
      throw new CalvingEventError('Horas de retenção deve ser >= 0', 400);
    }
  }
}

// ─── Auto-generate earTag for calf ────────────────────────────────

async function generateCalfEarTag(tx: any, farmId: string, motherEarTag: string): Promise<string> {
  // Find existing calves with motherEarTag prefix
  const existing = await tx.animal.findMany({
    where: {
      farmId,
      earTag: { startsWith: `${motherEarTag}-` },
      deletedAt: null,
    },
    select: { earTag: true },
    orderBy: { earTag: 'desc' },
  });

  let seq = 1;
  if (existing.length > 0) {
    for (const a of existing) {
      const suffix = a.earTag.split('-').pop();
      const num = parseInt(suffix ?? '0', 10);
      if (!isNaN(num) && num >= seq) {
        seq = num + 1;
      }
    }
  }

  return `${motherEarTag}-${seq}`;
}

// ─── Calculate breed composition (CA6) ──────────────────────────────

async function calculateCalfBreedComposition(
  tx: any,
  motherId: string,
  fatherId: string | null,
): Promise<Array<{ breedId: string; percentage: number }>> {
  // Get mother compositions
  const motherComps = await tx.animalBreedComposition.findMany({
    where: { animalId: motherId },
    select: { breedId: true, percentage: true },
  });

  if (!fatherId) {
    // Without father, inherit mother's composition
    return motherComps.map((c: any) => ({
      breedId: c.breedId,
      percentage: Number(c.percentage),
    }));
  }

  const fatherComps = await tx.animalBreedComposition.findMany({
    where: { animalId: fatherId },
    select: { breedId: true, percentage: true },
  });

  if (motherComps.length === 0 && fatherComps.length === 0) {
    return [];
  }

  // Average mother + father compositions
  const breedMap = new Map<string, number>();

  for (const comp of motherComps) {
    const pct = Number(comp.percentage);
    breedMap.set(comp.breedId, (breedMap.get(comp.breedId) ?? 0) + pct / 2);
  }

  for (const comp of fatherComps) {
    const pct = Number(comp.percentage);
    breedMap.set(comp.breedId, (breedMap.get(comp.breedId) ?? 0) + pct / 2);
  }

  return Array.from(breedMap.entries()).map(([breedId, percentage]) => ({
    breedId,
    percentage: Math.round(percentage * 100) / 100,
  }));
}

// ─── CREATE (CA1-CA9) ────────────────────────────────────────────────

export async function createCalvingEvent(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateCalvingInput,
): Promise<CalvingEventItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate mother exists and is female
    const mother = await (tx as any).animal.findFirst({
      where: { id: input.motherId, farmId, deletedAt: null },
      select: { id: true, sex: true, earTag: true, name: true },
    });
    if (!mother) {
      throw new CalvingEventError('Mãe não encontrada', 404);
    }
    if (mother.sex !== 'FEMALE') {
      throw new CalvingEventError(
        `Animal ${mother.earTag} não é fêmea. Registro de parto/aborto é apenas para fêmeas`,
        400,
      );
    }

    // Validate father if provided
    if (input.fatherId) {
      const father = await (tx as any).animal.findFirst({
        where: { id: input.fatherId, farmId, deletedAt: null },
        select: { id: true },
      });
      if (!father) {
        throw new CalvingEventError('Pai não encontrado', 404);
      }
    }

    const evDate = new Date(input.eventDate);
    const eventType = input.eventType as CalvingEventTypeValue;

    // Build event data
    const data: any = {
      organizationId: ctx.organizationId,
      farmId,
      motherId: input.motherId,
      fatherId: input.fatherId ?? null,
      fatherBreedName: input.fatherBreedName?.trim() ?? null,
      eventType,
      eventDate: evDate,
      eventTime: input.eventTime ?? null,
      eventPeriod: input.eventPeriod ?? null,
      attendantName: input.attendantName.trim(),
      notes: input.notes ?? null,
      recordedBy: userId,
      motherWeightKg: input.motherWeightKg ?? null,
      placentaRetention: input.placentaRetention ?? false,
      retentionHours: input.placentaRetention ? (input.retentionHours ?? null) : null,
      retentionIntervention: input.placentaRetention
        ? (input.retentionIntervention ?? false)
        : false,
      pregnancyDiagnosisId: input.pregnancyDiagnosisId ?? null,
    };

    if (eventType === 'BIRTH') {
      data.birthType = input.birthType ?? 'NORMAL';
      data.presentation = input.presentation ?? null;
    } else {
      // ABORTION
      data.abortionGestationDays = input.abortionGestationDays ?? null;
      data.abortionCause = input.abortionCause ?? null;
      data.abortionCauseDetail = input.abortionCauseDetail?.trim() ?? null;
      data.fetusFound = input.fetusFound ?? null;
    }

    const event = await (tx as any).calvingEvent.create({
      data,
      select: { id: true },
    });

    // Create calves (CA5) for birth events
    let hasAliveCalf = false;
    if (eventType === 'BIRTH' && input.calves && input.calves.length > 0) {
      for (const calfInput of input.calves) {
        const condition = calfInput.condition as CalfConditionValue;
        let createdAnimalId: string | null = null;
        let earTag = calfInput.earTag?.trim() ?? null;

        if (condition === 'ALIVE') {
          hasAliveCalf = true;

          // Auto-generate earTag if not provided (CA6)
          if (!earTag) {
            earTag = await generateCalfEarTag(tx as any, farmId, mother.earTag);
          }

          // Check earTag uniqueness
          const existingAnimal = await (tx as any).animal.findFirst({
            where: { farmId, earTag, deletedAt: null },
          });
          if (existingAnimal) {
            throw new CalvingEventError(`Brinco ${earTag} já está em uso na fazenda`, 400);
          }

          // Determine category
          const category = calfInput.sex === 'MALE' ? 'BEZERRO' : 'BEZERRA';

          // Create Animal record (CA6)
          const animal = await (tx as any).animal.create({
            data: {
              farmId,
              earTag,
              sex: calfInput.sex,
              birthDate: evDate,
              category,
              origin: 'BORN',
              entryWeightKg: calfInput.birthWeightKg ?? null,
              sireId: input.fatherId ?? null,
              damId: input.motherId,
              createdBy: userId,
            },
            select: { id: true },
          });
          createdAnimalId = animal.id;

          // Calculate and set breed composition (CA6)
          const compositions = await calculateCalfBreedComposition(
            tx,
            input.motherId,
            input.fatherId ?? null,
          );
          if (compositions.length > 0) {
            await (tx as any).animalBreedComposition.createMany({
              data: compositions.map((c) => ({
                animalId: animal.id,
                breedId: c.breedId,
                percentage: c.percentage,
              })),
            });
          }
        }

        // Create CalvingCalf record
        await (tx as any).calvingCalf.create({
          data: {
            calvingEventId: event.id,
            sex: calfInput.sex,
            birthWeightKg: calfInput.birthWeightKg ?? null,
            condition,
            stillbornReason: condition === 'STILLBORN' ? (calfInput.stillbornReason ?? null) : null,
            createdAnimalId,
            earTag,
            notes: calfInput.notes ?? null,
          },
        });
      }
    }

    // CA9: Update mother reproductive data
    const motherUpdateData: any = {};

    if (eventType === 'BIRTH') {
      motherUpdateData.category = hasAliveCalf ? 'VACA_LACTACAO' : 'VACA_SECA';

      // Count previous births for calving interval
      const previousBirths = await (tx as any).calvingEvent.findMany({
        where: {
          motherId: input.motherId,
          eventType: 'BIRTH',
          id: { not: event.id },
        },
        select: { eventDate: true },
        orderBy: { eventDate: 'desc' },
        take: 1,
      });

      if (previousBirths.length > 0) {
        const lastBirthDate = previousBirths[0].eventDate as Date;
        const intervalDays = Math.round(
          (evDate.getTime() - lastBirthDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        // Store calving interval as a reproductive record note
        motherUpdateData.notes = `Intervalo entre partos: ${intervalDays} dias`;
      }
    }

    if (Object.keys(motherUpdateData).length > 0) {
      await (tx as any).animal.update({
        where: { id: input.motherId },
        data: motherUpdateData,
      });
    }

    // Fetch complete event with relations
    const row = await (tx as any).calvingEvent.findUnique({
      where: { id: event.id },
      include: CALVING_INCLUDE,
    });

    return toCalvingItem(row);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listCalvingEvents(
  ctx: RlsContext,
  farmId: string,
  query: ListCalvingsQuery,
): Promise<{ data: CalvingEventItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.eventType) where.eventType = query.eventType;
    if (query.motherId) where.motherId = query.motherId;
    if (query.dateFrom || query.dateTo) {
      where.eventDate = {};
      if (query.dateFrom) where.eventDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.eventDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).calvingEvent.findMany({
        where,
        include: CALVING_INCLUDE,
        orderBy: { eventDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).calvingEvent.count({ where }),
    ]);

    return {
      data: rows.map(toCalvingItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getCalvingEvent(
  ctx: RlsContext,
  farmId: string,
  eventId: string,
): Promise<CalvingEventItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).calvingEvent.findFirst({
      where: { id: eventId, farmId },
      include: CALVING_INCLUDE,
    });
    if (!row) {
      throw new CalvingEventError('Evento de parto/aborto não encontrado', 404);
    }
    return toCalvingItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateCalvingEvent(
  ctx: RlsContext,
  farmId: string,
  eventId: string,
  input: UpdateCalvingInput,
): Promise<CalvingEventItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).calvingEvent.findFirst({
      where: { id: eventId, farmId },
    });
    if (!existing) {
      throw new CalvingEventError('Evento de parto/aborto não encontrado', 404);
    }

    const data: any = {};

    if (input.eventDate !== undefined) {
      const d = new Date(input.eventDate);
      if (isNaN(d.getTime())) {
        throw new CalvingEventError('Data do evento inválida', 400);
      }
      data.eventDate = d;
    }

    if (input.fatherId !== undefined) data.fatherId = input.fatherId;
    if (input.fatherBreedName !== undefined)
      data.fatherBreedName = input.fatherBreedName?.trim() ?? null;
    if (input.eventTime !== undefined) data.eventTime = input.eventTime;
    if (input.eventPeriod !== undefined) {
      if (input.eventPeriod && !isValidEventPeriod(input.eventPeriod)) {
        throw new CalvingEventError('Período do evento inválido', 400);
      }
      data.eventPeriod = input.eventPeriod;
    }

    if (input.birthType !== undefined) {
      if (input.birthType && !isValidBirthType(input.birthType)) {
        throw new CalvingEventError('Tipo de parto inválido', 400);
      }
      data.birthType = input.birthType;
    }
    if (input.presentation !== undefined) {
      if (input.presentation && !isValidPresentation(input.presentation)) {
        throw new CalvingEventError('Apresentação inválida', 400);
      }
      data.presentation = input.presentation;
    }

    if (input.abortionGestationDays !== undefined)
      data.abortionGestationDays = input.abortionGestationDays;
    if (input.abortionCause !== undefined) {
      if (input.abortionCause && !isValidAbortionCause(input.abortionCause)) {
        throw new CalvingEventError('Causa de aborto inválida', 400);
      }
      data.abortionCause = input.abortionCause;
    }
    if (input.abortionCauseDetail !== undefined)
      data.abortionCauseDetail = input.abortionCauseDetail?.trim() ?? null;
    if (input.fetusFound !== undefined) data.fetusFound = input.fetusFound;

    if (input.motherWeightKg !== undefined) data.motherWeightKg = input.motherWeightKg;
    if (input.placentaRetention !== undefined) data.placentaRetention = input.placentaRetention;
    if (input.retentionHours !== undefined) data.retentionHours = input.retentionHours;
    if (input.retentionIntervention !== undefined)
      data.retentionIntervention = input.retentionIntervention;

    if (input.attendantName !== undefined) {
      if (!input.attendantName?.trim()) {
        throw new CalvingEventError('Nome do responsável é obrigatório', 400);
      }
      data.attendantName = input.attendantName.trim();
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).calvingEvent.update({
      where: { id: eventId },
      data,
      include: CALVING_INCLUDE,
    });

    return toCalvingItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteCalvingEvent(
  ctx: RlsContext,
  farmId: string,
  eventId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).calvingEvent.findFirst({
      where: { id: eventId, farmId },
      include: { calves: { select: { createdAnimalId: true } } },
    });
    if (!existing) {
      throw new CalvingEventError('Evento de parto/aborto não encontrado', 404);
    }

    // Soft-delete animals that were auto-created from this calving event
    const createdAnimalIds = existing.calves.map((c: any) => c.createdAnimalId).filter(Boolean);

    if (createdAnimalIds.length > 0) {
      await (tx as any).animal.updateMany({
        where: { id: { in: createdAnimalIds } },
        data: { deletedAt: new Date() },
      });
    }

    await (tx as any).calvingEvent.delete({ where: { id: eventId } });
  });
}

// ─── UPCOMING BIRTHS (CA12) ─────────────────────────────────────────

export async function getUpcomingBirths(
  ctx: RlsContext,
  farmId: string,
  daysAhead?: number,
): Promise<UpcomingBirthItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const now = new Date();
    const maxDays = daysAhead ?? 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + maxDays);

    const rows = await (tx as any).pregnancyDiagnosis.findMany({
      where: {
        farmId,
        result: 'PREGNANT',
        expectedCalvingDate: {
          gte: now,
          lte: endDate,
        },
        lossDate: null,
      },
      include: {
        animal: { select: { earTag: true, name: true } },
      },
      orderBy: { expectedCalvingDate: 'asc' },
    });

    return rows.map((row: any) => {
      const ecDate = row.expectedCalvingDate as Date;
      const daysUntil = Math.round((ecDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        diagnosisId: row.id,
        animalId: row.animalId,
        animalEarTag: row.animal?.earTag ?? '',
        animalName: row.animal?.name ?? null,
        expectedCalvingDate: ecDate.toISOString().slice(0, 10),
        gestationDays: row.gestationDays ?? null,
        isConfirmed: row.isConfirmed ?? false,
        bullId: row.bullId ?? null,
        bullName: null,
        bullBreedName: row.bullBreedName ?? null,
        daysUntil,
      };
    });
  });
}

// ─── INDICATORS ─────────────────────────────────────────────────────

export async function getCalvingIndicators(
  ctx: RlsContext,
  farmId: string,
): Promise<CalvingIndicators> {
  return withRlsContext(ctx, async (tx) => {
    // Last 365 days
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 365);
    const periodStartStr = periodStart.toISOString().slice(0, 10);

    const events = await (tx as any).calvingEvent.findMany({
      where: {
        farmId,
        eventDate: {
          gte: new Date(periodStartStr),
          lte: new Date(periodEnd),
        },
      },
      include: {
        calves: { select: { condition: true, birthWeightKg: true } },
      },
    });

    const totalEvents = events.length;
    const birthCount = events.filter((e: any) => e.eventType === 'BIRTH').length;
    const abortionCount = events.filter((e: any) => e.eventType === 'ABORTION').length;

    // Calves stats
    const allCalves = events.flatMap((e: any) => e.calves ?? []);
    const totalCalves = allCalves.length;
    const aliveCalves = allCalves.filter((c: any) => c.condition === 'ALIVE').length;
    const stillbornCalves = allCalves.filter((c: any) => c.condition === 'STILLBORN').length;

    const stillbornRate =
      totalCalves > 0 ? Math.round((stillbornCalves / totalCalves) * 1000) / 10 : null;

    // Average birth weight
    const weights = allCalves
      .filter((c: any) => c.birthWeightKg != null)
      .map((c: any) => c.birthWeightKg as number);
    const avgBirthWeightKg =
      weights.length > 0
        ? Math.round((weights.reduce((a: number, b: number) => a + b, 0) / weights.length) * 10) /
          10
        : null;

    // Twin rate: births with >1 calf / total births
    const birthEvents = events.filter((e: any) => e.eventType === 'BIRTH');
    const twinBirths = birthEvents.filter((e: any) => (e.calves?.length ?? 0) > 1).length;
    const twinRate = birthCount > 0 ? Math.round((twinBirths / birthCount) * 1000) / 10 : null;

    // Abortion rate
    const abortionRate =
      totalEvents > 0 ? Math.round((abortionCount / totalEvents) * 1000) / 10 : null;

    return {
      totalEvents,
      birthCount,
      abortionCount,
      totalCalves,
      aliveCalves,
      stillbornCalves,
      stillbornRate,
      avgBirthWeightKg,
      twinRate,
      abortionRate,
      periodStart: periodStartStr,
      periodEnd,
    };
  });
}
