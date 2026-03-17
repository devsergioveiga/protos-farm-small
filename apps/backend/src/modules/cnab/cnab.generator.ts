// ─── CNAB Generator Utilities ─────────────────────────────────────────────
//
// Shared fixed-width formatting helpers used by both BB and Sicoob adapters.
// CNAB files use fixed-width positional records — every field must be exact length.

/**
 * Left-pad value with a character to reach the specified length.
 * Truncates if value is longer than length.
 * Default pad char is '0' (for numeric fields).
 */
export function padLeft(value: string | number, length: number, char = '0'): string {
  const str = String(value);
  if (str.length >= length) return str.slice(-length); // truncate from left if too long
  return str.padStart(length, char);
}

/**
 * Right-pad value with spaces to reach the specified length.
 * Truncates if value is longer than length.
 */
export function padRight(value: string | number, length: number): string {
  const str = String(value);
  if (str.length >= length) return str.slice(0, length); // truncate from right if too long
  return str.padEnd(length, ' ');
}

/**
 * Format a Date to a fixed string format.
 * Supported formats: 'DDMMYYYY', 'DDMMAA', 'YYYYMMDD'
 */
export function formatDate(
  date: Date,
  format: 'DDMMYYYY' | 'DDMMAA' | 'YYYYMMDD' = 'DDMMYYYY',
): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getUTCFullYear());
  const yy = yyyy.slice(2);

  switch (format) {
    case 'DDMMYYYY':
      return `${d}${m}${yyyy}`;
    case 'DDMMAA':
      return `${d}${m}${yy}`;
    case 'YYYYMMDD':
      return `${yyyy}${m}${d}`;
    default:
      return `${d}${m}${yyyy}`;
  }
}

/**
 * Format a monetary amount (in BRL) to centavos zero-padded to the given length.
 * e.g. formatAmount(1234.56, 13) => '0000000123456'
 */
export function formatAmount(amountBRL: number, length: number): string {
  // Convert to centavos: multiply by 100, round, convert to string
  const centavos = Math.round(amountBRL * 100);
  return padLeft(String(centavos), length, '0');
}

/**
 * Strip all non-digit characters from a string.
 * Useful for cleaning CPF/CNPJ values.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Build a fixed-width line by concatenating an array of [value, width] tuples.
 * Each field is right-padded with spaces (alpha) or left-padded with zeros (numeric).
 * Use padLeft/padRight before passing if custom padding is needed.
 */
export function buildLine(fields: string[]): string {
  return fields.join('');
}

/**
 * Fill a segment with spaces for the given length (branco/reservado fields).
 */
export function blanks(length: number): string {
  return ' '.repeat(length);
}

/**
 * Fill a segment with zeros for the given length.
 */
export function zeros(length: number): string {
  return '0'.repeat(length);
}
