import ExcelJS from 'exceljs';

// ─── Constants ──────────────────────────────────────────────────────────

export const MAX_BULK_ASSET_ROWS = 500;
export const MAX_ASSET_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_ASSET_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

// ─── Auto-mapping dictionary (Portuguese header → system field) ─────────

export const AUTO_MAP: Record<string, string> = {
  nome: 'name',
  tipo: 'assetType',
  classificacao: 'classification',
  classificacao_cpc: 'classification',
  fazenda: 'farmId',
  data_aquisicao: 'acquisitionDate',
  valor_aquisicao: 'acquisitionValue',
  numero_serie: 'serialNumber',
  fabricante: 'manufacturer',
  modelo: 'model',
  ano: 'yearOfManufacture',
  centro_custo: 'costCenterId',
  tag: 'assetTag',
  descricao: 'description',
  placa: 'licensePlate',
  renavam: 'renavamCode',
  potencia_hp: 'engineHp',
  combustivel: 'fuelType',
  area_m2: 'areaM2',
  area_ha: 'areaHa',
  matricula: 'registrationNumber',
  codigo_car: 'carCode',
  material_construcao: 'constructionMaterial',
  capacidade: 'capacity',
  horimetro_atual: 'currentHourmeter',
  odometro_atual: 'currentOdometer',
  observacoes: 'notes',
  numero_nota: 'invoiceNumber',
};

// ─── Types ──────────────────────────────────────────────────────────────

export interface ParseAssetFileResult {
  columnHeaders: string[];
  rowCount: number;
  sampleRows: Record<string, string>[]; // first 5 rows
  allRows: Record<string, string>[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function detectCsvSeparator(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ';' : ',';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isRowEmpty(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === '');
}

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip diacritics
    .replace(/\s+/g, '_');
}

// ─── Auto-mapper ────────────────────────────────────────────────────────

export function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = normalizeHeaderKey(header);
    if (AUTO_MAP[normalized]) {
      mapping[header] = AUTO_MAP[normalized];
    }
  }
  return mapping;
}

// ─── CSV parser ─────────────────────────────────────────────────────────

async function parseCsv(buffer: Buffer): Promise<ParseAssetFileResult> {
  let text = stripBom(buffer.toString('utf-8'));
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const separator = detectCsvSeparator(text);
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Arquivo CSV deve ter pelo menos um cabecalho e uma linha de dados');
  }

  const headerLine = lines[0];
  const columnHeaders = (headerLine ?? '')
    .split(separator)
    .map((h) => h.trim().replace(/^"|"$/g, ''));

  const allRows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = (lines[i] ?? '').split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const raw: Record<string, string> = {};

    for (let j = 0; j < columnHeaders.length; j++) {
      raw[columnHeaders[j] ?? ''] = cells[j] ?? '';
    }

    if (!isRowEmpty(raw)) {
      allRows.push(raw);
    }
  }

  return {
    columnHeaders,
    rowCount: allRows.length,
    sampleRows: allRows.slice(0, 5),
    allRows,
  };
}

// ─── XLSX parser ────────────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<ParseAssetFileResult> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new Error('Planilha deve ter pelo menos um cabecalho e uma linha de dados');
  }

  const headerRow = sheet.getRow(1);
  const columnHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    while (columnHeaders.length < colNumber - 1) columnHeaders.push('');
    columnHeaders.push(String(cell.value ?? '').trim());
  });

  const allRows: Record<string, string>[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw: Record<string, string> = {};

    for (let c = 0; c < columnHeaders.length; c++) {
      const cell = row.getCell(c + 1);
      let val = '';

      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'number') {
          val = String(cell.value);
        } else if (cell.value instanceof Date) {
          val = cell.value.toISOString().split('T')[0] ?? '';
        } else if (typeof cell.value === 'object' && 'result' in cell.value) {
          val = cell.value.result != null ? String(cell.value.result) : '';
        } else {
          val = String(cell.value).trim();
        }
      }

      raw[columnHeaders[c] ?? ''] = val;
    }

    if (!isRowEmpty(raw)) {
      allRows.push(raw);
    }
  }

  return {
    columnHeaders,
    rowCount: allRows.length,
    sampleRows: allRows.slice(0, 5),
    allRows,
  };
}

// ─── Main parser ─────────────────────────────────────────────────────────

export async function parseAssetFile(
  buffer: Buffer,
  filename: string,
): Promise<ParseAssetFileResult> {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  if (!(ACCEPTED_ASSET_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `Formato nao suportado. Extensoes aceitas: ${ACCEPTED_ASSET_EXTENSIONS.join(', ')}`,
    );
  }

  const result = ext === '.csv' ? await parseCsv(buffer) : await parseExcel(buffer);

  if (result.rowCount === 0) {
    throw new Error('Arquivo nao contem dados');
  }

  if (result.rowCount > MAX_BULK_ASSET_ROWS) {
    throw new Error(
      `Arquivo contem ${result.rowCount} linhas. Limite maximo: ${MAX_BULK_ASSET_ROWS}`,
    );
  }

  return result;
}
