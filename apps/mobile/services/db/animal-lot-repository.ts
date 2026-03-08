import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineAnimalLot } from '@/types/offline';

export function createAnimalLotRepository(db: SQLiteDatabase) {
  return {
    async getByFarmId(farmId: string): Promise<OfflineAnimalLot[]> {
      return db.getAllAsync<OfflineAnimalLot>(
        'SELECT * FROM animal_lots WHERE farm_id = ? ORDER BY name',
        farmId,
      );
    },

    async getById(id: string): Promise<OfflineAnimalLot | null> {
      return db.getFirstAsync<OfflineAnimalLot>('SELECT * FROM animal_lots WHERE id = ?', id);
    },

    async upsertMany(lots: OfflineAnimalLot[]): Promise<void> {
      if (lots.length === 0) return;

      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(`
          INSERT OR REPLACE INTO animal_lots (
            id, farm_id, name, predominant_category, current_location,
            location_type, location_id, max_capacity, description, notes,
            created_at, updated_at
          ) VALUES (
            $id, $farm_id, $name, $predominant_category, $current_location,
            $location_type, $location_id, $max_capacity, $description, $notes,
            $created_at, $updated_at
          )
        `);
        try {
          for (const l of lots) {
            await stmt.executeAsync({
              $id: l.id,
              $farm_id: l.farm_id,
              $name: l.name,
              $predominant_category: l.predominant_category,
              $current_location: l.current_location,
              $location_type: l.location_type,
              $location_id: l.location_id,
              $max_capacity: l.max_capacity,
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
      await db.runAsync('DELETE FROM animal_lots WHERE farm_id = ?', farmId);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM animal_lots WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM animal_lots');
    },
  };
}
