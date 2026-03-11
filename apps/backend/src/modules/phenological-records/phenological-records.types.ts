export class PhenoRecordError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'PhenoRecordError';
  }
}

export interface PhenoRecordItem {
  id: string;
  fieldPlotId: string;
  fieldPlotName: string;
  crop: string;
  stageCode: string;
  stageName: string;
  recordedAt: string;
  recordedBy: string;
  recorderName: string;
  notes: string | null;
}

export interface CreatePhenoRecordInput {
  fieldPlotId: string;
  crop: string;
  stageCode: string;
  stageName: string;
  recordedAt?: string;
  notes?: string | null;
}

export interface ListPhenoRecordsQuery {
  fieldPlotId?: string;
  crop?: string;
  limit?: number;
}
