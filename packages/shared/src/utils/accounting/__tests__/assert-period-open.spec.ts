import { assertPeriodOpen, PeriodNotOpenError } from '../assert-period-open';

describe('assertPeriodOpen', () => {
  it('passes silently when status is OPEN', () => {
    expect(() => assertPeriodOpen({ month: 3, year: 2026, status: 'OPEN' })).not.toThrow();
  });

  it('throws PeriodNotOpenError when status is CLOSED', () => {
    expect(() => assertPeriodOpen({ month: 1, year: 2026, status: 'CLOSED' })).toThrow(
      PeriodNotOpenError,
    );
  });

  it('throws PeriodNotOpenError when status is BLOCKED', () => {
    expect(() => assertPeriodOpen({ month: 2, year: 2026, status: 'BLOCKED' })).toThrow(
      PeriodNotOpenError,
    );
  });

  it('error message includes month and year for CLOSED period', () => {
    let thrownError: unknown;
    try {
      assertPeriodOpen({ month: 5, year: 2025, status: 'CLOSED' });
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(PeriodNotOpenError);
    const err = thrownError as PeriodNotOpenError;
    expect(err.message).toContain('5/2025');
    expect(err.message).toContain('CLOSED');
  });

  it('error message includes Portuguese text for BLOCKED period', () => {
    let thrownError: unknown;
    try {
      assertPeriodOpen({ month: 12, year: 2024, status: 'BLOCKED' });
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(PeriodNotOpenError);
    const err = thrownError as PeriodNotOpenError;
    expect(err.message).toContain('Periodo');
    expect(err.message).toContain('12/2024');
  });

  it('PeriodNotOpenError exposes month, year, and status fields', () => {
    let thrownError: unknown;
    try {
      assertPeriodOpen({ month: 7, year: 2026, status: 'CLOSED' });
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(PeriodNotOpenError);
    const err = thrownError as PeriodNotOpenError;
    expect(err.month).toBe(7);
    expect(err.year).toBe(2026);
    expect(err.status).toBe('CLOSED');
  });
});
