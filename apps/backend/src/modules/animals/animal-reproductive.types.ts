// ─── Error ──────────────────────────────────────────────────────────

export class AnimalReproductiveError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalReproductiveError';
  }
}

// ─── Enums ──────────────────────────────────────────────────────────

export type ReproductiveEventType =
  | 'CLEARANCE'
  | 'HEAT'
  | 'BREEDING_PLAN'
  | 'AI'
  | 'PREGNANCY'
  | 'CALVING';

export type HeatIntensity = 'WEAK' | 'MODERATE' | 'STRONG';
export type BreedingMethod = 'NATURAL' | 'AI' | 'ET';
export type CalvingType = 'NORMAL' | 'ASSISTED' | 'CESAREAN' | 'DYSTOCIC';
export type PregnancyConfirmation = 'PALPATION' | 'ULTRASOUND' | 'BLOOD_TEST' | 'OBSERVATION';

const VALID_REPRODUCTIVE_EVENT_TYPES: ReproductiveEventType[] = [
  'CLEARANCE',
  'HEAT',
  'BREEDING_PLAN',
  'AI',
  'PREGNANCY',
  'CALVING',
];
const VALID_HEAT_INTENSITIES: HeatIntensity[] = ['WEAK', 'MODERATE', 'STRONG'];
const VALID_BREEDING_METHODS: BreedingMethod[] = ['NATURAL', 'AI', 'ET'];
const VALID_CALVING_TYPES: CalvingType[] = ['NORMAL', 'ASSISTED', 'CESAREAN', 'DYSTOCIC'];
const VALID_PREGNANCY_CONFIRMATIONS: PregnancyConfirmation[] = [
  'PALPATION',
  'ULTRASOUND',
  'BLOOD_TEST',
  'OBSERVATION',
];

export function isValidReproductiveEventType(value: string): value is ReproductiveEventType {
  return VALID_REPRODUCTIVE_EVENT_TYPES.includes(value as ReproductiveEventType);
}

export function isValidHeatIntensity(value: string): value is HeatIntensity {
  return VALID_HEAT_INTENSITIES.includes(value as HeatIntensity);
}

export function isValidBreedingMethod(value: string): value is BreedingMethod {
  return VALID_BREEDING_METHODS.includes(value as BreedingMethod);
}

export function isValidCalvingType(value: string): value is CalvingType {
  return VALID_CALVING_TYPES.includes(value as CalvingType);
}

export function isValidPregnancyConfirmation(value: string): value is PregnancyConfirmation {
  return VALID_PREGNANCY_CONFIRMATIONS.includes(value as PregnancyConfirmation);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateReproductiveRecordInput {
  type: ReproductiveEventType;
  eventDate: string; // ISO date
  notes?: string | null;

  // CLEARANCE
  approvedBy?: string | null;
  criteriaDetails?: string | null;

  // HEAT
  heatIntensity?: HeatIntensity | null;

  // BREEDING_PLAN
  plannedSireId?: string | null;
  breedingMethod?: BreedingMethod | null;
  plannedDate?: string | null;

  // AI
  sireId?: string | null;
  sireName?: string | null;
  semenBatch?: string | null;
  technicianName?: string | null;

  // PREGNANCY
  confirmationMethod?: PregnancyConfirmation | null;
  confirmationDate?: string | null;
  expectedDueDate?: string | null;

  // CALVING
  calvingType?: CalvingType | null;
  calvingComplications?: string | null;
  calfId?: string | null;
  calfSex?: string | null;
  calfWeightKg?: number | null;
}

export interface UpdateReproductiveRecordInput {
  type?: ReproductiveEventType;
  eventDate?: string;
  notes?: string | null;
  approvedBy?: string | null;
  criteriaDetails?: string | null;
  heatIntensity?: HeatIntensity | null;
  plannedSireId?: string | null;
  breedingMethod?: BreedingMethod | null;
  plannedDate?: string | null;
  sireId?: string | null;
  sireName?: string | null;
  semenBatch?: string | null;
  technicianName?: string | null;
  confirmationMethod?: PregnancyConfirmation | null;
  confirmationDate?: string | null;
  expectedDueDate?: string | null;
  calvingType?: CalvingType | null;
  calvingComplications?: string | null;
  calfId?: string | null;
  calfSex?: string | null;
  calfWeightKg?: number | null;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface ReproductiveRecordItem {
  id: string;
  animalId: string;
  farmId: string;
  type: ReproductiveEventType;
  eventDate: string;
  notes: string | null;
  recordedBy: string;
  recorderName: string;

  // CLEARANCE
  approvedBy: string | null;
  criteriaDetails: string | null;

  // HEAT
  heatIntensity: HeatIntensity | null;
  intervalDays: number | null;

  // BREEDING_PLAN
  plannedSireId: string | null;
  plannedSireName: string | null;
  breedingMethod: BreedingMethod | null;
  plannedDate: string | null;

  // AI
  sireId: string | null;
  sireName: string | null;
  semenBatch: string | null;
  technicianName: string | null;

  // PREGNANCY
  confirmationMethod: PregnancyConfirmation | null;
  confirmationDate: string | null;
  expectedDueDate: string | null;

  // CALVING
  calvingType: CalvingType | null;
  calvingComplications: string | null;
  calfId: string | null;
  calfEarTag: string | null;
  calfSex: string | null;
  calfWeightKg: number | null;

  createdAt: string;
}

export interface ReproductiveStats {
  totalRecords: number;
  clearances: number;
  heats: number;
  breedingPlans: number;
  ais: number;
  pregnancies: number;
  calvings: number;
  lastHeatDate: string | null;
  lastAiDate: string | null;
  lastCalvingDate: string | null;
  isPregnant: boolean;
  averageHeatIntervalDays: number | null;
}
