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

export interface ListConversionHistoryQuery {
  farmId?: string;
  operationType?: OperationType;
  productName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export class ConversionHistoryError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ConversionHistoryError';
  }
}
