import Decimal from 'decimal.js';
import { Money } from '../types/money';
import type { IMoney } from '../types/money';

/**
 * Input for a single cost center allocation item.
 */
export interface CostCenterItemInput {
  costCenterId: string;
  farmId: string;
  allocMode: 'PERCENTAGE' | 'FIXED_VALUE';
  percentage?: number;
  fixedAmount?: number;
}

/**
 * A single generated installment.
 */
export interface Installment {
  number: number;
  amount: IMoney;
  dueDate: Date;
}

/**
 * generateInstallments — divides totalAmount into count installments.
 *
 * Cent residual (from Decimal rounding) is applied to the FIRST installment
 * per user decision. Sum of all installments always equals totalAmount exactly.
 *
 * @param totalAmount - Total amount to split
 * @param count - Number of installments (>= 1)
 * @param firstDueDate - Due date of the first installment (not mutated)
 * @param frequencyMonths - Months between installments (default: 1)
 */
export function generateInstallments(
  totalAmount: IMoney,
  count: number,
  firstDueDate: Date,
  frequencyMonths: number = 1,
): Installment[] {
  if (count < 1) {
    throw new Error('count must be >= 1');
  }

  // Use Decimal arithmetic to determine base amount (truncated to 2dp)
  const totalDecimal = totalAmount.toDecimal();
  const baseDecimal = totalDecimal.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const baseAmount = Money(baseDecimal);

  // residual = total - (base * count)
  const sumOfBase = baseAmount.multiply(count);
  const residual = totalAmount.subtract(sumOfBase);

  const installments: Installment[] = [];

  for (let i = 0; i < count; i++) {
    // Residual goes to FIRST installment (i === 0)
    const amount = i === 0 ? baseAmount.add(residual) : baseAmount;

    // Clone firstDueDate and advance by i * frequencyMonths
    // Use UTC methods to avoid timezone-shift issues
    const dueDate = new Date(firstDueDate);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + i * frequencyMonths);

    installments.push({
      number: i + 1,
      amount,
      dueDate,
    });
  }

  return installments;
}

/**
 * validateCostCenterItems — validates that cost center allocation items are internally consistent.
 *
 * Rules:
 * - Array must not be empty
 * - All items must use the same allocMode (no mixing)
 * - PERCENTAGE mode: sum of percentages must equal 100 (tolerance ±0.01)
 * - FIXED_VALUE mode: sum of fixedAmounts must equal totalAmount exactly
 *
 * @throws Error with a descriptive message on any validation failure
 */
export function validateCostCenterItems(totalAmount: IMoney, items: CostCenterItemInput[]): void {
  if (items.length === 0) {
    throw new Error('Rateio por centro de custo requer pelo menos um item.');
  }

  const firstMode = items[0].allocMode;
  const allSameMode = items.every((item) => item.allocMode === firstMode);
  if (!allSameMode) {
    throw new Error(
      'Todos os itens de rateio devem usar o mesmo modo de alocação (PERCENTAGE ou FIXED_VALUE).',
    );
  }

  if (firstMode === 'PERCENTAGE') {
    const sumPercent = items.reduce((acc, item) => acc + (item.percentage ?? 0), 0);
    if (Math.abs(sumPercent - 100) > 0.01) {
      throw new Error(`Rateio percentual deve somar 100%. Soma atual: ${sumPercent.toFixed(4)}%.`);
    }
  } else {
    // FIXED_VALUE
    const sumFixed = items.reduce((acc, item) => acc.add(Money(item.fixedAmount ?? 0)), Money(0));
    if (!sumFixed.equals(totalAmount)) {
      throw new Error(
        `Rateio em valor fixo deve somar exatamente o total (${totalAmount.toBRL()}). Soma atual: ${sumFixed.toBRL()}.`,
      );
    }
  }
}
