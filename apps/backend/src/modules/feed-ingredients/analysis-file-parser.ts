import ExcelJS from 'exceljs';

// ─── Constants ──────────────────────────────────────────────────────

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMPORT_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedAnalysisRow {
  index: number;
  feedName: string;
  batchNumber: string | null;
  collectionDate: string | null;
  laboratory: string | null;
  protocolNumber: string | null;
  responsibleName: string | null;
  dmPercent: number | null;
  cpPercent: number | null;
  ndfPercent: number | null;
  adfPercent: number | null;
  eePercent: number | null;
  mmPercent: number | null;
  tdnPercent: number | null;
  nelMcalKg: number | null;
  nfcPercent: number | null;
  caPercent: number | null;
  pPercent: number | null;
  mgPercent: number | null;
  kPercent: number | null;
  naPercent: number | null;
}

export interface ParsedAnalysisFile {
  columnHeaders: string[];
  rows: ParsedAnalysisRow[];
  errors: string[];
}

// ─── Column mapping ─────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  feedName: ['alimento', 'ingrediente', 'feed', 'ingredient', 'nome', 'name', 'feed_name'],
  batchNumber: ['lote', 'batch', 'batch_number', 'numero_lote'],
  collectionDate: ['data_coleta', 'collection_date', 'data', 'date'],
  laboratory: ['laboratorio', 'laboratório', 'lab', 'laboratory'],
  protocolNumber: ['protocolo', 'protocol', 'protocol_number', 'numero_protocolo'],
  responsibleName: ['responsavel', 'responsável', 'responsible', 'tecnico', 'técnico'],
  dmPercent: ['ms', 'dm', 'materia_seca', 'matéria_seca', 'dry_matter', 'ms_%', 'dm_%'],
  cpPercent: ['pb', 'cp', 'proteina_bruta', 'proteína_bruta', 'crude_protein', 'pb_%', 'cp_%'],
  ndfPercent: ['fdn', 'ndf', 'fdn_%', 'ndf_%'],
  adfPercent: ['fda', 'adf', 'fda_%', 'adf_%'],
  eePercent: ['ee', 'extrato_etereo', 'extrato_etéreo', 'fat', 'gordura', 'ee_%'],
  mmPercent: ['mm', 'cinzas', 'ash', 'materia_mineral', 'matéria_mineral', 'mm_%'],
  tdnPercent: ['ndt', 'tdn', 'ndt_%', 'tdn_%'],
  nelMcalKg: ['ell', 'nel', 'energia', 'nel_mcal', 'ell_mcal'],
  nfcPercent: ['cnf', 'nfc', 'cnf_%', 'nfc_%'],
  caPercent: ['ca', 'calcio', 'cálcio', 'calcium', 'ca_%'],
  pPercent: ['p', 'fosforo', 'fósforo', 'phosphorus', 'p_%'],
  mgPercent: ['mg', 'magnesio', 'magnésio', 'magnesium', 'mg_%'],
  kPercent: ['k', 'potassio', 'potássio', 'potassium', 'k_%'],
  naPercent: ['na', 'sodio', 'sódio', 'sodium', 'na_%'],
};

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim().replace(/[%()]/g, '').trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseNumber(val: string): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null;
  const numStr = val.trim().replace(',', '.');
  const num = Number(numStr);
  return isNaN(num) ? null : num;
}

function parseDate(val: string): string | null {
  if (!val || val.trim() === '') return null;
  const trimmed = val.trim();
  // Try ISO format
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // Try dd/mm/yyyy
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
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

async function parseCsv(buffer: Buffer): Promise<ParsedAnalysisFile> {
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

  const feedCol = findColumn(columnHeaders, COLUMN_ALIASES.feedName);
  if (feedCol < 0) {
    return { columnHeaders, rows: [], errors: ['Coluna "Alimento/Ingrediente" não encontrada'] };
  }

  const colMap: Record<string, number> = {};
  for (const key of Object.keys(COLUMN_ALIASES)) {
    colMap[key] = findColumn(columnHeaders, COLUMN_ALIASES[key]);
  }

  const rows: ParsedAnalysisRow[] = [];
  for (let i = 1; i < Math.min(lines.length, MAX_IMPORT_ROWS + 1); i++) {
    const cells = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const feedName = cells[feedCol] ?? '';
    if (!feedName) {
      errors.push(`Linha ${i + 1}: nome do alimento vazio`);
      continue;
    }

    rows.push({
      index: i,
      feedName: feedName.trim(),
      batchNumber: colMap.batchNumber >= 0 ? cells[colMap.batchNumber]?.trim() || null : null,
      collectionDate:
        colMap.collectionDate >= 0 ? parseDate(cells[colMap.collectionDate] ?? '') : null,
      laboratory: colMap.laboratory >= 0 ? cells[colMap.laboratory]?.trim() || null : null,
      protocolNumber:
        colMap.protocolNumber >= 0 ? cells[colMap.protocolNumber]?.trim() || null : null,
      responsibleName:
        colMap.responsibleName >= 0 ? cells[colMap.responsibleName]?.trim() || null : null,
      dmPercent: colMap.dmPercent >= 0 ? parseNumber(cells[colMap.dmPercent] ?? '') : null,
      cpPercent: colMap.cpPercent >= 0 ? parseNumber(cells[colMap.cpPercent] ?? '') : null,
      ndfPercent: colMap.ndfPercent >= 0 ? parseNumber(cells[colMap.ndfPercent] ?? '') : null,
      adfPercent: colMap.adfPercent >= 0 ? parseNumber(cells[colMap.adfPercent] ?? '') : null,
      eePercent: colMap.eePercent >= 0 ? parseNumber(cells[colMap.eePercent] ?? '') : null,
      mmPercent: colMap.mmPercent >= 0 ? parseNumber(cells[colMap.mmPercent] ?? '') : null,
      tdnPercent: colMap.tdnPercent >= 0 ? parseNumber(cells[colMap.tdnPercent] ?? '') : null,
      nelMcalKg: colMap.nelMcalKg >= 0 ? parseNumber(cells[colMap.nelMcalKg] ?? '') : null,
      nfcPercent: colMap.nfcPercent >= 0 ? parseNumber(cells[colMap.nfcPercent] ?? '') : null,
      caPercent: colMap.caPercent >= 0 ? parseNumber(cells[colMap.caPercent] ?? '') : null,
      pPercent: colMap.pPercent >= 0 ? parseNumber(cells[colMap.pPercent] ?? '') : null,
      mgPercent: colMap.mgPercent >= 0 ? parseNumber(cells[colMap.mgPercent] ?? '') : null,
      kPercent: colMap.kPercent >= 0 ? parseNumber(cells[colMap.kPercent] ?? '') : null,
      naPercent: colMap.naPercent >= 0 ? parseNumber(cells[colMap.naPercent] ?? '') : null,
    });
  }

  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    errors.push(`Arquivo excede o limite de ${MAX_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Excel Parser ───────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<ParsedAnalysisFile> {
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

  const feedCol = findColumn(columnHeaders, COLUMN_ALIASES.feedName);
  if (feedCol < 0) {
    return { columnHeaders, rows: [], errors: ['Coluna "Alimento/Ingrediente" não encontrada'] };
  }

  const colMap: Record<string, number> = {};
  for (const key of Object.keys(COLUMN_ALIASES)) {
    colMap[key] = findColumn(columnHeaders, COLUMN_ALIASES[key]);
  }

  const rows: ParsedAnalysisRow[] = [];
  const maxRow = Math.min(sheet.rowCount, MAX_IMPORT_ROWS + 1);

  for (let i = 2; i <= maxRow; i++) {
    const row = sheet.getRow(i);
    const feedName = String(row.getCell(feedCol + 1).value ?? '').trim();
    if (!feedName) continue;

    const getStr = (col: number): string | null =>
      col >= 0 ? String(row.getCell(col + 1).value ?? '').trim() || null : null;
    const getNum = (col: number): number | null => {
      if (col < 0) return null;
      const val = row.getCell(col + 1).value;
      if (val == null) return null;
      const num = Number(val);
      return isNaN(num) ? parseNumber(String(val)) : num;
    };

    rows.push({
      index: i - 1,
      feedName,
      batchNumber: getStr(colMap.batchNumber),
      collectionDate:
        colMap.collectionDate >= 0
          ? parseDate(String(row.getCell(colMap.collectionDate + 1).value ?? ''))
          : null,
      laboratory: getStr(colMap.laboratory),
      protocolNumber: getStr(colMap.protocolNumber),
      responsibleName: getStr(colMap.responsibleName),
      dmPercent: getNum(colMap.dmPercent),
      cpPercent: getNum(colMap.cpPercent),
      ndfPercent: getNum(colMap.ndfPercent),
      adfPercent: getNum(colMap.adfPercent),
      eePercent: getNum(colMap.eePercent),
      mmPercent: getNum(colMap.mmPercent),
      tdnPercent: getNum(colMap.tdnPercent),
      nelMcalKg: getNum(colMap.nelMcalKg),
      nfcPercent: getNum(colMap.nfcPercent),
      caPercent: getNum(colMap.caPercent),
      pPercent: getNum(colMap.pPercent),
      mgPercent: getNum(colMap.mgPercent),
      kPercent: getNum(colMap.kPercent),
      naPercent: getNum(colMap.naPercent),
    });
  }

  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
    errors.push(`Planilha excede o limite de ${MAX_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Main ───────────────────────────────────────────────────────────

export async function parseAnalysisFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedAnalysisFile> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv') {
    return parseCsv(buffer);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(buffer);
  }
  return { columnHeaders: [], rows: [], errors: [`Formato não suportado: .${ext}`] };
}
