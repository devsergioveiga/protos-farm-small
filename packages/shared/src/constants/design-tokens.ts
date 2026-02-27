/**
 * Design Tokens — Protos Farm
 *
 * Fonte única de verdade para cores, espaçamento, tipografia e demais tokens visuais.
 * Consumido pelo frontend (CSS vars / Tailwind) e mobile (StyleSheet).
 *
 * @see docs/design-system/ para documentação completa
 */

// ─── Cores ───────────────────────────────────────────────────────────────────

export const colors = {
  primary: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#388E3C',
    600: '#2E7D32',
    700: '#1B5E20',
    800: '#145218',
    900: '#0D3B10',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAF8',
    100: '#F5F3EF',
    200: '#E8E4DD',
    300: '#D4CEC4',
    400: '#A8A196',
    500: '#7A7267',
    600: '#5C554C',
    700: '#3E3833',
    800: '#2A2520',
    900: '#1A1613',
  },
  sky: {
    100: '#B3E5FC',
    500: '#0288D1',
  },
  earth: {
    100: '#D7CCC8',
    500: '#8D6E63',
  },
  sun: {
    100: '#FFF9C4',
    500: '#F9A825',
  },
  success: {
    100: '#E8F5E9',
    500: '#2E7D32',
  },
  warning: {
    100: '#FFF8E1',
    500: '#F57F17',
  },
  error: {
    100: '#FFEBEE',
    500: '#C62828',
  },
  info: {
    100: '#E1F5FE',
    500: '#0277BD',
  },
  sync: {
    offline: '#78909C',
    syncing: '#FFB300',
    synced: '#43A047',
  },
} as const;

// ─── Espaçamento (base 4px) ─────────────────────────────────────────────────

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ─── Tipografia ──────────────────────────────────────────────────────────────

export const fontFamily = {
  display: 'DM Sans',
  body: 'Source Sans 3',
  mono: 'JetBrains Mono',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
  '4xl': 48,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.3,
  normal: 1.5,
} as const;

// ─── Bordas & Sombras ───────────────────────────────────────────────────────

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
  lg: '0 4px 12px rgba(0, 0, 0, 0.1)',
  xl: '0 8px 24px rgba(0, 0, 0, 0.12)',
} as const;

// ─── Animação ────────────────────────────────────────────────────────────────

export const easing = {
  out: 'cubic-bezier(0.33, 1, 0.68, 1)',
  in: 'cubic-bezier(0.32, 0, 0.67, 0)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const duration = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

// ─── Layout ──────────────────────────────────────────────────────────────────

export const layout = {
  containerMax: 1280,
  sidebarWidth: 240,
  sidebarCollapsed: 64,
  topbarHeight: 64,
  bottomNavHeight: 56,
} as const;

export const breakpoint = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ColorScale = typeof colors;
export type SpacingScale = typeof spacing;
export type FontSizeScale = typeof fontSize;
export type RadiusScale = typeof radius;
export type BreakpointScale = typeof breakpoint;
