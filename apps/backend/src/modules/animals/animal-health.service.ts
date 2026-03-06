import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  AnimalHealthError,
  isValidHealthEventType,
  isValidApplicationMethod,
  type CreateHealthRecordInput,
  type UpdateHealthRecordInput,
  type HealthRecordItem,
  type HealthStats,
  type HealthEventType,
  type ApplicationMethod,
} from './animal-health.types';

// ─── Helpers ────────────────────────────────────────────────────────

function validateHealthRecordInput(input: CreateHealthRecordInput | UpdateHealthRecordInput): void {
  if ('type' in input && input.type !== undefined) {
    if (!isValidHealthEventType(input.type)) {
      throw new AnimalHealthError(
        'Tipo de evento deve ser VACCINATION, DEWORMING, TREATMENT ou EXAM',
        400,
      );
    }
  }
  if ('eventDate' in input && input.eventDate !== undefined) {
    const date = new Date(input.eventDate);
    if (isNaN(date.getTime())) {
      throw new AnimalHealthError('Data do evento inválida', 400);
    }
    if (date > new Date()) {
      throw new AnimalHealthError('Data do evento não pode ser no futuro', 400);
    }
  }
  if ('applicationMethod' in input && input.applicationMethod != null) {
    if (!isValidApplicationMethod(input.applicationMethod)) {
      throw new AnimalHealthError(
        'Método de aplicação deve ser INJECTABLE, ORAL, POUR_ON ou OTHER',
        400,
      );
    }
  }
  if ('durationDays' in input && input.durationDays != null) {
    if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
      throw new AnimalHealthError('Duração do tratamento deve ser um número inteiro positivo', 400);
    }
  }
}

function toHealthRecordItem(row: Record<string, unknown>): HealthRecordItem {
  return {
    id: row.id as string,
    animalId: row.animalId as string,
    farmId: row.farmId as string,
    type: row.type as HealthEventType,
    eventDate: (row.eventDate as Date).toISOString().slice(0, 10),
    productName: (row.productName as string) ?? null,
    dosage: (row.dosage as string) ?? null,
    applicationMethod: (row.applicationMethod as ApplicationMethod) ?? null,
    batchNumber: (row.batchNumber as string) ?? null,
    diagnosis: (row.diagnosis as string) ?? null,
    durationDays: (row.durationDays as number) ?? null,
    examResult: (row.examResult as string) ?? null,
    labName: (row.labName as string) ?? null,
    isFieldExam: (row.isFieldExam as boolean) ?? null,
    veterinaryName: (row.veterinaryName as string) ?? null,
    notes: (row.notes as string) ?? null,
    recordedBy: row.recordedBy as string,
    recorderName: ((row as Record<string, unknown>).recorder as { name: string })?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── LIST ───────────────────────────────────────────────────────────

export async function listHealthRecords(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  typeFilter?: HealthEventType,
): Promise<HealthRecordItem[]> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalHealthError('Animal não encontrado', 404);
    }

    const where: Record<string, unknown> = { animalId, farmId };
    if (typeFilter) {
      where.type = typeFilter;
    }

    const rows = await tx.animalHealthRecord.findMany({
      where,
      orderBy: { eventDate: 'desc' },
      include: { recorder: { select: { name: true } } },
    });

    return rows.map((r) => toHealthRecordItem(r as unknown as Record<string, unknown>));
  });
}

// ─── CREATE ─────────────────────────────────────────────────────────

export async function createHealthRecord(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  userId: string,
  input: CreateHealthRecordInput,
): Promise<HealthRecordItem> {
  validateHealthRecordInput(input);

  if (!input.type || !input.eventDate) {
    throw new AnimalHealthError('Tipo e data do evento são obrigatórios', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalHealthError('Animal não encontrado', 404);
    }

    const row = await tx.animalHealthRecord.create({
      data: {
        animalId,
        farmId,
        type: input.type,
        eventDate: new Date(input.eventDate),
        productName: input.productName ?? null,
        dosage: input.dosage ?? null,
        applicationMethod: input.applicationMethod ?? null,
        batchNumber: input.batchNumber ?? null,
        diagnosis: input.diagnosis ?? null,
        durationDays: input.durationDays ?? null,
        examResult: input.examResult ?? null,
        labName: input.labName ?? null,
        isFieldExam: input.isFieldExam ?? false,
        veterinaryName: input.veterinaryName ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: { recorder: { select: { name: true } } },
    });

    return toHealthRecordItem(row as unknown as Record<string, unknown>);
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────

export async function updateHealthRecord(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  recordId: string,
  input: UpdateHealthRecordInput,
): Promise<HealthRecordItem> {
  validateHealthRecordInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalHealthRecord.findFirst({
      where: { id: recordId, animalId, farmId },
    });
    if (!existing) {
      throw new AnimalHealthError('Registro sanitário não encontrado', 404);
    }

    const data: Record<string, unknown> = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.eventDate !== undefined) data.eventDate = new Date(input.eventDate);
    if (input.productName !== undefined) data.productName = input.productName;
    if (input.dosage !== undefined) data.dosage = input.dosage;
    if (input.applicationMethod !== undefined) data.applicationMethod = input.applicationMethod;
    if (input.batchNumber !== undefined) data.batchNumber = input.batchNumber;
    if (input.diagnosis !== undefined) data.diagnosis = input.diagnosis;
    if (input.durationDays !== undefined) data.durationDays = input.durationDays;
    if (input.examResult !== undefined) data.examResult = input.examResult;
    if (input.labName !== undefined) data.labName = input.labName;
    if (input.isFieldExam !== undefined) data.isFieldExam = input.isFieldExam;
    if (input.veterinaryName !== undefined) data.veterinaryName = input.veterinaryName;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await tx.animalHealthRecord.update({
      where: { id: recordId },
      data: data as never,
      include: { recorder: { select: { name: true } } },
    });

    return toHealthRecordItem(row as unknown as Record<string, unknown>);
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────

export async function deleteHealthRecord(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
  recordId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalHealthRecord.findFirst({
      where: { id: recordId, animalId, farmId },
    });
    if (!existing) {
      throw new AnimalHealthError('Registro sanitário não encontrado', 404);
    }

    await tx.animalHealthRecord.delete({ where: { id: recordId } });
  });
}

// ─── Stats ──────────────────────────────────────────────────────────

export async function getHealthStats(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<HealthStats> {
  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new AnimalHealthError('Animal não encontrado', 404);
    }

    const records = await tx.animalHealthRecord.findMany({
      where: { animalId, farmId },
      orderBy: { eventDate: 'desc' },
      select: { type: true, eventDate: true },
    });

    const stats: HealthStats = {
      totalRecords: records.length,
      vaccinations: 0,
      dewormings: 0,
      treatments: 0,
      exams: 0,
      lastVaccinationDate: null,
      lastDewormingDate: null,
      lastTreatmentDate: null,
      lastExamDate: null,
    };

    for (const record of records) {
      const dateStr = (record.eventDate as Date).toISOString().slice(0, 10);
      switch (record.type) {
        case 'VACCINATION':
          stats.vaccinations++;
          if (!stats.lastVaccinationDate) stats.lastVaccinationDate = dateStr;
          break;
        case 'DEWORMING':
          stats.dewormings++;
          if (!stats.lastDewormingDate) stats.lastDewormingDate = dateStr;
          break;
        case 'TREATMENT':
          stats.treatments++;
          if (!stats.lastTreatmentDate) stats.lastTreatmentDate = dateStr;
          break;
        case 'EXAM':
          stats.exams++;
          if (!stats.lastExamDate) stats.lastExamDate = dateStr;
          break;
      }
    }

    return stats;
  });
}

// ─── CSV Export ──────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  VACCINATION: 'Vacinação',
  DEWORMING: 'Vermifugação',
  TREATMENT: 'Tratamento',
  EXAM: 'Exame',
};

const METHOD_LABELS: Record<string, string> = {
  INJECTABLE: 'Injetável',
  ORAL: 'Oral',
  POUR_ON: 'Pour-on',
  OTHER: 'Outro',
};

export async function exportHealthRecordsCsv(
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
      throw new AnimalHealthError('Animal não encontrado', 404);
    }

    const records = await tx.animalHealthRecord.findMany({
      where: { animalId, farmId },
      orderBy: { eventDate: 'asc' },
      include: { recorder: { select: { name: true } } },
    });

    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push(`HISTÓRICO SANITÁRIO — ${animal.earTag}${animal.name ? ` (${animal.name})` : ''}`);
    lines.push(
      'Data;Tipo;Produto;Dosagem;Método;Lote/Série;Diagnóstico;Resultado Exame;Veterinário;Registrado por;Observações',
    );

    for (const r of records) {
      const date = new Date(r.eventDate).toLocaleDateString('pt-BR');
      const type = TYPE_LABELS[r.type] ?? r.type;
      const method = r.applicationMethod
        ? (METHOD_LABELS[r.applicationMethod] ?? r.applicationMethod)
        : '';
      lines.push(
        [
          date,
          type,
          r.productName ?? '',
          r.dosage ?? '',
          method,
          r.batchNumber ?? '',
          r.diagnosis ?? '',
          r.examResult ?? '',
          r.veterinaryName ?? '',
          r.recorder.name,
          r.notes ?? '',
        ].join(';'),
      );
    }

    return BOM + lines.join('\n');
  });
}
