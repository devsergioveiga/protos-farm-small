import ExcelJS from 'exceljs';

// ─── Constants ──────────────────────────────────────────────────────

export const MAX_MATING_PLAN_IMPORT_ROWS = 500;
export const MAX_MATING_PLAN_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_MATING_PLAN_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedMatingPairRow {
  index: number;
  earTag: string;
  primaryBullName: string | null;
  secondaryBullName: string | null;
  tertiaryBullName: string | null;
}

export interface ParsedMatingPlanFile {
  columnHeaders: string[];
  rows: ParsedMatingPairRow[];
  errors: string[];
}

// ─── Column mapping ─────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  earTag: [
    'brinco',
    'ear_tag',
    'eartag',
    'identificacao',
    'identificação',
    'id_animal',
    'animal',
    'tag',
  ],
  primaryBullName: [
    'touro_1',
    'touro_principal',
    'touro_primario',
    'primary_bull',
    'touro',
    'bull_1',
    'primeiro_touro',
  ],
  secondaryBullName: ['touro_2', 'touro_secundario', 'secondary_bull', 'bull_2', 'segundo_touro'],
  tertiaryBullName: ['touro_3', 'touro_terciario', 'tertiary_bull', 'bull_3', 'terceiro_touro'],
};

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

// ─── CSV Parser ─────────────────────────────────────────────────────

function detectSeparator(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function parseCsv(buffer: Buffer): Promise<ParsedMatingPlanFile> {
  let text = stripBom(buffer.toString('utf-8'));
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const separator = detectSeparator(text);
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const errors: string[] = [];

  if (lines.length < 2) {
    return {
      columnHeaders: [],
      rows: [],
      errors: ['Arquivo deve ter pelo menos cabeçalho e uma linha de dados'],
    };
  }

  const columnHeaders = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));

  const earTagCol = findColumn(columnHeaders, COLUMN_ALIASES.earTag);
  if (earTagCol < 0) {
    errors.push('Coluna "Brinco" não encontrada');
    return { columnHeaders, rows: [], errors };
  }

  const primaryCol = findColumn(columnHeaders, COLUMN_ALIASES.primaryBullName);
  const secondaryCol = findColumn(columnHeaders, COLUMN_ALIASES.secondaryBullName);
  const tertiaryCol = findColumn(columnHeaders, COLUMN_ALIASES.tertiaryBullName);

  const rows: ParsedMatingPairRow[] = [];
  for (let i = 1; i < Math.min(lines.length, MAX_MATING_PLAN_IMPORT_ROWS + 1); i++) {
    const cells = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const earTag = cells[earTagCol] ?? '';

    if (!earTag) {
      errors.push(`Linha ${i + 1}: Brinco vazio`);
      continue;
    }

    rows.push({
      index: i,
      earTag: earTag.trim(),
      primaryBullName: primaryCol >= 0 ? cells[primaryCol]?.trim() || null : null,
      secondaryBullName: secondaryCol >= 0 ? cells[secondaryCol]?.trim() || null : null,
      tertiaryBullName: tertiaryCol >= 0 ? cells[tertiaryCol]?.trim() || null : null,
    });
  }

  if (lines.length - 1 > MAX_MATING_PLAN_IMPORT_ROWS) {
    errors.push(`Arquivo excede o limite de ${MAX_MATING_PLAN_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Excel Parser ───────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<ParsedMatingPlanFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { columnHeaders: [], rows: [], errors: ['Planilha vazia ou sem dados'] };
  }

  const errors: string[] = [];
  const headerRow = sheet.getRow(1);
  const columnHeaders: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    columnHeaders[colNumber - 1] = String(cell.value ?? '').trim();
  });

  const earTagCol = findColumn(columnHeaders, COLUMN_ALIASES.earTag);
  if (earTagCol < 0) {
    errors.push('Coluna "Brinco" não encontrada');
    return { columnHeaders, rows: [], errors };
  }

  const primaryCol = findColumn(columnHeaders, COLUMN_ALIASES.primaryBullName);
  const secondaryCol = findColumn(columnHeaders, COLUMN_ALIASES.secondaryBullName);
  const tertiaryCol = findColumn(columnHeaders, COLUMN_ALIASES.tertiaryBullName);

  const rows: ParsedMatingPairRow[] = [];
  const maxRow = Math.min(sheet.rowCount, MAX_MATING_PLAN_IMPORT_ROWS + 1);

  for (let i = 2; i <= maxRow; i++) {
    const row = sheet.getRow(i);
    const earTag = String(row.getCell(earTagCol + 1).value ?? '').trim();

    if (!earTag) continue;

    const getCellStr = (col: number) =>
      col >= 0 ? String(row.getCell(col + 1).value ?? '').trim() : '';

    rows.push({
      index: i - 1,
      earTag,
      primaryBullName: primaryCol >= 0 ? getCellStr(primaryCol) || null : null,
      secondaryBullName: secondaryCol >= 0 ? getCellStr(secondaryCol) || null : null,
      tertiaryBullName: tertiaryCol >= 0 ? getCellStr(tertiaryCol) || null : null,
    });
  }

  if (sheet.rowCount - 1 > MAX_MATING_PLAN_IMPORT_ROWS) {
    errors.push(`Planilha excede o limite de ${MAX_MATING_PLAN_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Main ───────────────────────────────────────────────────────────

export async function parseMatingPlanFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedMatingPlanFile> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv') {
    return parseCsv(buffer);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(buffer);
  }
  return { columnHeaders: [], rows: [], errors: [`Formato não suportado: .${ext}`] };
}
