import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflinePesticideApplication } from '@/types/offline';

export function createPesticideApplicationRepository(db: SQLiteDatabase) {
  return {
    async create(app: OfflinePesticideApplication): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO pesticide_applications (
          id, farm_id, field_plot_id, field_plot_name, applied_at,
          product_name, active_ingredient, dose, dose_unit, spray_volume,
          target, target_description, art_number, agronomist_crea,
          technical_justification, temperature, relative_humidity, wind_speed,
          withdrawal_period_days, notes, photo_uri, latitude, longitude,
          synced, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $field_plot_id, $field_plot_name, $applied_at,
          $product_name, $active_ingredient, $dose, $dose_unit, $spray_volume,
          $target, $target_description, $art_number, $agronomist_crea,
          $technical_justification, $temperature, $relative_humidity, $wind_speed,
          $withdrawal_period_days, $notes, $photo_uri, $latitude, $longitude,
          $synced, $created_at, $updated_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: app.id,
          $farm_id: app.farm_id,
          $field_plot_id: app.field_plot_id,
          $field_plot_name: app.field_plot_name,
          $applied_at: app.applied_at,
          $product_name: app.product_name,
          $active_ingredient: app.active_ingredient,
          $dose: app.dose,
          $dose_unit: app.dose_unit,
          $spray_volume: app.spray_volume,
          $target: app.target,
          $target_description: app.target_description,
          $art_number: app.art_number,
          $agronomist_crea: app.agronomist_crea,
          $technical_justification: app.technical_justification,
          $temperature: app.temperature,
          $relative_humidity: app.relative_humidity,
          $wind_speed: app.wind_speed,
          $withdrawal_period_days: app.withdrawal_period_days,
          $notes: app.notes,
          $photo_uri: app.photo_uri,
          $latitude: app.latitude,
          $longitude: app.longitude,
          $synced: app.synced,
          $created_at: app.created_at,
          $updated_at: app.updated_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflinePesticideApplication[]> {
      return db.getAllAsync<OfflinePesticideApplication>(
        'SELECT * FROM pesticide_applications WHERE farm_id = ? ORDER BY applied_at DESC',
        farmId,
      );
    },

    async getUnsynced(): Promise<OfflinePesticideApplication[]> {
      return db.getAllAsync<OfflinePesticideApplication>(
        'SELECT * FROM pesticide_applications WHERE synced = 0 ORDER BY created_at ASC',
      );
    },

    async markSynced(id: string): Promise<void> {
      await db.runAsync(
        'UPDATE pesticide_applications SET synced = 1, updated_at = ? WHERE id = ?',
        new Date().toISOString(),
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM pesticide_applications WHERE id = ?', id);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM pesticide_applications WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },
  };
}
