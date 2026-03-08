import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineFarm } from '@/types/offline';

export function createFarmRepository(db: SQLiteDatabase) {
  return {
    async getAll(): Promise<OfflineFarm[]> {
      return db.getAllAsync<OfflineFarm>(
        'SELECT * FROM farms WHERE status = ? ORDER BY name',
        'ACTIVE',
      );
    },

    async getById(id: string): Promise<OfflineFarm | null> {
      return db.getFirstAsync<OfflineFarm>('SELECT * FROM farms WHERE id = ?', id);
    },

    async upsertMany(farms: OfflineFarm[]): Promise<void> {
      if (farms.length === 0) return;

      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(`
          INSERT OR REPLACE INTO farms (
            id, name, nickname, address, city, state, zip_code,
            total_area_ha, status, organization_id, latitude, longitude,
            boundary_geojson, created_at, updated_at
          ) VALUES (
            $id, $name, $nickname, $address, $city, $state, $zip_code,
            $total_area_ha, $status, $organization_id, $latitude, $longitude,
            $boundary_geojson, $created_at, $updated_at
          )
        `);
        try {
          for (const f of farms) {
            await stmt.executeAsync({
              $id: f.id,
              $name: f.name,
              $nickname: f.nickname,
              $address: f.address,
              $city: f.city,
              $state: f.state,
              $zip_code: f.zip_code,
              $total_area_ha: f.total_area_ha,
              $status: f.status,
              $organization_id: f.organization_id,
              $latitude: f.latitude,
              $longitude: f.longitude,
              $boundary_geojson: f.boundary_geojson,
              $created_at: f.created_at,
              $updated_at: f.updated_at,
            });
          }
        } finally {
          await stmt.finalizeAsync();
        }
      });
    },

    async deleteByIds(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM farms WHERE id IN (${placeholders})`, ...ids);
    },

    async count(): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM farms');
      return row?.count ?? 0;
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM farms');
    },
  };
}
