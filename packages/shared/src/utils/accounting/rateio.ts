import Decimal from 'decimal.js';
import { Money } from '../../types/money';
import type { IMoney } from '../../types/money';

/**
 * RateioInput — a single cost center allocation input.
 */
export interface RateioInput {
  costCenterId: string;
  percentage: number;
}

/**
 * RateioOutput — a single cost center allocation result.
 */
export interface RateioOutput {
  costCenterId: string;
  amount: IMoney;
}

/**
 * rateio — splits a total amount proportionally across cost centers.
 *
 * Algorithm:
 * 1. Truncate each share to 2dp using ROUND_DOWN (avoids over-distribution)
 * 2. Compute remainder = total - sum(truncated shares)
 * 3. Add remainder to the share with the largest percentage (first occurrence on tie)
 *
 * This guarantees: sum(output.amount) === total exactly.
 *
 * @param total - Total amount to split (IMoney)
 * @param items - Array of cost center allocations with percentage fields
 * @throws Error when items array is empty
 * @throws Error when percentages do not sum to 100 (tolerance ±0.01)
 */
export function rateio(total: IMoney, items: RateioInput[]): RateioOutput[] {
  if (items.length === 0) {
    throw new Error('Rateio requer pelo menos um item de centro de custo.');
  }

  const percentageSum = items.reduce((acc, item) => acc + item.percentage, 0);
  if (Math.abs(percentageSum - 100) > 0.01) {
    throw new Error(
      `Percentuais do rateio devem somar 100%. Soma atual: ${percentageSum.toFixed(4)}%.`,
    );
  }

  const totalDecimal = total.toDecimal();

  // Step 1: compute truncated shares
  const shares: Decimal[] = items.map((item) =>
    totalDecimal.times(item.percentage).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_DOWN),
  );

  // Step 2: compute remainder = total - sum(shares)
  const sumShares = shares.reduce((acc, s) => acc.plus(s), new Decimal(0));
  const remainder = totalDecimal.minus(sumShares).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  // Step 3: find index of item with largest percentage (first occurrence on tie)
  let largestIdx = 0;
  for (let i = 1; i < items.length; i++) {
    if (items[i].percentage > items[largestIdx].percentage) {
      largestIdx = i;
    }
  }

  // Apply remainder to largest share
  if (!remainder.isZero()) {
    shares[largestIdx] = shares[largestIdx].plus(remainder);
  }

  return items.map((item, idx) => ({
    costCenterId: item.costCenterId,
    amount: Money(shares[idx]),
  }));
}
