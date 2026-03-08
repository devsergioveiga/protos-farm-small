import type { SQLiteDatabase } from 'expo-sqlite';
import type { TileCacheMeta } from '@/types/offline';

export function createTileCacheRepository(db: SQLiteDatabase) {
  return {
    async getByFarmId(farmId: string): Promise<TileCacheMeta | null> {
      return db.getFirstAsync<TileCacheMeta>(
        'SELECT * FROM tile_cache_meta WHERE farm_id = ?',
        farmId,
      );
    },

    async upsert(meta: TileCacheMeta): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO tile_cache_meta (
          farm_id, min_zoom, max_zoom, total_tiles, downloaded_tiles,
          cache_size_bytes, bbox_south, bbox_west, bbox_north, bbox_east,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        meta.farm_id,
        meta.min_zoom,
        meta.max_zoom,
        meta.total_tiles,
        meta.downloaded_tiles,
        meta.cache_size_bytes,
        meta.bbox_south,
        meta.bbox_west,
        meta.bbox_north,
        meta.bbox_east,
        meta.status,
        meta.created_at,
        meta.updated_at,
      );
    },

    async updateProgress(
      farmId: string,
      downloadedTiles: number,
      cacheSizeBytes: number,
      status: TileCacheMeta['status'],
    ): Promise<void> {
      await db.runAsync(
        `UPDATE tile_cache_meta
         SET downloaded_tiles = ?, cache_size_bytes = ?, status = ?, updated_at = ?
         WHERE farm_id = ?`,
        downloadedTiles,
        cacheSizeBytes,
        status,
        new Date().toISOString(),
        farmId,
      );
    },

    async deleteByFarmId(farmId: string): Promise<void> {
      await db.runAsync('DELETE FROM tile_cache_meta WHERE farm_id = ?', farmId);
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM tile_cache_meta');
    },
  };
}
