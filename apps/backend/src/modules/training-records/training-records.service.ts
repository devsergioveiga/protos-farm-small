import { withRlsContext, type RlsContext } from '../../database/rls';
import { prisma } from '../../database/prisma';
import {
  TrainingRecordError,
  type CreateTrainingRecordInput,
  type TrainingRecordOutput,
  type EmployeeTrainingRecordOutput,
  type TrainingRecordListQuery,
} from './training-records.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ─── Helpers ──────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'toNumber' in val)
    return (val as { toNumber(): number }).toNumber();
  return Number(val);
}

function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// ─── Mappers ──────────────────────────────────────────────────────────

function mapEmployeeRecord(row: TxClient): EmployeeTrainingRecordOutput {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee?.name ?? '',
    expiresAt: row.expiresAt.toISOString(),
  };
}

function mapTrainingRecord(row: TxClient): TrainingRecordOutput {
  const participants = (row.employeeRecords ?? []).map(mapEmployeeRecord);
  return {
    id: row.id,
    trainingTypeId: row.trainingTypeId,
    trainingTypeName: row.trainingType?.name ?? '',
    date: row.date.toISOString(),
    instructorName: row.instructorName,
    instructorType: row.instructorType as 'INTERNO' | 'EXTERNO',
    instructorRegistration: row.instructorRegistration ?? null,
    effectiveHours: toNumber(row.effectiveHours),
    location: row.location ?? null,
    observations: row.observations ?? null,
    attendanceListUrl: row.attendanceListUrl ?? null,
    farmId: row.farmId ?? null,
    participantCount: participants.length,
    participants,
    createdAt: row.createdAt.toISOString(),
  };
}

const TRAINING_RECORD_INCLUDE = {
  trainingType: { select: { id: true, name: true } },
  employeeRecords: {
    include: { employee: { select: { id: true, name: true } } },
  },
} as const;

// ─── CA: Create training record ───────────────────────────────────────

export async function createTrainingRecord(
  ctx: RlsContext,
  input: CreateTrainingRecordInput,
): Promise<TrainingRecordOutput> {
  if (!input.employeeIds || input.employeeIds.length === 0) {
    throw new TrainingRecordError('Pelo menos um participante é obrigatório', 'NO_PARTICIPANTS');
  }

  return withRlsContext(ctx, async (tx) => {
    // Verify training type exists (system or org-scoped)
    const trainingType = await tx.trainingType.findFirst({
      where: {
        id: input.trainingTypeId,
        OR: [{ isSystem: true }, { organizationId: ctx.organizationId }],
      },
    });
    if (!trainingType) {
      throw new TrainingRecordError('Tipo de treinamento não encontrado', 'TRAINING_TYPE_NOT_FOUND');
    }

    const defaultValidityMonths = trainingType.defaultValidityMonths as number;

    // Create the training record
    const record = await tx.trainingRecord.create({
      data: {
        organizationId: ctx.organizationId,
        trainingTypeId: input.trainingTypeId,
        date: new Date(input.date),
        instructorName: input.instructorName,
        instructorType: input.instructorType,
        instructorRegistration: input.instructorRegistration ?? null,
        effectiveHours: input.effectiveHours,
        location: input.location ?? null,
        observations: input.observations ?? null,
        attendanceListUrl: input.attendanceListUrl ?? null,
        farmId: input.farmId ?? null,
        createdBy: ctx.userId ?? 'system',
      },
    });

    // Create EmployeeTrainingRecord for each participant
    for (const employeeId of input.employeeIds) {
      // Verify employee exists and belongs to org
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, organizationId: ctx.organizationId },
      });
      if (!employee) {
        throw new TrainingRecordError(
          `Funcionário ${employeeId} não encontrado`,
          'EMPLOYEE_NOT_FOUND',
        );
      }

      // Calculate expiresAt: date + defaultValidityMonths months
      const d = new Date(input.date);
      d.setMonth(d.getMonth() + defaultValidityMonths);
      const expiresAt = d;

      await tx.employeeTrainingRecord.create({
        data: {
          trainingRecordId: record.id,
          employeeId,
          expiresAt,
        },
      });
    }

    // Fetch complete record with relations
    const complete = await tx.trainingRecord.findFirst({
      where: { id: record.id },
      include: TRAINING_RECORD_INCLUDE,
    });

    return mapTrainingRecord(complete);
  });
}

// ─── List training records ────────────────────────────────────────────

export async function listTrainingRecords(
  ctx: RlsContext,
  query: TrainingRecordListQuery,
): Promise<{ data: TrainingRecordOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: TxClient = { organizationId: ctx.organizationId };

  if (query.trainingTypeId) where.trainingTypeId = query.trainingTypeId;
  if (query.instructorType) where.instructorType = query.instructorType;
  if (query.farmId) where.farmId = query.farmId;
  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
    if (query.dateTo) where.date.lte = new Date(query.dateTo);
  }

  const [rows, total] = await Promise.all([
    prisma.trainingRecord.findMany({
      where,
      include: TRAINING_RECORD_INCLUDE,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.trainingRecord.count({ where }),
  ]);

  return {
    data: rows.map(mapTrainingRecord),
    total,
    page,
    limit,
  };
}

// ─── Get single training record ───────────────────────────────────────

export async function getTrainingRecord(
  ctx: RlsContext,
  id: string,
): Promise<TrainingRecordOutput> {
  const row = await prisma.trainingRecord.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: TRAINING_RECORD_INCLUDE,
  });

  if (!row) throw new TrainingRecordError('Registro de treinamento não encontrado', 'NOT_FOUND');
  return mapTrainingRecord(row);
}

// ─── Delete training record ───────────────────────────────────────────

export async function deleteTrainingRecord(ctx: RlsContext, id: string): Promise<void> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.trainingRecord.findFirst({
      where: { id, organizationId: ctx.organizationId },
    });

    if (!existing) {
      throw new TrainingRecordError('Registro de treinamento não encontrado', 'NOT_FOUND');
    }

    // Delete employee records first (cascade)
    await tx.employeeTrainingRecord.deleteMany({ where: { trainingRecordId: id } });
    await tx.trainingRecord.delete({ where: { id } });
  });
}

// ─── Generate certificate PDF ─────────────────────────────────────────

export async function generateCertificatePdf(
  ctx: RlsContext,
  trainingRecordId: string,
  employeeId: string,
): Promise<Buffer> {
  // Fetch training record with type and employee records
  const record = await prisma.trainingRecord.findFirst({
    where: { id: trainingRecordId, organizationId: ctx.organizationId },
    include: {
      trainingType: true,
      employeeRecords: {
        where: { employeeId },
        include: { employee: { select: { id: true, name: true, cpf: true } } },
      },
    },
  });

  if (!record) {
    throw new TrainingRecordError('Registro de treinamento não encontrado', 'NOT_FOUND');
  }

  const empRecord = record.employeeRecords[0];
  if (!empRecord) {
    throw new TrainingRecordError(
      'Funcionário não encontrado neste treinamento',
      'EMPLOYEE_NOT_IN_RECORD',
    );
  }

  // Fetch organization name
  const org = await prisma.organization.findFirst({
    where: { id: ctx.organizationId },
    select: { name: true },
  });
  const orgName = org?.name ?? 'Organização';

  const employee = empRecord.employee;
  const trainingType = record.trainingType;
  const trainingDate = formatDate(record.date);
  const expiresAtFormatted = formatDate(empRecord.expiresAt);
  const instructorTypeLabel = record.instructorType === 'INTERNO' ? 'Interno' : 'Externo';

  // Generate PDF using pdfkit
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // account for margins

    // ── Header ──
    doc.fontSize(16).font('Helvetica-Bold').text(orgName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).font('Helvetica-Bold').text('CERTIFICADO DE TREINAMENTO', { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
    doc.moveDown(0.8);

    // ── Body ──
    const nrRef = trainingType.nrReference ? ` (${trainingType.nrReference})` : '';
    const cpfFormatted = employee.cpf
      ? employee.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : '';

    doc.fontSize(12).font('Helvetica');
    doc.text(
      `Certificamos que ${employee.name}, portador(a) do CPF ${cpfFormatted}, ` +
        `participou do treinamento de ${trainingType.name}${nrRef}, com carga horária de ` +
        `${toNumber(record.effectiveHours)} horas, realizado em ${trainingDate}, ministrado por ` +
        `${record.instructorName} (${instructorTypeLabel}).`,
      { align: 'left', lineGap: 4 },
    );
    doc.moveDown(0.8);

    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Este certificado tem validade até ${expiresAtFormatted}.`, { align: 'left' });
    doc.moveDown(1.5);

    if (record.location) {
      doc.fontSize(10).font('Helvetica');
      doc.text(`Local do treinamento: ${record.location}`);
      doc.moveDown(0.5);
    }

    // ── Footer ──
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
    doc.moveDown(0.5);

    // Signature lines
    const sigY = doc.y;
    doc.fontSize(10).font('Helvetica');

    // Left: instructor signature
    doc.moveTo(50, sigY + 30).lineTo(250, sigY + 30).stroke();
    doc.text('Instrutor: ' + record.instructorName, 50, sigY + 35, { width: 200 });

    // Right: employer signature
    doc.moveTo(310, sigY + 30).lineTo(510, sigY + 30).stroke();
    doc.text('Responsável pela Empresa', 310, sigY + 35, { width: 200 });

    doc.moveDown(3);
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Emitido em: ${formatDate(new Date())} — Gerado pelo sistema Protos Farm`, {
        align: 'center',
      });

    doc.end();
  });
}
