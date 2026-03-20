// ─── Error ──────────────────────────────────────────────────────────

export class MeterReadingError extends Error {
  public data?: Record<string, unknown>;
  constructor(
    message: string,
    public statusCode: number,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MeterReadingError';
    this.data = data;
  }
}

// ─── Input Types ─────────────────────────────────────────────────────

export type ReadingType = 'HOURMETER' | 'ODOMETER';

export interface CreateMeterReadingInput {
  assetId: string;
  readingDate: string | Date;
  readingType: ReadingType;
  value: number | string;
}

export interface ListMeterReadingsQuery {
  assetId?: string;
  readingType?: ReadingType;
  page?: number;
  limit?: number;
}
