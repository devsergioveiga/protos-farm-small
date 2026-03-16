/**
 * @protos-farm/shared
 * Tipos, constantes e utilitários compartilhados entre as apps do Protos Farm.
 */

export const APP_NAME = 'Protos Farm';
export const API_VERSION = 'v1';

// Design tokens
export {
  colors,
  colorsDark,
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
} from './constants';

export type {
  ColorScale,
  ColorsDarkScale,
  SpacingScale,
  FontSizeScale,
  RadiusScale,
  BreakpointScale,
} from './constants';

// Financial types
export { Money } from './types/money';
export type { IMoney, MoneyFactory } from './types/money';

// FEBRABAN bank list
export { FEBRABAN_BANKS, FEBRABAN_BANK_MAP } from './constants/febraban-banks';
export type { FebrabanBank } from './constants/febraban-banks';

// AP/AR utilities
export { generateInstallments, validateCostCenterItems } from './utils/installments';
export type { CostCenterItemInput, Installment } from './utils/installments';
