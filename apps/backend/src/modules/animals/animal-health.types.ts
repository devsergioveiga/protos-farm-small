// ─── Error ──────────────────────────────────────────────────────────

export class AnimalHealthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalHealthError';
  }
}

// ─── Enums ──────────────────────────────────────────────────────────

export type HealthEventType = 'VACCINATION' | 'DEWORMING' | 'TREATMENT' | 'EXAM';
export type ApplicationMethod = 'INJECTABLE' | 'ORAL' | 'POUR_ON' | 'OTHER';

const VALID_HEALTH_EVENT_TYPES: HealthEventType[] = [
  'VACCINATION',
  'DEWORMING',
  'TREATMENT',
  'EXAM',
];
const VALID_APPLICATION_METHODS: ApplicationMethod[] = ['INJECTABLE', 'ORAL', 'POUR_ON', 'OTHER'];

export function isValidHealthEventType(value: string): value is HealthEventType {
  return VALID_HEALTH_EVENT_TYPES.includes(value as HealthEventType);
}

export function isValidApplicationMethod(value: string): value is ApplicationMethod {
  return VALID_APPLICATION_METHODS.includes(value as ApplicationMethod);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateHealthRecordInput {
  type: HealthEventType;
  eventDate: string; // ISO date
  productName?: string | null;
  dosage?: string | null;
  applicationMethod?: ApplicationMethod | null;
  batchNumber?: string | null;
  diagnosis?: string | null;
  durationDays?: number | null;
  examResult?: string | null;
  labName?: string | null;
  isFieldExam?: boolean | null;
  veterinaryName?: string | null;
  notes?: string | null;
}

export interface UpdateHealthRecordInput {
  type?: HealthEventType;
  eventDate?: string;
  productName?: string | null;
  dosage?: string | null;
  applicationMethod?: ApplicationMethod | null;
  batchNumber?: string | null;
  diagnosis?: string | null;
  durationDays?: number | null;
  examResult?: string | null;
  labName?: string | null;
  isFieldExam?: boolean | null;
  veterinaryName?: string | null;
  notes?: string | null;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface HealthRecordItem {
  id: string;
  animalId: string;
  farmId: string;
  type: HealthEventType;
  eventDate: string;
  productName: string | null;
  dosage: string | null;
  applicationMethod: ApplicationMethod | null;
  batchNumber: string | null;
  diagnosis: string | null;
  durationDays: number | null;
  examResult: string | null;
  labName: string | null;
  isFieldExam: boolean | null;
  veterinaryName: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface HealthStats {
  totalRecords: number;
  vaccinations: number;
  dewormings: number;
  treatments: number;
  exams: number;
  lastVaccinationDate: string | null;
  lastDewormingDate: string | null;
  lastTreatmentDate: string | null;
  lastExamDate: string | null;
}
