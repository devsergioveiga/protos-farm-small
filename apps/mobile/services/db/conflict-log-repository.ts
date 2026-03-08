import type { SQLiteDatabase } from 'expo-sqlite';

export interface ConflictLogEntry {
  id: number;
  entity: string;
  entity_id: string;
  local_payload: string;
  server_payload: string;
  resolution: string;
  resolved_at: string;
  reviewed: number;
}

export function createConflictLogRepository(db: SQLiteDatabase) {
  return {
    async log(
      entity: string,
      entityId: string,
      localPayload: unknown,
      serverPayload: unknown,
      resolution = 'server_wins',
    ): Promise<void> {
      await db.runAsync(
        `INSERT INTO conflict_log (entity, entity_id, local_payload, server_payload, resolution, resolved_at, reviewed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        entity,
        entityId,
        JSON.stringify(localPayload),
        JSON.stringify(serverPayload),
        resolution,
        new Date().toISOString(),
      );
    },

    async getUnreviewed(): Promise<ConflictLogEntry[]> {
      return db.getAllAsync<ConflictLogEntry>(
        'SELECT * FROM conflict_log WHERE reviewed = 0 ORDER BY resolved_at DESC',
      );
    },

    async markReviewed(id: number): Promise<void> {
      await db.runAsync('UPDATE conflict_log SET reviewed = 1 WHERE id = ?', id);
    },

    async markAllReviewed(): Promise<void> {
      await db.runAsync('UPDATE conflict_log SET reviewed = 1 WHERE reviewed = 0');
    },

    async countUnreviewed(): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM conflict_log WHERE reviewed = 0',
      );
      return row?.count ?? 0;
    },

    async getAll(limit = 50): Promise<ConflictLogEntry[]> {
      return db.getAllAsync<ConflictLogEntry>(
        'SELECT * FROM conflict_log ORDER BY resolved_at DESC LIMIT ?',
        limit,
      );
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM conflict_log');
    },
  };
}
