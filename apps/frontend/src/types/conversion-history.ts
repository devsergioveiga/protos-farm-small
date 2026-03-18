export type OperationType = 'PESTICIDE' | 'FERTILIZER' | 'SOIL_PREP';

export interface ConversionHistoryItem {
  id: string;
  operationType: OperationType;
  operationLabel: string;
  farmId: string;
  farmName: string;
  fieldPlotId: string;
  fieldPlotName: string;
  productName: string;
  productId: string | null;
  appliedAt: string;
  dose: number;
  doseUnit: string;
  doseUnitLabel: string;
  areaHa: number;
  totalQuantityUsed: number;
  baseUnit: string;
  conversionFormula: string;
  stockOutputId: string | null;
  recordedBy: string;
  recorderName: string;
  createdAt: string;
}

export interface ConversionHistoryResponse {
  data: ConversionHistoryItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const OPERATION_TYPE_OPTIONS: Array<{ value: OperationType; label: string }> = [
  { value: 'PESTICIDE', label: 'Defensivo' },
  { value: 'FERTILIZER', label: 'Adubação' },
  { value: 'SOIL_PREP', label: 'Preparo de solo' },
];

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  PESTICIDE: 'Defensivo',
  FERTILIZER: 'Adubação',
  SOIL_PREP: 'Preparo de solo',
};
