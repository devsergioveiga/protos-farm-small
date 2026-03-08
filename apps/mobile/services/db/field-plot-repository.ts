import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineFieldPlot } from '@/types/offline';

export function createFieldPlotRepository(db: SQLiteDatabase) {
  return {
    async getByFarmId(farmId: string): Promise<OfflineFieldPlot[]> {
      return db.getAllAsync<OfflineFieldPlot>(
        'SELECT * FROM field_plots WHERE farm_id = ? AND status = ? ORDER BY name',
        farmId,
        'ACTIVE',
      );
    },

    async getById(id: string): Promise<OfflineFieldPlot | null> {
      return db.getFirstAsync<OfflineFieldPlot>('SELECT * FROM field_plots WHERE id = ?', id);
    },

    async upsertMany(plots: OfflineFieldPlot[]): Promise<void> {
      if (plots.length === 0) return;

      await db.withTransactionAsync(async () => {
        const stmt = await db.prepareAsync(`
          INSERT OR REPLACE INTO field_plots (
            id, farm_id, name, code, soil_type, current_crop, previous_crop,
            notes, boundary_area_ha, status, created_at, updated_at
          ) VALUES (
            $id, $farm_id, $name, $code, $soil_type, $current_crop, $previous_crop,
            $notes, $boundary_area_ha, $status, $created_at, $updated_at
          )
        `);
        try {
          for (const p of plots) {
            await stmt.executeAsync({
              $id: p.id,
              $farm_id: p.farm_id,
              $name: p.name,
              $code: p.code,
              $soil_type: p.soil_type,
              $current_crop: p.current_crop,
              $previous_crop: p.previous_crop,
              $notes: p.notes,
              $boundary_area_ha: p.boundary_area_ha,
              $status: p.status,
              $created_at: p.created_at,
              $updated_at: p.updated_at,
            });
          }
        } finally {
          await stmt.finalizeAsync();
        }
      });
    },

    async deleteByFarmId(farmId: string): Promise<void> {
      await db.runAsync('DELETE FROM field_plots WHERE farm_id = ?', farmId);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM field_plots WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM field_plots');
    },
  };
}
