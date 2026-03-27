import { Money } from '../../types/money';

/**
 * UnbalancedEntryError — thrown when debit total does not equal credit total.
 */
export class UnbalancedEntryError extends Error {
  constructor(debitTotal: string, creditTotal: string) {
    super(
      `Lancamento nao balanceado: debitos=${debitTotal} creditos=${creditTotal} -- partidas dobradas exigem igualdade`,
    );
    this.name = 'UnbalancedEntryError';
    Object.setPrototypeOf(this, UnbalancedEntryError.prototype);
  }
}

/**
 * assertBalanced — validates that sum of debit lines equals sum of credit lines.
 *
 * Accepts number or string amounts (Prisma returns Decimal as string at runtime).
 *
 * @param lines - Array of ledger lines with side ('DEBIT'|'CREDIT') and amount
 * @throws UnbalancedEntryError when debits !== credits
 */
export function assertBalanced(
  lines: Array<{ side: 'DEBIT' | 'CREDIT'; amount: number | string }>,
): void {
  let debits = Money(0);
  let credits = Money(0);

  for (const line of lines) {
    if (line.side === 'DEBIT') {
      debits = debits.add(Money(line.amount));
    } else {
      credits = credits.add(Money(line.amount));
    }
  }

  if (!debits.equals(credits)) {
    throw new UnbalancedEntryError(debits.toDecimal().toFixed(2), credits.toDecimal().toFixed(2));
  }
}
