import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  MedicalExamError,
  type CreateMedicalExamInput,
  type UpdateMedicalExamInput,
  type MedicalExamOutput,
  type MedicalExamListQuery,
} from './medical-exams.types';
import { classifyExpiryAlert } from '../safety-compliance/safety-compliance.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapExam(row: TxClient): MedicalExamOutput {
  const nextExamDate = row.nextExamDate ? new Date(row.nextExamDate) : null;
  const expiryStatus = classifyExpiryAlert(nextExamDate);

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? '',
    employeePosition: row.employee?.contracts?.[0]?.position?.name ?? null,
    farmId: row.farmId ?? null,
    type: row.type,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    doctorName: row.doctorName,
    doctorCrm: row.doctorCrm,
    result: row.result,
    restrictions: row.restrictions ?? null,
    nextExamDate: nextExamDate ? nextExamDate.toISOString().split('T')[0] : null,
    expiryStatus,
    documentUrl: row.documentUrl ?? null,
    observations: row.observations ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

const EXAM_INCLUDE = {
  employee: {
    select: {
      name: true,
      contracts: {
        where: { isActive: true },
        take: 1,
        select: {
          position: { select: { name: true, asoPeriodicityMonths: true } },
        },
      },
    },
  },
};

async function getAsoPeriodicityMonths(tx: TxClient, employeeId: string): Promise<number> {
  const contract = await tx.employeeContract.findFirst({
    where: { employeeId, isActive: true },
    orderBy: { startDate: 'desc' },
    select: { position: { select: { asoPeriodicityMonths: true } } },
  });
  return contract?.position?.asoPeriodicityMonths ?? 12;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createMedicalExam(
  ctx: RlsContext,
  input: CreateMedicalExamInput,
  createdBy: string,
): Promise<MedicalExamOutput> {
  return withRlsContext(ctx, async (tx) => {
    // Verify employee belongs to org
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!employee) {
      throw new MedicalExamError('Colaborador não encontrado', 404);
    }

    // Auto-calculate nextExamDate if not provided
    let nextExamDate: Date | null = null;
    if (input.nextExamDate) {
      nextExamDate = new Date(input.nextExamDate);
    } else {
      const periodicityMonths = await getAsoPeriodicityMonths(tx, input.employeeId);
      const examDate = new Date(input.date);
      nextExamDate = new Date(examDate);
      nextExamDate.setMonth(nextExamDate.getMonth() + periodicityMonths);
    }

    const created = await tx.medicalExam.create({
      data: {
        organizationId: ctx.organizationId,
        employeeId: input.employeeId,
        farmId: input.farmId ?? null,
        type: input.type,
        date: new Date(input.date),
        doctorName: input.doctorName,
        doctorCrm: input.doctorCrm,
        result: input.result,
        restrictions: input.restrictions ?? null,
        nextExamDate,
        documentUrl: input.documentUrl ?? null,
        observations: input.observations ?? null,
        createdBy,
      },
      include: EXAM_INCLUDE,
    });

    return mapExam(created);
  });
}

export async function updateMedicalExam(
  ctx: RlsContext,
  id: string,
  input: UpdateMedicalExamInput,
): Promise<MedicalExamOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.medicalExam.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new MedicalExamError('ASO não encontrado', 404);
    }

    const updated = await tx.medicalExam.update({
      where: { id },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.date !== undefined && { date: new Date(input.date) }),
        ...(input.doctorName !== undefined && { doctorName: input.doctorName }),
        ...(input.doctorCrm !== undefined && { doctorCrm: input.doctorCrm }),
        ...(input.result !== undefined && { result: input.result }),
        ...(input.restrictions !== undefined && { restrictions: input.restrictions }),
        ...(input.nextExamDate !== undefined && {
          nextExamDate: input.nextExamDate ? new Date(input.nextExamDate) : null,
        }),
        ...(input.documentUrl !== undefined && { documentUrl: input.documentUrl }),
        ...(input.observations !== undefined && { observations: input.observations }),
      },
      include: EXAM_INCLUDE,
    });

    return mapExam(updated);
  });
}

export async function deleteMedicalExam(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.medicalExam.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });
    if (!existing) {
      throw new MedicalExamError('ASO não encontrado', 404);
    }

    await tx.medicalExam.delete({ where: { id } });
  });
}

export async function getMedicalExam(ctx: RlsContext, id: string): Promise<MedicalExamOutput> {
  return withRlsContext(ctx, async (tx) => {
    const exam = await tx.medicalExam.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: EXAM_INCLUDE,
    });
    if (!exam) {
      throw new MedicalExamError('ASO não encontrado', 404);
    }
    return mapExam(exam);
  });
}

export async function listMedicalExams(
  ctx: RlsContext,
  query: MedicalExamListQuery,
): Promise<{ data: MedicalExamOutput[]; total: number; page: number; limit: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    // Build where clause (without expiryStatus — will filter in-app)
    const where: TxClient = {
      organizationId: ctx.organizationId,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.type && { type: query.type }),
      ...(query.result && { result: query.result }),
      ...(query.farmId && { farmId: query.farmId }),
    };

    const allExams = await tx.medicalExam.findMany({
      where,
      include: EXAM_INCLUDE,
      orderBy: { date: 'desc' },
    });

    const mapped = allExams.map(mapExam);

    // Filter by expiryStatus in-app if requested
    const filtered = query.expiryStatus
      ? mapped.filter((e: MedicalExamOutput) => e.expiryStatus === query.expiryStatus)
      : mapped;

    const total = filtered.length;
    const data = filtered.slice(skip, skip + limit);

    return { data, total, page, limit };
  });
}

export async function getEmployeeExams(
  ctx: RlsContext,
  employeeId: string,
): Promise<MedicalExamOutput[]> {
  return withRlsContext(ctx, async (tx) => {
    const exams = await tx.medicalExam.findMany({
      where: { organizationId: ctx.organizationId, employeeId },
      include: EXAM_INCLUDE,
      orderBy: { date: 'desc' },
    });
    return exams.map(mapExam);
  });
}
