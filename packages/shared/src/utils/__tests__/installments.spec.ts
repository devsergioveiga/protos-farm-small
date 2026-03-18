import { Money } from '../../types/money';
import {
  generateInstallments,
  validateCostCenterItems,
  type CostCenterItemInput,
} from '../installments';

describe('generateInstallments', () => {
  const baseDate = new Date('2025-01-01');

  it('divides R$1000 into 3 installments putting residual on first', () => {
    const result = generateInstallments(Money(1000), 3, baseDate);
    expect(result).toHaveLength(3);
    expect(result[0].amount.toNumber()).toBe(333.34);
    expect(result[1].amount.toNumber()).toBe(333.33);
    expect(result[2].amount.toNumber()).toBe(333.33);
  });

  it('sum of installments equals total amount exactly', () => {
    const total = Money(1000);
    const result = generateInstallments(total, 3, baseDate);
    const sum = result.reduce((acc, i) => acc.add(i.amount), Money(0));
    expect(sum.equals(total)).toBe(true);
  });

  it('single installment contains full amount', () => {
    const result = generateInstallments(Money(100), 1, baseDate);
    expect(result).toHaveLength(1);
    expect(result[0].amount.toNumber()).toBe(100);
    expect(result[0].number).toBe(1);
  });

  it('evenly divisible amounts have no residual', () => {
    const result = generateInstallments(Money(100), 4, baseDate);
    expect(result).toHaveLength(4);
    result.forEach((inst) => {
      expect(inst.amount.toNumber()).toBe(25.0);
    });
  });

  it('sum of evenly divisible installments is exact', () => {
    const total = Money(100);
    const result = generateInstallments(total, 4, baseDate);
    const sum = result.reduce((acc, i) => acc.add(i.amount), Money(0));
    expect(sum.equals(total)).toBe(true);
  });

  it('assigns sequential installment numbers starting at 1', () => {
    const result = generateInstallments(Money(300), 3, baseDate);
    expect(result[0].number).toBe(1);
    expect(result[1].number).toBe(2);
    expect(result[2].number).toBe(3);
  });

  it('increments due dates by 1 month by default', () => {
    const result = generateInstallments(Money(300), 3, baseDate);
    expect(result[0].dueDate.getUTCMonth()).toBe(0); // January
    expect(result[1].dueDate.getUTCMonth()).toBe(1); // February
    expect(result[2].dueDate.getUTCMonth()).toBe(2); // March
  });

  it('increments due dates by custom frequencyMonths', () => {
    const result = generateInstallments(Money(200), 2, baseDate, 3);
    expect(result[0].dueDate.getUTCMonth()).toBe(0); // January
    expect(result[1].dueDate.getUTCMonth()).toBe(3); // April
  });

  it('does not mutate the original firstDueDate', () => {
    const date = new Date('2025-06-15');
    const originalTime = date.getTime();
    generateInstallments(Money(200), 2, date);
    expect(date.getTime()).toBe(originalTime);
  });

  it('works with non-trivial residual amounts', () => {
    // R$10 / 3 = 3.33... => first gets 3.34, rest get 3.33
    const total = Money(10);
    const result = generateInstallments(total, 3, baseDate);
    const sum = result.reduce((acc, i) => acc.add(i.amount), Money(0));
    expect(sum.equals(total)).toBe(true);
    expect(result[0].amount.toNumber()).toBe(3.34);
    expect(result[1].amount.toNumber()).toBe(3.33);
    expect(result[2].amount.toNumber()).toBe(3.33);
  });
});

describe('validateCostCenterItems', () => {
  const totalAmount = Money(1000);

  it('passes when PERCENTAGE items sum to 100%', () => {
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 60,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 40,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).not.toThrow();
  });

  it('throws when PERCENTAGE items sum to less than 100%', () => {
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 60,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 39,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).toThrow();
  });

  it('throws when PERCENTAGE items sum to more than 100%', () => {
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 60,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 50,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).toThrow();
  });

  it('passes when FIXED_VALUE items sum equals totalAmount', () => {
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'FIXED_VALUE',
        fixedAmount: 600,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'FIXED_VALUE',
        fixedAmount: 400,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).not.toThrow();
  });

  it('throws when FIXED_VALUE items do not sum to totalAmount', () => {
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'FIXED_VALUE',
        fixedAmount: 600,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'FIXED_VALUE',
        fixedAmount: 300,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).toThrow();
  });

  it('throws when array is empty', () => {
    expect(() => validateCostCenterItems(totalAmount, [])).toThrow();
  });

  it('throws when items use mixed allocModes', () => {
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 60,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'FIXED_VALUE',
        fixedAmount: 400,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).toThrow();
  });

  it('passes with tolerance for PERCENTAGE within 0.01%', () => {
    // 99.99 + 0.01 = 100 with floating point near-match
    const items: CostCenterItemInput[] = [
      {
        costCenterId: 'cc-1',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 99.999,
      },
      {
        costCenterId: 'cc-2',
        farmId: 'farm-1',
        allocMode: 'PERCENTAGE',
        percentage: 0.001,
      },
    ];
    expect(() => validateCostCenterItems(totalAmount, items)).not.toThrow();
  });
});
