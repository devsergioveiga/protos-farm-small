import Decimal from 'decimal.js';
import { computeDepreciation, daysInMonth, getProRataDays } from './depreciation-engine.service';

describe('Depreciation Engine', () => {
  describe('daysInMonth', () => {
    it('returns 29 for February 2024 (leap year)', () => {
      expect(daysInMonth(2024, 2)).toBe(29);
    });

    it('returns 28 for February 2025', () => {
      expect(daysInMonth(2025, 2)).toBe(28);
    });

    it('returns 31 for January', () => {
      expect(daysInMonth(2025, 1)).toBe(31);
    });

    it('returns 30 for April', () => {
      expect(daysInMonth(2025, 4)).toBe(30);
    });

    it('returns 31 for December', () => {
      expect(daysInMonth(2025, 12)).toBe(31);
    });
  });

  describe('getProRataDays', () => {
    it('returns full month days when no acquisition in period', () => {
      const result = getProRataDays(2025, 3, new Date('2024-06-15'), null);
      expect(result.days).toBe(31);
      expect(result.totalDays).toBe(31);
    });

    it('returns partial days for mid-month acquisition (Jan 15 = 17 days)', () => {
      // Jan has 31 days; acquisition on day 15 → days 15..31 = 17 days remaining
      const result = getProRataDays(2025, 1, new Date('2025-01-15'), null);
      expect(result.days).toBe(17);
      expect(result.totalDays).toBe(31);
    });

    it('returns partial days for disposal on day 10', () => {
      // Disposal on Jan 10 → days 1..10 = 10 days
      const result = getProRataDays(2025, 1, new Date('2024-06-01'), new Date('2025-01-10'));
      expect(result.days).toBe(10);
      expect(result.totalDays).toBe(31);
    });

    it('returns full month when acquisition is on the first day of the period', () => {
      const result = getProRataDays(2025, 3, new Date('2025-03-01'), null);
      expect(result.days).toBe(31);
      expect(result.totalDays).toBe(31);
    });

    it('returns 1 day when acquisition is on the last day of the period', () => {
      const result = getProRataDays(2025, 1, new Date('2025-01-31'), null);
      expect(result.days).toBe(1);
      expect(result.totalDays).toBe(31);
    });
  });

  describe('computeDepreciation', () => {
    describe('STRAIGHT_LINE with rate', () => {
      const baseInput = {
        acquisitionValue: new Decimal(120000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(120000),
        config: {
          method: 'STRAIGHT_LINE' as const,
          fiscalAnnualRate: new Decimal(0.1),
          track: 'FISCAL' as const,
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      };

      it('STRAIGHT_LINE with rate: 120000 value, 10% rate, full month = 1000.00', () => {
        const result = computeDepreciation(baseInput);
        expect(result.skipped).toBe(false);
        expect(result.depreciationAmount.toFixed(2)).toBe('1000.00');
        expect(result.closingBookValue.toFixed(2)).toBe('119000.00');
        expect(result.daysInMonth).toBe(31);
        expect(result.proRataDays).toBeNull();
      });
    });

    it('STRAIGHT_LINE with usefulLifeMonths: 60000 / 120 months = 500.00', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(60000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(60000),
        config: {
          method: 'STRAIGHT_LINE',
          usefulLifeMonths: 120,
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(false);
      expect(result.depreciationAmount.toFixed(2)).toBe('500.00');
      expect(result.closingBookValue.toFixed(2)).toBe('59500.00');
    });

    it('STRAIGHT_LINE pro-rata: Jan 15 acquisition, 17/31 days = 548.39', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(120000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(120000),
        config: {
          method: 'STRAIGHT_LINE',
          fiscalAnnualRate: new Decimal(0.1),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 1 },
        acquisitionDate: new Date('2025-01-15'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(false);
      // 120000 * 0.1 / 12 = 1000, pro-rata = 1000 * 17/31 ≈ 548.39
      expect(result.depreciationAmount.toFixed(2)).toBe('548.39');
      expect(result.proRataDays).toBe(17);
      expect(result.daysInMonth).toBe(31);
    });

    it('stops at residual: remaining 500, monthly would be 1000 = amount 500', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(120000),
        residualValue: new Decimal(1000),
        openingBookValue: new Decimal(1500),
        config: {
          method: 'STRAIGHT_LINE',
          fiscalAnnualRate: new Decimal(0.1),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(false);
      expect(result.depreciationAmount.toFixed(2)).toBe('500.00');
      expect(result.closingBookValue.toFixed(2)).toBe('1000.00');
    });

    it('fully depreciated: openingBookValue equals residualValue = skipped', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(120000),
        residualValue: new Decimal(5000),
        openingBookValue: new Decimal(5000),
        config: {
          method: 'STRAIGHT_LINE',
          fiscalAnnualRate: new Decimal(0.1),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toMatch(/residual/i);
    });

    it('ACCELERATED: 100000 book value, 10% rate, factor 2.0 = 1666.67', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(100000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(100000),
        config: {
          method: 'ACCELERATED',
          fiscalAnnualRate: new Decimal(0.1),
          accelerationFactor: new Decimal(2.0),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(false);
      // 100000 * 0.1 * 2.0 / 12 = 100000 * 0.2 / 12 = 1666.6666... → 1666.67
      expect(result.depreciationAmount.toFixed(2)).toBe('1666.67');
      expect(result.closingBookValue.toFixed(2)).toBe('98333.33');
    });

    it('HOURS_OF_USE without periodicHours = skipped', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(100000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(100000),
        config: {
          method: 'HOURS_OF_USE',
          totalHours: new Decimal(10000),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('periodicHours');
    });

    it('HOURS_OF_USE with periodicHours: 100000 / 10000h * 150h = 1500.00', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(100000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(100000),
        config: {
          method: 'HOURS_OF_USE',
          totalHours: new Decimal(10000),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
        periodicHours: new Decimal(150),
      });
      expect(result.skipped).toBe(false);
      expect(result.depreciationAmount.toFixed(2)).toBe('1500.00');
      expect(result.closingBookValue.toFixed(2)).toBe('98500.00');
    });

    it('UNITS_OF_PRODUCTION without periodicUnits = skipped', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(100000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(100000),
        config: {
          method: 'UNITS_OF_PRODUCTION',
          totalUnits: new Decimal(50000),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('periodicUnits');
    });

    it('UNITS_OF_PRODUCTION with periodicUnits: 100000 / 50000u * 1000u = 2000.00', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(100000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(100000),
        config: {
          method: 'UNITS_OF_PRODUCTION',
          totalUnits: new Decimal(50000),
          track: 'FISCAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
        periodicUnits: new Decimal(1000),
      });
      expect(result.skipped).toBe(false);
      expect(result.depreciationAmount.toFixed(2)).toBe('2000.00');
      expect(result.closingBookValue.toFixed(2)).toBe('98000.00');
    });

    it('uses managerialAnnualRate when track is MANAGERIAL', () => {
      const result = computeDepreciation({
        acquisitionValue: new Decimal(120000),
        residualValue: new Decimal(0),
        openingBookValue: new Decimal(120000),
        config: {
          method: 'STRAIGHT_LINE',
          fiscalAnnualRate: new Decimal(0.1),
          managerialAnnualRate: new Decimal(0.2),
          track: 'MANAGERIAL',
        },
        period: { year: 2025, month: 3 },
        acquisitionDate: new Date('2024-01-01'),
        disposalDate: null,
      });
      expect(result.skipped).toBe(false);
      // 120000 * 0.2 / 12 = 2000.00
      expect(result.depreciationAmount.toFixed(2)).toBe('2000.00');
    });
  });
});
