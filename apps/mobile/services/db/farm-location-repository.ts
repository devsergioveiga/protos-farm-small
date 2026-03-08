import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineFarmLocation } from '@/types/offline';

export function createFarmLocationRepository(db: SQLiteDatabase) {
  return {
    async getByFarmId(farmId: string): Promise<OfflineFarmLocation[]> {
      return db.getAllAsync<OfflineFarmLocation>(
        'SELECT * FROM farm_locations WHERE farm_id = ? ORDER BY type, name',
        farmId,
      );
    },

    async getById(id: string): Promise<OfflineFarmLocation | null> {
      return db.getFirstAsync<OfflineFarmLocation>('SELECT * FROM farm_locations WHERE id = ?', id);
    },

    async getByType(farmId: string, type: 'PASTURE' | 'FACILITY'): Promise<OfflineFarmLocation[]> {
      return db.getAllAsync<OfflineFarmLocation>(
        'SELECT * FROM farm_locations WHERE farm_id = ? AND type = ? ORDER BY name',
        farmId,
        type,
      );
    },

    async upsertMany(locations: OfflineFarmLocation[]): Promise<void> {
      if (locations.length === 0) return;

      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(`
          INSERT OR REPLACE INTO farm_locations (
            id, farm_id, name, type, boundary_area_ha, capacity_ua, capacity_animals,
            forage_type, pasture_status, facility_type, facility_status,
            description, notes, created_at, updated_at
          ) VALUES (
            $id, $farm_id, $name, $type, $boundary_area_ha, $capacity_ua, $capacity_animals,
            $forage_type, $pasture_status, $facility_type, $facility_status,
            $description, $notes, $created_at, $updated_at
          )
        `);
        try {
          for (const l of locations) {
            await stmt.executeAsync({
              $id: l.id,
              $farm_id: l.farm_id,
              $name: l.name,
              $type: l.type,
              $boundary_area_ha: l.boundary_area_ha,
              $capacity_ua: l.capacity_ua,
              $capacity_animals: l.capacity_animals,
              $forage_type: l.forage_type,
              $pasture_status: l.pasture_status,
              $facility_type: l.facility_type,
              $facility_status: l.facility_status,
              $description: l.description,
              $notes: l.notes,
              $created_at: l.created_at,
              $updated_at: l.updated_at,
            });
          }
        } finally {
          await stmt.finalizeAsync();
        }
      });
    },

    async deleteByFarmId(farmId: string): Promise<void> {
      await db.runAsync('DELETE FROM farm_locations WHERE farm_id = ?', farmId);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM farm_locations WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM farm_locations');
    },
  };
}
