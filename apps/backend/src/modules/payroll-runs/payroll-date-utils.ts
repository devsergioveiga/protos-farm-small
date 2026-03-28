// ─── Payroll Date Utilities ────────────────────────────────────────────
// Shared date helpers used by payroll-runs.service.ts and cp-preview logic.

/**
 * Returns the Nth business day (Mon–Fri, ignoring holidays for simplicity) of a given month.
 * Month is 1-based (January = 1).
 */
export function nthBusinessDay(year: number, month: number, n: number): Date {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) break;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      count++;
      if (count === n) return d;
    }
  }
  // Fallback: last day of month
  return new Date(Date.UTC(year, month - 1, 0));
}
