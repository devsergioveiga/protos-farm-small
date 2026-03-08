import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncMeta, SyncEntity } from '@/types/offline';

export function createSyncMetaRepository(db: SQLiteDatabase) {
  return {
    async get(entity: SyncEntity): Promise<SyncMeta | null> {
      return db.getFirstAsync<SyncMeta>('SELECT * FROM sync_meta WHERE entity = ?', entity);
    },

    async getAll(): Promise<SyncMeta[]> {
      return db.getAllAsync<SyncMeta>('SELECT * FROM sync_meta ORDER BY entity');
    },

    async upsert(entity: SyncEntity, recordCount: number): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_meta (entity, last_synced_at, record_count)
         VALUES (?, ?, ?)`,
        entity,
        new Date().toISOString(),
        recordCount,
      );
    },

    async getLastSyncedAt(entity: SyncEntity): Promise<string | null> {
      const row = await db.getFirstAsync<SyncMeta>(
        'SELECT last_synced_at FROM sync_meta WHERE entity = ?',
        entity,
      );
      return row?.last_synced_at ?? null;
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM sync_meta');
    },
  };
}
