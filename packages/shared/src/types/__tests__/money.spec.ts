import { Money } from '../money';

describe('Money', () => {
  describe('arithmetic — float safety', () => {
    it('0.1 + 0.2 === 0.3', () => {
      expect(Money(0.1).add(Money(0.2)).toNumber()).toBe(0.3);
    });

    it('100 - 33.33 * 3 === 0.01 (remainder)', () => {
      expect(Money(100).subtract(Money(33.33).multiply(3)).toNumber()).toBe(0.01);
    });

    it('1000 * 0.023 === 23 (percentage rate)', () => {
      expect(Money(1000).multiply('0.023').toNumber()).toBe(23);
    });

    it('handles division correctly', () => {
      expect(Money(100).divide(3).toNumber()).toBe(33.33);
    });
  });

  describe('Money.fromPrismaDecimal', () => {
    it('converts Prisma Decimal string to Money with ROUND_HALF_UP to 2dp', () => {
      expect(Money.fromPrismaDecimal('99.995').toNumber()).toBe(100);
    });

    it('handles null/undefined as zero', () => {
      expect(Money.fromPrismaDecimal(null).toNumber()).toBe(0);
      expect(Money.fromPrismaDecimal(undefined).toNumber()).toBe(0);
    });
  });

  describe('toBRL', () => {
    it('formats 1234.56 as R$ 1.234,56', () => {
      expect(Money(1234.56).toBRL()).toBe('R$\u00a01.234,56');
    });

    it('formats 0 as R$ 0,00', () => {
      expect(Money(0).toBRL()).toBe('R$\u00a00,00');
    });
  });

  describe('negative values', () => {
    it('preserves negative toNumber', () => {
      expect(Money(-500.1).toNumber()).toBe(-500.1);
    });
  });

  describe('comparison helpers', () => {
    it('isZero', () => {
      expect(Money(0).isZero()).toBe(true);
      expect(Money(1).isZero()).toBe(false);
    });

    it('isNegative', () => {
      expect(Money(-1).isNegative()).toBe(true);
      expect(Money(0).isNegative()).toBe(false);
    });

    it('isPositive', () => {
      expect(Money(1).isPositive()).toBe(true);
      expect(Money(0).isPositive()).toBe(false);
    });

    it('equals', () => {
      expect(Money(1.5).equals(Money(1.5))).toBe(true);
      expect(Money(1).equals(Money(2))).toBe(false);
    });

    it('greaterThan', () => {
      expect(Money(2).greaterThan(Money(1))).toBe(true);
      expect(Money(1).greaterThan(Money(2))).toBe(false);
    });

    it('lessThan', () => {
      expect(Money(1).lessThan(Money(2))).toBe(true);
      expect(Money(2).lessThan(Money(1))).toBe(false);
    });
  });

  describe('static helpers', () => {
    it('Money.zero() returns Money(0)', () => {
      expect(Money.zero().toNumber()).toBe(0);
    });

    it('Money factory function works without new', () => {
      expect(Money(5).add(Money(3)).toNumber()).toBe(8);
    });
  });

  describe('immutability', () => {
    it('arithmetic returns new instance', () => {
      const a = Money(10);
      const b = a.add(Money(5));
      expect(a.toNumber()).toBe(10);
      expect(b.toNumber()).toBe(15);
    });
  });
});
