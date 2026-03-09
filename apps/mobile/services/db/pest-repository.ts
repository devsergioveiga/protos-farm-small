import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflinePest } from '@/types/offline';

export function createPestRepository(db: SQLiteDatabase) {
  return {
    async upsertMany(pests: OfflinePest[]): Promise<void> {
      if (pests.length === 0) return;
      const stmt = await db.prepareAsync(`
        INSERT OR REPLACE INTO pests (
          id, common_name, scientific_name, category,
          control_threshold, recommended_products, created_at, updated_at
        ) VALUES (
          $id, $common_name, $scientific_name, $category,
          $control_threshold, $recommended_products, $created_at, $updated_at
        )
      `);
      try {
        for (const p of pests) {
          await stmt.executeAsync({
            $id: p.id,
            $common_name: p.common_name,
            $scientific_name: p.scientific_name,
            $category: p.category,
            $control_threshold: p.control_threshold,
            $recommended_products: p.recommended_products,
            $created_at: p.created_at,
            $updated_at: p.updated_at,
          });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getAll(): Promise<OfflinePest[]> {
      return db.getAllAsync<OfflinePest>('SELECT * FROM pests ORDER BY common_name ASC');
    },

    async search(query: string): Promise<OfflinePest[]> {
      return db.getAllAsync<OfflinePest>(
        'SELECT * FROM pests WHERE common_name LIKE ? OR scientific_name LIKE ? ORDER BY common_name ASC',
        `%${query}%`,
        `%${query}%`,
      );
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM pests');
    },
  };
}
