import ExcelJS from 'exceljs';
import { isValidCNPJ, isValidCPF, cleanDocument } from '../../shared/utils/document-validator';
import { SUPPLIER_CATEGORIES, SUPPLIER_CATEGORY_LABELS } from './suppliers.types';

// ─── Constants ──────────────────────────────────────────────────────

export const MAX_SUPPLIER_ROWS = 500;

const VALID_UF = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

// Reverse mapping from label (case-insensitive) to enum value
const CATEGORY_LABEL_TO_ENUM: Record<string, string> = {};
for (const [enumVal, label] of Object.entries(SUPPLIER_CATEGORY_LABELS)) {
  CATEGORY_LABEL_TO_ENUM[label.toLowerCase()] = enumVal;
  CATEGORY_LABEL_TO_ENUM[enumVal.toLowerCase()] = enumVal;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface ParsedSupplierRow {
  type: 'PF' | 'PJ';
  name: string;
  tradeName?: string;
  document: string;
  stateRegistration?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;
  freightType?: string;
  categories: string[];
}

export interface InvalidSupplierRow {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  valid: ParsedSupplierRow[];
  invalid: InvalidSupplierRow[];
}

// ─── Helpers ────────────────────────────────────────────────────────

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

function normalizeCategories(raw: string): string[] {
  if (!raw || !raw.trim()) return ['OUTROS'];
  return raw
    .split('|')
    .map((c) => c.trim())
    .map((c) => CATEGORY_LABEL_TO_ENUM[c.toLowerCase()] ?? c.toUpperCase())
    .filter(Boolean);
}

function validateRow(
  rowNum: number,
  data: Record<string, string>,
): { parsed: ParsedSupplierRow | null; errors: string[] } {
  const errors: string[] = [];

  const rawType = (data['Tipo'] ?? '').trim().toUpperCase();
  const rawDocument = cleanDocument(data['CNPJ/CPF'] ?? '');
  const name = (data['Nome/Razão Social'] ?? '').trim();

  // Infer type
  let type: 'PF' | 'PJ' | null = null;
  if (rawType === 'PF') {
    type = 'PF';
  } else if (rawType === 'PJ') {
    type = 'PJ';
  } else if (rawDocument.length === 11) {
    type = 'PF';
  } else if (rawDocument.length === 14) {
    type = 'PJ';
  } else {
    errors.push('Tipo inválido. Use PF ou PJ.');
  }

  // Validate name
  if (!name || name.length < 2) {
    errors.push('Nome/Razão Social é obrigatório (mínimo 2 caracteres).');
  }

  // Validate document
  if (!rawDocument) {
    errors.push('CNPJ/CPF é obrigatório.');
  } else if (type === 'PJ' && !isValidCNPJ(rawDocument)) {
    errors.push('CNPJ inválido.');
  } else if (type === 'PF' && !isValidCPF(rawDocument)) {
    errors.push('CPF inválido.');
  }

  // Validate UF
  const uf = (data['UF'] ?? '').trim().toUpperCase();
  if (uf && !VALID_UF.includes(uf)) {
    errors.push(`UF inválida: ${uf}.`);
  }

  // Validate freight
  const rawFreight = (data['Frete'] ?? '').trim().toUpperCase();
  if (rawFreight && rawFreight !== 'CIF' && rawFreight !== 'FOB') {
    errors.push(`Frete inválido: ${rawFreight}. Use CIF ou FOB.`);
  }

  // Validate categories
  const rawCats = data['Categorias'] ?? '';
  const categories = normalizeCategories(rawCats);
  const invalidCats = categories.filter(
    (c) => !(SUPPLIER_CATEGORIES as readonly string[]).includes(c),
  );
  if (invalidCats.length > 0) {
    errors.push(`Categorias inválidas: ${invalidCats.join(', ')}.`);
  }

  if (errors.length > 0) {
    return { parsed: null, errors };
  }

  return {
    parsed: {
      type: type!,
      name,
      tradeName: (data['Nome Fantasia'] ?? '').trim() || undefined,
      document: rawDocument,
      stateRegistration: (data['IE'] ?? '').trim() || undefined,
      address: (data['Endereço'] ?? '').trim() || undefined,
      city: (data['Cidade'] ?? '').trim() || undefined,
      state: uf || undefined,
      zipCode: (data['CEP'] ?? '').trim() || undefined,
      contactName: (data['Contato Nome'] ?? '').trim() || undefined,
      contactPhone: (data['Contato Telefone'] ?? '').trim() || undefined,
      contactEmail: (data['Contato Email'] ?? '').trim() || undefined,
      paymentTerms: (data['Condição Pagamento'] ?? '').trim() || undefined,
      freightType: rawFreight || undefined,
      categories,
    },
    errors: [],
  };
}

// ─── CSV Parser ──────────────────────────────────────────────────────

async function parseCsv(buffer: Buffer): Promise<Array<Record<string, string>>> {
  let text = stripBom(buffer.toString('utf-8'));
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const separator = detectCsvSeparator(text);
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    throw new Error('Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados');
  }

  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? '';
    }
    if (!isRowEmpty(row)) {
      rows.push(row);
    }
  }

  return rows;
}

// ─── XLSX Parser ─────────────────────────────────────────────────────

async function parseExcel(buffer: Buffer): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new Error('Planilha deve ter pelo menos um cabeçalho e uma linha de dados');
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    while (headers.length < colNumber - 1) headers.push('');
    headers.push(String(cell.value ?? '').trim());
  });

  const rows: Array<Record<string, string>> = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const data: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const cell = row.getCell(c + 1);
      let val = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (cell.value instanceof Date) {
          val = cell.value.toISOString().split('T')[0];
        } else if (typeof cell.value === 'object' && 'result' in cell.value) {
          val = cell.value.result != null ? String(cell.value.result) : '';
        } else {
          val = String(cell.value).trim();
        }
      }
      data[headers[c]] = val;
    }
    if (!isRowEmpty(data)) {
      rows.push(data);
    }
  }

  return rows;
}

// ─── Main Export ─────────────────────────────────────────────────────

export async function parseSupplierFile(buffer: Buffer, mimetype: string): Promise<ParseResult> {
  const isExcel =
    mimetype.includes('spreadsheetml') ||
    mimetype.includes('excel') ||
    mimetype === 'application/vnd.ms-excel';

  let rawRows: Array<Record<string, string>>;

  if (isExcel) {
    rawRows = await parseExcel(buffer);
  } else {
    rawRows = await parseCsv(buffer);
  }

  if (rawRows.length === 0) {
    throw new Error('Arquivo não contém dados');
  }

  if (rawRows.length > MAX_SUPPLIER_ROWS) {
    throw new Error(`Arquivo contém ${rawRows.length} linhas. Limite máximo: ${MAX_SUPPLIER_ROWS}`);
  }

  const valid: ParsedSupplierRow[] = [];
  const invalid: InvalidSupplierRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2; // +2 because row 1 is header
    const result = validateRow(rowNum, rawRows[i]);
    if (result.parsed) {
      valid.push(result.parsed);
    } else {
      invalid.push({ row: rowNum, data: rawRows[i], errors: result.errors });
    }
  }

  return { valid, invalid };
}
