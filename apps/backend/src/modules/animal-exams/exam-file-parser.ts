import ExcelJS from 'exceljs';

// ─── Constants ──────────────────────────────────────────────────────

export const MAX_EXAM_IMPORT_ROWS = 500;
export const MAX_EXAM_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_EXAM_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedExamResultRow {
  index: number;
  earTag: string;
  paramName: string;
  numericValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
  unit: string | null;
}

export interface ParsedExamFile {
  columnHeaders: string[];
  rows: ParsedExamResultRow[];
  errors: string[];
}

// ─── Column mapping ─────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  earTag: ['brinco', 'ear_tag', 'eartag', 'identificação', 'identificacao', 'animal', 'id_animal'],
  paramName: ['parametro', 'parâmetro', 'param', 'exame', 'teste', 'parameter', 'param_name'],
  value: ['valor', 'resultado', 'result', 'value'],
  unit: ['unidade', 'unit', 'un'],
};

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseResultValue(val: string): {
  numericValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
} {
  if (!val || val.trim() === '') return { numericValue: null, booleanValue: null, textValue: null };

  const trimmed = val.trim().toLowerCase();

  // Boolean values
  if (['positivo', 'pos', 'positive', '+', 'sim', 'yes', 'true', 'reagente'].includes(trimmed)) {
    return { numericValue: null, booleanValue: true, textValue: null };
  }
  if (
    [
      'negativo',
      'neg',
      'negative',
      '-',
      'não',
      'nao',
      'no',
      'false',
      'não reagente',
      'nao reagente',
    ].includes(trimmed)
  ) {
    return { numericValue: null, booleanValue: false, textValue: null };
  }

  // Numeric values (support comma as decimal separator)
  const numStr = val.trim().replace(',', '.');
  const num = Number(numStr);
  if (!isNaN(num) && numStr !== '') {
    return { numericValue: num, booleanValue: null, textValue: null };
  }

  // Text fallback
  return { numericValue: null, booleanValue: null, textValue: val.trim() };
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

async function parseCsv(buffer: Buffer): Promise<ParsedExamFile> {
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
  const paramCol = findColumn(columnHeaders, COLUMN_ALIASES.paramName);
  const valueCol = findColumn(columnHeaders, COLUMN_ALIASES.value);
  const unitCol = findColumn(columnHeaders, COLUMN_ALIASES.unit);

  if (earTagCol < 0) errors.push('Coluna "Brinco" não encontrada');
  if (paramCol < 0) errors.push('Coluna "Parâmetro" não encontrada');
  if (valueCol < 0) errors.push('Coluna "Valor/Resultado" não encontrada');

  if (errors.length > 0) return { columnHeaders, rows: [], errors };

  const rows: ParsedExamResultRow[] = [];
  for (let i = 1; i < Math.min(lines.length, MAX_EXAM_IMPORT_ROWS + 1); i++) {
    const cells = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const earTag = cells[earTagCol] ?? '';
    const paramName = cells[paramCol] ?? '';
    const rawValue = cells[valueCol] ?? '';
    const unit = unitCol >= 0 ? (cells[unitCol] ?? null) : null;

    if (!earTag || !paramName) {
      errors.push(`Linha ${i + 1}: Brinco ou parâmetro vazio`);
      continue;
    }

    const { numericValue, booleanValue, textValue } = parseResultValue(rawValue);
    rows.push({
      index: i,
      earTag: earTag.trim(),
      paramName: paramName.trim(),
      numericValue,
      booleanValue,
      textValue,
      unit: unit?.trim() || null,
    });
  }

  if (lines.length - 1 > MAX_EXAM_IMPORT_ROWS) {
    errors.push(`Arquivo excede o limite de ${MAX_EXAM_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Excel Parser ───────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<ParsedExamFile> {
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
  const paramCol = findColumn(columnHeaders, COLUMN_ALIASES.paramName);
  const valueCol = findColumn(columnHeaders, COLUMN_ALIASES.value);
  const unitCol = findColumn(columnHeaders, COLUMN_ALIASES.unit);

  if (earTagCol < 0) errors.push('Coluna "Brinco" não encontrada');
  if (paramCol < 0) errors.push('Coluna "Parâmetro" não encontrada');
  if (valueCol < 0) errors.push('Coluna "Valor/Resultado" não encontrada');

  if (errors.length > 0) return { columnHeaders, rows: [], errors };

  const rows: ParsedExamResultRow[] = [];
  const maxRow = Math.min(sheet.rowCount, MAX_EXAM_IMPORT_ROWS + 1);

  for (let i = 2; i <= maxRow; i++) {
    const row = sheet.getRow(i);
    const earTag = String(row.getCell(earTagCol + 1).value ?? '').trim();
    const paramName = String(row.getCell(paramCol + 1).value ?? '').trim();
    const rawValue = String(row.getCell(valueCol + 1).value ?? '').trim();
    const unit = unitCol >= 0 ? String(row.getCell(unitCol + 1).value ?? '').trim() || null : null;

    if (!earTag && !paramName) continue;
    if (!earTag || !paramName) {
      errors.push(`Linha ${i}: Brinco ou parâmetro vazio`);
      continue;
    }

    const { numericValue, booleanValue, textValue } = parseResultValue(rawValue);
    rows.push({ index: i - 1, earTag, paramName, numericValue, booleanValue, textValue, unit });
  }

  if (sheet.rowCount - 1 > MAX_EXAM_IMPORT_ROWS) {
    errors.push(`Planilha excede o limite de ${MAX_EXAM_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Main ───────────────────────────────────────────────────────────

export async function parseExamFile(buffer: Buffer, filename: string): Promise<ParsedExamFile> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv') {
    return parseCsv(buffer);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(buffer);
  }
  return { columnHeaders: [], rows: [], errors: [`Formato não suportado: .${ext}`] };
}
