import Decimal from 'decimal.js';

// Configure rounding globally — ROUND_HALF_UP is the Brazilian banking standard
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/**
 * IMoney — interface for the Money value object.
 */
export interface IMoney {
  add(other: IMoney): IMoney;
  subtract(other: IMoney): IMoney;
  multiply(factor: number | string): IMoney;
  divide(divisor: number | string): IMoney;
  toDecimal(): Decimal;
  toNumber(): number;
  toBRL(): string;
  isZero(): boolean;
  isNegative(): boolean;
  isPositive(): boolean;
  equals(other: IMoney): boolean;
  greaterThan(other: IMoney): boolean;
  lessThan(other: IMoney): boolean;
}

/**
 * MoneyImpl — internal implementation class.
 */
class MoneyImpl implements IMoney {
  readonly _value: Decimal;

  constructor(value: number | string | Decimal) {
    this._value = new Decimal(value);
  }

  add(other: IMoney): MoneyImpl {
    return new MoneyImpl(this._value.plus((other as MoneyImpl)._value));
  }

  subtract(other: IMoney): MoneyImpl {
    return new MoneyImpl(this._value.minus((other as MoneyImpl)._value));
  }

  multiply(factor: number | string): MoneyImpl {
    return new MoneyImpl(this._value.times(factor));
  }

  divide(divisor: number | string): MoneyImpl {
    return new MoneyImpl(this._value.dividedBy(divisor));
  }

  /** Returns Decimal rounded to 2dp (ROUND_HALF_UP). Use for storage/display. */
  toDecimal(): Decimal {
    return this._value.toDecimalPlaces(2);
  }

  /** Serialization only — use at API boundaries, not for intermediate calculations. */
  toNumber(): number {
    return this.toDecimal().toNumber();
  }

  /** Formats as BRL currency string using Intl.NumberFormat. */
  toBRL(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toNumber());
  }

  isZero(): boolean {
    return this.toDecimal().isZero();
  }

  isNegative(): boolean {
    return this.toDecimal().isNegative();
  }

  isPositive(): boolean {
    return this.toDecimal().isPositive() && !this.toDecimal().isZero();
  }

  equals(other: IMoney): boolean {
    return this.toDecimal().equals((other as MoneyImpl).toDecimal());
  }

  greaterThan(other: IMoney): boolean {
    return this.toDecimal().greaterThan((other as MoneyImpl).toDecimal());
  }

  lessThan(other: IMoney): boolean {
    return this.toDecimal().lessThan((other as MoneyImpl).toDecimal());
  }
}

// ---------------------------------------------------------------------------
// Public Money factory + static methods
// ---------------------------------------------------------------------------

/** Money factory — call as `Money(100)` or `new Money(100)` */
export interface MoneyFactory {
  (value: number | string | Decimal): IMoney;
  new (value: number | string | Decimal): IMoney;
  fromPrismaDecimal(value: unknown): IMoney;
  zero(): IMoney;
}

function moneyFactory(value: number | string | Decimal): IMoney {
  return new MoneyImpl(value);
}

moneyFactory.fromPrismaDecimal = function (value: unknown): IMoney {
  return new MoneyImpl(new Decimal(String(value ?? '0')));
};

moneyFactory.zero = function (): IMoney {
  return new MoneyImpl(0);
};

/**
 * Money — type-safe monetary arithmetic backed by decimal.js.
 *
 * Usage:
 *   Money(0.1).add(Money(0.2)).toNumber() // 0.3
 *   Money.fromPrismaDecimal(prismaDecimal).toBRL() // 'R$ 1,00'
 *   Money.zero() // Money(0)
 */
export const Money = moneyFactory as unknown as MoneyFactory;
