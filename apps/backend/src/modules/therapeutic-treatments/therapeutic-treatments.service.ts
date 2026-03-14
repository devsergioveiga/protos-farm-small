import { withRlsContext, type RlsContext, type TxClient } from '../../database/rls';
import {
  TherapeuticTreatmentError,
  TREATMENT_STATUS_LABELS,
  TREATMENT_OUTCOME_LABELS,
  EVOLUTION_TYPE_LABELS,
  APPLICATION_STATUS_LABELS,
  SEVERITY_LABELS,
  ADMINISTRATION_ROUTE_LABELS,
  DOSAGE_UNIT_LABELS,
  SEVERITY_LEVELS,
  isValidAdministrationRoute,
  type CreateTreatmentInput,
  type UpdateTreatmentInput,
  type CloseTreatmentInput,
  type RecordApplicationInput,
  type SkipApplicationInput,
  type RecordEvolutionInput,
  type ListTreatmentsQuery,
  type TreatmentItem,
  type TreatmentListItem,
  type ApplicationItem,
  type EvolutionItem,
  type PendingApplicationsResult,
  type TreatmentStatusValue,
  type TreatmentOutcomeValue,
  type EvolutionTypeValue,
  type ApplicationStatusValue,
} from './therapeutic-treatments.types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  return typeof val === 'number' ? val : Number(val);
}

function toDateStr(val: unknown): string {
  if (!val) return '';
  return (val as Date).toISOString().slice(0, 10);
}

function toApplicationItem(row: any): ApplicationItem {
  return {
    id: row.id,
    treatmentId: row.treatmentId,
    productId: row.productId ?? null,
    productName: row.productName,
    dosage: toNumber(row.dosage),
    dosageUnit: row.dosageUnit,
    dosageUnitLabel: DOSAGE_UNIT_LABELS[row.dosageUnit] ?? row.dosageUnit,
    administrationRoute: row.administrationRoute,
    administrationRouteLabel:
      ADMINISTRATION_ROUTE_LABELS[row.administrationRoute] ?? row.administrationRoute,
    scheduledDate: toDateStr(row.scheduledDate),
    scheduledTime: row.scheduledTime ?? null,
    applicationDate: row.applicationDate ? toDateStr(row.applicationDate) : null,
    applicationTime: row.applicationTime ?? null,
    status: row.status as ApplicationStatusValue,
    statusLabel: APPLICATION_STATUS_LABELS[row.status as ApplicationStatusValue] ?? row.status,
    notDoneReason: row.notDoneReason ?? null,
    responsibleName: row.responsibleName ?? null,
    stockOutputId: row.stockOutputId ?? null,
    costCents: toNumber(row.costCents),
    notes: row.notes ?? null,
  };
}

function toEvolutionItem(row: any): EvolutionItem {
  return {
    id: row.id,
    treatmentId: row.treatmentId,
    evolutionDate: toDateStr(row.evolutionDate),
    evolutionType: row.evolutionType as EvolutionTypeValue,
    evolutionTypeLabel:
      EVOLUTION_TYPE_LABELS[row.evolutionType as EvolutionTypeValue] ?? row.evolutionType,
    temperature: row.temperature != null ? toNumber(row.temperature) : null,
    observations: row.observations ?? null,
    veterinaryName: row.veterinaryName ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toTreatmentItem(row: any): TreatmentItem {
  const status = row.status as TreatmentStatusValue;
  const outcome = row.outcome as TreatmentOutcomeValue | null;
  const today = new Date().toISOString().slice(0, 10);
  const applications = (row.applications ?? []).map(toApplicationItem);
  const evolutions = (row.evolutions ?? []).map(toEvolutionItem);
  const pendingToday = applications.filter(
    (a: ApplicationItem) => a.scheduledDate === today && a.status === 'PENDING',
  ).length;

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    diseaseId: row.diseaseId ?? null,
    diseaseName: row.diseaseName,
    diagnosisDate: toDateStr(row.diagnosisDate),
    observedSeverity: row.observedSeverity,
    severityLabel: SEVERITY_LABELS[row.observedSeverity] ?? row.observedSeverity,
    clinicalObservations: row.clinicalObservations ?? null,
    veterinaryName: row.veterinaryName,
    responsibleName: row.responsibleName,
    treatmentProtocolId: row.treatmentProtocolId ?? null,
    treatmentProtocolName: row.treatmentProtocolName ?? null,
    withdrawalMeatDays: row.withdrawalMeatDays ?? null,
    withdrawalMilkDays: row.withdrawalMilkDays ?? null,
    withdrawalEndDate: row.withdrawalEndDate ? toDateStr(row.withdrawalEndDate) : null,
    status,
    statusLabel: TREATMENT_STATUS_LABELS[status] ?? status,
    outcome,
    outcomeLabel: outcome ? (TREATMENT_OUTCOME_LABELS[outcome] ?? outcome) : null,
    closedAt: row.closedAt ? (row.closedAt as Date).toISOString() : null,
    closingNotes: row.closingNotes ?? null,
    totalCostCents: toNumber(row.totalCostCents),
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    applications,
    evolutions,
    pendingApplicationsToday: pendingToday,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toTreatmentListItem(row: any): TreatmentListItem {
  const status = row.status as TreatmentStatusValue;
  const outcome = row.outcome as TreatmentOutcomeValue | null;
  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    diseaseName: row.diseaseName,
    diagnosisDate: toDateStr(row.diagnosisDate),
    observedSeverity: row.observedSeverity,
    severityLabel: SEVERITY_LABELS[row.observedSeverity] ?? row.observedSeverity,
    status,
    statusLabel: TREATMENT_STATUS_LABELS[status] ?? status,
    outcome,
    outcomeLabel: outcome ? (TREATMENT_OUTCOME_LABELS[outcome] ?? outcome) : null,
    veterinaryName: row.veterinaryName,
    treatmentProtocolName: row.treatmentProtocolName ?? null,
    totalCostCents: toNumber(row.totalCostCents),
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// ─── Validate ──────────────────────────────────────────────────────

function validateCreateInput(input: CreateTreatmentInput): void {
  if (!input.animalId) {
    throw new TherapeuticTreatmentError('Animal é obrigatório', 400);
  }
  if (!input.diseaseName?.trim()) {
    throw new TherapeuticTreatmentError('Nome da doença é obrigatório', 400);
  }
  if (!input.diagnosisDate) {
    throw new TherapeuticTreatmentError('Data do diagnóstico é obrigatória', 400);
  }
  const date = new Date(input.diagnosisDate);
  if (isNaN(date.getTime())) {
    throw new TherapeuticTreatmentError('Data do diagnóstico inválida', 400);
  }
  if (!input.observedSeverity || !SEVERITY_LEVELS.includes(input.observedSeverity as any)) {
    throw new TherapeuticTreatmentError('Gravidade observada inválida', 400);
  }
  if (!input.veterinaryName?.trim()) {
    throw new TherapeuticTreatmentError('Veterinário responsável é obrigatório', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new TherapeuticTreatmentError('Responsável é obrigatório', 400);
  }
  // Must have either protocol or adhoc products
  if (!input.treatmentProtocolId && (!input.adhocProducts || input.adhocProducts.length === 0)) {
    throw new TherapeuticTreatmentError(
      'É necessário selecionar um protocolo ou informar produtos para tratamento avulso',
      400,
    );
  }
}

// ─── Schedule generation (CA2) ─────────────────────────────────────

async function generateScheduleFromProtocol(
  tx: TxClient,
  treatmentId: string,
  protocolId: string,
  diagnosisDate: Date,
): Promise<{ withdrawalMeatDays: number | null; withdrawalMilkDays: number | null }> {
  const protocol = await (tx as any).treatmentProtocol.findUnique({
    where: { id: protocolId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  if (!protocol) {
    throw new TherapeuticTreatmentError('Protocolo de tratamento não encontrado', 404);
  }

  let maxMeatDays: number | null = null;
  let maxMilkDays: number | null = null;
  const applicationsData: any[] = [];

  for (const step of protocol.steps) {
    const startDay = step.startDay ?? 1;
    const freq = step.frequencyPerDay ?? 1;

    // Track withdrawal days
    if (step.withdrawalMeatDays != null) {
      maxMeatDays = Math.max(maxMeatDays ?? 0, step.withdrawalMeatDays);
    }
    if (step.withdrawalMilkDays != null) {
      maxMilkDays = Math.max(maxMilkDays ?? 0, step.withdrawalMilkDays);
    }

    // Generate application entries for each day × frequency
    for (let day = 0; day < step.durationDays; day++) {
      const scheduledDate = new Date(diagnosisDate);
      scheduledDate.setDate(scheduledDate.getDate() + startDay - 1 + day);

      for (let f = 0; f < freq; f++) {
        const hours =
          freq === 1 ? ['08:00'] : freq === 2 ? ['08:00', '20:00'] : ['06:00', '14:00', '22:00'];
        applicationsData.push({
          treatmentId,
          productId: step.productId ?? null,
          productName: step.productName,
          dosage: step.dosage,
          dosageUnit: step.dosageUnit,
          administrationRoute: step.administrationRoute,
          scheduledDate,
          scheduledTime: hours[f] ?? null,
          status: 'PENDING',
        });
      }
    }
  }

  if (applicationsData.length > 0) {
    await (tx as any).treatmentApplication.createMany({ data: applicationsData });
  }

  return { withdrawalMeatDays: maxMeatDays, withdrawalMilkDays: maxMilkDays };
}

// ─── Schedule from ad-hoc products (CA3) ───────────────────────────

async function generateScheduleFromAdhoc(
  tx: TxClient,
  treatmentId: string,
  products: CreateTreatmentInput['adhocProducts'],
  diagnosisDate: Date,
): Promise<{ withdrawalMeatDays: number | null; withdrawalMilkDays: number | null }> {
  if (!products || products.length === 0)
    return { withdrawalMeatDays: null, withdrawalMilkDays: null };

  const applicationsData: any[] = [];

  for (const prod of products) {
    if (!isValidAdministrationRoute(prod.administrationRoute)) {
      throw new TherapeuticTreatmentError(
        `Via de administração inválida: ${prod.administrationRoute}`,
        400,
      );
    }
    const startDay = prod.startDay ?? 1;
    const freq = prod.frequencyPerDay ?? 1;

    for (let day = 0; day < prod.durationDays; day++) {
      const scheduledDate = new Date(diagnosisDate);
      scheduledDate.setDate(scheduledDate.getDate() + startDay - 1 + day);

      for (let f = 0; f < freq; f++) {
        const hours =
          freq === 1 ? ['08:00'] : freq === 2 ? ['08:00', '20:00'] : ['06:00', '14:00', '22:00'];
        applicationsData.push({
          treatmentId,
          productId: prod.productId ?? null,
          productName: prod.productName,
          dosage: prod.dosage,
          dosageUnit: prod.dosageUnit,
          administrationRoute: prod.administrationRoute,
          scheduledDate,
          scheduledTime: hours[f] ?? null,
          status: 'PENDING',
        });
      }
    }
  }

  if (applicationsData.length > 0) {
    await (tx as any).treatmentApplication.createMany({ data: applicationsData });
  }

  return { withdrawalMeatDays: null, withdrawalMilkDays: null };
}

// ─── Stock deduction (CA11) ────────────────────────────────────────

async function deductApplicationStock(
  tx: TxClient,
  organizationId: string,
  productId: string,
  quantity: number,
  ref: string,
  responsibleName: string,
  productName: string,
): Promise<{ stockOutputId: string; costCents: number }> {
  const balance = await (tx as any).stockBalance.findUnique({
    where: { organizationId_productId: { organizationId, productId } },
  });

  const output = await (tx as any).stockOutput.create({
    data: {
      organizationId,
      outputDate: new Date(),
      type: 'CONSUMPTION',
      status: 'CONFIRMED',
      fieldOperationRef: ref,
      responsibleName,
      notes: `Tratamento terapêutico — ${productName}`,
      totalCost: 0,
      items: {
        create: [{ productId, quantity, unitCost: 0, totalCost: 0 }],
      },
    },
  });

  let costCents = 0;
  if (balance) {
    const prevQty = toNumber(balance.currentQuantity);
    const prevTotal = toNumber(balance.totalValue);
    const avgCost = toNumber(balance.averageCost);
    const deductedCost = quantity * avgCost;
    const newQty = Math.max(0, prevQty - quantity);
    const newTotal = Math.max(0, prevTotal - deductedCost);
    const newAvgCost = newQty > 0 ? newTotal / newQty : avgCost;

    await (tx as any).stockBalance.update({
      where: { id: balance.id },
      data: { currentQuantity: newQty, averageCost: newAvgCost, totalValue: newTotal },
    });

    await (tx as any).stockOutput.update({
      where: { id: output.id },
      data: { totalCost: deductedCost },
    });
    await (tx as any).stockOutputItem.updateMany({
      where: { stockOutputId: output.id },
      data: { unitCost: avgCost, totalCost: deductedCost },
    });

    costCents = Math.round(deductedCost * 100);
  }

  return { stockOutputId: output.id, costCents };
}

// ─── Include for queries ───────────────────────────────────────────

const TREATMENT_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
  recorder: { select: { name: true } },
  applications: { orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }] },
  evolutions: {
    orderBy: { evolutionDate: 'desc' },
    include: { recorder: { select: { name: true } } },
  },
};

const TREATMENT_LIST_INCLUDE = {
  animal: { select: { earTag: true, name: true } },
};

// ─── CREATE (CA1) ──────────────────────────────────────────────────

export async function createTreatment(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateTreatmentInput,
): Promise<TreatmentItem> {
  validateCreateInput(input);

  return withRlsContext(ctx, async (tx) => {
    // Validate animal
    const animal = await (tx as any).animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (!animal) {
      throw new TherapeuticTreatmentError('Animal não encontrado', 404);
    }

    // Validate disease if provided
    if (input.diseaseId) {
      const disease = await (tx as any).disease.findFirst({
        where: { id: input.diseaseId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!disease) {
        throw new TherapeuticTreatmentError('Doença não encontrada', 404);
      }
    }

    // Validate protocol if provided
    let protocolName: string | null = null;
    if (input.treatmentProtocolId) {
      const protocol = await (tx as any).treatmentProtocol.findFirst({
        where: {
          id: input.treatmentProtocolId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true, name: true },
      });
      if (!protocol) {
        throw new TherapeuticTreatmentError('Protocolo de tratamento não encontrado', 404);
      }
      protocolName = protocol.name;
    }

    const diagnosisDate = new Date(input.diagnosisDate);

    // Create treatment
    const treatment = await (tx as any).therapeuticTreatment.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        diseaseId: input.diseaseId ?? null,
        diseaseName: input.diseaseName,
        diagnosisDate,
        observedSeverity: input.observedSeverity,
        clinicalObservations: input.clinicalObservations ?? null,
        veterinaryName: input.veterinaryName,
        responsibleName: input.responsibleName,
        treatmentProtocolId: input.treatmentProtocolId ?? null,
        treatmentProtocolName: protocolName,
        status: 'OPEN',
        notes: input.notes ?? null,
        recordedBy: userId,
      },
    });

    // Generate schedule (CA2 or CA3)
    let withdrawalMeatDays: number | null = null;
    let withdrawalMilkDays: number | null = null;

    if (input.treatmentProtocolId) {
      const withdrawal = await generateScheduleFromProtocol(
        tx,
        treatment.id,
        input.treatmentProtocolId,
        diagnosisDate,
      );
      withdrawalMeatDays = withdrawal.withdrawalMeatDays;
      withdrawalMilkDays = withdrawal.withdrawalMilkDays;
    } else if (input.adhocProducts && input.adhocProducts.length > 0) {
      await generateScheduleFromAdhoc(tx, treatment.id, input.adhocProducts, diagnosisDate);
    }

    // Calculate withdrawal end date (CA7)
    const maxWithdrawal = Math.max(withdrawalMeatDays ?? 0, withdrawalMilkDays ?? 0);
    let withdrawalEndDate: Date | null = null;
    if (maxWithdrawal > 0) {
      // Find last application date
      const lastApp = await (tx as any).treatmentApplication.findFirst({
        where: { treatmentId: treatment.id },
        orderBy: { scheduledDate: 'desc' },
        select: { scheduledDate: true },
      });
      if (lastApp) {
        withdrawalEndDate = new Date(lastApp.scheduledDate);
        withdrawalEndDate.setDate(withdrawalEndDate.getDate() + maxWithdrawal);
      }
    }

    // Update treatment with withdrawal info
    const row = await (tx as any).therapeuticTreatment.update({
      where: { id: treatment.id },
      data: { withdrawalMeatDays, withdrawalMilkDays, withdrawalEndDate },
      include: TREATMENT_INCLUDE,
    });

    // Create health record for animal timeline
    await (tx as any).animalHealthRecord.create({
      data: {
        animalId: input.animalId,
        farmId,
        type: 'TREATMENT',
        eventDate: diagnosisDate,
        diagnosis: input.diseaseName,
        veterinaryName: input.veterinaryName,
        notes: input.clinicalObservations ?? input.notes ?? null,
        recordedBy: userId,
      },
    });

    return toTreatmentItem(row);
  });
}

// ─── LIST ──────────────────────────────────────────────────────────

export async function listTreatments(
  ctx: RlsContext,
  farmId: string,
  query: ListTreatmentsQuery,
): Promise<{ data: TreatmentListItem[]; total: number }> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.diseaseId) where.diseaseId = query.diseaseId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.diagnosisDate = {};
      if (query.dateFrom) where.diagnosisDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.diagnosisDate.lte = new Date(query.dateTo);
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      (tx as any).therapeuticTreatment.findMany({
        where,
        include: TREATMENT_LIST_INCLUDE,
        orderBy: { diagnosisDate: 'desc' },
        skip,
        take: limit,
      }),
      (tx as any).therapeuticTreatment.count({ where }),
    ]);

    return { data: rows.map(toTreatmentListItem), total };
  });
}

// ─── GET ───────────────────────────────────────────────────────────

export async function getTreatment(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
): Promise<TreatmentItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
      include: TREATMENT_INCLUDE,
    });
    if (!row) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }
    return toTreatmentItem(row);
  });
}

// ─── UPDATE ────────────────────────────────────────────────────────

export async function updateTreatment(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
  input: UpdateTreatmentInput,
): Promise<TreatmentItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
    });
    if (!existing) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }
    if (existing.status === 'CLOSED') {
      throw new TherapeuticTreatmentError('Não é possível editar um tratamento encerrado', 400);
    }

    const data: any = {};
    if (input.clinicalObservations !== undefined)
      data.clinicalObservations = input.clinicalObservations;
    if (input.veterinaryName !== undefined) data.veterinaryName = input.veterinaryName;
    if (input.responsibleName !== undefined) data.responsibleName = input.responsibleName;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await (tx as any).therapeuticTreatment.update({
      where: { id: treatmentId },
      data,
      include: TREATMENT_INCLUDE,
    });

    return toTreatmentItem(row);
  });
}

// ─── CLOSE (CA8) ───────────────────────────────────────────────────

export async function closeTreatment(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
  input: CloseTreatmentInput,
): Promise<TreatmentItem> {
  if (!input.outcome) {
    throw new TherapeuticTreatmentError('Resultado do tratamento é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
    });
    if (!existing) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }
    if (existing.status === 'CLOSED') {
      throw new TherapeuticTreatmentError('Tratamento já está encerrado', 400);
    }

    const row = await (tx as any).therapeuticTreatment.update({
      where: { id: treatmentId },
      data: {
        status: 'CLOSED',
        outcome: input.outcome,
        closedAt: new Date(),
        closingNotes: input.closingNotes ?? null,
      },
      include: TREATMENT_INCLUDE,
    });

    return toTreatmentItem(row);
  });
}

// ─── DELETE ────────────────────────────────────────────────────────

export async function deleteTreatment(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
    });
    if (!existing) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }

    await (tx as any).therapeuticTreatment.delete({ where: { id: treatmentId } });
  });
}

// ─── RECORD APPLICATION (CA4) ──────────────────────────────────────

export async function recordApplication(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
  applicationId: string,
  userId: string,
  input: RecordApplicationInput,
): Promise<ApplicationItem> {
  return withRlsContext(ctx, async (tx) => {
    const treatment = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
    });
    if (!treatment) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }
    if (treatment.status === 'CLOSED') {
      throw new TherapeuticTreatmentError('Tratamento já está encerrado', 400);
    }

    const app = await (tx as any).treatmentApplication.findFirst({
      where: { id: applicationId, treatmentId },
    });
    if (!app) {
      throw new TherapeuticTreatmentError('Aplicação não encontrada', 404);
    }
    if (app.status !== 'PENDING') {
      throw new TherapeuticTreatmentError('Aplicação já foi registrada', 400);
    }

    const updateData: any = {
      status: 'DONE',
      applicationDate: new Date(input.applicationDate),
      applicationTime: input.applicationTime ?? null,
      responsibleName: input.responsibleName,
      notes: input.notes ?? null,
    };

    // Stock deduction (CA11)
    if (app.productId && input.deductStock !== false) {
      const result = await deductApplicationStock(
        tx,
        ctx.organizationId,
        app.productId,
        app.dosage,
        `treatment-${treatmentId}-app-${applicationId}`,
        input.responsibleName,
        app.productName,
      );
      updateData.stockOutputId = result.stockOutputId;
      updateData.costCents = result.costCents;
    }

    const row = await (tx as any).treatmentApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    // Update treatment status to IN_PROGRESS if OPEN
    if (treatment.status === 'OPEN') {
      await (tx as any).therapeuticTreatment.update({
        where: { id: treatmentId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Recalculate total cost (CA10)
    const totalCost = await (tx as any).treatmentApplication.aggregate({
      where: { treatmentId, status: 'DONE' },
      _sum: { costCents: true },
    });
    await (tx as any).therapeuticTreatment.update({
      where: { id: treatmentId },
      data: { totalCostCents: totalCost._sum.costCents ?? 0 },
    });

    return toApplicationItem(row);
  });
}

// ─── SKIP APPLICATION (CA4) ───────────────────────────────────────

export async function skipApplication(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
  applicationId: string,
  input: SkipApplicationInput,
): Promise<ApplicationItem> {
  if (!input.notDoneReason?.trim()) {
    throw new TherapeuticTreatmentError('Motivo da não realização é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const treatment = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
    });
    if (!treatment) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }

    const app = await (tx as any).treatmentApplication.findFirst({
      where: { id: applicationId, treatmentId },
    });
    if (!app) {
      throw new TherapeuticTreatmentError('Aplicação não encontrada', 404);
    }
    if (app.status !== 'PENDING') {
      throw new TherapeuticTreatmentError('Aplicação já foi registrada', 400);
    }

    const row = await (tx as any).treatmentApplication.update({
      where: { id: applicationId },
      data: { status: 'NOT_DONE', notDoneReason: input.notDoneReason },
    });

    return toApplicationItem(row);
  });
}

// ─── RECORD EVOLUTION (CA5) ───────────────────────────────────────

export async function recordEvolution(
  ctx: RlsContext,
  farmId: string,
  treatmentId: string,
  userId: string,
  input: RecordEvolutionInput,
): Promise<EvolutionItem> {
  if (!input.evolutionDate) {
    throw new TherapeuticTreatmentError('Data da evolução é obrigatória', 400);
  }
  if (!input.evolutionType) {
    throw new TherapeuticTreatmentError('Tipo de evolução é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const treatment = await (tx as any).therapeuticTreatment.findFirst({
      where: { id: treatmentId, farmId },
    });
    if (!treatment) {
      throw new TherapeuticTreatmentError('Tratamento não encontrado', 404);
    }
    if (treatment.status === 'CLOSED') {
      throw new TherapeuticTreatmentError('Tratamento já está encerrado', 400);
    }

    const row = await (tx as any).clinicalEvolution.create({
      data: {
        treatmentId,
        evolutionDate: new Date(input.evolutionDate),
        evolutionType: input.evolutionType,
        temperature: input.temperature ?? null,
        observations: input.observations ?? null,
        veterinaryName: input.veterinaryName ?? null,
        recordedBy: userId,
      },
      include: { recorder: { select: { name: true } } },
    });

    return toEvolutionItem(row);
  });
}

// ─── PENDING APPLICATIONS (CA4 checklist) ─────────────────────────

export async function getPendingApplications(
  ctx: RlsContext,
  farmId: string,
  date?: string,
): Promise<PendingApplicationsResult> {
  const targetDate = date ? new Date(date) : new Date();
  const dateStr = targetDate.toISOString().slice(0, 10);

  return withRlsContext(ctx, async (tx) => {
    const applications = await (tx as any).treatmentApplication.findMany({
      where: {
        scheduledDate: targetDate,
        status: 'PENDING',
        treatment: { farmId, status: { not: 'CLOSED' } },
      },
      include: {
        treatment: {
          select: {
            id: true,
            diseaseName: true,
            animal: { select: { earTag: true, name: true } },
          },
        },
      },
      orderBy: [{ scheduledTime: 'asc' }],
    });

    // Group by treatment
    const grouped = new Map<string, any>();
    for (const app of applications) {
      const tid = app.treatment.id;
      if (!grouped.has(tid)) {
        grouped.set(tid, {
          treatmentId: tid,
          animalEarTag: app.treatment.animal.earTag,
          animalName: app.treatment.animal.name ?? null,
          diseaseName: app.treatment.diseaseName,
          applications: [],
        });
      }
      grouped.get(tid).applications.push(toApplicationItem(app));
    }

    return {
      date: dateStr,
      totalPending: applications.length,
      treatments: Array.from(grouped.values()),
    };
  });
}

// ─── EXPORT CSV ────────────────────────────────────────────────────

export async function exportTreatmentsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListTreatmentsQuery,
): Promise<string> {
  const { data } = await listTreatments(ctx, farmId, { ...query, limit: 5000 });

  const BOM = '\uFEFF';
  const lines: string[] = [];
  lines.push(
    'Brinco;Nome;Doença;Data Diagnóstico;Gravidade;Status;Resultado;Veterinário;Protocolo;Custo (R$)',
  );

  for (const t of data) {
    lines.push(
      [
        t.animalEarTag,
        t.animalName ?? '',
        t.diseaseName,
        new Date(t.diagnosisDate).toLocaleDateString('pt-BR'),
        t.severityLabel,
        t.statusLabel,
        t.outcomeLabel ?? '',
        t.veterinaryName,
        t.treatmentProtocolName ?? 'Avulso',
        (t.totalCostCents / 100).toFixed(2).replace('.', ','),
      ].join(';'),
    );
  }

  return BOM + lines.join('\n');
}
