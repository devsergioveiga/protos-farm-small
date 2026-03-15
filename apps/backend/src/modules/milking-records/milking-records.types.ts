// ─── Error ──────────────────────────────────────────────────────────

export class MilkingRecordError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MilkingRecordError';
  }
}

// ─── Constants ─────────────────────────────────────────────────────

export const MILKING_SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT'] as const;
export type MilkingShiftValue = (typeof MILKING_SHIFTS)[number];

export const MILKING_SHIFT_LABELS: Record<MilkingShiftValue, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export function isValidMilkingShift(value: string): value is MilkingShiftValue {
  return MILKING_SHIFTS.includes(value as MilkingShiftValue);
}

// ─── Input Types ────────────────────────────────────────────────────

export interface CreateMilkingInput {
  animalId: string;
  milkingDate: string; // ISO date
  shift: MilkingShiftValue;
  liters: number;
  notes?: string | null;
}

export interface BulkMilkingInput {
  milkingDate: string; // ISO date
  shift: MilkingShiftValue;
  entries: Array<{
    animalId: string;
    liters: number;
    notes?: string | null;
  }>;
}

export interface UpdateMilkingInput {
  liters?: number;
  notes?: string | null;
}

export interface ListMilkingsQuery {
  animalId?: string;
  dateFrom?: string;
  dateTo?: string;
  shift?: MilkingShiftValue;
  variationAlert?: boolean;
  page?: number;
  limit?: number;
}

// ─── Response Types ─────────────────────────────────────────────────

export interface MilkingRecordItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  animalCategory: string;
  lotName: string | null;
  milkingDate: string;
  shift: MilkingShiftValue;
  shiftLabel: string;
  liters: number;
  variationPercent: number | null;
  variationAlert: boolean;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface BulkMilkingResult {
  created: number;
  alerts: Array<{
    animalId: string;
    animalEarTag: string;
    liters: number;
    previousLiters: number;
    variationPercent: number;
  }>;
}

export interface DailyProductionSummary {
  date: string;
  totalLiters: number;
  avgPerAnimal: number;
  animalCount: number;
  byShift: Array<{
    shift: MilkingShiftValue;
    shiftLabel: string;
    totalLiters: number;
    animalCount: number;
  }>;
  byLot: Array<{
    lotId: string | null;
    lotName: string;
    totalLiters: number;
    animalCount: number;
  }>;
}

export interface ProductionTrendItem {
  date: string;
  totalLiters: number;
  animalCount: number;
  avgPerAnimal: number;
}

export interface LactatingAnimalItem {
  id: string;
  earTag: string;
  name: string | null;
  category: string;
  lotId: string | null;
  lotName: string | null;
  lastMilkingDate: string | null;
  lastMilkingLiters: number | null;
}
