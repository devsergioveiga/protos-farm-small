import ExcelJS from 'exceljs';

// ─── Constants ──────────────────────────────────────────────────────

export const MAX_BULK_ANIMAL_ROWS = 500;
export const MAX_ANIMAL_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_ANIMAL_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedAnimalRow {
  index: number;
  raw: Record<string, string | number | null>;
}

export interface ParsedAnimalFile {
  columnHeaders: string[];
  rows: ParsedAnimalRow[];
}

// ─── Parser ─────────────────────────────────────────────────────────

function detectCsvSeparator(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ';' : ',';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isRowEmpty(row: Record<string, string | number | null>): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === '');
}

function decodeBuffer(buffer: Buffer): string {
  // Check for UTF-8 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf-8');
  }

  // Try UTF-8 first; if it produces replacement characters, fall back to latin1
  const utf8 = buffer.toString('utf-8');
  if (!utf8.includes('\uFFFD')) {
    return utf8;
  }

  // ISO-8859-1 (Latin-1) — very common in Brazilian Excel exports
  return buffer.toString('latin1');
}

async function parseCsv(buffer: Buffer): Promise<ParsedAnimalFile> {
  let text = stripBom(decodeBuffer(buffer));
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const separator = detectCsvSeparator(text);
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados');
  }

  const headerLine = lines[0];
  const columnHeaders = headerLine.split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));

  const rows: ParsedAnimalRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const raw: Record<string, string | number | null> = {};

    for (let j = 0; j < columnHeaders.length; j++) {
      const val = cells[j] ?? '';
      raw[columnHeaders[j]] = val === '' ? null : val;
    }

    if (!isRowEmpty(raw)) {
      rows.push({ index: rows.length, raw });
    }
  }

  return { columnHeaders, rows };
}

async function parseExcel(buffer: Buffer): Promise<ParsedAnimalFile> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new Error('Planilha deve ter pelo menos um cabeçalho e uma linha de dados');
  }

  const headerRow = sheet.getRow(1);
  const columnHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    while (columnHeaders.length < colNumber - 1) columnHeaders.push('');
    columnHeaders.push(String(cell.value ?? '').trim());
  });

  const rows: ParsedAnimalRow[] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw: Record<string, string | number | null> = {};

    for (let c = 0; c < columnHeaders.length; c++) {
      const cell = row.getCell(c + 1);
      let val: string | number | null = null;

      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'number') {
          val = cell.value;
        } else if (cell.value instanceof Date) {
          val = cell.value.toISOString().split('T')[0];
        } else if (typeof cell.value === 'object' && 'result' in cell.value) {
          val = cell.value.result != null ? String(cell.value.result) : null;
        } else {
          val = String(cell.value).trim();
          if (val === '') val = null;
        }
      }

      raw[columnHeaders[c]] = val;
    }

    if (!isRowEmpty(raw)) {
      rows.push({ index: rows.length, raw });
    }
  }

  return { columnHeaders, rows };
}

export async function parseAnimalFile(buffer: Buffer, filename: string): Promise<ParsedAnimalFile> {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  if (!(ACCEPTED_ANIMAL_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `Formato não suportado. Extensões aceitas: ${ACCEPTED_ANIMAL_EXTENSIONS.join(', ')}`,
    );
  }

  const result = ext === '.csv' ? await parseCsv(buffer) : await parseExcel(buffer);

  if (result.rows.length === 0) {
    throw new Error('Arquivo não contém dados');
  }

  if (result.rows.length > MAX_BULK_ANIMAL_ROWS) {
    throw new Error(
      `Arquivo contém ${result.rows.length} linhas. Limite máximo: ${MAX_BULK_ANIMAL_ROWS}`,
    );
  }

  return result;
}
