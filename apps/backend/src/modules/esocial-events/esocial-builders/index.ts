// ─── eSocial Builders Index ───────────────────────────────────────────────────
// Barrel export with dynamic dispatch by event type.

export { buildS1000 } from './s1000-builder';
export { buildS1005 } from './s1005-builder';
export { buildS1010 } from './s1010-builder';
export { buildS1020 } from './s1020-builder';
export { buildS2200 } from './s2200-builder';
export { buildS2206 } from './s2206-builder';
export { buildS2230 } from './s2230-builder';
export { buildS2299 } from './s2299-builder';
export { buildS1200 } from './s1200-builder';
export { buildS1210 } from './s1210-builder';
export { buildS1299 } from './s1299-builder';
export { buildS2210 } from './s2210-builder';
export { buildS2220 } from './s2220-builder';
export { buildS2240 } from './s2240-builder';
export { validateXmlAgainstXsd } from '../esocial-xsd-validator';

import { buildS1000 } from './s1000-builder';
import { buildS1005 } from './s1005-builder';
import { buildS1010 } from './s1010-builder';
import { buildS1020 } from './s1020-builder';
import { buildS2200 } from './s2200-builder';
import { buildS2206 } from './s2206-builder';
import { buildS2230 } from './s2230-builder';
import { buildS2299 } from './s2299-builder';
import { buildS1200 } from './s1200-builder';
import { buildS1210 } from './s1210-builder';
import { buildS1299 } from './s1299-builder';
import { buildS2210 } from './s2210-builder';
import { buildS2220 } from './s2220-builder';
import { buildS2240 } from './s2240-builder';

import {
  validateS1000Input,
  validateS1005Input,
  validateS1010Input,
  validateS1020Input,
  validateS2200Input,
  validateS2206Input,
  validateS2230Input,
  validateS2299Input,
  validateS1200Input,
  validateS1210Input,
  validateS1299Input,
  validateS2220Input,
  validateS2240Input,
} from '../esocial-validators';

import type { EsocialValidationError } from '../esocial-events.types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BUILDER_MAP: Record<string, (data: any) => string> = {
  'S-1000': buildS1000,
  'S-1005': buildS1005,
  'S-1010': buildS1010,
  'S-1020': buildS1020,
  'S-2200': buildS2200,
  'S-2206': buildS2206,
  'S-2230': buildS2230,
  'S-2299': buildS2299,
  'S-1200': buildS1200,
  'S-1210': buildS1210,
  'S-1299': buildS1299,
  'S-2210': buildS2210,
  'S-2220': buildS2220,
  'S-2240': buildS2240,
};

const VALIDATOR_MAP: Record<string, (data: any) => EsocialValidationError[]> = {
  'S-1000': (d: any) => validateS1000Input(d.organization),
  'S-1005': (d: any) => validateS1005Input(d.farm, d.organization),
  'S-1010': (d: any) => validateS1010Input(d.rubrica),
  'S-1020': (d: any) => validateS1020Input(d.position),
  'S-2200': (d: any) => validateS2200Input(d.employee, d.contract, d.position),
  'S-2206': (d: any) => validateS2206Input(d.employee, d.amendment),
  'S-2230': (d: any) => validateS2230Input(d.employee, d.absence),
  'S-2299': (d: any) => validateS2299Input(d.employee, d.termination),
  'S-1200': (d: any) => validateS1200Input(d.item, d.employee),
  'S-1210': (d: any) => validateS1210Input(d.item, d.employee),
  'S-1299': (d: any) => validateS1299Input(d.payrollRun, d.organization),
  'S-2210': (d: any) => [], // CAT — no specific validator needed
  'S-2220': (d: any) => validateS2220Input(d.exam, d.employee),
  'S-2240': (d: any) => validateS2240Input(d.epiDelivery, d.employee),
};

export function getBuilder(eventType: string): ((data: any) => string) | undefined {
  return BUILDER_MAP[eventType];
}

export function getValidator(eventType: string): ((data: any) => EsocialValidationError[]) | undefined {
  return VALIDATOR_MAP[eventType];
}
