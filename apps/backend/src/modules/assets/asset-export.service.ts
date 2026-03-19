import ExcelJS from 'exceljs';
import { prisma } from '../../database/prisma';
import type { RlsContext } from '../../database/rls';
import type { ListAssetsQuery } from './assets.types';

// ─── Helpers ─────────────────────────────────────────────────────────

function toNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && 'toNumber' in val) {
    return (val as { toNumber(): number }).toNumber();
  }
  return Number(val);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('pt-BR');
}

function formatCurrency(val: unknown): string {
  if (val == null) return '';
  const n = toNumber(val);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  MAQUINA: 'Máquina',
  VEICULO: 'Veículo',
  IMPLEMENTO: 'Implemento',
  BENFEITORIA: 'Benfeitoria',
  TERRA: 'Terra',
  EQUIPAMENTO: 'Equipamento',
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  DEPRECIABLE_CPC27: 'Depreciável (CPC 27)',
  NON_DEPRECIABLE_CPC27: 'Não depreciável (CPC 27)',
  FAIR_VALUE_CPC29: 'Valor justo (CPC 29)',
  BEARER_PLANT_CPC27: 'Planta portadora (CPC 27)',
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  EM_MANUTENCAO: 'Em manutenção',
  ALIENADO: 'Alienado',
  EM_ANDAMENTO: 'Em andamento',
};

async function getAssets(ctx: RlsContext, query?: ListAssetsQuery) {
  const where: Record<string, unknown> = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query?.farmId) where['farmId'] = query.farmId;
  if (query?.assetType) where['assetType'] = query.assetType;
  if (query?.status) where['status'] = query.status;

  if (query?.search) {
    where['OR'] = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { assetTag: { contains: query.search, mode: 'insensitive' } },
      { serialNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query?.minValue != null || query?.maxValue != null) {
    const valueFilter: Record<string, unknown> = {};
    if (query.minValue != null) valueFilter['gte'] = String(query.minValue);
    if (query.maxValue != null) valueFilter['lte'] = String(query.maxValue);
    where['acquisitionValue'] = valueFilter;
  }

  return prisma.asset.findMany({
    where: where as never,
    include: {
      farm: { select: { name: true } },
      costCenter: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────

export async function exportAssetsCsv(ctx: RlsContext, query?: ListAssetsQuery): Promise<Buffer> {
  const assets = await getAssets(ctx, query);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ativos');

  sheet.columns = [
    { header: 'Tag', key: 'tag', width: 14 },
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 15 },
    { header: 'Classificação CPC', key: 'classificacao', width: 25 },
    { header: 'Fazenda', key: 'fazenda', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Valor Aquisição (R$)', key: 'valorAquisicao', width: 22 },
    { header: 'Data Aquisição', key: 'dataAquisicao', width: 16 },
    { header: 'Fabricante', key: 'fabricante', width: 18 },
    { header: 'Modelo', key: 'modelo', width: 18 },
    { header: 'Centro de Custo', key: 'centroCusto', width: 20 },
  ];

  for (const a of assets) {
    sheet.addRow({
      tag: a.assetTag,
      nome: a.name,
      tipo: ASSET_TYPE_LABELS[String(a.assetType)] ?? String(a.assetType),
      classificacao: CLASSIFICATION_LABELS[String(a.classification)] ?? String(a.classification),
      fazenda: a.farm?.name ?? '',
      status: STATUS_LABELS[String(a.status)] ?? String(a.status),
      valorAquisicao: a.acquisitionValue ? toNumber(a.acquisitionValue) : '',
      dataAquisicao: formatDate(a.acquisitionDate),
      fabricante: a.manufacturer ?? '',
      modelo: a.model ?? '',
      centroCusto: a.costCenter?.name ?? '',
    });
  }

  const rawBuffer = await workbook.csv.writeBuffer();
  return Buffer.from(rawBuffer);
}

// ─── PDF Export ───────────────────────────────────────────────────────

export async function exportAssetsPdf(ctx: RlsContext, query?: ListAssetsQuery): Promise<Buffer> {
  const assets = await getAssets(ctx, query);

  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 80; // margins
    const now = new Date();

    // ── Header ──
    doc.fontSize(16).font('Helvetica-Bold').text('Inventário de Ativos Patrimoniais', 40, 40);
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Emitido em: ${formatDate(now)}`, 40, 62);
    doc.moveDown(1);

    // ── Table header ──
    const colWidths = [80, 180, 90, 100, 80, 100];
    const headers = ['Tag', 'Nome', 'Tipo', 'Fazenda', 'Status', 'Valor Aquisição'];
    let x = 40;
    const headerY = doc.y;

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x, headerY, { width: colWidths[i], continued: false });
      x += colWidths[i];
    });

    doc
      .moveTo(40, headerY + 12)
      .lineTo(40 + pageWidth, headerY + 12)
      .stroke();

    // ── Rows ──
    doc.fontSize(8).font('Helvetica');
    let totalValue = 0;

    for (const a of assets) {
      const rowY = doc.y + 4;

      // Check if new page needed
      if (rowY > doc.page.height - 80) {
        doc.addPage({ layout: 'landscape' });
      }

      const currentY = doc.y + 4;
      x = 40;
      const cols = [
        a.assetTag,
        a.name,
        ASSET_TYPE_LABELS[String(a.assetType)] ?? String(a.assetType),
        a.farm?.name ?? '',
        STATUS_LABELS[String(a.status)] ?? String(a.status),
        a.acquisitionValue ? formatCurrency(a.acquisitionValue) : '',
      ];

      cols.forEach((col, i) => {
        doc.text(String(col), x, currentY, { width: colWidths[i], ellipsis: true });
        x += colWidths[i];
      });

      if (a.acquisitionValue) totalValue += toNumber(a.acquisitionValue);
      doc.moveDown(0.3);
    }

    // ── Footer ──
    doc
      .moveTo(40, doc.y + 4)
      .lineTo(40 + pageWidth, doc.y + 4)
      .stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Total de ativos: ${assets.length}`, 40, doc.y);
    doc.text(
      `Valor total: ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      40,
      doc.y + 2,
    );

    doc.end();
  });
}
