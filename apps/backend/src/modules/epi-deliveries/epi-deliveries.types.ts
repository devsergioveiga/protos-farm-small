export class EpiDeliveryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EpiDeliveryError';
  }
}

export const EPI_DELIVERY_REASONS = ['NOVO', 'TROCA', 'DANIFICADO', 'EXTRAVIO'] as const;
export type EpiDeliveryReason = (typeof EPI_DELIVERY_REASONS)[number];

export interface CreateEpiDeliveryInput {
  employeeId: string;
  epiProductId: string;
  date: string;
  quantity: number;
  reason: EpiDeliveryReason;
  signatureUrl?: string;
  observations?: string;
}

export interface EpiDeliveryOutput {
  id: string;
  employeeId: string;
  employeeName: string;
  epiProductId: string;
  epiProductName: string;
  caNumber: string;
  date: string;
  quantity: number;
  reason: EpiDeliveryReason;
  signatureUrl: string | null;
  observations: string | null;
  stockOutputId: string | null;
  createdAt: string;
}

export interface EpiDeliveryListQuery {
  employeeId?: string;
  epiType?: string;
  reason?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
