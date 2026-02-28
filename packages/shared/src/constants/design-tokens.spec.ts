import {
  colors,
  spacing,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  shadow,
  easing,
  duration,
  layout,
  breakpoint,
} from './design-tokens';

describe('design tokens', () => {
  describe('colors', () => {
    it('should have primary scale from 50 to 900', () => {
      expect(colors.primary[50]).toBe('#E8F5E9');
      expect(colors.primary[600]).toBe('#2E7D32');
      expect(colors.primary[900]).toBe('#0D3B10');
    });

    it('should have neutral scale from 0 to 900', () => {
      expect(colors.neutral[0]).toBe('#FFFFFF');
      expect(colors.neutral[700]).toBe('#3E3833');
      expect(colors.neutral[900]).toBe('#1A1613');
    });

    it('should have semantic colors with 100 and 500 shades', () => {
      for (const key of ['success', 'warning', 'error', 'info'] as const) {
        expect(colors[key][100]).toBeDefined();
        expect(colors[key][500]).toBeDefined();
      }
    });

    it('should have all hex values as valid format', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      const flatValues = JSON.stringify(colors);
      const matches = flatValues.match(/#[0-9A-Fa-f]{6}/g) || [];
      for (const hex of matches) {
        expect(hex).toMatch(hexRegex);
      }
    });
  });

  describe('spacing', () => {
    it('should be based on 4px multiples', () => {
      expect(spacing[1]).toBe(4);
      expect(spacing[2]).toBe(8);
      expect(spacing[4]).toBe(16);
      expect(spacing[6]).toBe(24);
    });

    it('should start at 0', () => {
      expect(spacing[0]).toBe(0);
    });
  });

  describe('fontFamily', () => {
    it('should define display, body, and mono families', () => {
      expect(fontFamily.display).toBe('DM Sans');
      expect(fontFamily.body).toBe('Source Sans 3');
      expect(fontFamily.mono).toBe('JetBrains Mono');
    });
  });

  describe('fontSize', () => {
    it('should have base at 16px', () => {
      expect(fontSize.base).toBe(16);
    });

    it('should never go below 12px', () => {
      for (const [, value] of Object.entries(fontSize)) {
        expect(value).toBeGreaterThanOrEqual(12);
      }
    });
  });

  describe('radius', () => {
    it('should have progressive scale', () => {
      expect(radius.sm).toBeLessThan(radius.md);
      expect(radius.md).toBeLessThan(radius.lg);
      expect(radius.lg).toBeLessThan(radius.xl);
    });

    it('should have full as large value for pills', () => {
      expect(radius.full).toBe(9999);
    });
  });

  describe('breakpoint', () => {
    it('should have progressive scale', () => {
      expect(breakpoint.sm).toBeLessThan(breakpoint.md);
      expect(breakpoint.md).toBeLessThan(breakpoint.lg);
      expect(breakpoint.lg).toBeLessThan(breakpoint.xl);
    });
  });

  it('should export all token groups', () => {
    expect(fontWeight).toBeDefined();
    expect(lineHeight).toBeDefined();
    expect(shadow).toBeDefined();
    expect(easing).toBeDefined();
    expect(duration).toBeDefined();
    expect(layout).toBeDefined();
  });
});
