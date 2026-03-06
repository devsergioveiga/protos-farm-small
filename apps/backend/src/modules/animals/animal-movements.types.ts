// ─── Error ──────────────────────────────────────────────────────────

export class AnimalMovementsError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AnimalMovementsError';
  }
}

// ─── Response Types ─────────────────────────────────────────────────

export interface AnimalMovementItem {
  id: string;
  lotName: string;
  lotLocationType: string;
  locationName: string | null;
  previousLotName: string | null;
  enteredAt: string;
  exitedAt: string | null;
  durationDays: number;
  reason: string | null;
  movedByName: string;
}

export interface AnimalMovementStats {
  totalMovements: number;
  currentLotName: string | null;
  currentLocationName: string | null;
  daysInCurrentLot: number | null;
  distinctLots: number;
}
