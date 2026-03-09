import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineMonitoringRecord } from '@/types/offline';

export function createMonitoringRecordRepository(db: SQLiteDatabase) {
  return {
    async create(rec: OfflineMonitoringRecord): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO monitoring_records (
          id, farm_id, field_plot_id, monitoring_point_id, monitoring_point_code,
          pest_id, pest_name, observed_at, infestation_level,
          sample_count, pest_count, growth_stage,
          has_natural_enemies, natural_enemies_desc, damage_percentage,
          photo_uri, latitude, longitude, notes,
          synced, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $field_plot_id, $monitoring_point_id, $monitoring_point_code,
          $pest_id, $pest_name, $observed_at, $infestation_level,
          $sample_count, $pest_count, $growth_stage,
          $has_natural_enemies, $natural_enemies_desc, $damage_percentage,
          $photo_uri, $latitude, $longitude, $notes,
          $synced, $created_at, $updated_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: rec.id,
          $farm_id: rec.farm_id,
          $field_plot_id: rec.field_plot_id,
          $monitoring_point_id: rec.monitoring_point_id,
          $monitoring_point_code: rec.monitoring_point_code,
          $pest_id: rec.pest_id,
          $pest_name: rec.pest_name,
          $observed_at: rec.observed_at,
          $infestation_level: rec.infestation_level,
          $sample_count: rec.sample_count,
          $pest_count: rec.pest_count,
          $growth_stage: rec.growth_stage,
          $has_natural_enemies: rec.has_natural_enemies,
          $natural_enemies_desc: rec.natural_enemies_desc,
          $damage_percentage: rec.damage_percentage,
          $photo_uri: rec.photo_uri,
          $latitude: rec.latitude,
          $longitude: rec.longitude,
          $notes: rec.notes,
          $synced: rec.synced,
          $created_at: rec.created_at,
          $updated_at: rec.updated_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflineMonitoringRecord[]> {
      return db.getAllAsync<OfflineMonitoringRecord>(
        'SELECT * FROM monitoring_records WHERE farm_id = ? ORDER BY observed_at DESC',
        farmId,
      );
    },

    async getUnsynced(): Promise<OfflineMonitoringRecord[]> {
      return db.getAllAsync<OfflineMonitoringRecord>(
        'SELECT * FROM monitoring_records WHERE synced = 0 ORDER BY created_at ASC',
      );
    },

    async markSynced(id: string): Promise<void> {
      await db.runAsync(
        'UPDATE monitoring_records SET synced = 1, updated_at = ? WHERE id = ?',
        new Date().toISOString(),
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM monitoring_records WHERE id = ?', id);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM monitoring_records WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },
  };
}
