import { doseToAbsoluteQuantity } from './stock-deduction';

describe('stock-deduction helpers', () => {
  describe('doseToAbsoluteQuantity', () => {
    it('should convert L_HA correctly', () => {
      expect(doseToAbsoluteQuantity(2.5, 'L_HA', 10)).toBe(25);
    });

    it('should convert KG_HA correctly', () => {
      expect(doseToAbsoluteQuantity(150, 'KG_HA', 5)).toBe(750);
    });

    it('should convert ML_HA to L', () => {
      // 500 mL/ha × 10 ha = 5000 mL = 5 L
      expect(doseToAbsoluteQuantity(500, 'ML_HA', 10)).toBe(5);
    });

    it('should convert G_HA to kg', () => {
      // 200 g/ha × 10 ha = 2000 g = 2 kg
      expect(doseToAbsoluteQuantity(200, 'G_HA', 10)).toBe(2);
    });

    it('should convert T_HA to kg', () => {
      // 2 t/ha × 5 ha = 10000 kg
      expect(doseToAbsoluteQuantity(2, 'T_HA', 5)).toBe(10000);
    });

    it('should convert G_PLANTA with plantsPerHa', () => {
      // 5 g/planta × 3000 plantas/ha × 10 ha = 150000 g = 150 kg
      expect(doseToAbsoluteQuantity(5, 'G_PLANTA', 10, 3000)).toBe(150);
    });

    it('should convert G_PLANTA without plantsPerHa (single plant fallback)', () => {
      // 5 g / 1000 = 0.005 kg
      expect(doseToAbsoluteQuantity(5, 'G_PLANTA', 10)).toBe(0.005);
    });

    it('should use default fallback for unknown units', () => {
      expect(doseToAbsoluteQuantity(3, 'UNKNOWN', 10)).toBe(30);
    });

    it('should handle zero area', () => {
      expect(doseToAbsoluteQuantity(2.5, 'L_HA', 0)).toBe(0);
    });

    it('should handle zero dose', () => {
      expect(doseToAbsoluteQuantity(0, 'KG_HA', 10)).toBe(0);
    });
  });
});
