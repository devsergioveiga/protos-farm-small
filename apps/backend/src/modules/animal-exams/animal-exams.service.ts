import { randomUUID } from 'node:crypto';
import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  AnimalExamError,
  EXAM_CATEGORIES,
  EXAM_CATEGORY_LABELS,
  EXAM_METHODS,
  EXAM_METHOD_LABELS,
  EXAM_MATERIALS,
  EXAM_MATERIAL_LABELS,
  EXAM_STATUSES,
  EXAM_STATUS_LABELS,
  RESULT_INDICATOR_LABELS,
  type ExamCategoryValue,
  type ExamMethodValue,
  type ExamMaterialValue,
  type ExamStatusValue,
  type ResultIndicatorValue,
  type CreateExamTypeInput,
  type UpdateExamTypeInput,
  type ListExamTypesQuery,
  type ExamTypeItem,
  type ExamTypeParamItem,
  type CreateAnimalExamInput,
  type BulkExamInput,
  type UpdateAnimalExamInput,
  type RecordResultsInput,
  type ListAnimalExamsQuery,
  type AnimalExamItem,
  type ExamResultItem,
  type BulkExamResult,
  type ExamIndicators,
  type ImportExamResultsResult,
} from './animal-exams.types';
import { parseExamFile, type ParsedExamResultRow } from './exam-file-parser';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Helpers ────────────────────────────────────────────────────────

function toExamTypeItem(row: any): ExamTypeItem {
  const category = row.category as ExamCategoryValue;
  const method = row.method as ExamMethodValue;
  const material = (row.material as ExamMaterialValue) ?? null;

  const params: ExamTypeParamItem[] = (row.referenceParams ?? []).map((p: any) => ({
    id: p.id,
    paramName: p.paramName,
    unit: p.unit ?? null,
    minReference: p.minReference ?? null,
    maxReference: p.maxReference ?? null,
    isBooleanResult: p.isBooleanResult ?? false,
    sortOrder: p.sortOrder ?? 0,
  }));

  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    category,
    categoryLabel: EXAM_CATEGORY_LABELS[category] ?? category,
    method,
    methodLabel: EXAM_METHOD_LABELS[method] ?? method,
    material,
    materialLabel: material ? (EXAM_MATERIAL_LABELS[material] ?? material) : null,
    defaultLab: row.defaultLab ?? null,
    isRegulatory: row.isRegulatory ?? false,
    validityDays: row.validityDays ?? null,
    notes: row.notes ?? null,
    referenceParams: params.sort(
      (a: ExamTypeParamItem, b: ExamTypeParamItem) => a.sortOrder - b.sortOrder,
    ),
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function toExamResultItem(row: any): ExamResultItem {
  const indicator = (row.indicator as ResultIndicatorValue) ?? null;
  return {
    id: row.id,
    paramName: row.paramName,
    numericValue: row.numericValue ?? null,
    booleanValue: row.booleanValue ?? null,
    textValue: row.textValue ?? null,
    unit: row.unit ?? null,
    minReference: row.minReference ?? null,
    maxReference: row.maxReference ?? null,
    indicator,
    indicatorLabel: indicator ? (RESULT_INDICATOR_LABELS[indicator] ?? indicator) : null,
  };
}

function toAnimalExamItem(row: any): AnimalExamItem {
  const status = row.status as ExamStatusValue;
  const examCategory = (row.examType?.category as ExamCategoryValue) ?? '';

  return {
    id: row.id,
    farmId: row.farmId,
    animalId: row.animalId,
    animalEarTag: row.animal?.earTag ?? '',
    animalName: row.animal?.name ?? null,
    examTypeId: row.examTypeId,
    examTypeName: row.examTypeName,
    examTypeCategory: examCategory,
    examTypeCategoryLabel: EXAM_CATEGORY_LABELS[examCategory] ?? examCategory,
    collectionDate: (row.collectionDate as Date).toISOString().slice(0, 10),
    sendDate: row.sendDate ? (row.sendDate as Date).toISOString().slice(0, 10) : null,
    laboratory: row.laboratory ?? null,
    protocolNumber: row.protocolNumber ?? null,
    status,
    statusLabel: EXAM_STATUS_LABELS[status] ?? status,
    resultDate: row.resultDate ? (row.resultDate as Date).toISOString().slice(0, 10) : null,
    responsibleName: row.responsibleName,
    veterinaryName: row.veterinaryName ?? null,
    veterinaryCrmv: row.veterinaryCrmv ?? null,
    certificateNumber: row.certificateNumber ?? null,
    certificateValidity: row.certificateValidity
      ? (row.certificateValidity as Date).toISOString().slice(0, 10)
      : null,
    animalLotId: row.animalLotId ?? null,
    campaignId: row.campaignId ?? null,
    linkedTreatmentId: row.linkedTreatmentId ?? null,
    reportFileName: row.reportFileName ?? null,
    reportMimeType: row.reportMimeType ?? null,
    reportUrl: row.reportPath ? `/api/org/farms/${row.farmId}/animal-exams/${row.id}/report` : null,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy,
    recorderName: row.recorder?.name ?? '',
    results: (row.results ?? []).map(toExamResultItem),
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

function calcIndicator(
  numericValue: number | null | undefined,
  booleanValue: boolean | null | undefined,
  minRef: number | null | undefined,
  maxRef: number | null | undefined,
): ResultIndicatorValue | null {
  if (booleanValue != null) {
    return booleanValue ? 'POSITIVE' : 'NEGATIVE';
  }
  if (numericValue != null) {
    if (minRef != null && numericValue < minRef) return 'BELOW';
    if (maxRef != null && numericValue > maxRef) return 'ABOVE';
    if (minRef != null || maxRef != null) return 'NORMAL';
  }
  return null;
}

// ─── Validation ─────────────────────────────────────────────────────

function validateExamTypeInput(input: CreateExamTypeInput, isUpdate = false): void {
  if (!isUpdate) {
    if (!input.name?.trim()) {
      throw new AnimalExamError('Nome do tipo de exame é obrigatório', 400);
    }
    if (!input.category) {
      throw new AnimalExamError('Categoria é obrigatória', 400);
    }
    if (!input.method) {
      throw new AnimalExamError('Método é obrigatório', 400);
    }
  }
  if (input.category !== undefined) {
    if (!EXAM_CATEGORIES.includes(input.category as ExamCategoryValue)) {
      throw new AnimalExamError(`Categoria inválida. Use: ${EXAM_CATEGORIES.join(', ')}`, 400);
    }
  }
  if (input.method !== undefined) {
    if (!EXAM_METHODS.includes(input.method as ExamMethodValue)) {
      throw new AnimalExamError(`Método inválido. Use: ${EXAM_METHODS.join(', ')}`, 400);
    }
  }
  if (input.material !== undefined && input.material !== null) {
    if (!EXAM_MATERIALS.includes(input.material as ExamMaterialValue)) {
      throw new AnimalExamError(`Material inválido. Use: ${EXAM_MATERIALS.join(', ')}`, 400);
    }
  }
  if (input.validityDays !== undefined && input.validityDays !== null) {
    if (!Number.isInteger(input.validityDays) || input.validityDays <= 0) {
      throw new AnimalExamError('Dias de validade deve ser um número inteiro positivo', 400);
    }
  }
}

function validateAnimalExamInput(input: CreateAnimalExamInput): void {
  if (!input.animalId?.trim()) {
    throw new AnimalExamError('Animal é obrigatório', 400);
  }
  if (!input.examTypeId?.trim()) {
    throw new AnimalExamError('Tipo de exame é obrigatório', 400);
  }
  if (!input.collectionDate) {
    throw new AnimalExamError('Data da coleta é obrigatória', 400);
  }
  const date = new Date(input.collectionDate);
  if (isNaN(date.getTime())) {
    throw new AnimalExamError('Data da coleta inválida', 400);
  }
  if (date > new Date()) {
    throw new AnimalExamError('Data da coleta não pode ser no futuro', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new AnimalExamError('Nome do responsável é obrigatório', 400);
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXAM TYPES
// ═══════════════════════════════════════════════════════════════════

const examTypeInclude = { referenceParams: true };

export async function createExamType(
  ctx: RlsContext,
  input: CreateExamTypeInput,
): Promise<ExamTypeItem> {
  validateExamTypeInput(input);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.examType.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      throw new AnimalExamError('Já existe um tipo de exame com este nome', 409);
    }

    const created = await tx.examType.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name.trim(),
        category: input.category as any,
        method: input.method as any,
        material: input.material ?? null,
        defaultLab: input.defaultLab ?? null,
        isRegulatory: input.isRegulatory ?? false,
        validityDays: input.validityDays ?? null,
        notes: input.notes ?? null,
        referenceParams: input.referenceParams?.length
          ? {
              create: input.referenceParams.map((p, i) => ({
                paramName: p.paramName,
                unit: p.unit ?? null,
                minReference: p.minReference ?? null,
                maxReference: p.maxReference ?? null,
                isBooleanResult: p.isBooleanResult ?? false,
                sortOrder: p.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: examTypeInclude,
    });

    return toExamTypeItem(created);
  });
}

export async function listExamTypes(
  ctx: RlsContext,
  query: ListExamTypesQuery,
): Promise<{
  data: ExamTypeItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    };
    if (query.category) {
      where.category = query.category;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [rows, total] = await Promise.all([
      tx.examType.findMany({
        where,
        include: examTypeInclude,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      tx.examType.count({ where }),
    ]);

    return {
      data: rows.map(toExamTypeItem),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getExamType(ctx: RlsContext, examTypeId: string): Promise<ExamTypeItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.examType.findFirst({
      where: { id: examTypeId, organizationId: ctx.organizationId, deletedAt: null },
      include: examTypeInclude,
    });
    if (!row) {
      throw new AnimalExamError('Tipo de exame não encontrado', 404);
    }
    return toExamTypeItem(row);
  });
}

export async function updateExamType(
  ctx: RlsContext,
  examTypeId: string,
  input: UpdateExamTypeInput,
): Promise<ExamTypeItem> {
  validateExamTypeInput(input as CreateExamTypeInput, true);

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.examType.findFirst({
      where: { id: examTypeId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new AnimalExamError('Tipo de exame não encontrado', 404);
    }

    if (input.name && input.name.trim() !== existing.name) {
      const dup = await tx.examType.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: input.name.trim(),
          deletedAt: null,
          id: { not: examTypeId },
        },
      });
      if (dup) {
        throw new AnimalExamError('Já existe um tipo de exame com este nome', 409);
      }
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.category !== undefined) data.category = input.category;
    if (input.method !== undefined) data.method = input.method;
    if (input.material !== undefined) data.material = input.material;
    if (input.defaultLab !== undefined) data.defaultLab = input.defaultLab;
    if (input.isRegulatory !== undefined) data.isRegulatory = input.isRegulatory;
    if (input.validityDays !== undefined) data.validityDays = input.validityDays;
    if (input.notes !== undefined) data.notes = input.notes;

    if (input.referenceParams !== undefined) {
      await tx.examTypeParam.deleteMany({ where: { examTypeId } });
      if (input.referenceParams.length > 0) {
        await tx.examTypeParam.createMany({
          data: input.referenceParams.map((p, i) => ({
            examTypeId,
            paramName: p.paramName,
            unit: p.unit ?? null,
            minReference: p.minReference ?? null,
            maxReference: p.maxReference ?? null,
            isBooleanResult: p.isBooleanResult ?? false,
            sortOrder: p.sortOrder ?? i,
          })),
        });
      }
    }

    const updated = await tx.examType.update({
      where: { id: examTypeId },
      data,
      include: examTypeInclude,
    });

    return toExamTypeItem(updated);
  });
}

export async function deleteExamType(ctx: RlsContext, examTypeId: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.examType.findFirst({
      where: { id: examTypeId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new AnimalExamError('Tipo de exame não encontrado', 404);
    }

    await tx.examType.update({
      where: { id: examTypeId },
      data: { deletedAt: new Date() },
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// ANIMAL EXAMS
// ═══════════════════════════════════════════════════════════════════

const examInclude = {
  animal: { select: { earTag: true, name: true } },
  examType: { select: { category: true } },
  recorder: { select: { name: true } },
  results: true,
};

export async function createAnimalExam(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: CreateAnimalExamInput,
): Promise<AnimalExamItem> {
  validateAnimalExamInput(input);

  return withRlsContext(ctx, async (tx) => {
    const animal = await tx.animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
    });
    if (!animal) {
      throw new AnimalExamError('Animal não encontrado nesta fazenda', 404);
    }

    const examType = await tx.examType.findFirst({
      where: { id: input.examTypeId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!examType) {
      throw new AnimalExamError('Tipo de exame não encontrado', 404);
    }

    const created = await tx.animalExam.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        animalId: input.animalId,
        examTypeId: input.examTypeId,
        examTypeName: examType.name,
        collectionDate: new Date(input.collectionDate),
        sendDate: input.sendDate ? new Date(input.sendDate) : null,
        laboratory: input.laboratory ?? examType.defaultLab ?? null,
        protocolNumber: input.protocolNumber ?? null,
        responsibleName: input.responsibleName.trim(),
        veterinaryName: input.veterinaryName ?? null,
        veterinaryCrmv: input.veterinaryCrmv ?? null,
        certificateNumber: input.certificateNumber ?? null,
        certificateValidity: input.certificateValidity ? new Date(input.certificateValidity) : null,
        notes: input.notes ?? null,
        recordedBy: userId,
      },
      include: examInclude,
    });

    return toAnimalExamItem(created);
  });
}

export async function bulkExam(
  ctx: RlsContext,
  farmId: string,
  userId: string,
  input: BulkExamInput,
): Promise<BulkExamResult> {
  if (!input.animalLotId?.trim()) {
    throw new AnimalExamError('Lote é obrigatório', 400);
  }
  if (!input.examTypeId?.trim()) {
    throw new AnimalExamError('Tipo de exame é obrigatório', 400);
  }
  if (!input.collectionDate) {
    throw new AnimalExamError('Data da coleta é obrigatória', 400);
  }
  if (!input.responsibleName?.trim()) {
    throw new AnimalExamError('Nome do responsável é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const lot = await tx.animalLot.findFirst({
      where: { id: input.animalLotId, farmId },
    });
    if (!lot) {
      throw new AnimalExamError('Lote não encontrado nesta fazenda', 404);
    }

    const examType = await tx.examType.findFirst({
      where: { id: input.examTypeId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!examType) {
      throw new AnimalExamError('Tipo de exame não encontrado', 404);
    }

    const animals = await tx.animal.findMany({
      where: { lotId: input.animalLotId, farmId, deletedAt: null },
      select: { id: true },
    });
    if (animals.length === 0) {
      throw new AnimalExamError('Nenhum animal encontrado no lote', 404);
    }

    const campaignId = randomUUID();
    const collectionDate = new Date(input.collectionDate);
    const sendDate = input.sendDate ? new Date(input.sendDate) : null;

    await tx.animalExam.createMany({
      data: animals.map((a) => ({
        organizationId: ctx.organizationId,
        farmId,
        animalId: a.id,
        examTypeId: input.examTypeId,
        examTypeName: examType.name,
        collectionDate,
        sendDate,
        laboratory: input.laboratory ?? examType.defaultLab ?? null,
        protocolNumber: input.protocolNumber ?? null,
        responsibleName: input.responsibleName.trim(),
        veterinaryName: input.veterinaryName ?? null,
        veterinaryCrmv: input.veterinaryCrmv ?? null,
        animalLotId: input.animalLotId,
        campaignId,
        notes: input.notes ?? null,
        recordedBy: userId,
      })),
    });

    return {
      campaignId,
      created: animals.length,
      animalCount: animals.length,
    };
  });
}

export async function listAnimalExams(
  ctx: RlsContext,
  farmId: string,
  query: ListAnimalExamsQuery,
): Promise<{
  data: AnimalExamItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId, organizationId: ctx.organizationId };

    if (query.animalId) where.animalId = query.animalId;
    if (query.examTypeId) where.examTypeId = query.examTypeId;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.collectionDate = {};
      if (query.dateFrom) where.collectionDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.collectionDate.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { examTypeName: { contains: query.search, mode: 'insensitive' } },
        { animal: { earTag: { contains: query.search, mode: 'insensitive' } } },
        { animal: { name: { contains: query.search, mode: 'insensitive' } } },
        { laboratory: { contains: query.search, mode: 'insensitive' } },
        { responsibleName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.animalExam.findMany({
        where,
        include: examInclude,
        orderBy: { collectionDate: 'desc' },
        skip,
        take: limit,
      }),
      tx.animalExam.count({ where }),
    ]);

    return {
      data: rows.map(toAnimalExamItem),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export async function getAnimalExam(
  ctx: RlsContext,
  farmId: string,
  examId: string,
): Promise<AnimalExamItem> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.animalExam.findFirst({
      where: { id: examId, farmId, organizationId: ctx.organizationId },
      include: examInclude,
    });
    if (!row) {
      throw new AnimalExamError('Exame não encontrado', 404);
    }
    return toAnimalExamItem(row);
  });
}

export async function updateAnimalExam(
  ctx: RlsContext,
  farmId: string,
  examId: string,
  input: UpdateAnimalExamInput,
): Promise<AnimalExamItem> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalExam.findFirst({
      where: { id: examId, farmId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new AnimalExamError('Exame não encontrado', 404);
    }

    if (input.status !== undefined) {
      if (!EXAM_STATUSES.includes(input.status as ExamStatusValue)) {
        throw new AnimalExamError(`Status inválido. Use: ${EXAM_STATUSES.join(', ')}`, 400);
      }
    }

    const data: any = {};
    if (input.sendDate !== undefined)
      data.sendDate = input.sendDate ? new Date(input.sendDate) : null;
    if (input.laboratory !== undefined) data.laboratory = input.laboratory;
    if (input.protocolNumber !== undefined) data.protocolNumber = input.protocolNumber;
    if (input.responsibleName !== undefined) data.responsibleName = input.responsibleName.trim();
    if (input.veterinaryName !== undefined) data.veterinaryName = input.veterinaryName;
    if (input.veterinaryCrmv !== undefined) data.veterinaryCrmv = input.veterinaryCrmv;
    if (input.certificateNumber !== undefined) data.certificateNumber = input.certificateNumber;
    if (input.certificateValidity !== undefined) {
      data.certificateValidity = input.certificateValidity
        ? new Date(input.certificateValidity)
        : null;
    }
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) data.status = input.status;

    const updated = await tx.animalExam.update({
      where: { id: examId },
      data,
      include: examInclude,
    });

    return toAnimalExamItem(updated);
  });
}

export async function deleteAnimalExam(
  ctx: RlsContext,
  farmId: string,
  examId: string,
): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.animalExam.findFirst({
      where: { id: examId, farmId, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new AnimalExamError('Exame não encontrado', 404);
    }
    await tx.animalExam.delete({ where: { id: examId } });
  });
}

export async function recordResults(
  ctx: RlsContext,
  farmId: string,
  examId: string,
  input: RecordResultsInput,
): Promise<AnimalExamItem> {
  if (!input.resultDate) {
    throw new AnimalExamError('Data do resultado é obrigatória', 400);
  }
  if (!input.results || input.results.length === 0) {
    throw new AnimalExamError('Pelo menos um resultado é obrigatório', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const exam = await tx.animalExam.findFirst({
      where: { id: examId, farmId, organizationId: ctx.organizationId },
      include: { examType: { include: { referenceParams: true } } },
    });
    if (!exam) {
      throw new AnimalExamError('Exame não encontrado', 404);
    }
    if (exam.status === 'COMPLETED') {
      throw new AnimalExamError(
        'Este exame já foi concluído. Exclua os resultados existentes antes de registrar novos.',
        400,
      );
    }
    if (exam.status === 'CANCELLED') {
      throw new AnimalExamError('Não é possível registrar resultados em um exame cancelado', 400);
    }

    // Delete existing results to replace
    await tx.examResult.deleteMany({ where: { examId } });

    // Build reference map from exam type params
    const refMap = new Map<string, { min: number | null; max: number | null; isBool: boolean }>();
    for (const p of exam.examType.referenceParams) {
      refMap.set(p.paramName, {
        min: p.minReference,
        max: p.maxReference,
        isBool: p.isBooleanResult,
      });
    }

    // Create results with auto-calculated indicators
    const resultsData = input.results.map((r) => {
      const ref = refMap.get(r.paramName);
      const minRef = r.minReference ?? ref?.min ?? null;
      const maxRef = r.maxReference ?? ref?.max ?? null;
      const indicator = calcIndicator(r.numericValue, r.booleanValue, minRef, maxRef);

      return {
        examId,
        paramName: r.paramName,
        numericValue: r.numericValue ?? null,
        booleanValue: r.booleanValue ?? null,
        textValue: r.textValue ?? null,
        unit: r.unit ?? null,
        minReference: minRef,
        maxReference: maxRef,
        indicator: indicator as any,
      };
    });

    await tx.examResult.createMany({ data: resultsData });

    // Update exam status and result date
    const updated = await tx.animalExam.update({
      where: { id: examId },
      data: {
        status: 'COMPLETED',
        resultDate: new Date(input.resultDate),
      },
      include: examInclude,
    });

    return toAnimalExamItem(updated);
  });
}

export async function getExamIndicators(ctx: RlsContext, farmId: string): Promise<ExamIndicators> {
  return withRlsContext(ctx, async (tx) => {
    // Pending results
    const pendingResults = await tx.animalExam.count({
      where: {
        farmId,
        organizationId: ctx.organizationId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Expired regulatory exams
    const now = new Date();
    const expiredRegulatory = await tx.animalExam.count({
      where: {
        farmId,
        organizationId: ctx.organizationId,
        certificateValidity: { lt: now },
        examType: { isRegulatory: true },
        status: 'COMPLETED',
      },
    });

    // Positivity rates by exam type
    const completedExams = await tx.animalExam.findMany({
      where: {
        farmId,
        organizationId: ctx.organizationId,
        status: 'COMPLETED',
      },
      include: {
        results: true,
      },
    });

    const typeMap = new Map<string, { total: number; positive: number }>();
    for (const exam of completedExams) {
      const entry = typeMap.get(exam.examTypeName) ?? { total: 0, positive: 0 };
      entry.total++;
      const hasPositive = exam.results.some((r: any) => r.indicator === 'POSITIVE');
      if (hasPositive) entry.positive++;
      typeMap.set(exam.examTypeName, entry);
    }

    const positivityRates = Array.from(typeMap.entries()).map(([name, stats]) => ({
      examTypeName: name,
      total: stats.total,
      positive: stats.positive,
      rate: stats.total > 0 ? Math.round((stats.positive / stats.total) * 10000) / 100 : 0,
    }));

    return { pendingResults, expiredRegulatory, positivityRates };
  });
}

export async function exportExamsCsv(
  ctx: RlsContext,
  farmId: string,
  query: ListAnimalExamsQuery,
): Promise<string> {
  return withRlsContext(ctx, async (tx) => {
    const where: any = { farmId, organizationId: ctx.organizationId };
    if (query.animalId) where.animalId = query.animalId;
    if (query.examTypeId) where.examTypeId = query.examTypeId;
    if (query.status) where.status = query.status;

    const rows = await tx.animalExam.findMany({
      where,
      include: {
        animal: { select: { earTag: true, name: true } },
        results: true,
        recorder: { select: { name: true } },
      },
      orderBy: { collectionDate: 'desc' },
    });

    const header = [
      'Brinco',
      'Animal',
      'Tipo Exame',
      'Data Coleta',
      'Laboratório',
      'Protocolo',
      'Status',
      'Data Resultado',
      'Responsável',
      'Veterinário',
      'CRMV',
      'Nº Atestado',
      'Validade Atestado',
      'Resultados',
    ].join(';');

    const lines = rows.map((row: any) => {
      const resultsStr = (row.results as any[])
        .map((r: any) => {
          if (r.booleanValue != null)
            return `${r.paramName}: ${r.booleanValue ? 'Positivo' : 'Negativo'}`;
          if (r.numericValue != null)
            return `${r.paramName}: ${r.numericValue}${r.unit ? ' ' + r.unit : ''}`;
          if (r.textValue) return `${r.paramName}: ${r.textValue}`;
          return r.paramName;
        })
        .join(' | ');

      return [
        row.animal?.earTag ?? '',
        row.animal?.name ?? '',
        row.examTypeName,
        (row.collectionDate as Date).toISOString().slice(0, 10),
        row.laboratory ?? '',
        row.protocolNumber ?? '',
        EXAM_STATUS_LABELS[row.status as ExamStatusValue] ?? row.status,
        row.resultDate ? (row.resultDate as Date).toISOString().slice(0, 10) : '',
        row.responsibleName,
        row.veterinaryName ?? '',
        row.veterinaryCrmv ?? '',
        row.certificateNumber ?? '',
        row.certificateValidity ? (row.certificateValidity as Date).toISOString().slice(0, 10) : '',
        resultsStr,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';');
    });

    return '\uFEFF' + [header, ...lines].join('\n');
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA6: UPLOAD REPORT
// ═══════════════════════════════════════════════════════════════════

export async function uploadExamReport(
  ctx: RlsContext,
  farmId: string,
  examId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer },
): Promise<AnimalExamItem> {
  return withRlsContext(ctx, async (tx) => {
    const exam = await tx.animalExam.findFirst({
      where: { id: examId, farmId, organizationId: ctx.organizationId },
    });
    if (!exam) {
      throw new AnimalExamError('Exame não encontrado', 404);
    }

    // Store file on disk
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'exam-reports');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname) || '.pdf';
    const filename = `${examId}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const updated = await tx.animalExam.update({
      where: { id: examId },
      data: {
        reportFileName: file.originalname,
        reportMimeType: file.mimetype,
        reportPath: filePath,
      },
      include: examInclude,
    });

    return toAnimalExamItem(updated);
  });
}

export async function getExamReportFile(
  ctx: RlsContext,
  farmId: string,
  examId: string,
): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
  return withRlsContext(ctx, async (tx) => {
    const exam = await tx.animalExam.findFirst({
      where: { id: examId, farmId, organizationId: ctx.organizationId },
    });
    if (!exam || !exam.reportPath) {
      throw new AnimalExamError('Laudo não encontrado', 404);
    }

    const fs = await import('node:fs/promises');
    const buffer = await fs.readFile(exam.reportPath);
    return {
      buffer,
      filename: exam.reportFileName ?? 'laudo.pdf',
      mimetype: exam.reportMimeType ?? 'application/octet-stream',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════
// CA11: IMPORT RESULTS FROM CSV/EXCEL
// ═══════════════════════════════════════════════════════════════════

export async function importExamResults(
  ctx: RlsContext,
  farmId: string,
  file: { originalname: string; buffer: Buffer },
  resultDate: string,
): Promise<ImportExamResultsResult> {
  const parsed = await parseExamFile(file.buffer, file.originalname);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    throw new AnimalExamError(parsed.errors.join('; '), 400);
  }

  if (parsed.rows.length === 0) {
    throw new AnimalExamError('Nenhum resultado encontrado no arquivo', 400);
  }

  if (!resultDate) {
    throw new AnimalExamError('Data do resultado é obrigatória', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // Group rows by earTag
    const byEarTag = new Map<string, ParsedExamResultRow[]>();
    for (const row of parsed.rows) {
      const existing = byEarTag.get(row.earTag) ?? [];
      existing.push(row);
      byEarTag.set(row.earTag, existing);
    }

    // Load animals by earTag
    const animals = await tx.animal.findMany({
      where: {
        farmId,
        earTag: { in: [...byEarTag.keys()] },
        deletedAt: null,
      },
      select: { id: true, earTag: true },
    });
    const animalMap = new Map(animals.map((a) => [a.earTag, a.id]));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [...parsed.errors];

    for (const [earTag, rows] of byEarTag.entries()) {
      const animalId = animalMap.get(earTag);
      if (!animalId) {
        errors.push(`Brinco "${earTag}" não encontrado na fazenda`);
        skipped += rows.length;
        continue;
      }

      // Find the most recent PENDING/IN_PROGRESS exam for this animal
      const exam = await tx.animalExam.findFirst({
        where: {
          animalId,
          farmId,
          organizationId: ctx.organizationId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: { examType: { include: { referenceParams: true } } },
        orderBy: { collectionDate: 'desc' },
      });

      if (!exam) {
        errors.push(`Nenhum exame pendente para brinco "${earTag}"`);
        skipped += rows.length;
        continue;
      }

      // Build reference map
      const refMap = new Map<string, { min: number | null; max: number | null }>();
      for (const p of exam.examType.referenceParams) {
        refMap.set(p.paramName, { min: p.minReference, max: p.maxReference });
      }

      // Delete existing results
      await tx.examResult.deleteMany({ where: { examId: exam.id } });

      // Create results
      const resultsData = rows.map((r) => {
        const ref = refMap.get(r.paramName);
        const indicator = calcIndicator(
          r.numericValue,
          r.booleanValue,
          ref?.min ?? null,
          ref?.max ?? null,
        );
        return {
          examId: exam.id,
          paramName: r.paramName,
          numericValue: r.numericValue,
          booleanValue: r.booleanValue,
          textValue: r.textValue,
          unit: r.unit,
          minReference: ref?.min ?? null,
          maxReference: ref?.max ?? null,
          indicator: indicator as any,
        };
      });

      await tx.examResult.createMany({ data: resultsData });

      // Update exam status
      await tx.animalExam.update({
        where: { id: exam.id },
        data: { status: 'COMPLETED', resultDate: new Date(resultDate) },
      });

      imported += rows.length;
    }

    return { imported, skipped, errors };
  });
}
