import { withRlsContext, type RlsContext } from '../../database/rls';
import {
  PrescriptionError,
  TARGET_TYPES,
  DOSE_UNITS,
  PRESCRIPTION_STATUSES,
  type CreatePrescriptionInput,
  type UpdatePrescriptionInput,
  type PrescriptionOutput,
  type PrescriptionProductOutput,
  type PrescriptionListQuery,
} from './pesticide-prescriptions.types';

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'toNumber' in val)
    return (val as { toNumber(): number }).toNumber();
  return Number(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

const PRESCRIPTION_INCLUDE = {
  products: true,
  creator: { select: { id: true, name: true } },
} as const;

function mapProduct(p: TxClient): PrescriptionProductOutput {
  return {
    id: p.id,
    productId: p.productId,
    productName: p.productName,
    activeIngredient: p.activeIngredient,
    dose: toNumber(p.dose),
    doseUnit: p.doseUnit,
    withdrawalPeriodDays: p.withdrawalPeriodDays,
    safetyIntervalDays: p.safetyIntervalDays,
    toxicityClass: p.toxicityClass,
    mapaRegistration: p.mapaRegistration,
    environmentalClass: p.environmentalClass,
  };
}

function mapPrescription(row: TxClient): PrescriptionOutput {
  return {
    id: row.id,
    organizationId: row.organizationId,
    farmId: row.farmId,
    fieldPlotId: row.fieldPlotId,
    sequentialNumber: row.sequentialNumber,
    issuedAt: row.issuedAt.toISOString(),
    farmName: row.farmName,
    fieldPlotName: row.fieldPlotName,
    cultureName: row.cultureName,
    areaHa: toNumber(row.areaHa),
    targetPest: row.targetPest,
    targetType: row.targetType,
    sprayVolume: toNumber(row.sprayVolume),
    numberOfApplications: row.numberOfApplications,
    applicationInterval: row.applicationInterval,
    agronomistName: row.agronomistName,
    agronomistCrea: row.agronomistCrea,
    agronomistSignatureUrl: row.agronomistSignatureUrl,
    pesticideApplicationId: row.pesticideApplicationId,
    stockOutputId: row.stockOutputId,
    technicalJustification: row.technicalJustification,
    notes: row.notes,
    status: row.status,
    createdBy: row.createdBy,
    creatorName: row.creator?.name ?? '',
    products: (row.products ?? []).map(mapProduct),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── CA8: Numeração sequencial por fazenda ──────────────────────────

async function getNextSequentialNumber(tx: TxClient, farmId: string): Promise<number> {
  const last = await tx.pesticidePrescription.findFirst({
    where: { farmId },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  return (last?.sequentialNumber ?? 0) + 1;
}

// ─── CA1+CA2+CA3+CA4+CA5+CA7+CA8: Criar receituário ────────────────

export async function createPrescription(
  ctx: RlsContext,
  farmId: string,
  input: CreatePrescriptionInput,
  createdBy: string,
): Promise<PrescriptionOutput> {
  // Validate target type
  if (!TARGET_TYPES.includes(input.targetType as (typeof TARGET_TYPES)[number])) {
    throw new PrescriptionError(`Tipo de alvo inválido: ${input.targetType}`, 400);
  }
  if (!input.products || input.products.length === 0) {
    throw new PrescriptionError('Ao menos um produto é obrigatório', 400);
  }
  if (!input.agronomistName || !input.agronomistCrea) {
    throw new PrescriptionError('Nome e CREA do agrônomo são obrigatórios', 400);
  }

  return withRlsContext(ctx, async (tx) => {
    // CA2: Auto-fill farm and plot data
    const farm = await tx.farm.findFirst({
      where: { id: farmId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!farm) throw new PrescriptionError('Fazenda não encontrada', 404);

    const fieldPlot = await tx.fieldPlot.findFirst({
      where: { id: input.fieldPlotId, farmId, deletedAt: null },
    });
    if (!fieldPlot) throw new PrescriptionError('Talhão não encontrado', 404);

    // CA8: Sequential number
    const sequentialNumber = await getNextSequentialNumber(tx, farmId);

    // Validate products dose units
    for (const p of input.products) {
      if (p.doseUnit && !DOSE_UNITS.includes(p.doseUnit as (typeof DOSE_UNITS)[number])) {
        throw new PrescriptionError(`Unidade de dose inválida: ${p.doseUnit}`, 400);
      }
    }

    const created = await tx.pesticidePrescription.create({
      data: {
        organizationId: ctx.organizationId,
        farmId,
        fieldPlotId: input.fieldPlotId,
        sequentialNumber,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : new Date(),
        farmName: farm.name,
        fieldPlotName: fieldPlot.name,
        cultureName: input.cultureName,
        areaHa: toNumber(fieldPlot.boundaryAreaHa),
        targetPest: input.targetPest,
        targetType: input.targetType as 'PRAGA' | 'DOENCA' | 'PLANTA_DANINHA',
        sprayVolume: input.sprayVolume,
        numberOfApplications: input.numberOfApplications ?? 1,
        applicationInterval: input.applicationInterval ?? null,
        agronomistName: input.agronomistName,
        agronomistCrea: input.agronomistCrea,
        agronomistSignatureUrl: input.agronomistSignatureUrl ?? null,
        pesticideApplicationId: input.pesticideApplicationId ?? null,
        stockOutputId: input.stockOutputId ?? null,
        technicalJustification: input.technicalJustification ?? null,
        notes: input.notes ?? null,
        createdBy,
        products: {
          create: input.products.map((p) => ({
            productId: p.productId ?? null,
            productName: p.productName,
            activeIngredient: p.activeIngredient,
            dose: p.dose,
            doseUnit: (p.doseUnit ?? 'L_HA') as 'L_HA' | 'KG_HA' | 'ML_HA' | 'G_HA',
            withdrawalPeriodDays: p.withdrawalPeriodDays ?? null,
            safetyIntervalDays: p.safetyIntervalDays ?? null,
            toxicityClass: p.toxicityClass ?? null,
            mapaRegistration: p.mapaRegistration ?? null,
            environmentalClass: p.environmentalClass ?? null,
          })),
        },
      },
      include: PRESCRIPTION_INCLUDE,
    });

    return mapPrescription(created);
  });
}

// ─── Listar receituários ────────────────────────────────────────────

export async function listPrescriptions(
  ctx: RlsContext,
  farmId: string,
  query: PrescriptionListQuery,
): Promise<{ data: PrescriptionOutput[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  return withRlsContext(ctx, async (tx) => {
    const where: TxClient = {
      farmId,
      organizationId: ctx.organizationId,
      deletedAt: null,
    };

    if (
      query.status &&
      PRESCRIPTION_STATUSES.includes(query.status as (typeof PRESCRIPTION_STATUSES)[number])
    ) {
      where.status = query.status;
    }
    if (query.fieldPlotId) {
      where.fieldPlotId = query.fieldPlotId;
    }
    if (query.search) {
      where.OR = [
        { agronomistName: { contains: query.search, mode: 'insensitive' } },
        { cultureName: { contains: query.search, mode: 'insensitive' } },
        { targetPest: { contains: query.search, mode: 'insensitive' } },
        { farmName: { contains: query.search, mode: 'insensitive' } },
        { fieldPlotName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      tx.pesticidePrescription.findMany({
        where,
        include: PRESCRIPTION_INCLUDE,
        orderBy: { sequentialNumber: 'desc' },
        skip,
        take: limit,
      }),
      tx.pesticidePrescription.count({ where }),
    ]);

    return {
      data: rows.map(mapPrescription),
      total,
      page,
      limit,
    };
  });
}

// ─── Buscar receituário por ID ──────────────────────────────────────

export async function getPrescription(
  ctx: RlsContext,
  farmId: string,
  prescriptionId: string,
): Promise<PrescriptionOutput> {
  return withRlsContext(ctx, async (tx) => {
    const row = await tx.pesticidePrescription.findFirst({
      where: { id: prescriptionId, farmId, organizationId: ctx.organizationId, deletedAt: null },
      include: PRESCRIPTION_INCLUDE,
    });
    if (!row) throw new PrescriptionError('Receituário não encontrado', 404);
    return mapPrescription(row);
  });
}

// ─── Atualizar receituário ──────────────────────────────────────────

export async function updatePrescription(
  ctx: RlsContext,
  farmId: string,
  prescriptionId: string,
  input: UpdatePrescriptionInput,
): Promise<PrescriptionOutput> {
  if (
    input.targetType &&
    !TARGET_TYPES.includes(input.targetType as (typeof TARGET_TYPES)[number])
  ) {
    throw new PrescriptionError(`Tipo de alvo inválido: ${input.targetType}`, 400);
  }
  if (
    input.status &&
    !PRESCRIPTION_STATUSES.includes(input.status as (typeof PRESCRIPTION_STATUSES)[number])
  ) {
    throw new PrescriptionError(`Status inválido: ${input.status}`, 400);
  }

  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.pesticidePrescription.findFirst({
      where: { id: prescriptionId, farmId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) throw new PrescriptionError('Receituário não encontrado', 404);

    // Build update data (exclude undefined fields)
    const data: Record<string, unknown> = {};
    if (input.cultureName !== undefined) data.cultureName = input.cultureName;
    if (input.targetPest !== undefined) data.targetPest = input.targetPest;
    if (input.targetType !== undefined) data.targetType = input.targetType;
    if (input.sprayVolume !== undefined) data.sprayVolume = input.sprayVolume;
    if (input.numberOfApplications !== undefined)
      data.numberOfApplications = input.numberOfApplications;
    if (input.applicationInterval !== undefined)
      data.applicationInterval = input.applicationInterval;
    if (input.agronomistName !== undefined) data.agronomistName = input.agronomistName;
    if (input.agronomistCrea !== undefined) data.agronomistCrea = input.agronomistCrea;
    if (input.agronomistSignatureUrl !== undefined)
      data.agronomistSignatureUrl = input.agronomistSignatureUrl;
    if (input.pesticideApplicationId !== undefined)
      data.pesticideApplicationId = input.pesticideApplicationId;
    if (input.stockOutputId !== undefined) data.stockOutputId = input.stockOutputId;
    if (input.technicalJustification !== undefined)
      data.technicalJustification = input.technicalJustification;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status !== undefined) data.status = input.status;

    // If products are provided, replace all
    if (input.products) {
      if (input.products.length === 0) {
        throw new PrescriptionError('Ao menos um produto é obrigatório', 400);
      }
      for (const p of input.products) {
        if (p.doseUnit && !DOSE_UNITS.includes(p.doseUnit as (typeof DOSE_UNITS)[number])) {
          throw new PrescriptionError(`Unidade de dose inválida: ${p.doseUnit}`, 400);
        }
      }

      await tx.pesticidePrescriptionProduct.deleteMany({ where: { prescriptionId } });
      await tx.pesticidePrescriptionProduct.createMany({
        data: input.products.map((p) => ({
          prescriptionId,
          productId: p.productId ?? null,
          productName: p.productName,
          activeIngredient: p.activeIngredient,
          dose: p.dose,
          doseUnit: (p.doseUnit ?? 'L_HA') as 'L_HA' | 'KG_HA' | 'ML_HA' | 'G_HA',
          withdrawalPeriodDays: p.withdrawalPeriodDays ?? null,
          safetyIntervalDays: p.safetyIntervalDays ?? null,
          toxicityClass: p.toxicityClass ?? null,
          mapaRegistration: p.mapaRegistration ?? null,
          environmentalClass: p.environmentalClass ?? null,
        })),
      });
    }

    const updated = await tx.pesticidePrescription.update({
      where: { id: prescriptionId },
      data,
      include: PRESCRIPTION_INCLUDE,
    });

    return mapPrescription(updated);
  });
}

// ─── Cancelar receituário (soft-delete) ─────────────────────────────

export async function cancelPrescription(
  ctx: RlsContext,
  farmId: string,
  prescriptionId: string,
): Promise<PrescriptionOutput> {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.pesticidePrescription.findFirst({
      where: { id: prescriptionId, farmId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) throw new PrescriptionError('Receituário não encontrado', 404);

    const updated = await tx.pesticidePrescription.update({
      where: { id: prescriptionId },
      data: { status: 'CANCELLED', deletedAt: new Date() },
      include: PRESCRIPTION_INCLUDE,
    });

    return mapPrescription(updated);
  });
}

// ─── CA6: Gerar PDF do receituário ──────────────────────────────────

export async function generatePrescriptionPdf(
  ctx: RlsContext,
  farmId: string,
  prescriptionId: string,
): Promise<Buffer> {
  const prescription = await getPrescription(ctx, farmId, prescriptionId);

  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 100; // margins

    // ── Header ──
    doc.fontSize(16).font('Helvetica-Bold').text('RECEITUÁRIO AGRONÔMICO', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Nº ${String(prescription.sequentialNumber).padStart(6, '0')}`, { align: 'center' });
    doc.moveDown(0.5);

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.5);

    // ── 1. Dados da propriedade (CA2) ──
    doc.fontSize(11).font('Helvetica-Bold').text('1. DADOS DA PROPRIEDADE');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Propriedade: ${prescription.farmName}`);
    doc.text(`Talhão: ${prescription.fieldPlotName}`);
    doc.text(`Cultura: ${prescription.cultureName}`);
    doc.text(`Área (ha): ${prescription.areaHa.toFixed(2)}`);
    doc.text(`Alvo: ${prescription.targetPest} (${prescription.targetType})`);
    doc.moveDown(0.5);

    // ── 2. Produtos recomendados (CA3 + CA5) ──
    doc.fontSize(11).font('Helvetica-Bold').text('2. PRODUTOS RECOMENDADOS');
    doc.moveDown(0.3);

    for (const [i, product] of prescription.products.entries()) {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`${i + 1}. ${product.productName}`);
      doc.font('Helvetica');
      doc.text(`   Ingrediente ativo: ${product.activeIngredient}`);
      doc.text(`   Dose: ${product.dose} ${product.doseUnit}`);
      if (product.mapaRegistration) doc.text(`   Registro MAPA: ${product.mapaRegistration}`);
      if (product.toxicityClass) doc.text(`   Classe toxicológica: ${product.toxicityClass}`);
      if (product.environmentalClass)
        doc.text(`   Classe ambiental: ${product.environmentalClass}`);
      if (product.withdrawalPeriodDays != null)
        doc.text(`   Período de carência: ${product.withdrawalPeriodDays} dias`);
      if (product.safetyIntervalDays != null)
        doc.text(`   Intervalo de segurança (reentrada): ${product.safetyIntervalDays} dias`);
      doc.moveDown(0.3);
    }

    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Volume de calda: ${prescription.sprayVolume} L/ha`);
    doc.text(`Nº de aplicações: ${prescription.numberOfApplications}`);
    if (prescription.applicationInterval) {
      doc.text(`Intervalo entre aplicações: ${prescription.applicationInterval} dias`);
    }
    doc.moveDown(0.5);

    // ── 3. Justificativa técnica ──
    if (prescription.technicalJustification) {
      doc.fontSize(11).font('Helvetica-Bold').text('3. JUSTIFICATIVA TÉCNICA');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').text(prescription.technicalJustification);
      doc.moveDown(0.5);
    }

    // ── 4. Observações ──
    if (prescription.notes) {
      doc.fontSize(11).font('Helvetica-Bold').text('4. OBSERVAÇÕES');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').text(prescription.notes);
      doc.moveDown(0.5);
    }

    // ── Dados do agrônomo (CA4) ──
    doc.moveDown(1);
    doc
      .moveTo(50, doc.y)
      .lineTo(50 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').text('RESPONSÁVEL TÉCNICO');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Nome: ${prescription.agronomistName}`);
    doc.text(`CREA: ${prescription.agronomistCrea}`);
    doc.moveDown(1);

    // Signature line
    doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke();
    doc.moveDown(0.2);
    doc.fontSize(8).text('Assinatura do Engenheiro Agrônomo');
    doc.moveDown(1);

    // ── Footer ──
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`Data de emissão: ${new Date(prescription.issuedAt).toLocaleDateString('pt-BR')}`, {
        align: 'left',
      });
    doc.text(
      `Receituário nº ${String(prescription.sequentialNumber).padStart(6, '0')} — Gerado pelo sistema Protos Farm`,
      {
        align: 'left',
      },
    );

    doc.end();
  });
}

// ─── CSV Export ─────────────────────────────────────────────────────

export function prescriptionsToCsv(prescriptions: PrescriptionOutput[]): string {
  const header = [
    'Nº',
    'Data Emissão',
    'Fazenda',
    'Talhão',
    'Cultura',
    'Área (ha)',
    'Alvo',
    'Tipo Alvo',
    'Produtos',
    'Ingredientes Ativos',
    'Doses',
    'Volume Calda (L/ha)',
    'Nº Aplicações',
    'Intervalo (dias)',
    'Agrônomo',
    'CREA',
    'Status',
  ].join(';');

  const rows = prescriptions.map((p) => {
    const products = p.products.map((pr) => pr.productName).join(', ');
    const ingredients = p.products.map((pr) => pr.activeIngredient).join(', ');
    const doses = p.products.map((pr) => `${pr.dose} ${pr.doseUnit}`).join(', ');
    return [
      p.sequentialNumber,
      new Date(p.issuedAt).toLocaleDateString('pt-BR'),
      `"${p.farmName}"`,
      `"${p.fieldPlotName}"`,
      `"${p.cultureName}"`,
      p.areaHa.toFixed(2),
      `"${p.targetPest}"`,
      p.targetType,
      `"${products}"`,
      `"${ingredients}"`,
      `"${doses}"`,
      p.sprayVolume,
      p.numberOfApplications,
      p.applicationInterval ?? '',
      `"${p.agronomistName}"`,
      `"${p.agronomistCrea}"`,
      p.status,
    ].join(';');
  });

  return [header, ...rows].join('\n');
}
