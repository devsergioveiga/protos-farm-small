import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  AnimalReproductiveError,
  isValidReproductiveEventType,
  isValidHeatIntensity,
  isValidBreedingMethod,
  isValidCalvingType,
  isValidPregnancyConfirmation,
  type CreateReproductiveRecordInput,
  type UpdateReproductiveRecordInput,
  type ReproductiveRecordItem,
  type ReproductiveStats,
  type ReproductiveEventType,
  type HeatIntensity,
  type BreedingMethod,
  type CalvingType,
  type PregnancyConfirmation,
} from './animal-reproductive.types';

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function toRecordItem(row: Record<string, unknown>): ReproductiveRecordItem {
  const recorder = row.recorder as { name: string } | undefined;
  const plannedSire = row.plannedSire as { name: string | null; earTag: string } | null;
  const sireRel = row.sire as { name: string | null; earTag: string } | null;
  const calfRel = row.calf as { earTag: string } | null;

  return {
    id: row.id as string,
    animalId: row.animalId as string,
    farmId: row.farmId as string,
    type: row.type as ReproductiveEventType,
    eventDate: formatDate(row.eventDate as Date)!,
    notes: (row.notes as string) ?? null,
    recordedBy: row.recordedBy as string,
    recorderName: recorder?.name ?? '',

    approvedBy: (row.approvedBy as string) ?? null,
    criteriaDetails: (row.criteriaDetails as string) ?? null,

    heatIntensity: (row.heatIntensity as HeatIntensity) ?? null,
    intervalDays: (row.intervalDays as number) ?? null,

    plannedSireId: (row.plannedSireId as string) ?? null,
    plannedSireName: plannedSire?.name ?? plannedSire?.earTag ?? null,
    breedingMethod: (row.breedingMethod as BreedingMethod) ?? null,
    plannedDate: formatDate(row.plannedDate as Date | null),

    sireId: (row.sireId as string) ?? null,
    sireName: (row.sireName as string) ?? sireRel?.name ?? sireRel?.earTag ?? null,
    semenBatch: (row.semenBatch as string) ?? null,
    technicianName: (row.technicianName as string) ?? null,

    confirmationMethod: (row.confirmationMethod as PregnancyConfirmation) ?? null,
    confirmationDate: formatDate(row.confirmationDate as Date | null),
    expectedDueDate: formatDate(row.expectedDueDate as Date | null),

    calvingType: (row.calvingType as CalvingType) ?? null,
    calvingComplications: (row.calvingComplications as string) ?? null,
    calfId: (row.calfId as string) ?? null,
    calfEarTag: calfRel?.earTag ?? null,
    calfSex: (row.calfSex as string) ?? null,
    calfWeightKg: row.calfWeightKg != null ? Number(row.calfWeightKg) : null,

    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function validateInput(input: CreateReproductiveRecordInput | UpdateReproductiveRecordInput): void {
  if ('type' in input && input.type !== undefined) {
    if (!isValidReproductiveEventType(input.type)) {
      throw new AnimalReproductiveError(
        'Tipo de evento deve ser CLEARANCE, HEAT, BREEDING_PLAN, AI, PREGNANCY ou CALVING',
        400,
      );
    }
  }

  if ('eventDate' in input && input.eventDate !== undefined) {
    const date = new Date(input.eventDate);
    if (isNaN(date.getTime())) {
      throw new AnimalReproductiveError('Data do evento inválida', 400);
    }
  }

  if ('heatIntensity' in input && input.heatIntensity != null) {
    if (!isValidHeatIntensity(input.heatIntensity)) {
      throw new AnimalReproductiveError(
        'Intensidade do cio deve ser WEAK, MODERATE ou STRONG',
        400,
      );
    }
  }

  if ('breedingMethod' in input && input.breedingMethod != null) {
    if (!isValidBreedingMethod(input.breedingMethod)) {
      throw new AnimalReproductiveError('Método de acasalamento deve ser NATURAL, AI ou ET', 400);
    }
  }

  if ('calvingType' in input && input.calvingType != null) {
    if (!isValidCalvingType(input.calvingType)) {
      throw new AnimalReproductiveError(
        'Tipo de parto deve ser NORMAL, ASSISTED, CESAREAN ou DYSTOCIC',
        400,
      );
    }
  }

  if ('confirmationMethod' in input && input.confirmationMethod != null) {
    if (!isValidPregnancyConfirmation(input.confirmationMethod)) {
      throw new AnimalReproductiveError(
        'Método de confirmação deve ser PALPATION, ULTRASOUND, BLOOD_TEST ou OBSERVATION',
        400,
      );
    }
  }

  if ('calfWeightKg' in input && input.calfWeightKg != null) {
    if (input.calfWeightKg <= 0) {
      throw new AnimalReproductiveError('Peso do bezerro deve ser positivo', 400);
    }
  }
}

const INCLUDE_RELATIONS = {
  recorder: { select: { name: true } },
  plannedSire: { select: { name: true, earTag: true } },
  sire: { select: { name: true, earTag: true } },
  calf: { select: { earTag: true } },
};

// ─── LIST ───────────────────────────────────────────────────────────

export async function listReproductiveRecords(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  typeFilter?: ReproductiveEventType,
): Promise<ReproductiveRecordItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalReproductiveError('Animal não encontrado', 404);
    }

    const where: Record<string, unknown> = { animalId, farmId };
    if (typeFilter) where.type = typeFilter;

    const rows = await tx.animalReproductiveRecord.findMany({
      where,
      orderBy: { eventDate: 'desc' },
      include: INCLUDE_RELATIONS,
    });

    return rows.map((r) => toRecordItem(r as unknown as Record<string, unknown>));
  });
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createReproductiveRecord(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  userId: string,
  input: CreateReproductiveRecordInput,
): Promise<ReproductiveRecordItem> {
  validateInput(input);

  if (!input.type || !input.eventDate) {
    throw new AnimalReproductiveError('Tipo e data do evento são obrigatórios', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalReproductiveError('Animal não encontrado', 404);
    }

    // Auto-calculate intervalDays for HEAT events
    let intervalDays: number | null = null;
    if (input.type === 'HEAT') {
      const lastHeat = await tx.animalReproductiveRecord.findFirst({
        where: { animalId, farmId, type: 'HEAT' },
        orderBy: { eventDate: 'desc' },
        select: { eventDate: true },
      });
      if (lastHeat) {
        const current = new Date(input.eventDate);
        const previous = new Date(lastHeat.eventDate);
        const diffMs = current.getTime() - previous.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0) intervalDays = diffDays;
      }
    }

    const row = await tx.animalReproductiveRecord.create({
      data: {
        animalId,
        farmId,
        type: input.type,
        eventDate: new Date(input.eventDate),
        notes: input.notes ?? null,
        recordedBy: userId,
        approvedBy: input.approvedBy ?? null,
        criteriaDetails: input.criteriaDetails ?? null,
        heatIntensity: input.heatIntensity ?? null,
        intervalDays,
        plannedSireId: input.plannedSireId ?? null,
        breedingMethod: input.breedingMethod ?? null,
        plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
        sireId: input.sireId ?? null,
        sireName: input.sireName ?? null,
        semenBatch: input.semenBatch ?? null,
        technicianName: input.technicianName ?? null,
        confirmationMethod: input.confirmationMethod ?? null,
        confirmationDate: input.confirmationDate ? new Date(input.confirmationDate) : null,
        expectedDueDate: input.expectedDueDate ? new Date(input.expectedDueDate) : null,
        calvingType: input.calvingType ?? null,
        calvingComplications: input.calvingComplications ?? null,
        calfId: input.calfId ?? null,
        calfSex: (input.calfSex as 'MALE' | 'FEMALE' | null) ?? null,
        calfWeightKg: input.calfWeightKg ?? null,
      },
      include: INCLUDE_RELATIONS,
    });

    return toRecordItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateReproductiveRecord(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  recordId: string,
  input: UpdateReproductiveRecordInput,
): Promise<ReproductiveRecordItem> {
  validateInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalReproductiveRecord.findFirst({
      where: { id: recordId, animalId, farmId },
    });
    if (!existing) {
      throw new AnimalReproductiveError('Registro reprodutivo não encontrado', 404);
    }

    const data: Record<string, unknown> = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.eventDate !== undefined) data.eventDate = new Date(input.eventDate);
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.approvedBy !== undefined) data.approvedBy = input.approvedBy;
    if (input.criteriaDetails !== undefined) data.criteriaDetails = input.criteriaDetails;
    if (input.heatIntensity !== undefined) data.heatIntensity = input.heatIntensity;
    if (input.plannedSireId !== undefined) data.plannedSireId = input.plannedSireId;
    if (input.breedingMethod !== undefined) data.breedingMethod = input.breedingMethod;
    if (input.plannedDate !== undefined)
      data.plannedDate = input.plannedDate ? new Date(input.plannedDate) : null;
    if (input.sireId !== undefined) data.sireId = input.sireId;
    if (input.sireName !== undefined) data.sireName = input.sireName;
    if (input.semenBatch !== undefined) data.semenBatch = input.semenBatch;
    if (input.technicianName !== undefined) data.technicianName = input.technicianName;
    if (input.confirmationMethod !== undefined) data.confirmationMethod = input.confirmationMethod;
    if (input.confirmationDate !== undefined)
      data.confirmationDate = input.confirmationDate ? new Date(input.confirmationDate) : null;
    if (input.expectedDueDate !== undefined)
      data.expectedDueDate = input.expectedDueDate ? new Date(input.expectedDueDate) : null;
    if (input.calvingType !== undefined) data.calvingType = input.calvingType;
    if (input.calvingComplications !== undefined)
      data.calvingComplications = input.calvingComplications;
    if (input.calfId !== undefined) data.calfId = input.calfId;
    if (input.calfSex !== undefined) data.calfSex = input.calfSex;
    if (input.calfWeightKg !== undefined) data.calfWeightKg = input.calfWeightKg;

    const row = await tx.animalReproductiveRecord.update({
      where: { id: recordId },
      data: data as never,
      include: INCLUDE_RELATIONS,
    });

    return toRecordItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteReproductiveRecord(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  recordId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalReproductiveRecord.findFirst({
      where: { id: recordId, animalId, farmId },
    });
    if (!existing) {
      throw new AnimalReproductiveError('Registro reprodutivo não encontrado', 404);
    }

    await tx.animalReproductiveRecord.delete({ where: { id: recordId } });
  });
}

// ─── STATS ──────────────────────────────────────────────────────────

export async function getReproductiveStats(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<ReproductiveStats> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalReproductiveError('Animal não encontrado', 404);
    }

    const records = await tx.animalReproductiveRecord.findMany({
      where: { animalId, farmId },
      orderBy: { eventDate: 'desc' },
      select: { type: true, eventDate: true, intervalDays: true },
    });

    const stats: ReproductiveStats = {
      totalRecords: records.length,
      clearances: 0,
      heats: 0,
      breedingPlans: 0,
      ais: 0,
      pregnancies: 0,
      calvings: 0,
      lastHeatDate: null,
      lastAiDate: null,
      lastCalvingDate: null,
      isPregnant: false,
      averageHeatIntervalDays: null,
    };

    const heatIntervals: number[] = [];
    let hasPregnancy = false;
    let hasCalvingAfterPregnancy = false;

    for (const record of records) {
      const dateStr = formatDate(record.eventDate as Date);
      switch (record.type) {
        case 'CLEARANCE':
          stats.clearances++;
          break;
        case 'HEAT':
          stats.heats++;
          if (!stats.lastHeatDate) stats.lastHeatDate = dateStr;
          if (record.intervalDays != null && record.intervalDays > 0) {
            heatIntervals.push(record.intervalDays);
          }
          break;
        case 'BREEDING_PLAN':
          stats.breedingPlans++;
          break;
        case 'AI':
          stats.ais++;
          if (!stats.lastAiDate) stats.lastAiDate = dateStr;
          break;
        case 'PREGNANCY':
          stats.pregnancies++;
          if (!hasPregnancy) hasPregnancy = true;
          break;
        case 'CALVING':
          stats.calvings++;
          if (!stats.lastCalvingDate) stats.lastCalvingDate = dateStr;
          if (!hasCalvingAfterPregnancy) hasCalvingAfterPregnancy = true;
          break;
      }
    }

    // isPregnant: has PREGNANCY but no CALVING after the most recent PREGNANCY
    if (hasPregnancy) {
      const lastPregnancyIdx = records.findIndex((r) => r.type === 'PREGNANCY');
      const lastCalvingIdx = records.findIndex((r) => r.type === 'CALVING');
      // Records are sorted desc, so lower index = more recent
      stats.isPregnant = lastCalvingIdx === -1 || lastPregnancyIdx < lastCalvingIdx;
    }

    if (heatIntervals.length > 0) {
      const sum = heatIntervals.reduce((a, b) => a + b, 0);
      stats.averageHeatIntervalDays = Math.round(sum / heatIntervals.length);
    }

    return stats;
  });
}

// ─── CSV Export ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  CLEARANCE: 'Liberação',
  HEAT: 'Cio',
  BREEDING_PLAN: 'Plano de Acasalamento',
  AI: 'Inseminação Artificial',
  PREGNANCY: 'Gestação',
  CALVING: 'Parto',
};

const HEAT_LABELS: Record<string, string> = {
  WEAK: 'Fraco',
  MODERATE: 'Moderado',
  STRONG: 'Forte',
};

const BREEDING_LABELS: Record<string, string> = {
  NATURAL: 'Monta Natural',
  AI: 'Inseminação Artificial',
  ET: 'Transferência de Embrião',
};

const CALVING_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  ASSISTED: 'Assistido',
  CESAREAN: 'Cesariana',
  DYSTOCIC: 'Distócico',
};

const CONFIRMATION_LABELS: Record<string, string> = {
  PALPATION: 'Palpação',
  ULTRASOUND: 'Ultrassom',
  BLOOD_TEST: 'Exame de Sangue',
  OBSERVATION: 'Observação',
};

export async function exportReproductiveRecordsCsv(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true, earTag: true, name: true },
    });
    if (!animal) {
      throw new AnimalReproductiveError('Animal não encontrado', 404);
    }

    const records = await tx.animalReproductiveRecord.findMany({
      where: { animalId, farmId },
      orderBy: { eventDate: 'asc' },
      include: INCLUDE_RELATIONS,
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push(`HISTÓRICO REPRODUTIVO — ${animal.earTag}${animal.name ? ` (${animal.name})` : ''}`);
    lines.push('Data;Tipo;Detalhes;Touro/Sêmen;Método;Registrado por;Observações');

    for (const r of records) {
      const date = new Date(r.eventDate).toLocaleDateString('pt-BR');
      const type = TYPE_LABELS[r.type] ?? r.type;

      let details = '';
      switch (r.type) {
        case 'CLEARANCE':
          details = r.approvedBy ? `Aprovado por: ${r.approvedBy}` : '';
          break;
        case 'HEAT':
          details = [
            r.heatIntensity
              ? `Intensidade: ${HEAT_LABELS[r.heatIntensity] ?? r.heatIntensity}`
              : '',
            r.intervalDays != null ? `Intervalo: ${r.intervalDays}d` : '',
          ]
            .filter(Boolean)
            .join(' | ');
          break;
        case 'BREEDING_PLAN':
          details = r.plannedDate
            ? `Planejado: ${new Date(r.plannedDate).toLocaleDateString('pt-BR')}`
            : '';
          break;
        case 'AI':
          details = [
            r.semenBatch ? `Lote: ${r.semenBatch}` : '',
            r.technicianName ? `Técnico: ${r.technicianName}` : '',
          ]
            .filter(Boolean)
            .join(' | ');
          break;
        case 'PREGNANCY':
          details = [
            r.confirmationMethod
              ? `Confirmação: ${CONFIRMATION_LABELS[r.confirmationMethod] ?? r.confirmationMethod}`
              : '',
            r.expectedDueDate
              ? `Previsão parto: ${new Date(r.expectedDueDate).toLocaleDateString('pt-BR')}`
              : '',
          ]
            .filter(Boolean)
            .join(' | ');
          break;
        case 'CALVING':
          details = [
            r.calvingType ? `Tipo: ${CALVING_LABELS[r.calvingType] ?? r.calvingType}` : '',
            r.calfSex ? `Sexo: ${r.calfSex === 'MALE' ? 'Macho' : 'Fêmea'}` : '',
            r.calfWeightKg != null ? `Peso: ${Number(r.calfWeightKg)}kg` : '',
          ]
            .filter(Boolean)
            .join(' | ');
          break;
      }

      const sireInfo =
        r.sireName ??
        (r.sire as { name: string | null; earTag: string } | null)?.name ??
        (r.sire as { name: string | null; earTag: string } | null)?.earTag ??
        (r.plannedSire as { name: string | null; earTag: string } | null)?.name ??
        (r.plannedSire as { name: string | null; earTag: string } | null)?.earTag ??
        '';

      const method = r.breedingMethod
        ? (BREEDING_LABELS[r.breedingMethod] ?? r.breedingMethod)
        : '';

      lines.push([date, type, details, sireInfo, method, r.recorder.name, r.notes ?? ''].join(';'));
    }

    return BOM + lines.join('\n');
  });
}
