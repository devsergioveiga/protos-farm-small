// ─── CNAB Parser Utilities ────────────────────────────────────────────────
//
// Shared utilities for parsing CNAB retorno files.
// CNAB uses 1-based position references in manuals but JavaScript strings are 0-based.

/**
 * Extract a field from a CNAB line using 1-based start/end positions (as in bank manuals).
 * Returns the raw string with leading/trailing whitespace preserved.
 */
export function sliceField(line: string, start: number, end: number): string {
  // Convert from 1-based (CNAB manual) to 0-based (JS string)
  return line.substring(start - 1, end);
}

/**
 * Extract and trim a field from a CNAB line using 1-based positions.
 */
export function sliceFieldTrimmed(line: string, start: number, end: number): string {
  return sliceField(line, start, end).trim();
}

/**
 * Parse a CNAB date string to a Date object.
 * Supported formats: 'DDMMYYYY', 'DDMMAA', 'YYYYMMDD'
 */
export function parseDateFromCnab(
  str: string,
  format: 'DDMMYYYY' | 'DDMMAA' | 'YYYYMMDD' = 'DDMMYYYY',
): Date | undefined {
  if (!str || str.trim() === '' || str === '00000000' || str === '000000') {
    return undefined;
  }

  let day: number, month: number, year: number;

  switch (format) {
    case 'DDMMYYYY':
      day = parseInt(str.slice(0, 2), 10);
      month = parseInt(str.slice(2, 4), 10) - 1; // 0-indexed
      year = parseInt(str.slice(4, 8), 10);
      break;
    case 'DDMMAA':
      day = parseInt(str.slice(0, 2), 10);
      month = parseInt(str.slice(2, 4), 10) - 1;
      year = 2000 + parseInt(str.slice(4, 6), 10);
      break;
    case 'YYYYMMDD':
      year = parseInt(str.slice(0, 4), 10);
      month = parseInt(str.slice(4, 6), 10) - 1;
      day = parseInt(str.slice(6, 8), 10);
      break;
    default:
      return undefined;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return undefined;
  return new Date(Date.UTC(year, month, day));
}

/**
 * Parse a CNAB amount string (centavos, zero-padded) to a BRL number.
 * e.g. '0000000123456' => 1234.56
 */
export function parseAmountFromCnab(str: string): number {
  const trimmed = str.trim();
  if (!trimmed || trimmed === '' || /^0+$/.test(trimmed)) return 0;
  const centavos = parseInt(trimmed, 10);
  if (isNaN(centavos)) return 0;
  return centavos / 100;
}

/**
 * Detect the CNAB format of a file based on line length.
 * Returns '240' for CNAB 240, '400' for CNAB 400, or 'unknown'.
 */
export function detectFormat(content: string): '240' | '400' | 'unknown' {
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return 'unknown';

  const firstLineLength = lines[0].length;
  if (firstLineLength === 240) return '240';
  if (firstLineLength === 400) return '400';

  // Check majority of lines
  const linesWith240 = lines.filter((l) => l.length === 240).length;
  const linesWith400 = lines.filter((l) => l.length === 400).length;

  if (linesWith240 > linesWith400) return '240';
  if (linesWith400 > linesWith240) return '400';

  return 'unknown';
}
