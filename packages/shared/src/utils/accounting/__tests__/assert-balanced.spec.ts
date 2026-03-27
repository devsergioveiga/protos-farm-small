import { assertBalanced, UnbalancedEntryError } from '../assert-balanced';

describe('assertBalanced', () => {
  it('passes when single debit line equals single credit line', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: 100 },
        { side: 'CREDIT', amount: 100 },
      ]),
    ).not.toThrow();
  });

  it('passes when multiple debit lines sum equals multiple credit lines sum', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: 60 },
        { side: 'DEBIT', amount: 40 },
        { side: 'CREDIT', amount: 75 },
        { side: 'CREDIT', amount: 25 },
      ]),
    ).not.toThrow();
  });

  it('throws UnbalancedEntryError when debits > credits', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: 200 },
        { side: 'CREDIT', amount: 100 },
      ]),
    ).toThrow(UnbalancedEntryError);
  });

  it('throws UnbalancedEntryError when credits > debits', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: 100 },
        { side: 'CREDIT', amount: 200 },
      ]),
    ).toThrow(UnbalancedEntryError);
  });

  it('handles string amounts (from Prisma Decimal fields)', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: '500.00' },
        { side: 'CREDIT', amount: '500.00' },
      ]),
    ).not.toThrow();
  });

  it('handles zero-amount entries (all zeros passes)', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: 0 },
        { side: 'CREDIT', amount: 0 },
      ]),
    ).not.toThrow();
  });

  it('throws with descriptive error message showing debit and credit totals', () => {
    let thrownError: unknown;
    try {
      assertBalanced([
        { side: 'DEBIT', amount: 300 },
        { side: 'CREDIT', amount: 100 },
      ]);
    } catch (e) {
      thrownError = e;
    }
    expect(thrownError).toBeInstanceOf(UnbalancedEntryError);
    const err = thrownError as UnbalancedEntryError;
    expect(err.message).toBeTruthy();
  });

  it('handles mixed string and number amounts', () => {
    expect(() =>
      assertBalanced([
        { side: 'DEBIT', amount: '100.50' },
        { side: 'DEBIT', amount: 49.50 },
        { side: 'CREDIT', amount: 150 },
      ]),
    ).not.toThrow();
  });
});
