/**
 * PeriodNotOpenError — thrown when an accounting period is not open for posting.
 */
export class PeriodNotOpenError extends Error {
  readonly month: number;
  readonly year: number;
  readonly status: string;

  constructor(month: number, year: number, status: string) {
    super(`Periodo ${month}/${year} esta ${status} -- lancamentos nao permitidos`);
    this.name = 'PeriodNotOpenError';
    this.month = month;
    this.year = year;
    this.status = status;
    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, PeriodNotOpenError.prototype);
  }
}

/**
 * assertPeriodOpen — guard that throws if the period is not OPEN.
 *
 * @param period - Object with month, year, and status fields
 * @throws PeriodNotOpenError when status is not 'OPEN'
 */
export function assertPeriodOpen(period: { month: number; year: number; status: string }): void {
  if (period.status !== 'OPEN') {
    throw new PeriodNotOpenError(period.month, period.year, period.status);
  }
}
