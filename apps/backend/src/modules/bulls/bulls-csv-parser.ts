import ExcelJS from 'exceljs';

// ─── Constants ──────────────────────────────────────────────────────

export const MAX_BULL_IMPORT_ROWS = 500;
export const MAX_BULL_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_BULL_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedBullRow {
  index: number;
  name: string;
  breedName: string;
  registryNumber: string | null;
  registryAssociation: string | null;
  ptaMilkKg: number | null;
  ptaFatKg: number | null;
  ptaProteinKg: number | null;
  centralName: string | null;
  batchNumber: string | null;
  doses: number | null;
  costPerDose: number | null; // cents
}

export interface ParsedBullFile {
  columnHeaders: string[];
  rows: ParsedBullRow[];
  errors: string[];
}

// ─── Column mapping ─────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['nome', 'name', 'touro', 'bull', 'nome_touro', 'bull_name'],
  breedName: ['raça', 'raca', 'breed', 'raça_principal', 'breed_name'],
  registryNumber: ['registro', 'registry', 'número_registro', 'registry_number', 'num_registro'],
  registryAssociation: ['associação', 'associacao', 'association', 'registry_association'],
  ptaMilkKg: ['pta_leite', 'pta_milk', 'pta_leite_kg', 'pta_milk_kg', 'leite_kg'],
  ptaFatKg: ['pta_gordura', 'pta_fat', 'pta_gordura_kg', 'pta_fat_kg', 'gordura_kg'],
  ptaProteinKg: ['pta_proteina', 'pta_protein', 'pta_proteina_kg', 'pta_protein_kg', 'proteina_kg'],
  centralName: ['central', 'central_name', 'nome_central', 'marca', 'brand'],
  batchNumber: ['lote', 'batch', 'lote_semen', 'batch_number', 'num_lote'],
  doses: ['doses', 'qtd_doses', 'quantidade_doses', 'dose_count'],
  costPerDose: ['custo_dose', 'cost_per_dose', 'preco_dose', 'custo', 'price'],
};

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseNumberOrNull(val: string): number | null {
  if (!val || val.trim() === '') return null;
  const numStr = val.trim().replace(',', '.');
  const num = Number(numStr);
  return isNaN(num) ? null : num;
}

function parseCostInCents(val: string): number | null {
  const num = parseNumberOrNull(val);
  if (num === null) return null;
  // If value looks like reais (has decimal), convert to cents
  return Math.round(num * 100);
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

async function parseCsv(buffer: Buffer): Promise<ParsedBullFile> {
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

  const nameCol = findColumn(columnHeaders, COLUMN_ALIASES.name);
  const breedCol = findColumn(columnHeaders, COLUMN_ALIASES.breedName);

  if (nameCol < 0) errors.push('Coluna "Nome" não encontrada');
  if (breedCol < 0) errors.push('Coluna "Raça" não encontrada');

  if (errors.length > 0) return { columnHeaders, rows: [], errors };

  const registryCol = findColumn(columnHeaders, COLUMN_ALIASES.registryNumber);
  const associationCol = findColumn(columnHeaders, COLUMN_ALIASES.registryAssociation);
  const ptaMilkCol = findColumn(columnHeaders, COLUMN_ALIASES.ptaMilkKg);
  const ptaFatCol = findColumn(columnHeaders, COLUMN_ALIASES.ptaFatKg);
  const ptaProteinCol = findColumn(columnHeaders, COLUMN_ALIASES.ptaProteinKg);
  const centralCol = findColumn(columnHeaders, COLUMN_ALIASES.centralName);
  const batchCol = findColumn(columnHeaders, COLUMN_ALIASES.batchNumber);
  const dosesCol = findColumn(columnHeaders, COLUMN_ALIASES.doses);
  const costCol = findColumn(columnHeaders, COLUMN_ALIASES.costPerDose);

  const rows: ParsedBullRow[] = [];
  for (let i = 1; i < Math.min(lines.length, MAX_BULL_IMPORT_ROWS + 1); i++) {
    const cells = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const name = cells[nameCol] ?? '';
    const breedName = cells[breedCol] ?? '';

    if (!name) {
      errors.push(`Linha ${i + 1}: Nome do touro vazio`);
      continue;
    }
    if (!breedName) {
      errors.push(`Linha ${i + 1}: Raça vazia`);
      continue;
    }

    rows.push({
      index: i,
      name: name.trim(),
      breedName: breedName.trim(),
      registryNumber: registryCol >= 0 ? cells[registryCol]?.trim() || null : null,
      registryAssociation: associationCol >= 0 ? cells[associationCol]?.trim() || null : null,
      ptaMilkKg: ptaMilkCol >= 0 ? parseNumberOrNull(cells[ptaMilkCol] ?? '') : null,
      ptaFatKg: ptaFatCol >= 0 ? parseNumberOrNull(cells[ptaFatCol] ?? '') : null,
      ptaProteinKg: ptaProteinCol >= 0 ? parseNumberOrNull(cells[ptaProteinCol] ?? '') : null,
      centralName: centralCol >= 0 ? cells[centralCol]?.trim() || null : null,
      batchNumber: batchCol >= 0 ? cells[batchCol]?.trim() || null : null,
      doses: dosesCol >= 0 ? parseNumberOrNull(cells[dosesCol] ?? '') : null,
      costPerDose: costCol >= 0 ? parseCostInCents(cells[costCol] ?? '') : null,
    });
  }

  if (lines.length - 1 > MAX_BULL_IMPORT_ROWS) {
    errors.push(`Arquivo excede o limite de ${MAX_BULL_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Excel Parser ───────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<ParsedBullFile> {
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

  const nameCol = findColumn(columnHeaders, COLUMN_ALIASES.name);
  const breedCol = findColumn(columnHeaders, COLUMN_ALIASES.breedName);

  if (nameCol < 0) errors.push('Coluna "Nome" não encontrada');
  if (breedCol < 0) errors.push('Coluna "Raça" não encontrada');

  if (errors.length > 0) return { columnHeaders, rows: [], errors };

  const registryCol = findColumn(columnHeaders, COLUMN_ALIASES.registryNumber);
  const associationCol = findColumn(columnHeaders, COLUMN_ALIASES.registryAssociation);
  const ptaMilkCol = findColumn(columnHeaders, COLUMN_ALIASES.ptaMilkKg);
  const ptaFatCol = findColumn(columnHeaders, COLUMN_ALIASES.ptaFatKg);
  const ptaProteinCol = findColumn(columnHeaders, COLUMN_ALIASES.ptaProteinKg);
  const centralCol = findColumn(columnHeaders, COLUMN_ALIASES.centralName);
  const batchCol = findColumn(columnHeaders, COLUMN_ALIASES.batchNumber);
  const dosesCol = findColumn(columnHeaders, COLUMN_ALIASES.doses);
  const costCol = findColumn(columnHeaders, COLUMN_ALIASES.costPerDose);

  const rows: ParsedBullRow[] = [];
  const maxRow = Math.min(sheet.rowCount, MAX_BULL_IMPORT_ROWS + 1);

  for (let i = 2; i <= maxRow; i++) {
    const row = sheet.getRow(i);
    const name = String(row.getCell(nameCol + 1).value ?? '').trim();
    const breedName = String(row.getCell(breedCol + 1).value ?? '').trim();

    if (!name && !breedName) continue;
    if (!name) {
      errors.push(`Linha ${i}: Nome do touro vazio`);
      continue;
    }
    if (!breedName) {
      errors.push(`Linha ${i}: Raça vazia`);
      continue;
    }

    const getCellStr = (col: number) =>
      col >= 0 ? String(row.getCell(col + 1).value ?? '').trim() : '';

    rows.push({
      index: i - 1,
      name,
      breedName,
      registryNumber: registryCol >= 0 ? getCellStr(registryCol) || null : null,
      registryAssociation: associationCol >= 0 ? getCellStr(associationCol) || null : null,
      ptaMilkKg: ptaMilkCol >= 0 ? parseNumberOrNull(getCellStr(ptaMilkCol)) : null,
      ptaFatKg: ptaFatCol >= 0 ? parseNumberOrNull(getCellStr(ptaFatCol)) : null,
      ptaProteinKg: ptaProteinCol >= 0 ? parseNumberOrNull(getCellStr(ptaProteinCol)) : null,
      centralName: centralCol >= 0 ? getCellStr(centralCol) || null : null,
      batchNumber: batchCol >= 0 ? getCellStr(batchCol) || null : null,
      doses: dosesCol >= 0 ? parseNumberOrNull(getCellStr(dosesCol)) : null,
      costPerDose: costCol >= 0 ? parseCostInCents(getCellStr(costCol)) : null,
    });
  }

  if (sheet.rowCount - 1 > MAX_BULL_IMPORT_ROWS) {
    errors.push(`Planilha excede o limite de ${MAX_BULL_IMPORT_ROWS} linhas`);
  }

  return { columnHeaders, rows, errors };
}

// ─── Main ───────────────────────────────────────────────────────────

export async function parseBullFile(buffer: Buffer, filename: string): Promise<ParsedBullFile> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv') {
    return parseCsv(buffer);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(buffer);
  }
  return { columnHeaders: [], rows: [], errors: [`Formato não suportado: .${ext}`] };
}
