import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

export type PunchType = 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT';

export interface LocalTimePunch {
  id: string;
  employeeId: string;
  organizationId: string;
  farmId: string;
  punchType: PunchType;
  punchedAt: string; // ISO 8601
  latitude: number | null;
  longitude: number | null;
  outOfRange: boolean;
  synced: boolean;
  createdAt: string;
}

type TimePunchRow = {
  id: string;
  employee_id: string;
  organization_id: string;
  farm_id: string;
  punch_type: string;
  punched_at: string;
  latitude: number | null;
  longitude: number | null;
  out_of_range: number;
  synced: number;
  created_at: string;
};

function mapRow(row: TimePunchRow): LocalTimePunch {
  return {
    id: row.id,
    employeeId: row.employee_id,
    organizationId: row.organization_id,
    farmId: row.farm_id,
    punchType: row.punch_type as PunchType,
    punchedAt: row.punched_at,
    latitude: row.latitude,
    longitude: row.longitude,
    outOfRange: row.out_of_range === 1,
    synced: row.synced === 1,
    createdAt: row.created_at,
  };
}

export class TimePunchRepository {
  constructor(private db: SQLiteDatabase) {}

  async create(
    punch: Omit<LocalTimePunch, 'id' | 'synced' | 'createdAt'>,
  ): Promise<LocalTimePunch> {
    // NOTE: organizationId is stored so offline-queue can build the correct endpoint URL
    const id = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${punch.employeeId}-${punch.punchType}-${punch.punchedAt}-${Math.random()}`,
    ).then((hash) => hash.substring(0, 32));
    const createdAt = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO time_punches (id, employee_id, organization_id, farm_id, punch_type, punched_at, latitude, longitude, out_of_range, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        punch.employeeId,
        punch.organizationId,
        punch.farmId,
        punch.punchType,
        punch.punchedAt,
        punch.latitude,
        punch.longitude,
        punch.outOfRange ? 1 : 0,
        createdAt,
      ],
    );
    return { ...punch, id, synced: false, createdAt };
  }

  async getTodayPunches(employeeId: string): Promise<LocalTimePunch[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const rows = await this.db.getAllAsync<TimePunchRow>(
      `SELECT * FROM time_punches WHERE employee_id = ? AND punched_at LIKE ? ORDER BY punched_at ASC`,
      [employeeId, `${today}%`],
    );
    return rows.map(mapRow);
  }

  async markSynced(id: string): Promise<void> {
    await this.db.runAsync(`UPDATE time_punches SET synced = 1 WHERE id = ?`, [id]);
  }

  async getPendingCount(): Promise<number> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM time_punches WHERE synced = 0`,
    );
    return result?.count ?? 0;
  }
}

export function createTimePunchRepository(db: SQLiteDatabase): TimePunchRepository {
  return new TimePunchRepository(db);
}
