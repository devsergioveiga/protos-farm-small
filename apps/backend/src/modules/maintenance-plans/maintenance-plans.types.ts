export class MaintenancePlanError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'MaintenancePlanError';
  }
}

export interface CreateMaintenancePlanInput {
  assetId: string;
  name: string;
  description?: string;
  triggerType: 'HOURMETER' | 'ODOMETER' | 'CALENDAR';
  intervalValue: number;
  alertBeforeValue: number;
}

export interface UpdateMaintenancePlanInput extends Partial<CreateMaintenancePlanInput> {
  isActive?: boolean;
}

export interface ListMaintenancePlansQuery {
  assetId?: string;
  triggerType?: 'HOURMETER' | 'ODOMETER' | 'CALENDAR';
  isActive?: boolean;
  farmId?: string;
  page?: number;
  limit?: number;
}

export interface MaintenancePlanOutput {
  id: string;
  organizationId: string;
  assetId: string;
  name: string;
  description: string | null;
  triggerType: string;
  intervalValue: number;
  alertBeforeValue: number;
  lastExecutedAt: string | null;
  lastMeterValue: number | null;
  nextDueAt: string | null;
  nextDueMeter: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  asset?: { id: string; name: string; assetTag: string };
}

export interface RlsContext {
  userId: string;
  organizationId: string;
}
