/**
 * US-098 — Conversão em comercialização e produção
 * Tests for the conversion service (CA1-CA3, CA5)
 */

import { convertHarvestUnit } from './harvest-commercial-conversion.service';
import { HarvestConversionError } from './harvest-commercial-conversion.types';

describe('harvest-commercial-conversion service', () => {
  // ─── CA5: convertHarvestUnit ──────────────────────────────────

  describe('convertHarvestUnit', () => {
    // ── Identity ──
    it('returns same quantity for same unit', () => {
      const result = convertHarvestUnit({
        harvestType: 'GRAIN',
        quantity: 1000,
        fromUnit: 'kg',
        toUnit: 'kg',
      });
      expect(result.convertedQuantity).toBe(1000);
      expect(result.conversionFactor).toBe(1);
    });

    // ── CA1: Grain conversions ──
    describe('grain conversions', () => {
      it('converts kg to sacas (60 kg)', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 6000,
          fromUnit: 'kg',
          toUnit: 'sc',
        });
        expect(result.convertedQuantity).toBe(100);
        expect(result.targetUnit).toBe('sc');
        expect(result.formula).toContain('6000 kg = 100 sc');
      });

      it('converts kg to arrobas (15 kg)', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 6000,
          fromUnit: 'kg',
          toUnit: '@',
        });
        expect(result.convertedQuantity).toBe(400);
      });

      it('converts kg to toneladas', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 6000,
          fromUnit: 'kg',
          toUnit: 't',
        });
        expect(result.convertedQuantity).toBe(6);
      });

      it('converts sacas to kg', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 100,
          fromUnit: 'sc',
          toUnit: 'kg',
        });
        expect(result.convertedQuantity).toBe(6000);
      });

      it('converts sacas to arrobas', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 10,
          fromUnit: 'sc',
          toUnit: '@',
        });
        // 10 sc × 60 kg = 600 kg / 15 = 40 @
        expect(result.convertedQuantity).toBe(40);
      });

      it('converts sacas to toneladas', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 100,
          fromUnit: 'sc',
          toUnit: 't',
        });
        expect(result.convertedQuantity).toBe(6);
      });
    });

    // ── CA2: Coffee conversions ──
    describe('coffee conversions', () => {
      it('converts liters to sacas using default yield (480 L/sc)', () => {
        const result = convertHarvestUnit({
          harvestType: 'COFFEE',
          quantity: 4800,
          fromUnit: 'L',
          toUnit: 'sc',
        });
        expect(result.convertedQuantity).toBe(10);
      });

      it('converts liters to sacas using custom yield', () => {
        const result = convertHarvestUnit({
          harvestType: 'COFFEE',
          quantity: 3000,
          fromUnit: 'L',
          toUnit: 'sc',
          yieldLitersPerSac: 500,
        });
        expect(result.convertedQuantity).toBe(6);
      });

      it('converts liters to kg via sacas', () => {
        const result = convertHarvestUnit({
          harvestType: 'COFFEE',
          quantity: 4800,
          fromUnit: 'L',
          toUnit: 'kg',
        });
        // 4800 L / 480 = 10 sc × 60 = 600 kg
        expect(result.convertedQuantity).toBe(600);
      });

      it('converts liters to arrobas', () => {
        const result = convertHarvestUnit({
          harvestType: 'COFFEE',
          quantity: 4800,
          fromUnit: 'L',
          toUnit: '@',
        });
        // 4800 / 480 = 10 sc × 60 = 600 kg / 15 = 40 @
        expect(result.convertedQuantity).toBe(40);
      });

      it('converts sacas to liters (reverse)', () => {
        const result = convertHarvestUnit({
          harvestType: 'COFFEE',
          quantity: 10,
          fromUnit: 'sc',
          toUnit: 'L',
        });
        // 10 sc → 600 kg → 600/60 = 10 sc → 10 × 480 = 4800 L
        expect(result.convertedQuantity).toBe(4800);
      });
    });

    // ── CA3: Orange conversions ──
    describe('orange conversions', () => {
      it('converts caixas to kg', () => {
        const result = convertHarvestUnit({
          harvestType: 'ORANGE',
          quantity: 100,
          fromUnit: 'cx',
          toUnit: 'kg',
        });
        expect(result.convertedQuantity).toBe(4080);
      });

      it('converts caixas to toneladas', () => {
        const result = convertHarvestUnit({
          harvestType: 'ORANGE',
          quantity: 100,
          fromUnit: 'cx',
          toUnit: 't',
        });
        expect(result.convertedQuantity).toBe(4.08);
      });

      it('converts toneladas to caixas', () => {
        const result = convertHarvestUnit({
          harvestType: 'ORANGE',
          quantity: 4.08,
          fromUnit: 't',
          toUnit: 'cx',
        });
        expect(result.convertedQuantity).toBe(100);
      });
    });

    // ── Validation ──
    describe('validation', () => {
      it('rejects invalid harvest type', () => {
        expect(() =>
          convertHarvestUnit({
            harvestType: 'INVALID',
            quantity: 100,
            fromUnit: 'kg',
            toUnit: 'sc',
          }),
        ).toThrow(HarvestConversionError);
      });

      it('rejects negative quantity', () => {
        expect(() =>
          convertHarvestUnit({
            harvestType: 'GRAIN',
            quantity: -1,
            fromUnit: 'kg',
            toUnit: 'sc',
          }),
        ).toThrow(HarvestConversionError);
      });

      it('rejects missing fromUnit', () => {
        expect(() =>
          convertHarvestUnit({
            harvestType: 'GRAIN',
            quantity: 100,
            fromUnit: '',
            toUnit: 'sc',
          }),
        ).toThrow(HarvestConversionError);
      });

      it('rejects missing toUnit', () => {
        expect(() =>
          convertHarvestUnit({
            harvestType: 'GRAIN',
            quantity: 100,
            fromUnit: 'kg',
            toUnit: '',
          }),
        ).toThrow(HarvestConversionError);
      });

      it('handles zero quantity', () => {
        const result = convertHarvestUnit({
          harvestType: 'GRAIN',
          quantity: 0,
          fromUnit: 'kg',
          toUnit: 'sc',
        });
        expect(result.convertedQuantity).toBe(0);
        expect(result.conversionFactor).toBe(0);
      });
    });
  });

  // ─── CA1: Grain commercial units ─────────────────────────────
  describe('grain commercial units helper', () => {
    it('provides all conversions from corrected production', () => {
      // Test via convertHarvestUnit as a proxy
      const result = convertHarvestUnit({
        harvestType: 'GRAIN',
        quantity: 60000,
        fromUnit: 'kg',
        toUnit: 'sc',
      });
      expect(result.convertedQuantity).toBe(1000);

      const tResult = convertHarvestUnit({
        harvestType: 'GRAIN',
        quantity: 60000,
        fromUnit: 'kg',
        toUnit: 't',
      });
      expect(tResult.convertedQuantity).toBe(60);

      const arrobaResult = convertHarvestUnit({
        harvestType: 'GRAIN',
        quantity: 60000,
        fromUnit: 'kg',
        toUnit: '@',
      });
      expect(arrobaResult.convertedQuantity).toBe(4000);
    });
  });
});
