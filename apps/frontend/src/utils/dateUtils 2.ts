/**
 * Converts an ISO datetime string from the API to a YYYY-MM-DD value
 * suitable for <input type="date">.
 *
 * Uses UTC components to avoid timezone-induced day shifts.
 * e.g. "2009-09-24T00:00:00.000Z" in UTC-3 would become Sep 23 locally,
 * but this function correctly returns "2009-09-24".
 */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
