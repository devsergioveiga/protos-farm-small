import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MastitisError,
  GRADES,
  GRADE_LABELS,
  CLASSIFICATION_LABELS,
  QUARTER_STATUSES,
  QUARTER_STATUS_LABELS,
  CASE_STATUS_LABELS,
  MILK_APPEARANCE_LABELS,
  CMT_RESULT_LABELS,
  QUARTERS,
  QUARTER_LABELS,
  CLOSURE_OUTCOMES,
  CLOSURE_OUTCOME_LABELS,
  ADMIN_ROUTE_LABELS,
  type CreateMastitisInput,
  type UpdateMastitisInput,
  type RecordApplicationInput,
  type UpdateQuarterInput,
  type CloseCaseInput,
  type ListMastitisQuery,
  type MastitisCaseItem,
  type MastitisListItem,
  type QuarterItem,
  type ApplicationItem,
  type MastitisIndicators,
  type GradeValue,
  type ClassificationValue,
  type QuarterStatusValue,
  type CaseStatusValue,
  type MilkAppearanceValue,
  type CmtResultValue,
  type QuarterValue,
  type ClosureOutcomeValue,
} from './mastitis.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toDateStr(val: unknown): string {
  if (!val) return '';
  return (val as Date).toISOString().slice(0, 10);
}

function toQuarterItem(row: any): QuarterItem {
  const quarter = row.quarter as QuarterValue;
  const grade = row.grade as GradeValue;
  const milkApp = row.milkAppearance as MilkAppearanceValue | null;
  const cmt = row.cmtResult as CmtResultValue | null;
  const status = row.status as QuarterStatusValue;

  return {
    id: row.id,
    caseId: row.caseId,
    quarter,
    quarterLabel: QUARTER_LABELS[quarter] ?? quarter,
    grade,
    gradeLabel: GRADE_LABELS[grade] ?? grade,
    milkAppearance: milkApp,
    milkAppearanceLabel: milkApp ? (MILK_APPEARANCE_LABELS[milkApp] ?? milkApp) : null,
    cmtResult: cmt,
    cmtResultLabel: cmt ? (CMT_RESULT_LABELS[cmt] ?? cmt) : null,
    status,
    statusLabel: QUARTER_STATUS_LABELS[status] ?? status,
    withdrawalEndDate: row.withdrawalEndDate ? toDateStr(row.withdrawalEndDate) : null,
    notes: row.notes ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toApplicationItem(row: any): ApplicationItem {
  const route = row.administrationRoute;
  const qt = row.quarterTreated as QuarterValue | null;

  return {
    id: row.id,
    caseId: row.caseId,
    applicationDate: toDateStr(row.applicationDate),
    applicationTime: row.applicationTime ?? null,
    productName: row.productName,
    productId: row.productId ?? null,
    dose: row.dose,
    administrationRoute: route,
    administrationRouteLabel: ADMIN_ROUTE_LABELS[route as keyof typeof ADMIN_ROUTE_LABELS] ?? route,
    quarterTreated: qt,
    quarterTreatedLabel: qt ? (QUARTER_LABELS[qt] ?? qt) : null,
    responsibleName: row.responsibleName,
    costCents: row.costCents ?? 0,
    notes: row.notes ?? null,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toCaseItem(row: any): MastitisCaseItem {
  const classification = row.classification as ClassificationValue;
  const status = row.status as CaseStatusValue;
  const outcome = row.closureOutcome as ClosureOutcomeValue | null;

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    occurrenceDate: toDateStr(row.occurrenceDate),
    occurrenceTime: row.occurrenceTime ?? null,
    identifiedBy: row.identifiedBy,
    delAtOccurrence: row.delAtOccurrence ?? null,
    rectalTemperature: row.rectalTemperature ?? null,
    temperatureAlert: row.temperatureAlert,
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification] ?? classification,
    status,
    statusLabel: CASE_STATUS_LABELS[status] ?? status,
    cultureSampleCollected: row.cultureSampleCollected,
    cultureLab: row.cultureLab ?? null,
    cultureSampleNumber: row.cultureSampleNumber ?? null,
    cultureAgent: row.cultureAgent ?? null,
    cultureAntibiogram: row.cultureAntibiogram ?? null,
    treatmentProtocolName: row.treatmentProtocolName ?? null,
    withdrawalEndDate: row.withdrawalEndDate ? toDateStr(row.withdrawalEndDate) : null,
    closedAt: row.closedAt ? (row.closedAt as Date).toISOString() : null,
    closureOutcome: outcome,
    closureOutcomeLabel: outcome ? (CLOSURE_OUTCOME_LABELS[outcome] ?? outcome) : null,
    totalCostCents: row.totalCostCents ?? 0,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    quarters: (row.quarters ?? []).map(toQuarterItem),
    applications: (row.applications ?? []).map(toApplicationItem),
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toListItem(row: any): MastitisListItem {
  const classification = row.classification as ClassificationValue;
  const status = row.status as CaseStatusValue;

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    occurrenceDate: toDateStr(row.occurrenceDate),
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification] ?? classification,
    status,
    statusLabel: CASE_STATUS_LABELS[status] ?? status,
    identifiedBy: row.identifiedBy,
    quartersAffected: (row.quarters ?? []).map((q: any) => q.quarter),
    treatmentProtocolName: row.treatmentProtocolName ?? null,
    totalCostCents: row.totalCostCents ?? 0,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── Validate ──────────────────────────────────────────────────────

function validateCreateInput(input: CreateMastitisInput): void {
  if (!input.animalId) {
    throw new MastitisError('Animal é obrigatório', 400);
  }
  if (!input.occurrenceDate) {
    throw new MastitisError('Data da ocorrência é obrigatória', 400);
  }
  const date = new Date(input.occurrenceDate);
  if (isNaN(date.getTime())) {
    throw new MastitisError('Data da ocorrência inválida', 400);
  }
  if (!input.identifiedBy?.trim()) {
    throw new MastitisError('Identificador (quem identificou) é obrigatório', 400);
  }
  if (!input.quarters || input.quarters.length === 0) {
    throw new MastitisError('Ao menos um quarto afetado é obrigatório', 400);
  }

  for (const q of input.quarters) {
    if (!QUARTERS.includes(q.quarter as QuarterValue)) {
      throw new MastitisError(`Quarto inválido: ${q.quarter}. Use FL, FR, RL ou RR`, 400);
    }
    if (!GRADES.includes(q.grade as GradeValue)) {
      throw new MastitisError(`Grau de mastite inválido: ${q.grade}`, 400);
    }
  }
}

// ─── Auto-classification (CA5) ─────────────────────────────────────

async function autoClassify(
  tx: any,
  animalId: string,
  farmId: string,
  quarters: CreateMastitisInput['quarters'],
  occurrenceDate: Date,
): Promise<ClassificationValue> {
  // Subclinical: CMT positive but milk appearance is NORMAL (no visible changes)
  const allNormalAppearance = quarters.every(
    (q) => !q.milkAppearance || q.milkAppearance === 'NORMAL',
  );
  const hasCmtPositive = quarters.some((q) => q.cmtResult && q.cmtResult !== 'NEGATIVE');

  if (allNormalAppearance && hasCmtPositive) {
    return 'SUBCLINICAL';
  }

  // Check recurrence: same quarter >2 episodes in same lactation (approximated as last 305 days)
  const lactationStart = new Date(occurrenceDate);
  lactationStart.setDate(lactationStart.getDate() - 305);

  const affectedQuarters = quarters.map((q) => q.quarter);

  const previousCases = await tx.mastitisCase.findMany({
    where: {
      animalId,
      farmId,
      occurrenceDate: { gte: lactationStart },
    },
    include: { quarters: true },
  });

  // Count episodes per quarter
  const quarterEpisodeCounts: Record<string, number> = {};
  for (const c of previousCases) {
    for (const q of c.quarters) {
      if (affectedQuarters.includes(q.quarter)) {
        quarterEpisodeCounts[q.quarter] = (quarterEpisodeCounts[q.quarter] ?? 0) + 1;
      }
    }
  }

  // Chronic: >3 episodes in same quarter
  const hasChronicQuarter = Object.values(quarterEpisodeCounts).some((count) => count >= 3);
  if (hasChronicQuarter) {
    return 'CHRONIC';
  }

  // Recurrent: same quarter >2 episodes
  const hasRecurrentQuarter = Object.values(quarterEpisodeCounts).some((count) => count >= 2);
  if (hasRecurrentQuarter) {
    return 'RECURRENT';
  }

  // Default: clinical
  return 'CLINICAL';
}

// ─── Include for queries ───────────────────────────────────────────

const CASE_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
  quarters: { orderBy: { quarter: 'asc' as const } },
  applications: { orderBy: { applicationDate: 'desc' as const } },
};

const CASE_LIST_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  quarters: { select: { quarter: true } },
};

// ─── CREATE CASE (CA1) ─────────────────────────────────────────────

export async function createCase(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateMastitisInput,
): Promise<MastitisCaseItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate animal
    const animal = await (tx as any).animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new MastitisError('Animal não encontrado', 404);
    }

    const occurrenceDate = new Date(input.occurrenceDate);

    // Auto-classify (CA5)
    const classification = await autoClassify(
      tx as any,
      input.animalId,
      farmId,
      input.quarters,
      occurrenceDate,
    );

    // Temperature alert (CA3)
    const temperatureAlert = input.rectalTemperature != null && input.rectalTemperature > 39.5;

    // Calculate DEL (CA1)
    let delAtOccurrence: number | null = null;
    // Try to find last calving event for this animal
    const lastCalving = await (tx as any).calvingEvent.findFirst({
      where: { animalId: input.animalId },
      orderBy: { calvingDate: 'desc' },
      select: { calvingDate: true },
    });
    if (lastCalving) {
      const calvingDate = new Date(lastCalving.calvingDate);
      delAtOccurrence = Math.floor(
        (occurrenceDate.getTime() - calvingDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (delAtOccurrence < 0) delAtOccurrence = null;
    }

    // Create case
    const row = await (tx as any).mastitisCase.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        occurrenceDate,
        occurrenceTime: input.occurrenceTime ?? null,
        identifiedBy: input.identifiedBy,
        delAtOccurrence,
        rectalTemperature: input.rectalTemperature ?? null,
        temperatureAlert,
        classification,
        status: 'OPEN',
        cultureSampleCollected: input.cultureSampleCollected ?? false,
        cultureLab: input.cultureLab ?? null,
        cultureSampleNumber: input.cultureSampleNumber ?? null,
        cultureAgent: input.cultureAgent ?? null,
        cultureAntibiogram: input.cultureAntibiogram ?? null,
        treatmentProtocolName: input.treatmentProtocolName ?? null,
        notes: input.notes ?? null,
        recordedBy: userId,
        quarters: {
          create: input.quarters.map((q) => ({
            quarter: q.quarter,
            grade: q.grade,
            milkAppearance: q.milkAppearance ?? null,
            cmtResult: q.cmtResult ?? null,
            status: 'IN_TREATMENT',
            notes: q.notes ?? null,
          })),
        },
      },
      include: CASE_INCLUDE,
    });

    return toCaseItem(row);
  });
}

// ─── LIST CASES ────────────────────────────────────────────────────

export async function listCases(
  ctx: RlsContext,
  farmId: string,
  query: ListMastitisQuery,
): Promise<{ data: MastitisListItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.status) where.status = query.status;
    if (query.classification) where.classification = query.classification;
    if (query.dateFrom || query.dateTo) {
      where.occurrenceDate = {};
      if (query.dateFrom) where.occurrenceDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.occurrenceDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).mastitisCase.findMany({
        where,
        include: CASE_LIST_INCLUDE,
        orderBy: { occurrenceDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).mastitisCase.count({ where }),
    ]);

    return { data: rows.map(toListItem), total };
  });
}

// ─── GET CASE ──────────────────────────────────────────────────────

export async function getCase(
  ctx: RlsContext,
  farmId: string,
  caseId: string,
): Promise<MastitisCaseItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).mastitisCase.findFirst({
      where: { id: caseId, farmId },
      include: CASE_INCLUDE,
    });
    if (!row) {
      throw new MastitisError('Caso de mastite não encontrado', 404);
    }
    return toCaseItem(row);
  });
}

// ─── UPDATE CASE ───────────────────────────────────────────────────

export async function updateCase(
  ctx: RlsContext,
  farmId: string,
  caseId: string,
  input: UpdateMastitisInput,
): Promise<MastitisCaseItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).mastitisCase.findFirst({
      where: { id: caseId, farmId },
    });
    if (!existing) {
      throw new MastitisError('Caso de mastite não encontrado', 404);
    }
    if (existing.status === 'CLOSED') {
      throw new MastitisError('Não é possível editar um caso encerrado', 400);
    }

    const data: any = {};
    if (input.cultureSampleCollected !== undefined)
      data.cultureSampleCollected = input.cultureSampleCollected;
    if (input.cultureLab !== undefined) data.cultureLab = input.cultureLab;
    if (input.cultureSampleNumber !== undefined)
      data.cultureSampleNumber = input.cultureSampleNumber;
    if (input.cultureAgent !== undefined) data.cultureAgent = input.cultureAgent;
    if (input.cultureAntibiogram !== undefined) data.cultureAntibiogram = input.cultureAntibiogram;
    if (input.treatmentProtocolName !== undefined)
      data.treatmentProtocolName = input.treatmentProtocolName;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).mastitisCase.update({
      where: { id: caseId },
      data,
      include: CASE_INCLUDE,
    });

    return toCaseItem(row);
  });
}

// ─── RECORD APPLICATION (CA6) ──────────────────────────────────────

export async function recordApplication(
  ctx: RlsContext,
  farmId: string,
  caseId: string,
  input: RecordApplicationInput,
): Promise<ApplicationItem> {
  if (!input.applicationDate) {
    throw new MastitisError('Data da aplicação é obrigatória', 400);
  }
  if (!input.productName?.trim()) {
    throw new MastitisError('Nome do produto é obrigatório', 400);
  }
  if (!input.dose?.trim()) {
    throw new MastitisError('Dose é obrigatória', 400);
  }
  if (!input.administrationRoute?.trim()) {
    throw new MastitisError('Via de administração é obrigatória', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new MastitisError('Responsável é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).mastitisCase.findFirst({
      where: { id: caseId, farmId },
    });
    if (!existing) {
      throw new MastitisError('Caso de mastite não encontrado', 404);
    }
    if (existing.status === 'CLOSED') {
      throw new MastitisError('Não é possível registrar aplicação em caso encerrado', 400);
    }

    const row = await (tx as any).mastitisApplication.create({
      data: {
        caseId,
        applicationDate: new Date(input.applicationDate),
        applicationTime: input.applicationTime ?? null,
        productName: input.productName,
        productId: input.productId ?? null,
        dose: input.dose,
        administrationRoute: input.administrationRoute,
        quarterTreated: input.quarterTreated ?? null,
        responsibleName: input.responsibleName,
        costCents: input.costCents ?? 0,
        notes: input.notes ?? null,
      },
    });

    // Recalculate total cost
    const totalCost = await (tx as any).mastitisApplication.aggregate({
      where: { caseId },
      _sum: { costCents: true },
    });
    await (tx as any).mastitisCase.update({
      where: { id: caseId },
      data: { totalCostCents: totalCost._sum.costCents ?? 0 },
    });

    return toApplicationItem(row);
  });
}

// ─── UPDATE QUARTER (CA8) ──────────────────────────────────────────

export async function updateQuarter(
  ctx: RlsContext,
  farmId: string,
  caseId: string,
  quarterId: string,
  input: UpdateQuarterInput,
): Promise<QuarterItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).mastitisCase.findFirst({
      where: { id: caseId, farmId },
    });
    if (!existing) {
      throw new MastitisError('Caso de mastite não encontrado', 404);
    }

    const quarter = await (tx as any).mastitisQuarter.findFirst({
      where: { id: quarterId, caseId },
    });
    if (!quarter) {
      throw new MastitisError('Quarto não encontrado', 404);
    }

    if (input.status && !QUARTER_STATUSES.includes(input.status as QuarterStatusValue)) {
      throw new MastitisError(`Status de quarto inválido: ${input.status}`, 400);
    }

    const data: any = {};
    if (input.milkAppearance !== undefined) data.milkAppearance = input.milkAppearance;
    if (input.cmtResult !== undefined) data.cmtResult = input.cmtResult;
    if (input.status !== undefined) data.status = input.status;
    if (input.withdrawalEndDate !== undefined) {
      data.withdrawalEndDate = input.withdrawalEndDate ? new Date(input.withdrawalEndDate) : null;
    }
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).mastitisQuarter.update({
      where: { id: quarterId },
      data,
    });

    // Update case withdrawalEndDate to latest quarter withdrawal
    const allQuarters = await (tx as any).mastitisQuarter.findMany({
      where: { caseId },
      select: { withdrawalEndDate: true },
    });
    const maxWithdrawal = allQuarters.reduce(
      (max: Date | null, q: any) => {
        if (!q.withdrawalEndDate) return max;
        const d = new Date(q.withdrawalEndDate);
        return !max || d > max ? d : max;
      },
      null as Date | null,
    );

    await (tx as any).mastitisCase.update({
      where: { id: caseId },
      data: { withdrawalEndDate: maxWithdrawal },
    });

    return toQuarterItem(row);
  });
}

// ─── CLOSE CASE (CA9) ─────────────────────────────────────────────

export async function closeCase(
  ctx: RlsContext,
  farmId: string,
  caseId: string,
  input: CloseCaseInput,
): Promise<MastitisCaseItem> {
  if (!input.closureOutcome) {
    throw new MastitisError('Resultado do encerramento é obrigatório', 400);
  }
  if (!CLOSURE_OUTCOMES.includes(input.closureOutcome as ClosureOutcomeValue)) {
    throw new MastitisError(`Resultado inválido: ${input.closureOutcome}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).mastitisCase.findFirst({
      where: { id: caseId, farmId },
    });
    if (!existing) {
      throw new MastitisError('Caso de mastite não encontrado', 404);
    }
    if (existing.status === 'CLOSED') {
      throw new MastitisError('Caso já está encerrado', 400);
    }

    const row = await (tx as any).mastitisCase.update({
      where: { id: caseId },
      data: {
        status: 'CLOSED',
        closureOutcome: input.closureOutcome,
        closedAt: new Date(),
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
      include: CASE_INCLUDE,
    });

    return toCaseItem(row);
  });
}

// ─── DELETE CASE ───────────────────────────────────────────────────

export async function deleteCase(ctx: RlsContext, farmId: string, caseId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).mastitisCase.findFirst({
      where: { id: caseId, farmId },
    });
    if (!existing) {
      throw new MastitisError('Caso de mastite não encontrado', 404);
    }

    await (tx as any).mastitisCase.delete({ where: { id: caseId } });
  });
}

// ─── ANIMAL MASTITIS HISTORY (CA10) ────────────────────────────────

export async function getAnimalMastitisHistory(
  ctx: RlsContext,
  farmId: string,
  animalId: string,
): Promise<MastitisCaseItem[]> {
  return withRlsContext(ctx, async (tx) => {
    // Validate animal
    const animal = await (tx as any).animal.findFirst({
      where: { id: animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new MastitisError('Animal não encontrado', 404);
    }

    const rows = await (tx as any).mastitisCase.findMany({
      where: { farmId, animalId },
      include: CASE_INCLUDE,
      orderBy: { occurrenceDate: 'desc' },
    });

    return rows.map(toCaseItem);
  });
}

// ─── MASTITIS INDICATORS (CA11) ───────────────────────────────────

export async function getMastitisIndicators(
  ctx: RlsContext,
  farmId: string,
): Promise<MastitisIndicators> {
  return withRlsContext(ctx, async (tx) => {
    const allCases = await (tx as any).mastitisCase.findMany({
      where: { farmId },
      include: {
        quarters: { select: { quarter: true } },
      },
    });

    const totalCases = allCases.length;
    const openCases = allCases.filter((c: any) => c.status === 'OPEN').length;
    const closedCases = allCases.filter((c: any) => c.status === 'CLOSED').length;

    // Classification rates
    const clinicalCount = allCases.filter((c: any) => c.classification === 'CLINICAL').length;
    const subclinicalCount = allCases.filter((c: any) => c.classification === 'SUBCLINICAL').length;
    const recurrentCount = allCases.filter((c: any) => c.classification === 'RECURRENT').length;
    const chronicCount = allCases.filter((c: any) => c.classification === 'CHRONIC').length;

    const clinicalRate = totalCases > 0 ? clinicalCount / totalCases : 0;
    const subclinicalRate = totalCases > 0 ? subclinicalCount / totalCases : 0;
    const recurrentRate = totalCases > 0 ? recurrentCount / totalCases : 0;
    const chronicRate = totalCases > 0 ? chronicCount / totalCases : 0;

    // Quarter breakdown
    const quarterBreakdown: Record<string, number> = { FL: 0, FR: 0, RL: 0, RR: 0 };
    for (const c of allCases) {
      for (const q of c.quarters) {
        quarterBreakdown[q.quarter] = (quarterBreakdown[q.quarter] ?? 0) + 1;
      }
    }

    // Top agents
    const agentCounts: Record<string, number> = {};
    for (const c of allCases) {
      if (c.cultureAgent) {
        agentCounts[c.cultureAgent] = (agentCounts[c.cultureAgent] ?? 0) + 1;
      }
    }
    const topAgents = Object.entries(agentCounts)
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cure rate
    const curedCount = allCases.filter((c: any) => c.closureOutcome === 'CURED').length;
    const cureRate = closedCases > 0 ? curedCount / closedCases : 0;

    // Total cost
    const totalCostResult = await (tx as any).mastitisCase.aggregate({
      where: { farmId },
      _sum: { totalCostCents: true },
    });
    const totalCostCents = totalCostResult._sum.totalCostCents ?? 0;

    // Recurrent cows: animals with >1 case
    const animalCounts: Record<string, number> = {};
    for (const c of allCases) {
      animalCounts[c.animalId] = (animalCounts[c.animalId] ?? 0) + 1;
    }
    const recurrentCows = Object.values(animalCounts).filter((count) => count > 1).length;

    return {
      totalCases,
      openCases,
      closedCases,
      clinicalRate: Math.round(clinicalRate * 10000) / 10000,
      subclinicalRate: Math.round(subclinicalRate * 10000) / 10000,
      recurrentRate: Math.round(recurrentRate * 10000) / 10000,
      chronicRate: Math.round(chronicRate * 10000) / 10000,
      quarterBreakdown,
      topAgents,
      cureRate: Math.round(cureRate * 10000) / 10000,
      totalCostCents,
      recurrentCows,
    };
  });
}

// ─── EXPORT CSV ────────────────────────────────────────────────────

export async function exportMastitisCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListMastitisQuery,
): Promise<string> {
  const { data } = await listCases(ctx, farmId, { ...query, limit: 5000 });

  const BOM = '\uFEFF';
  const lines: string[] = [];
  lines.push(
    'Brinco;Nome;Data Ocorrência;Classificação;Status;Quartos;Identificado por;Protocolo;Custo (R$)',
  );

  for (const c of data) {
    lines.push(
      [
        c.animalEarTag,
        c.animalName ?? '',
        new Date(c.occurrenceDate).toLocaleDateString('pt-BR'),
        c.classificationLabel,
        c.statusLabel,
        c.quartersAffected.join(', '),
        c.identifiedBy,
        c.treatmentProtocolName ?? 'Sem protocolo',
        (c.totalCostCents / 100).toFixed(2).replace('.', ','),
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}
