import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineCultivar } from '@/types/offline';

export function createCultivarRepository(db: SQLiteDatabase) {
  return {
    async upsertMany(cultivars: OfflineCultivar[]): Promise<void> {
      if (cultivars.length === 0) return;
      const stmt = await db.prepareAsync(`
        INSERT OR REPLACE INTO cultivars (
          id, name, crop, obtainer, cycle_days, maturity_group,
          technology, seed_type, created_at, updated_at
        ) VALUES ($id, $name, $crop, $obtainer, $cycle_days, $maturity_group,
          $technology, $seed_type, $created_at, $updated_at)
      `);
      try {
        for (const c of cultivars) {
          await stmt.executeAsync({
            $id: c.id,
            $name: c.name,
            $crop: c.crop,
            $obtainer: c.obtainer,
            $cycle_days: c.cycle_days,
            $maturity_group: c.maturity_group,
            $technology: c.technology,
            $seed_type: c.seed_type,
            $created_at: c.created_at,
            $updated_at: c.updated_at,
          });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getAll(): Promise<OfflineCultivar[]> {
      return db.getAllAsync<OfflineCultivar>('SELECT * FROM cultivars ORDER BY crop, name');
    },

    async getByCrop(crop: string): Promise<OfflineCultivar[]> {
      return db.getAllAsync<OfflineCultivar>(
        'SELECT * FROM cultivars WHERE crop = ? ORDER BY name',
        crop,
      );
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM cultivars');
    },
  };
}
