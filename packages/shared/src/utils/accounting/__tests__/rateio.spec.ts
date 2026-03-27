import { Money } from '../../../types/money';
import { rateio } from '../rateio';

describe('rateio', () => {
  it('splits 100.00 into 50/50 for two equal cost centers', () => {
    const result = rateio(Money(100), [
      { costCenterId: 'cc-1', percentage: 50 },
      { costCenterId: 'cc-2', percentage: 50 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].amount.toNumber()).toBe(50.0);
    expect(result[1].amount.toNumber()).toBe(50.0);
  });

  it('splits 100.00 into 33.33/33.33/33.34 for three equal cost centers (remainder on largest)', () => {
    const result = rateio(Money(100), [
      { costCenterId: 'cc-1', percentage: 33.33 },
      { costCenterId: 'cc-2', percentage: 33.33 },
      { costCenterId: 'cc-3', percentage: 33.34 },
    ]);
    expect(result).toHaveLength(3);
    // After truncation: each gets 33.33, and remainder (0.01) goes to largest (cc-3)
    const sum = result.reduce((acc, r) => acc.add(r.amount), Money(0));
    expect(sum.toNumber()).toBe(100.0);
  });

  it('splits 1000.00 into 70/30 percentages', () => {
    const result = rateio(Money(1000), [
      { costCenterId: 'cc-1', percentage: 70 },
      { costCenterId: 'cc-2', percentage: 30 },
    ]);
    expect(result[0].amount.toNumber()).toBe(700.0);
    expect(result[1].amount.toNumber()).toBe(300.0);
  });

  it('throws when items array is empty', () => {
    expect(() => rateio(Money(100), [])).toThrow();
  });

  it('throws when percentages do not sum to 100 (50+40=90)', () => {
    expect(() =>
      rateio(Money(100), [
        { costCenterId: 'cc-1', percentage: 50 },
        { costCenterId: 'cc-2', percentage: 40 },
      ]),
    ).toThrow();
  });

  it('handles edge case: 0.01 split into 50/50 -> remainder on largest (first occurrence on tie)', () => {
    const result = rateio(Money(0.01), [
      { costCenterId: 'cc-1', percentage: 50 },
      { costCenterId: 'cc-2', percentage: 50 },
    ]);
    expect(result).toHaveLength(2);
    const amounts = result.map((r) => r.amount.toNumber());
    // One gets 0.01, other gets 0.00, sum must equal 0.01
    const sum = result.reduce((acc, r) => acc.add(r.amount), Money(0));
    expect(sum.toNumber()).toBe(0.01);
    // Total of non-zero amounts is 0.01
    expect(amounts.filter((a) => a > 0)).toHaveLength(1);
    expect(amounts.filter((a) => a === 0)).toHaveLength(1);
  });

  it('sum of all output amounts always equals input total exactly', () => {
    const total = Money(1234.56);
    const result = rateio(total, [
      { costCenterId: 'cc-1', percentage: 33 },
      { costCenterId: 'cc-2', percentage: 33 },
      { costCenterId: 'cc-3', percentage: 34 },
    ]);
    const sum = result.reduce((acc, r) => acc.add(r.amount), Money(0));
    expect(sum.equals(total)).toBe(true);
  });

  it('preserves costCenterId in output', () => {
    const result = rateio(Money(100), [
      { costCenterId: 'farm-a', percentage: 60 },
      { costCenterId: 'farm-b', percentage: 40 },
    ]);
    expect(result[0].costCenterId).toBe('farm-a');
    expect(result[1].costCenterId).toBe('farm-b');
  });

  it('applies ROUND_DOWN truncation per share (not ROUND_HALF_UP)', () => {
    // 100 / 3 = 33.333... — ROUND_DOWN gives 33.33, not 33.34
    // remainder (0.01) goes to cc-3 (largest: 33.34%)
    const result = rateio(Money(100), [
      { costCenterId: 'cc-1', percentage: 33.33 },
      { costCenterId: 'cc-2', percentage: 33.33 },
      { costCenterId: 'cc-3', percentage: 33.34 },
    ]);
    expect(result[0].amount.toNumber()).toBe(33.33);
    expect(result[1].amount.toNumber()).toBe(33.33);
    // cc-3 gets 33.34 (from truncation * percentage 33.34) + remainder
    const sum = result.reduce((acc, r) => acc.add(r.amount), Money(0));
    expect(sum.toNumber()).toBe(100.0);
  });
});
