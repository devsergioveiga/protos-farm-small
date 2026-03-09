import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineMonitoringPoint } from '@/types/offline';

export function createMonitoringPointRepository(db: SQLiteDatabase) {
  return {
    async upsertMany(points: OfflineMonitoringPoint[]): Promise<void> {
      if (points.length === 0) return;
      const stmt = await db.prepareAsync(`
        INSERT OR REPLACE INTO monitoring_points (
          id, farm_id, field_plot_id, code, latitude, longitude, created_at
        ) VALUES (
          $id, $farm_id, $field_plot_id, $code, $latitude, $longitude, $created_at
        )
      `);
      try {
        for (const p of points) {
          await stmt.executeAsync({
            $id: p.id,
            $farm_id: p.farm_id,
            $field_plot_id: p.field_plot_id,
            $code: p.code,
            $latitude: p.latitude,
            $longitude: p.longitude,
            $created_at: p.created_at,
          });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFieldPlotId(fieldPlotId: string): Promise<OfflineMonitoringPoint[]> {
      return db.getAllAsync<OfflineMonitoringPoint>(
        'SELECT * FROM monitoring_points WHERE field_plot_id = ? ORDER BY code ASC',
        fieldPlotId,
      );
    },

    async getByFarmId(farmId: string): Promise<OfflineMonitoringPoint[]> {
      return db.getAllAsync<OfflineMonitoringPoint>(
        'SELECT * FROM monitoring_points WHERE farm_id = ? ORDER BY code ASC',
        farmId,
      );
    },

    async deleteByFarmId(farmId: string): Promise<void> {
      await db.runAsync('DELETE FROM monitoring_points WHERE farm_id = ?', farmId);
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM monitoring_points');
    },
  };
}
