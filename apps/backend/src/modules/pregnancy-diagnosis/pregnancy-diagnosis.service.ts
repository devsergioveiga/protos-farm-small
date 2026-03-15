import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PregnancyDiagnosisError,
  DG_RESULT_LABELS,
  DG_METHOD_LABELS,
  UTERINE_CONDITION_LABELS,
  CYCLICITY_STATUS_LABELS,
  FETAL_SEX_LABELS,
  RESTRICTIVE_CONDITIONS,
  RESTRICTION_WAIT_DAYS,
  AVG_GESTATION_DAYS,
  isValidDgResult,
  isValidDgMethod,
  isValidUterineCondition,
  isValidCyclicityStatus,
  isValidFetalSex,
  type DgResultValue,
  type DgMethodValue,
  type UterineConditionValue,
  type CyclicityStatusValue,
  type FetalSexValue,
  type CreateDiagnosisInput,
  type UpdateDiagnosisInput,
  type ConfirmPregnancyInput,
  type RecordLossInput,
  type ReferToIatfInput,
  type ListDiagnosesQuery,
  type DiagnosisItem,
  type CalvingCalendarItem,
  type DgIndicators,
  type EmptyFemaleItem,
} from './pregnancy-diagnosis.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

const DIAGNOSIS_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function calcExpectedCalvingDate(diagnosisDate: Date, gestationDays: number): Date {
  const result = new Date(diagnosisDate);
  result.setDate(result.getDate() + (AVG_GESTATION_DAYS - gestationDays));
  return result;
}

function calcRestrictionEndDate(
  diagnosisDate: Date,
  condition: UterineConditionValue,
): Date | null {
  const waitDays = RESTRICTION_WAIT_DAYS[condition];
  if (!waitDays) return null;
  const endDate = new Date(diagnosisDate);
  endDate.setDate(endDate.getDate() + waitDays);
  return endDate;
}

function toDiagnosisItem(row: any): DiagnosisItem {
  const result = row.result as DgResultValue;
  const method = row.method as DgMethodValue;
  const uterineCondition = row.uterineCondition as UterineConditionValue;
  const fetalSex = row.fetalSex as FetalSexValue | null;
  const cyclicityStatus = row.cyclicityStatus as CyclicityStatusValue | null;

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    diagnosisDate: (row.diagnosisDate as Date).toISOString().slice(0, 10),
    result,
    resultLabel: DG_RESULT_LABELS[result] ?? result,
    method,
    methodLabel: DG_METHOD_LABELS[method] ?? method,
    gestationDays: row.gestationDays ?? null,
    fetalSex: fetalSex ?? null,
    fetalSexLabel: fetalSex ? (FETAL_SEX_LABELS[fetalSex] ?? fetalSex) : null,
    cyclicityStatus: cyclicityStatus ?? null,
    cyclicityStatusLabel: cyclicityStatus
      ? (CYCLICITY_STATUS_LABELS[cyclicityStatus] ?? cyclicityStatus)
      : null,
    expectedCalvingDate: row.expectedCalvingDate
      ? (row.expectedCalvingDate as Date).toISOString().slice(0, 10)
      : null,
    uterineCondition,
    uterineConditionLabel: UTERINE_CONDITION_LABELS[uterineCondition] ?? uterineCondition,
    placentaRetentionHours: row.placentaRetentionHours ?? null,
    reproductiveRestriction: row.reproductiveRestriction ?? false,
    restrictionEndDate: row.restrictionEndDate
      ? (row.restrictionEndDate as Date).toISOString().slice(0, 10)
      : null,
    inseminationId: row.inseminationId ?? null,
    naturalMatingId: row.naturalMatingId ?? null,
    linkedTreatmentId: row.linkedTreatmentId ?? null,
    bullId: row.bullId ?? null,
    bullName: null, // bull relation not included in basic query
    bullBreedName: row.bullBreedName ?? null,
    isConfirmed: row.isConfirmed ?? false,
    confirmationDate: row.confirmationDate
      ? (row.confirmationDate as Date).toISOString().slice(0, 10)
      : null,
    lossDate: row.lossDate ? (row.lossDate as Date).toISOString().slice(0, 10) : null,
    lossReason: row.lossReason ?? null,
    referredToIatf: row.referredToIatf ?? false,
    referredProtocolId: row.referredProtocolId ?? null,
    veterinaryName: row.veterinaryName,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateCreateInput(input: CreateDiagnosisInput): void {
  if (!input.animalId) {
    throw new PregnancyDiagnosisError('Animal é obrigatório', 400);
  }
  if (!input.diagnosisDate) {
    throw new PregnancyDiagnosisError('Data do diagnóstico é obrigatória', 400);
  }
  const diagDate = new Date(input.diagnosisDate);
  if (isNaN(diagDate.getTime())) {
    throw new PregnancyDiagnosisError('Data do diagnóstico inválida', 400);
  }
  if (!input.result || !isValidDgResult(input.result)) {
    throw new PregnancyDiagnosisError('Resultado do diagnóstico inválido', 400);
  }
  if (!input.method || !isValidDgMethod(input.method)) {
    throw new PregnancyDiagnosisError('Método do diagnóstico inválido', 400);
  }
  if (!input.veterinaryName?.trim()) {
    throw new PregnancyDiagnosisError('Nome do veterinário é obrigatório', 400);
  }
  if (input.fetalSex && !isValidFetalSex(input.fetalSex)) {
    throw new PregnancyDiagnosisError('Sexo fetal inválido', 400);
  }
  if (input.cyclicityStatus && !isValidCyclicityStatus(input.cyclicityStatus)) {
    throw new PregnancyDiagnosisError('Status de ciclicidade inválido', 400);
  }
  if (input.uterineCondition && !isValidUterineCondition(input.uterineCondition)) {
    throw new PregnancyDiagnosisError('Condição uterina inválida', 400);
  }
  if (input.gestationDays !== undefined && input.gestationDays !== null) {
    if (
      typeof input.gestationDays !== 'number' ||
      input.gestationDays < 1 ||
      input.gestationDays > AVG_GESTATION_DAYS
    ) {
      throw new PregnancyDiagnosisError(
        `Dias de gestação deve ser entre 1 e ${AVG_GESTATION_DAYS}`,
        400,
      );
    }
  }
  if (input.placentaRetentionHours !== undefined && input.placentaRetentionHours !== null) {
    if (typeof input.placentaRetentionHours !== 'number' || input.placentaRetentionHours < 0) {
      throw new PregnancyDiagnosisError('Horas de retenção de placenta deve ser >= 0', 400);
    }
  }
}

// ─── CREATE (CA1, CA2, CA3, CA4, CA5, CA6, CA7) ─────────────────────

export async function createDiagnosis(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateDiagnosisInput,
): Promise<DiagnosisItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate animal exists
    const animal = await (tx as any).animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
      select: { id: true, sex: true, earTag: true },
    });
    if (!animal) {
      throw new PregnancyDiagnosisError('Animal não encontrado', 404);
    }
    if (animal.sex !== 'FEMALE') {
      throw new PregnancyDiagnosisError(
        `Animal ${animal.earTag} não é fêmea. Diagnóstico de gestação é apenas para fêmeas`,
        400,
      );
    }

    const diagDate = new Date(input.diagnosisDate);
    const result = input.result as DgResultValue;
    const uterineCondition = (input.uterineCondition ?? 'NONE') as UterineConditionValue;

    // CA7: Calculate expected calving date
    let expectedCalvingDate: Date | null = null;
    if (result === 'PREGNANT' && input.gestationDays) {
      expectedCalvingDate = calcExpectedCalvingDate(diagDate, input.gestationDays);
    }

    // CA4: Reproductive restriction for uterine conditions
    let reproductiveRestriction = false;
    let restrictionEndDate: Date | null = null;
    if (RESTRICTIVE_CONDITIONS.includes(uterineCondition)) {
      reproductiveRestriction = true;
      restrictionEndDate = calcRestrictionEndDate(diagDate, uterineCondition);
    }

    const data: any = {
      organizationId: ctx.organizationId,
      farmId,
      animalId: input.animalId,
      diagnosisDate: diagDate,
      result,
      method: input.method,
      gestationDays: input.gestationDays ?? null,
      fetalSex: input.fetalSex ?? null,
      cyclicityStatus:
        result === 'EMPTY' || result === 'CYCLING' ? (input.cyclicityStatus ?? null) : null,
      expectedCalvingDate,
      uterineCondition,
      placentaRetentionHours:
        uterineCondition === 'PLACENTA_RETENTION' ? (input.placentaRetentionHours ?? null) : null,
      reproductiveRestriction,
      restrictionEndDate,
      inseminationId: input.inseminationId ?? null,
      naturalMatingId: input.naturalMatingId ?? null,
      bullId: input.bullId ?? null,
      bullBreedName: input.bullBreedName?.trim() ?? null,
      veterinaryName: input.veterinaryName.trim(),
      notes: input.notes ?? null,
      recordedBy: userId,
    };

    const row = await (tx as any).pregnancyDiagnosis.create({
      data,
      include: DIAGNOSIS_INCLUDE,
    });

    // CA6: Auto-generate retroactive natural mating when pregnant without prior IA/monta and bull informed
    if (
      result === 'PREGNANT' &&
      !input.inseminationId &&
      !input.naturalMatingId &&
      (input.bullId || input.bullBreedName?.trim()) &&
      input.gestationDays
    ) {
      const estimatedMatingDate = new Date(diagDate);
      estimatedMatingDate.setDate(estimatedMatingDate.getDate() - input.gestationDays);

      const matingData: any = {
        organizationId: ctx.organizationId,
        farmId,
        bullId: input.bullId ?? null,
        bullBreedName: input.bullId ? null : (input.bullBreedName?.trim() ?? null),
        reason: 'DIRECT_COVERAGE',
        entryDate: estimatedMatingDate,
        exitDate: estimatedMatingDate, // same day for retroactive
        maxStayDays: 1,
        isOverstay: false,
        paternityType: input.bullId ? 'PROBABLE_NATURAL' : 'UNKNOWN_BREED_ONLY',
        notes: `Monta natural retroativa gerada pelo DG ${row.id}`,
        recordedBy: userId,
        animals: {
          create: [{ animalId: input.animalId }],
        },
      };

      const mating = await (tx as any).naturalMating.create({
        data: matingData,
        select: { id: true },
      });

      // Update diagnosis with mating link
      await (tx as any).pregnancyDiagnosis.update({
        where: { id: row.id },
        data: { naturalMatingId: mating.id },
      });

      row.naturalMatingId = mating.id;
    }

    return toDiagnosisItem(row);
  });
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listDiagnoses(
  ctx: RlsContext,
  farmId: string,
  query: ListDiagnosesQuery,
): Promise<{ data: DiagnosisItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.result) where.result = query.result;
    if (query.animalId) where.animalId = query.animalId;
    if (query.dateFrom || query.dateTo) {
      where.diagnosisDate = {};
      if (query.dateFrom) where.diagnosisDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.diagnosisDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).pregnancyDiagnosis.findMany({
        where,
        include: DIAGNOSIS_INCLUDE,
        orderBy: { diagnosisDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).pregnancyDiagnosis.count({ where }),
    ]);

    return {
      data: rows.map(toDiagnosisItem),
      total,
    };
  });
}

// ─── GET ────────────────────────────────────────────────────────────

export async function getDiagnosis(
  ctx: RlsContext,
  farmId: string,
  diagnosisId: string,
): Promise<DiagnosisItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).pregnancyDiagnosis.findFirst({
      where: { id: diagnosisId, farmId },
      include: DIAGNOSIS_INCLUDE,
    });
    if (!row) {
      throw new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404);
    }
    return toDiagnosisItem(row);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateDiagnosis(
  ctx: RlsContext,
  farmId: string,
  diagnosisId: string,
  input: UpdateDiagnosisInput,
): Promise<DiagnosisItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).pregnancyDiagnosis.findFirst({
      where: { id: diagnosisId, farmId },
    });
    if (!existing) {
      throw new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404);
    }

    const data: any = {};

    if (input.diagnosisDate !== undefined) {
      const d = new Date(input.diagnosisDate);
      if (isNaN(d.getTime())) {
        throw new PregnancyDiagnosisError('Data do diagnóstico inválida', 400);
      }
      data.diagnosisDate = d;
    }

    if (input.result !== undefined) {
      if (!isValidDgResult(input.result)) {
        throw new PregnancyDiagnosisError('Resultado do diagnóstico inválido', 400);
      }
      data.result = input.result;
    }

    if (input.method !== undefined) {
      if (!isValidDgMethod(input.method)) {
        throw new PregnancyDiagnosisError('Método do diagnóstico inválido', 400);
      }
      data.method = input.method;
    }

    if (input.gestationDays !== undefined) {
      if (input.gestationDays !== null) {
        if (
          typeof input.gestationDays !== 'number' ||
          input.gestationDays < 1 ||
          input.gestationDays > AVG_GESTATION_DAYS
        ) {
          throw new PregnancyDiagnosisError(
            `Dias de gestação deve ser entre 1 e ${AVG_GESTATION_DAYS}`,
            400,
          );
        }
      }
      data.gestationDays = input.gestationDays;
    }

    if (input.fetalSex !== undefined) {
      if (input.fetalSex && !isValidFetalSex(input.fetalSex)) {
        throw new PregnancyDiagnosisError('Sexo fetal inválido', 400);
      }
      data.fetalSex = input.fetalSex;
    }

    if (input.cyclicityStatus !== undefined) {
      if (input.cyclicityStatus && !isValidCyclicityStatus(input.cyclicityStatus)) {
        throw new PregnancyDiagnosisError('Status de ciclicidade inválido', 400);
      }
      data.cyclicityStatus = input.cyclicityStatus;
    }

    if (input.uterineCondition !== undefined) {
      if (input.uterineCondition && !isValidUterineCondition(input.uterineCondition)) {
        throw new PregnancyDiagnosisError('Condição uterina inválida', 400);
      }
      const uc = (input.uterineCondition ?? 'NONE') as UterineConditionValue;
      data.uterineCondition = uc;

      // Recalculate restriction
      const diagDate = data.diagnosisDate ?? (existing.diagnosisDate as Date);
      if (RESTRICTIVE_CONDITIONS.includes(uc)) {
        data.reproductiveRestriction = true;
        data.restrictionEndDate = calcRestrictionEndDate(diagDate, uc);
      } else {
        data.reproductiveRestriction = false;
        data.restrictionEndDate = null;
      }
    }

    if (input.placentaRetentionHours !== undefined) {
      data.placentaRetentionHours = input.placentaRetentionHours;
    }

    if (input.veterinaryName !== undefined) {
      if (!input.veterinaryName?.trim()) {
        throw new PregnancyDiagnosisError('Nome do veterinário é obrigatório', 400);
      }
      data.veterinaryName = input.veterinaryName.trim();
    }

    if (input.inseminationId !== undefined) data.inseminationId = input.inseminationId;
    if (input.naturalMatingId !== undefined) data.naturalMatingId = input.naturalMatingId;
    if (input.bullId !== undefined) data.bullId = input.bullId;
    if (input.bullBreedName !== undefined) data.bullBreedName = input.bullBreedName?.trim() ?? null;
    if (input.notes !== undefined) data.notes = input.notes;

    // Recalculate expected calving date if result or gestationDays changed
    const finalResult = (data.result ?? existing.result) as DgResultValue;
    const finalGestationDays =
      data.gestationDays !== undefined ? data.gestationDays : existing.gestationDays;
    const finalDiagDate = data.diagnosisDate ?? (existing.diagnosisDate as Date);

    if (finalResult === 'PREGNANT' && finalGestationDays) {
      data.expectedCalvingDate = calcExpectedCalvingDate(finalDiagDate, finalGestationDays);
    } else {
      data.expectedCalvingDate = null;
    }

    const row = await (tx as any).pregnancyDiagnosis.update({
      where: { id: diagnosisId },
      data,
      include: DIAGNOSIS_INCLUDE,
    });

    return toDiagnosisItem(row);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteDiagnosis(
  ctx: RlsContext,
  farmId: string,
  diagnosisId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).pregnancyDiagnosis.findFirst({
      where: { id: diagnosisId, farmId },
    });
    if (!existing) {
      throw new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404);
    }

    await (tx as any).pregnancyDiagnosis.delete({ where: { id: diagnosisId } });
  });
}

// ─── CONFIRM PREGNANCY (CA12) ──────────────────────────────────────

export async function confirmPregnancy(
  ctx: RlsContext,
  farmId: string,
  diagnosisId: string,
  input: ConfirmPregnancyInput,
): Promise<DiagnosisItem> {
  if (!input.confirmationDate) {
    throw new PregnancyDiagnosisError('Data de confirmação é obrigatória', 400);
  }
  const confirmDate = new Date(input.confirmationDate);
  if (isNaN(confirmDate.getTime())) {
    throw new PregnancyDiagnosisError('Data de confirmação inválida', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).pregnancyDiagnosis.findFirst({
      where: { id: diagnosisId, farmId },
    });
    if (!existing) {
      throw new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404);
    }
    if (existing.result !== 'PREGNANT') {
      throw new PregnancyDiagnosisError(
        'Somente diagnósticos com resultado "Gestante" podem ser confirmados',
        400,
      );
    }
    if (existing.isConfirmed) {
      throw new PregnancyDiagnosisError('Diagnóstico já confirmado', 400);
    }

    const data: any = {
      isConfirmed: true,
      confirmationDate: confirmDate,
    };
    if (input.notes) {
      data.notes = input.notes;
    }

    const row = await (tx as any).pregnancyDiagnosis.update({
      where: { id: diagnosisId },
      data,
      include: DIAGNOSIS_INCLUDE,
    });

    return toDiagnosisItem(row);
  });
}

// ─── RECORD LOSS (CA12) ────────────────────────────────────────────

export async function recordLoss(
  ctx: RlsContext,
  farmId: string,
  diagnosisId: string,
  input: RecordLossInput,
): Promise<DiagnosisItem> {
  if (!input.lossDate) {
    throw new PregnancyDiagnosisError('Data da perda é obrigatória', 400);
  }
  const lossDate = new Date(input.lossDate);
  if (isNaN(lossDate.getTime())) {
    throw new PregnancyDiagnosisError('Data da perda inválida', 400);
  }
  if (!input.lossReason?.trim()) {
    throw new PregnancyDiagnosisError('Motivo da perda é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).pregnancyDiagnosis.findFirst({
      where: { id: diagnosisId, farmId },
    });
    if (!existing) {
      throw new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404);
    }
    if (existing.result !== 'PREGNANT') {
      throw new PregnancyDiagnosisError(
        'Somente diagnósticos com resultado "Gestante" podem registrar perda',
        400,
      );
    }

    const data: any = {
      result: 'LOSS',
      lossDate,
      lossReason: input.lossReason.trim(),
      expectedCalvingDate: null,
    };
    if (input.notes) {
      data.notes = input.notes;
    }

    const row = await (tx as any).pregnancyDiagnosis.update({
      where: { id: diagnosisId },
      data,
      include: DIAGNOSIS_INCLUDE,
    });

    return toDiagnosisItem(row);
  });
}

// ─── CALVING CALENDAR (CA8) ────────────────────────────────────────

export async function getCalvingCalendar(
  ctx: RlsContext,
  farmId: string,
  monthsAhead?: number,
): Promise<CalvingCalendarItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const now = new Date();
    const maxMonths = monthsAhead ?? 6;
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + maxMonths);

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

    // Group by month
    const monthMap = new Map<string, CalvingCalendarItem>();

    for (const row of rows) {
      const ecDate = row.expectedCalvingDate as Date;
      const monthKey = ecDate.toISOString().slice(0, 7); // YYYY-MM
      const monthIdx = ecDate.getMonth();
      const year = ecDate.getFullYear();
      const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          monthLabel,
          expectedCalvings: [],
          count: 0,
        });
      }

      const entry = monthMap.get(monthKey)!;
      entry.expectedCalvings.push({
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
      });
      entry.count = entry.expectedCalvings.length;
    }

    return Array.from(monthMap.values());
  });
}

// ─── EMPTY FEMALES (CA10) ──────────────────────────────────────────

export async function getEmptyFemales(ctx: RlsContext, farmId: string): Promise<EmptyFemaleItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const rows = await (tx as any).pregnancyDiagnosis.findMany({
      where: {
        farmId,
        result: { in: ['EMPTY', 'CYCLING'] },
      },
      include: {
        animal: { select: { earTag: true, name: true } },
      },
      orderBy: { diagnosisDate: 'desc' },
    });

    // Keep only the latest diagnosis per animal
    const latestByAnimal = new Map<string, any>();
    for (const row of rows) {
      if (!latestByAnimal.has(row.animalId)) {
        latestByAnimal.set(row.animalId, row);
      }
    }

    const now = new Date();
    const items: EmptyFemaleItem[] = [];

    for (const row of latestByAnimal.values()) {
      const diagDate = row.diagnosisDate as Date;
      const daysSince = Math.round((now.getTime() - diagDate.getTime()) / (1000 * 60 * 60 * 24));
      const cyclicityStatus = row.cyclicityStatus as CyclicityStatusValue | null;

      items.push({
        animalId: row.animalId,
        animalEarTag: row.animal?.earTag ?? '',
        animalName: row.animal?.name ?? null,
        diagnosisId: row.id,
        diagnosisDate: diagDate.toISOString().slice(0, 10),
        cyclicityStatus: cyclicityStatus ?? null,
        cyclicityStatusLabel: cyclicityStatus
          ? (CYCLICITY_STATUS_LABELS[cyclicityStatus] ?? cyclicityStatus)
          : null,
        referredToIatf: row.referredToIatf ?? false,
        referredProtocolId: row.referredProtocolId ?? null,
        daysSinceDiagnosis: daysSince,
      });
    }

    // Sort by days since diagnosis descending
    items.sort((a, b) => b.daysSinceDiagnosis - a.daysSinceDiagnosis);

    return items;
  });
}

// ─── INDICATORS (CA9, CA12) ────────────────────────────────────────

export async function getDgIndicators(ctx: RlsContext, farmId: string): Promise<DgIndicators> {
  return withRlsContext(ctx, async (tx) => {
    // Last 365 days
    const now = new Date();
    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 365);
    const periodStartStr = periodStart.toISOString().slice(0, 10);

    const rows = await (tx as any).pregnancyDiagnosis.findMany({
      where: {
        farmId,
        diagnosisDate: {
          gte: new Date(periodStartStr),
          lte: new Date(periodEnd),
        },
      },
      select: {
        id: true,
        result: true,
        bullId: true,
        bullBreedName: true,
        inseminationId: true,
        naturalMatingId: true,
      },
    });

    const totalDiagnoses = rows.length;
    const pregnantCount = rows.filter((r: any) => r.result === 'PREGNANT').length;
    const emptyCount = rows.filter((r: any) => r.result === 'EMPTY').length;
    const lossCount = rows.filter((r: any) => r.result === 'LOSS').length;
    const cyclingCount = rows.filter((r: any) => r.result === 'CYCLING').length;

    // CA9: Pregnancy rate = pregnant / (pregnant + empty + cycling) * 100
    const totalExposed = pregnantCount + emptyCount + cyclingCount;
    const pregnancyRate =
      totalExposed > 0 ? Math.round((pregnantCount / totalExposed) * 1000) / 10 : null;

    // Loss rate = loss / (pregnant + loss) * 100
    const totalPregnantPlusLoss = pregnantCount + lossCount;
    const lossRate =
      totalPregnantPlusLoss > 0
        ? Math.round((lossCount / totalPregnantPlusLoss) * 1000) / 10
        : null;

    // CA12: Conception rate per bull
    const bullMap = new Map<
      string,
      {
        bullId: string | null;
        bullBreedName: string | null;
        pregnantCount: number;
        totalCount: number;
      }
    >();

    for (const row of rows) {
      // Only count rows linked to a bull (identified or breed)
      const key = row.bullId ?? row.bullBreedName ?? null;
      if (!key) continue;

      if (!bullMap.has(key)) {
        bullMap.set(key, {
          bullId: row.bullId ?? null,
          bullBreedName: row.bullBreedName ?? null,
          pregnantCount: 0,
          totalCount: 0,
        });
      }

      const entry = bullMap.get(key)!;
      entry.totalCount++;
      if (row.result === 'PREGNANT') {
        entry.pregnantCount++;
      }
    }

    const conceptionRatePerBull = Array.from(bullMap.values()).map((b) => ({
      bullId: b.bullId,
      bullName: null,
      bullBreedName: b.bullBreedName,
      pregnantCount: b.pregnantCount,
      totalCount: b.totalCount,
      rate: b.totalCount > 0 ? Math.round((b.pregnantCount / b.totalCount) * 1000) / 10 : 0,
    }));

    return {
      totalDiagnoses,
      pregnantCount,
      emptyCount,
      lossCount,
      cyclingCount,
      pregnancyRate,
      lossRate,
      conceptionRatePerBull,
      periodStart: periodStartStr,
      periodEnd,
    };
  });
}

// ─── REFER TO IATF (CA11) ─────────────────────────────────────────

export async function referToIatf(
  ctx: RlsContext,
  farmId: string,
  diagnosisId: string,
  input: ReferToIatfInput,
): Promise<DiagnosisItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).pregnancyDiagnosis.findFirst({
      where: { id: diagnosisId, farmId },
    });
    if (!existing) {
      throw new PregnancyDiagnosisError('Diagnóstico de gestação não encontrado', 404);
    }
    if (existing.result !== 'EMPTY' && existing.result !== 'CYCLING') {
      throw new PregnancyDiagnosisError(
        'Encaminhamento para IATF é apenas para fêmeas vazias ou ciclando',
        400,
      );
    }

    const row = await (tx as any).pregnancyDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        referredToIatf: true,
        referredProtocolId: input.referredProtocolId ?? null,
      },
      include: DIAGNOSIS_INCLUDE,
    });

    return toDiagnosisItem(row);
  });
}
