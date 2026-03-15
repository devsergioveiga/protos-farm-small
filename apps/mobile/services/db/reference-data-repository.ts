import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Supported reference data entity types for offline caching.
 * These are reference/lookup data needed for offline form filling.
 */
export type ReferenceEntityType =
  | 'bulls'
  | 'semen_batches'
  | 'iatf_protocols'
  | 'mating_plans'
  | 'diseases'
  | 'treatment_protocols'
  | 'exam_types'
  | 'feed_ingredients'
  | 'diets'
  | 'products';

interface ReferenceDataRow {
  farm_id: string;
  entity_type: string;
  data_json: string;
  synced_at: string;
  size_bytes: number;
}

interface CacheSizeByFarm {
  farm_id: string;
  total_bytes: number;
}

/**
 * Generic repository for caching reference data as JSON blobs
 * per entity type per farm. Uses a simple key-value store approach.
 */
export function createReferenceDataRepository(db: SQLiteDatabase) {
  return {
    /**
     * Ensure the reference_data table exists.
     */
    async init(): Promise<void> {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reference_data (
          farm_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          data_json TEXT NOT NULL DEFAULT '[]',
          synced_at TEXT NOT NULL,
          size_bytes INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (farm_id, entity_type)
        );
      `);
    },

    /**
     * Store JSON data for a given farm + entity type.
     * Uses INSERT OR REPLACE to upsert.
     */
    async upsertReferenceData(
      farmId: string,
      entityType: ReferenceEntityType,
      data: unknown[],
    ): Promise<void> {
      const json = JSON.stringify(data);
      const sizeBytes = new TextEncoder().encode(json).length;
      await db.runAsync(
        `INSERT OR REPLACE INTO reference_data (farm_id, entity_type, data_json, synced_at, size_bytes)
         VALUES (?, ?, ?, ?, ?)`,
        farmId,
        entityType,
        json,
        new Date().toISOString(),
        sizeBytes,
      );
    },

    /**
     * Retrieve cached data for a given farm + entity type.
     * Returns parsed array or empty array if not found.
     */
    async getReferenceData<T>(farmId: string, entityType: ReferenceEntityType): Promise<T[]> {
      const row = await db.getFirstAsync<ReferenceDataRow>(
        'SELECT data_json FROM reference_data WHERE farm_id = ? AND entity_type = ?',
        farmId,
        entityType,
      );
      if (!row?.data_json) return [];
      try {
        return JSON.parse(row.data_json) as T[];
      } catch {
        return [];
      }
    },

    /**
     * Search cached reference data by a text query (case-insensitive).
     * Searches within the JSON blob using SQLite LIKE.
     */
    async searchReferenceData<T>(
      farmId: string,
      entityType: ReferenceEntityType,
      query: string,
    ): Promise<T[]> {
      const all = await this.getReferenceData<T>(farmId, entityType);
      if (!query.trim()) return all;
      const lowerQuery = query.toLowerCase();
      return all.filter((item) => {
        const json = JSON.stringify(item).toLowerCase();
        return json.includes(lowerQuery);
      });
    },

    /**
     * Get the last sync timestamp for a given farm + entity type.
     */
    async getLastSyncedAt(farmId: string, entityType: ReferenceEntityType): Promise<string | null> {
      const row = await db.getFirstAsync<{ synced_at: string }>(
        'SELECT synced_at FROM reference_data WHERE farm_id = ? AND entity_type = ?',
        farmId,
        entityType,
      );
      return row?.synced_at ?? null;
    },

    /**
     * Clear all cached data for a specific farm.
     */
    async clearFarmCache(farmId: string): Promise<void> {
      await db.runAsync('DELETE FROM reference_data WHERE farm_id = ?', farmId);
    },

    /**
     * Get total cache size in bytes across all farms.
     */
    async getCacheSize(): Promise<number> {
      const row = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(size_bytes), 0) as total FROM reference_data',
      );
      return row?.total ?? 0;
    },

    /**
     * Get cache size per farm (in bytes).
     */
    async getCacheSizeByFarm(): Promise<CacheSizeByFarm[]> {
      return db.getAllAsync<CacheSizeByFarm>(
        'SELECT farm_id, COALESCE(SUM(size_bytes), 0) as total_bytes FROM reference_data GROUP BY farm_id ORDER BY total_bytes DESC',
      );
    },

    /**
     * Get all entity types cached for a specific farm with their sync timestamps.
     */
    async getFarmCacheDetails(
      farmId: string,
    ): Promise<Array<{ entity_type: string; synced_at: string; size_bytes: number }>> {
      return db.getAllAsync<{ entity_type: string; synced_at: string; size_bytes: number }>(
        'SELECT entity_type, synced_at, size_bytes FROM reference_data WHERE farm_id = ? ORDER BY entity_type',
        farmId,
      );
    },

    /**
     * Clear all reference data across all farms.
     */
    async clearAll(): Promise<void> {
      await db.runAsync('DELETE FROM reference_data');
    },
  };
}
