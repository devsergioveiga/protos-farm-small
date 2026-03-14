export interface SanitaryProtocolItem {
  id: string;
  order: number;
  procedureType: string;
  procedureTypeLabel: string;
  productId: string | null;
  productName: string;
  dosage: number | null;
  dosageUnit: string | null;
  dosageUnitLabel: string | null;
  administrationRoute: string | null;
  administrationRouteLabel: string | null;
  triggerType: string;
  triggerTypeLabel: string;
  triggerAgeDays: number | null;
  triggerAgeMaxDays: number | null;
  triggerEvent: string | null;
  triggerEventLabel: string | null;
  triggerEventOffsetDays: number | null;
  calendarFrequency: string | null;
  calendarFrequencyLabel: string | null;
  calendarMonths: number[];
  isReinforcement: boolean;
  reinforcementIntervalDays: number | null;
  reinforcementDoseNumber: number | null;
  withdrawalMeatDays: number | null;
  withdrawalMilkDays: number | null;
  notes: string | null;
}

export interface SanitaryProtocol {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  authorName: string;
  status: string;
  statusLabel: string;
  version: number;
  originalId: string | null;
  isObligatory: boolean;
  targetCategories: string[];
  targetCategoryLabels: string[];
  items: SanitaryProtocolItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SanitaryProtocolsResponse {
  data: SanitaryProtocol[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ItemInput {
  order: number;
  procedureType: string;
  productId?: string | null;
  productName: string;
  dosage?: number | null;
  dosageUnit?: string | null;
  administrationRoute?: string | null;
  triggerType: string;
  triggerAgeDays?: number | null;
  triggerAgeMaxDays?: number | null;
  triggerEvent?: string | null;
  triggerEventOffsetDays?: number | null;
  calendarFrequency?: string | null;
  calendarMonths?: number[] | null;
  isReinforcement?: boolean;
  reinforcementIntervalDays?: number | null;
  reinforcementDoseNumber?: number | null;
  withdrawalMeatDays?: number | null;
  withdrawalMilkDays?: number | null;
  notes?: string | null;
}

export interface CreateSanitaryProtocolInput {
  name: string;
  description?: string | null;
  authorName: string;
  status?: string;
  isObligatory?: boolean;
  targetCategories?: string[];
  items: ItemInput[];
}

export const PROCEDURE_TYPES = [
  { value: 'VACCINATION', label: 'Vacinação' },
  { value: 'DEWORMING', label: 'Vermifugação' },
  { value: 'EXAM', label: 'Exame' },
  { value: 'MEDICATION', label: 'Aplicação de medicamento' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export const TRIGGER_TYPES = [
  { value: 'AGE', label: 'Por idade' },
  { value: 'EVENT', label: 'Por evento' },
  { value: 'CALENDAR', label: 'Por calendário' },
] as const;

export const EVENT_TRIGGERS = [
  { value: 'BIRTH', label: 'Nascimento' },
  { value: 'WEANING', label: 'Desmama/Desaleitamento' },
  { value: 'REPRODUCTIVE_RELEASE', label: 'Liberação reprodutiva' },
  { value: 'PRE_IATF', label: 'Pré-IATF' },
  { value: 'DRYING', label: 'Secagem' },
  { value: 'PRE_PARTUM', label: 'Pré-parto' },
  { value: 'POST_PARTUM', label: 'Pós-parto' },
  { value: 'TRANSITION', label: 'Transição' },
  { value: 'FARM_ENTRY', label: 'Entrada na fazenda' },
  { value: 'FARM_EXIT', label: 'Saída da fazenda' },
] as const;

export const CALENDAR_FREQUENCIES = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Quadrimestral' },
  { value: 'BIANNUAL', label: 'Semestral' },
  { value: 'ANNUAL', label: 'Anual' },
] as const;

export const TARGET_CATEGORIES = [
  { value: 'BEZERRO', label: 'Bezerro' },
  { value: 'BEZERRA', label: 'Bezerra' },
  { value: 'NOVILHA', label: 'Novilha' },
  { value: 'NOVILHO', label: 'Novilho' },
  { value: 'VACA_LACTACAO', label: 'Vaca em lactação' },
  { value: 'VACA_SECA', label: 'Vaca seca' },
  { value: 'TOURO_REPRODUTOR', label: 'Touro reprodutor' },
  { value: 'DESCARTE', label: 'Descarte' },
] as const;

export const SANITARY_PROTOCOL_STATUSES = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
] as const;

export const ADMINISTRATION_ROUTES = [
  { value: 'IM', label: 'Intramuscular' },
  { value: 'SC', label: 'Subcutâneo' },
  { value: 'IV', label: 'Intravenoso' },
  { value: 'ORAL', label: 'Oral' },
  { value: 'INTRAMMARY', label: 'Intramamária' },
  { value: 'TOPICAL', label: 'Tópica' },
] as const;

export const DOSAGE_UNITS = [
  { value: 'MG_KG', label: 'mg/kg' },
  { value: 'ML_ANIMAL', label: 'mL/animal' },
  { value: 'FIXED_DOSE', label: 'Dose fixa' },
] as const;

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;
