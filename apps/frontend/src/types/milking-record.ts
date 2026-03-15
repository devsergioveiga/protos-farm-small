export interface MilkingRecordItem {
  id: string;
  farmId: string;
  animalId: string;
  animalEarTag: string;
  animalName: string | null;
  milkingDate: string;
  shift: string;
  shiftLabel: string;
  liters: number;
  variationPercent: number | null;
  variationAlert: boolean;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface MilkingRecordsResponse {
  data: MilkingRecordItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateMilkingRecordInput {
  animalId: string;
  milkingDate: string;
  shift: string;
  liters: number;
  notes?: string | null;
}

export interface UpdateMilkingRecordInput {
  milkingDate?: string;
  shift?: string;
  liters?: number;
  notes?: string | null;
}

export interface BulkMilkingEntry {
  animalId: string;
  liters: number;
}

export interface BulkMilkingInput {
  shift: string;
  date: string;
  entries: BulkMilkingEntry[];
}

export interface BulkMilkingResult {
  created: number;
  alerts: Array<{ earTag: string; variation: number }>;
}

export interface DailyProductionSummary {
  date: string;
  totalLiters: number;
  avgPerAnimal: number;
  animalCount: number;
  byLot: Array<{ lotId: string; lotName: string; liters: number; animalCount: number }>;
}

export interface LactatingAnimalItem {
  animalId: string;
  earTag: string;
  animalName: string | null;
  lotName: string | null;
  lastMilkingLiters: number | null;
  lastMilkingDate: string | null;
}

export interface ProductionTrendItem {
  date: string;
  totalLiters: number;
}

export const MILKING_SHIFTS = [
  { value: 'MORNING', label: 'Manhã' },
  { value: 'AFTERNOON', label: 'Tarde' },
  { value: 'NIGHT', label: 'Noite' },
] as const;

export const SHIFT_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  MORNING: { label: 'Manhã', className: 'shift--morning' },
  AFTERNOON: { label: 'Tarde', className: 'shift--afternoon' },
  NIGHT: { label: 'Noite', className: 'shift--night' },
};
