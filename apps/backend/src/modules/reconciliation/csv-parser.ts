import { ReconciliationError } from './reconciliation.types';
import type {
  CsvColumnMapping,
  CsvDetectedColumns,
  ParsedStatementLine,
} from './reconciliation.types';

const MAX_LINES = 5000;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Detect the separator used in a CSV file.
 * Tries ; then , then \t. Uses the one that produces the most columns.
 */
function detectSeparator(headerLine: string): string {
  const candidates = [';', ',', '\t'];
  let best = ',';
  let bestCount = 0;

  for (const sep of candidates) {
    const count = headerLine.split(sep).length;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
}

/**
 * Parse a Brazilian decimal number (e.g. "1.234,56" -> 1234.56).
 * Also handles negative numbers like "-500,00".
 */
function parseBrazilianDecimal(value: string): number {
  // Remove thousand separators (dots) and replace comma decimal with dot
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}

/**
 * Auto-detect column indices by matching common header name patterns.
 */
function suggestMapping(headers: string[]): CsvColumnMapping {
  const mapping: CsvColumnMapping = { date: 0, amount: 1, description: 2 };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();

    if (/^(data|date|dt|data.+movimento)/.test(h)) {
      mapping.date = i;
    } else if (/^(valor|amount|value|montante|vl)/.test(h)) {
      mapping.amount = i;
    } else if (/^(descri|memo|histor|descr|observ|hist)/.test(h)) {
      mapping.description = i;
    } else if (/^(tipo|type|tp|operacao|op)/.test(h)) {
      mapping.type = i;
    }
  }

  return mapping;
}

/**
 * Parse a date string from Brazilian CSV formats.
 * Handles: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
 */
function parseCsvDate(value: string): Date {
  const clean = value.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(clean)) {
    const sep = clean.includes('/') ? '/' : '-';
    const parts = clean.split(sep);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Fallback
  return new Date(clean);
}

// ─── Public Functions ─────────────────────────────────────────────────

/**
 * Detect CSV columns from file content.
 * Returns headers, suggested mapping, and first 10 preview rows.
 */
export function detectCsvColumns(content: string): CsvDetectedColumns {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new ReconciliationError('Arquivo CSV vazio', 400);
  }

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator).map((h) => h.trim());
  const suggestedMapping = suggestMapping(headers);

  const previewRows = lines
    .slice(1, 11) // up to 10 data rows
    .map((line) => line.split(separator).map((c) => c.trim()));

  return { headers, suggestedMapping, previewRows };
}

/**
 * Parse CSV file content into ParsedStatementLine array.
 * Uses the confirmed column mapping.
 */
export function parseCsv(content: string, mapping: CsvColumnMapping): ParsedStatementLine[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const separator = detectSeparator(lines[0]);
  const dataLines = lines.slice(1); // skip header

  if (dataLines.length > MAX_LINES) {
    throw new ReconciliationError(`Arquivo excede o limite de ${MAX_LINES} linhas`, 400);
  }

  const result: ParsedStatementLine[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    const cols = line.split(separator).map((c) => c.trim());

    const dateStr = cols[mapping.date] ?? '';
    const amountStr = cols[mapping.amount] ?? '0';
    const memo = cols[mapping.description] ?? '';

    if (!dateStr) continue;

    const rawAmount = parseBrazilianDecimal(amountStr);
    const amount = Math.abs(rawAmount);
    let trnType: 'CREDIT' | 'DEBIT';

    // Determine type by explicit column or by sign of amount
    if (mapping.type !== undefined && cols[mapping.type]) {
      const typeVal = cols[mapping.type].toLowerCase().trim();
      trnType = /cred|entr|receb/.test(typeVal) ? 'CREDIT' : 'DEBIT';
    } else {
      trnType = rawAmount >= 0 ? 'CREDIT' : 'DEBIT';
    }

    result.push({
      trnType,
      amount,
      date: parseCsvDate(dateStr),
      memo,
    });
  }

  return result;
}
