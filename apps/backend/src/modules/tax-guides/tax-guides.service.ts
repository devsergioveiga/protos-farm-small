// ─── Tax Guides Service ───────────────────────────────────────────────
// Generates FGTS/INSS/IRRF/FUNRURAL collection guides from PayrollRunItem
// aggregations. Creates Contas a Pagar with originType TAX_GUIDE.
// Produces downloadable files: SEFIP .RE for FGTS, DARF PDF for INSS/IRRF,
// GPS PDF for FUNRURAL.

import Decimal from 'decimal.js';
import { withRlsContext } from '../../database/rls';
import {
  TaxGuideError,
  TAX_GUIDE_DUE_DAYS,
  TAX_GUIDE_RECEITA_CODES,
  type TaxGuideOutput,
  type GenerateTaxGuidesInput,
  type ListTaxGuidesQuery,
} from './tax-guides.types';
import type { TaxGuideType } from '@prisma/client';

// ─── Types ─────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
type TxClient = any;

interface DownloadResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Moves a Date to the next Monday if it falls on Saturday (6) or Sunday (0).
 */
function adjustForWeekend(date: Date): Date {
  const dow = date.getUTCDay();
  if (dow === 6) {
    // Saturday → Monday (+2)
    date.setUTCDate(date.getUTCDate() + 2);
  } else if (dow === 0) {
    // Sunday → Monday (+1)
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

/**
 * Calculates the due date for a guide type given the reference month.
 * referenceMonth is a Date object (first day of that month).
 * Due date = Nth day of the NEXT month (N from TAX_GUIDE_DUE_DAYS).
 */
function calculateDueDate(guideType: TaxGuideType, referenceMonth: Date): Date {
  const dayOfMonth = TAX_GUIDE_DUE_DAYS[guideType];
  const refYear = referenceMonth.getUTCFullYear();
  const refMonth = referenceMonth.getUTCMonth(); // 0-indexed
  // Next month
  const nextMonth = refMonth === 11 ? 0 : refMonth + 1;
  const nextYear = refMonth === 11 ? refYear + 1 : refYear;
  const dueDate = new Date(Date.UTC(nextYear, nextMonth, dayOfMonth));
  return adjustForWeekend(dueDate);
}

/**
 * Formats referenceMonth as "MM/YYYY" (e.g. "03/2026").
 */
function formatCompetencia(referenceMonth: Date): string {
  const mm = String(referenceMonth.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = referenceMonth.getUTCFullYear();
  return `${mm}/${yyyy}`;
}

/**
 * Formats referenceMonth as "AAAAMM" for SEFIP (e.g. "202603").
 */
function formatCompetenciaSefip(referenceMonth: Date): string {
  const mm = String(referenceMonth.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = referenceMonth.getUTCFullYear();
  return `${yyyy}${mm}`;
}

/**
 * Pads a string on the right with spaces to fill the given length.
 */
function padRight(str: string, length: number): string {
  return str.substring(0, length).padEnd(length, ' ');
}

/**
 * Pads a string on the left with zeros to fill the given length.
 */
function padLeft(str: string, length: number, char = '0'): string {
  return str.substring(0, length).padStart(length, char);
}

/**
 * Formats a Decimal value as Brazilian cents string (9 digits, no decimal point).
 * Used for SEFIP numeric fields.
 */
function formatDecimalCents(value: Decimal, length: number): string {
  const cents = value.mul(100).toFixed(0);
  return padLeft(cents, length);
}

/**
 * Computes daysUntilDue and alertLevel for a guide's dueDate.
 */
function computeAlertLevel(dueDate: Date): {
  daysUntilDue: number;
  alertLevel: 'none' | 'warning' | 'danger';
} {
  const now = new Date();
  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(msUntilDue / (1000 * 60 * 60 * 24));
  let alertLevel: 'none' | 'warning' | 'danger';
  if (daysUntilDue <= 5) {
    alertLevel = 'danger';
  } else if (daysUntilDue <= 10) {
    alertLevel = 'warning';
  } else {
    alertLevel = 'none';
  }
  return { daysUntilDue, alertLevel };
}

/**
 * Maps a Prisma TaxGuide record to TaxGuideOutput with computed alert fields.
 */
function mapGuideOutput(guide: any): TaxGuideOutput {
  const { daysUntilDue, alertLevel } = computeAlertLevel(guide.dueDate);
  return {
    id: guide.id,
    organizationId: guide.organizationId,
    guideType: guide.guideType,
    referenceMonth:
      guide.referenceMonth instanceof Date
        ? guide.referenceMonth.toISOString()
        : guide.referenceMonth,
    dueDate: guide.dueDate instanceof Date ? guide.dueDate.toISOString() : guide.dueDate,
    totalAmount: guide.totalAmount?.toString() ?? '0',
    status: guide.status,
    fileKey: guide.fileKey ?? null,
    payrollRunId: guide.payrollRunId ?? null,
    generatedBy: guide.generatedBy ?? null,
    generatedAt:
      guide.generatedAt instanceof Date
        ? guide.generatedAt.toISOString()
        : (guide.generatedAt ?? null),
    notes: guide.notes ?? null,
    createdAt: guide.createdAt instanceof Date ? guide.createdAt.toISOString() : guide.createdAt,
    updatedAt: guide.updatedAt instanceof Date ? guide.updatedAt.toISOString() : guide.updatedAt,
    daysUntilDue,
    alertLevel,
  };
}

// ─── Tax Guide Type Labels ────────────────────────────────────────────

const TAX_GUIDE_LABELS: Record<TaxGuideType, string> = {
  FGTS: 'FGTS',
  INSS: 'INSS Patronal',
  IRRF: 'IRRF s/Trabalho',
  FUNRURAL: 'FUNRURAL',
};

// ─── SEFIP .RE Builder ───────────────────────────────────────────────

/**
 * Builds a simplified SEFIP .RE fixed-width text file per CAIXA SEFIP 8.4 spec.
 * Record types: 10 (header), 20 (empregador, FPAS 604), 50 (totais empregador), 99 (trailer).
 * Encoding: ASCII.
 */
function buildSefipRE(guide: any, org: { name: string; document: string }, items: any[]): Buffer {
  const competencia = formatCompetenciaSefip(guide.referenceMonth);
  const cnpj = (org.document ?? '').replace(/\D/g, '');
  const totalFgts = new Decimal(guide.totalAmount?.toString() ?? '0');

  // FPAS 604 = empregador rural com segurados empregados
  const fpas = '604';

  const lines: string[] = [];

  // Record 10: Header
  // Positions fixed per SEFIP 8.4: type(2) + competencia(6) + CNPJ(14) + ...
  const rec10 =
    '10' +
    competencia +
    padLeft(cnpj, 14) +
    padRight(org.name, 40) +
    padRight('PROTOS FARM', 20) + // software name
    padRight('1.0', 10) + // version
    padRight('', 2) + // movimento/indicador
    padRight('', 1); // tipo de inscricao (1=CNPJ)
  lines.push(rec10);

  // Record 20: Empregador
  const rec20 =
    '20' +
    padLeft(cnpj, 14) +
    padLeft('1', 1) + // tipo inscricao CNPJ
    padRight(org.name, 40) +
    padRight('', 40) + // endereco
    padRight('', 40) + // bairro
    padRight('00000000', 8) + // CEP
    padRight('', 30) + // cidade
    padRight('SP', 2) + // UF
    padRight('', 10) + // telefone
    fpas + // FPAS 604
    padRight('', 3) + // cod terceiros
    '0000' + // FAP (1.00 = 1000 / sem ajuste)
    formatDecimalCents(totalFgts, 14) + // valor FGTS no mes
    padRight('', 3);
  lines.push(rec20);

  // Records 30/32/40 per employee (simplified — one consolidated record)
  for (const item of items) {
    const fgtsItem = new Decimal(item.fgtsAmount?.toString() ?? '0');
    const grossItem = new Decimal(item.grossSalary?.toString() ?? '0');
    const cpf = (item.employee?.cpf ?? '00000000000').replace(/\D/g, '');
    const name = item.employee?.name ?? 'EMPREGADO';

    // Record 30: Trabalhador
    const rec30 =
      '30' +
      padLeft(cpf, 11) +
      padLeft('1', 1) + // tipo inscricao CPF
      padRight(name, 70) +
      padRight('', 2); // codigo categoria (01=empregado)
    lines.push(rec30);

    // Record 32: Remuneração
    const rec32 =
      '32' +
      padLeft(cpf, 11) +
      formatDecimalCents(grossItem, 14) + // remuneracao
      formatDecimalCents(fgtsItem, 14); // FGTS mes
    lines.push(rec32);

    // Record 40: Totais trabalhador
    const rec40 =
      '40' +
      padLeft(cpf, 11) +
      formatDecimalCents(grossItem, 14) +
      formatDecimalCents(fgtsItem, 14);
    lines.push(rec40);
  }

  // Record 50: Totais empregador
  const rec50 =
    '50' +
    padLeft(cnpj, 14) +
    formatDecimalCents(totalFgts, 14) + // total FGTS a recolher
    padRight('', 14) + // FGTS rescisorio
    padRight('', 14) + // INSS trabalhador
    padRight('', 14) + // INSS empregador
    padRight('', 6); // qtd trabalhadores
  lines.push(rec50);

  // Record 99: Trailer
  const rec99 = '99' + padLeft(String(lines.length + 1), 6); // total de registros incluindo este
  lines.push(rec99);

  const content = lines.join('\r\n') + '\r\n';
  return Buffer.from(content, 'ascii');
}

// ─── DARF PDF Builder ─────────────────────────────────────────────────

/**
 * Builds a DARF-layout PDF for INSS or IRRF guide using pdfkit.
 */
async function buildDarfPdf(guide: any, org: { name: string; document: string }): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const cnpj = (org.document ?? '').replace(/\D/g, '');
  const cnpjFormatted =
    cnpj.length === 14
      ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
      : cnpj;
  const competencia = formatCompetencia(guide.referenceMonth);
  const amount = new Decimal(guide.totalAmount?.toString() ?? '0');
  const amountFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount.toNumber());
  const dueDateFormatted =
    guide.dueDate instanceof Date
      ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(guide.dueDate)
      : guide.dueDate;
  const receitaCode = TAX_GUIDE_RECEITA_CODES[guide.guideType as TaxGuideType];
  const guideLabel = TAX_GUIDE_LABELS[guide.guideType as TaxGuideType];

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('DARF — Documento de Arrecadação de Receitas Federais', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(guideLabel, { align: 'center' });
    doc.moveDown(1);

    // Draw a border box
    const boxX = 40;
    const boxY = doc.y;
    doc.rect(boxX, boxY, 515, 200).stroke();
    doc.moveDown(0.5);

    // Fields
    const fieldY = boxY + 10;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('CNPJ do Contribuinte:', boxX + 10, fieldY);
    doc.font('Helvetica').text(cnpjFormatted, boxX + 160, fieldY);

    doc.font('Helvetica-Bold').text('Razão Social:', boxX + 10, fieldY + 20);
    doc.font('Helvetica').text(org.name, boxX + 160, fieldY + 20);

    doc.font('Helvetica-Bold').text('Código da Receita:', boxX + 10, fieldY + 40);
    doc.font('Helvetica').text(receitaCode, boxX + 160, fieldY + 40);

    doc.font('Helvetica-Bold').text('Competência (MM/AAAA):', boxX + 10, fieldY + 60);
    doc.font('Helvetica').text(competencia, boxX + 160, fieldY + 60);

    doc.font('Helvetica-Bold').text('Data de Vencimento:', boxX + 10, fieldY + 80);
    doc.font('Helvetica').text(dueDateFormatted, boxX + 160, fieldY + 80);

    doc.font('Helvetica-Bold').text('Valor Principal:', boxX + 10, fieldY + 100);
    doc.font('Helvetica').text(amountFormatted, boxX + 160, fieldY + 100);

    doc.font('Helvetica-Bold').text('Valor Total:', boxX + 10, fieldY + 120);
    doc.font('Helvetica').text(amountFormatted, boxX + 160, fieldY + 120);

    doc.font('Helvetica-Bold').text('Período de Apuração:', boxX + 10, fieldY + 140);
    doc.font('Helvetica').text(competencia, boxX + 160, fieldY + 140);

    doc.moveDown(10);

    // Footer note
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`Gerado automaticamente pelo sistema Protos Farm. Competência: ${competencia}.`, {
        align: 'center',
      });

    doc.end();
  });
}

// ─── GPS PDF Builder ──────────────────────────────────────────────────

/**
 * Builds a GPS-layout PDF for FUNRURAL guide using pdfkit.
 * Código de pagamento GPS 2100 = Contribuição Rural do Empregador Rural (PJ).
 */
async function buildGpsPdf(guide: any, org: { name: string; document: string }): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const cnpj = (org.document ?? '').replace(/\D/g, '');
  const cnpjFormatted =
    cnpj.length === 14
      ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
      : cnpj;
  const competencia = formatCompetencia(guide.referenceMonth);
  const amount = new Decimal(guide.totalAmount?.toString() ?? '0');
  const amountFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount.toNumber());
  const dueDateFormatted =
    guide.dueDate instanceof Date
      ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(guide.dueDate)
      : guide.dueDate;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('GPS — Guia da Previdência Social', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('FUNRURAL — Contribuição Rural do Empregador', { align: 'center' });
    doc.moveDown(1);

    const boxX = 40;
    const boxY = doc.y;
    doc.rect(boxX, boxY, 515, 180).stroke();

    const fieldY = boxY + 10;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Código de Pagamento:', boxX + 10, fieldY);
    doc.font('Helvetica').text('2100', boxX + 160, fieldY);

    doc.font('Helvetica-Bold').text('CNPJ do Contribuinte:', boxX + 10, fieldY + 20);
    doc.font('Helvetica').text(cnpjFormatted, boxX + 160, fieldY + 20);

    doc.font('Helvetica-Bold').text('Razão Social:', boxX + 10, fieldY + 40);
    doc.font('Helvetica').text(org.name, boxX + 160, fieldY + 40);

    doc.font('Helvetica-Bold').text('Competência (MM/AAAA):', boxX + 10, fieldY + 60);
    doc.font('Helvetica').text(competencia, boxX + 160, fieldY + 60);

    doc.font('Helvetica-Bold').text('Data de Vencimento:', boxX + 10, fieldY + 80);
    doc.font('Helvetica').text(dueDateFormatted, boxX + 160, fieldY + 80);

    doc.font('Helvetica-Bold').text('Valor INSS (FUNRURAL):', boxX + 10, fieldY + 100);
    doc.font('Helvetica').text(amountFormatted, boxX + 160, fieldY + 100);

    doc.font('Helvetica-Bold').text('Outras Entidades (SENAR):', boxX + 10, fieldY + 120);
    doc.font('Helvetica').text('Incluído no valor acima', boxX + 160, fieldY + 120);

    doc.font('Helvetica-Bold').text('Valor Total:', boxX + 10, fieldY + 140);
    doc.font('Helvetica').text(amountFormatted, boxX + 160, fieldY + 140);

    doc.moveDown(12);

    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`Gerado automaticamente pelo sistema Protos Farm. Competência: ${competencia}.`, {
        align: 'center',
      });

    doc.end();
  });
}

// ─── Service Class ────────────────────────────────────────────────────

export class TaxGuidesService {
  /**
   * Aggregates PayrollRunItem totals and generates/upserts TaxGuide records
   * and Payable records for each guide type.
   */
  async generateGuides(
    orgId: string,
    input: GenerateTaxGuidesInput,
    userId: string,
  ): Promise<TaxGuideOutput[]> {
    const referenceMonth = new Date(input.referenceMonth);
    if (isNaN(referenceMonth.getTime())) {
      throw new TaxGuideError('referenceMonth inválido — use formato YYYY-MM-DD', 400);
    }

    const guideTypes: TaxGuideType[] =
      input.guideTypes && input.guideTypes.length > 0
        ? input.guideTypes
        : ['FGTS', 'INSS', 'IRRF', 'FUNRURAL'];

    return withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      // Fetch organization for farmId and funruralBasis
      const org = await tx.organization.findFirst({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          document: true,
          funruralBasis: true,
          farms: { select: { id: true }, take: 1 },
        },
      });

      if (!org) {
        throw new TaxGuideError('Organização não encontrada', 404);
      }

      const farmId = org.farms[0]?.id;
      if (!farmId) {
        throw new TaxGuideError('Organização não tem fazendas cadastradas', 400);
      }

      // Aggregate PayrollRunItem amounts
      const baseWhere: Record<string, unknown> = { payrollRun: { organizationId: orgId } };
      if (input.payrollRunId) {
        baseWhere.payrollRunId = input.payrollRunId;
      } else {
        // Filter by referenceMonth from payrollRun
        baseWhere.payrollRun = {
          ...(baseWhere.payrollRun as object),
          referenceMonth,
        };
      }

      const [fgtsAgg, inssAgg, irrfAgg, grossAgg] = await Promise.all([
        tx.payrollRunItem.aggregate({ where: baseWhere, _sum: { fgtsAmount: true } }),
        tx.payrollRunItem.aggregate({ where: baseWhere, _sum: { inssAmount: true } }),
        tx.payrollRunItem.aggregate({ where: baseWhere, _sum: { irrfAmount: true } }),
        tx.payrollRunItem.aggregate({ where: baseWhere, _sum: { grossSalary: true } }),
      ]);

      const fgtsTotal = new Decimal(fgtsAgg._sum.fgtsAmount?.toString() ?? '0');
      const inssTotal = new Decimal(inssAgg._sum.inssAmount?.toString() ?? '0');
      const irrfTotal = new Decimal(irrfAgg._sum.irrfAmount?.toString() ?? '0');
      const grossTotal = new Decimal(grossAgg._sum.grossSalary?.toString() ?? '0');

      // Compute FUNRURAL amount using PayrollLegalTable effective-date lookup
      let funruralTotal = new Decimal(0);
      {
        const funruralTable = await tx.payrollLegalTable.findFirst({
          where: {
            tableType: 'FUNRURAL',
            effectiveFrom: { lte: referenceMonth },
          },
          orderBy: { effectiveFrom: 'desc' },
          select: { scalarValues: true },
        });

        // Extract rate from scalarValues (key='rate', value='2.7' means 2.7%)
        const rateEntry = funruralTable?.scalarValues?.find(
          (sv: { key: string; value: string }) => sv.key === 'rate',
        );
        const rate = rateEntry ? new Decimal(rateEntry.value) : new Decimal('2.7');

        // funruralBasis: PAYROLL → use grossSalary; GROSS_REVENUE → same proxy for now
        const basis = org.funruralBasis === 'GROSS_REVENUE' ? grossTotal : grossTotal;
        funruralTotal = new Decimal(basis.mul(rate).div(100).toFixed(2));
      }

      const amountsByType: Record<TaxGuideType, Decimal> = {
        FGTS: fgtsTotal,
        INSS: inssTotal,
        IRRF: irrfTotal,
        FUNRURAL: funruralTotal,
      };

      const guides: TaxGuideOutput[] = [];

      for (const guideType of guideTypes) {
        const totalAmount = amountsByType[guideType];
        const dueDate = calculateDueDate(guideType, referenceMonth);
        const competencia = formatCompetencia(referenceMonth);
        const supplierName = `${TAX_GUIDE_LABELS[guideType]} — Competência ${competencia}`;

        // Upsert TaxGuide (unique on orgId+guideType+referenceMonth)
        const guide = await tx.taxGuide.upsert({
          where: {
            organizationId_guideType_referenceMonth: {
              organizationId: orgId,
              guideType,
              referenceMonth,
            },
          },
          create: {
            organizationId: orgId,
            guideType,
            referenceMonth,
            dueDate,
            totalAmount: totalAmount.toFixed(2),
            status: 'PENDING' as const,
            payrollRunId: input.payrollRunId ?? null,
            generatedBy: userId,
          },
          update: {
            totalAmount: totalAmount.toFixed(2),
            dueDate,
            updatedAt: new Date(),
          },
        });

        // Upsert Payable with originType TAX_GUIDE
        await tx.payable.upsert({
          where: {
            originType_originId: {
              originType: 'TAX_GUIDE',
              originId: guide.id,
            },
          },
          create: {
            organizationId: orgId,
            farmId,
            supplierName,
            category: 'TAXES' as const,
            description: supplierName,
            totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
            dueDate: dueDate.toISOString().substring(0, 10),
            originType: 'TAX_GUIDE',
            originId: guide.id,
          },
          update: {
            totalAmount: totalAmount.toDecimalPlaces(2).toNumber(),
            dueDate: dueDate.toISOString().substring(0, 10),
          },
        });

        guides.push(mapGuideOutput(guide));
      }

      return guides;
    });
  }

  /**
   * Lists tax guides for an organization with optional filters and computed alert fields.
   */
  async listGuides(
    orgId: string,
    query: ListTaxGuidesQuery,
  ): Promise<{ data: TaxGuideOutput[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.referenceMonth) {
      where.referenceMonth = new Date(query.referenceMonth);
    }
    if (query.guideType) {
      where.guideType = query.guideType;
    }
    if (query.status) {
      where.status = query.status;
    }

    const guides = await withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      return tx.taxGuide.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { guideType: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      });
    });

    const data = guides.map(mapGuideOutput);
    return { data, total: data.length, page, limit };
  }

  /**
   * Generates and returns the downloadable file for a tax guide.
   * FGTS → SEFIP .RE (text); INSS/IRRF → DARF PDF; FUNRURAL → GPS PDF.
   */
  async downloadGuide(orgId: string, guideId: string): Promise<DownloadResult> {
    const guide = await withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      return tx.taxGuide.findFirst({
        where: { id: guideId, organizationId: orgId },
      });
    });

    if (!guide) {
      throw new TaxGuideError('Guia não encontrada', 404);
    }

    const org = await withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      return tx.organization.findFirst({
        where: { id: orgId },
        select: { id: true, name: true, document: true },
      });
    });

    if (!org) {
      throw new TaxGuideError('Organização não encontrada', 404);
    }

    const refMonthDate =
      guide.referenceMonth instanceof Date ? guide.referenceMonth : new Date(guide.referenceMonth);

    const mm = String(refMonthDate.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = refMonthDate.getUTCFullYear();

    let buffer: Buffer;
    let filename: string;
    let contentType: string;

    if (guide.guideType === 'FGTS') {
      // Fetch payroll items for SEFIP
      const items = await withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
        return tx.payrollRunItem.findMany({
          where: guide.payrollRunId
            ? { payrollRunId: guide.payrollRunId }
            : { payrollRun: { organizationId: orgId, referenceMonth: refMonthDate } },
          include: { employee: { select: { name: true, cpf: true } } },
        });
      });

      buffer = buildSefipRE(guide, org, items);
      filename = `SEFIP-FGTS-${yyyy}${mm}.RE`;
      contentType = 'text/plain';
    } else if (guide.guideType === 'INSS' || guide.guideType === 'IRRF') {
      buffer = await buildDarfPdf(guide, org);
      const typeLabel = guide.guideType === 'INSS' ? 'INSS' : 'IRRF';
      filename = `DARF-${typeLabel}-${yyyy}${mm}.pdf`;
      contentType = 'application/pdf';
    } else {
      // FUNRURAL
      buffer = await buildGpsPdf(guide, org);
      filename = `GPS-FUNRURAL-${yyyy}${mm}.pdf`;
      contentType = 'application/pdf';
    }

    // Update guide status to GENERATED
    await withRlsContext({ organizationId: orgId }, async (tx: TxClient) => {
      await tx.taxGuide.update({
        where: { id: guideId },
        data: { status: 'GENERATED' as const, generatedAt: new Date() },
      });
    });

    return { buffer, filename, contentType };
  }
}

export const taxGuidesService = new TaxGuidesService();
