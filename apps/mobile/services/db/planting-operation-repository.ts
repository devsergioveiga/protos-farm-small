import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflinePlantingOperation } from '@/types/offline';

export function createPlantingOperationRepository(db: SQLiteDatabase) {
  return {
    async create(op: OfflinePlantingOperation): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO planting_operations (
          id, farm_id, field_plot_id, field_plot_name,
          cultivar_id, cultivar_name, crop, planting_date,
          season_year, season_type, planted_area_percent,
          population_per_m, row_spacing_cm, depth_cm, seed_rate_kg_ha,
          seed_treatments, base_fertilizations,
          machine_name, operator_name, average_speed_km_h,
          seed_cost, fertilizer_cost, treatment_cost, operation_cost,
          notes, photo_uri, latitude, longitude,
          synced, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $field_plot_id, $field_plot_name,
          $cultivar_id, $cultivar_name, $crop, $planting_date,
          $season_year, $season_type, $planted_area_percent,
          $population_per_m, $row_spacing_cm, $depth_cm, $seed_rate_kg_ha,
          $seed_treatments, $base_fertilizations,
          $machine_name, $operator_name, $average_speed_km_h,
          $seed_cost, $fertilizer_cost, $treatment_cost, $operation_cost,
          $notes, $photo_uri, $latitude, $longitude,
          $synced, $created_at, $updated_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: op.id,
          $farm_id: op.farm_id,
          $field_plot_id: op.field_plot_id,
          $field_plot_name: op.field_plot_name,
          $cultivar_id: op.cultivar_id,
          $cultivar_name: op.cultivar_name,
          $crop: op.crop,
          $planting_date: op.planting_date,
          $season_year: op.season_year,
          $season_type: op.season_type,
          $planted_area_percent: op.planted_area_percent,
          $population_per_m: op.population_per_m,
          $row_spacing_cm: op.row_spacing_cm,
          $depth_cm: op.depth_cm,
          $seed_rate_kg_ha: op.seed_rate_kg_ha,
          $seed_treatments: op.seed_treatments,
          $base_fertilizations: op.base_fertilizations,
          $machine_name: op.machine_name,
          $operator_name: op.operator_name,
          $average_speed_km_h: op.average_speed_km_h,
          $seed_cost: op.seed_cost,
          $fertilizer_cost: op.fertilizer_cost,
          $treatment_cost: op.treatment_cost,
          $operation_cost: op.operation_cost,
          $notes: op.notes,
          $photo_uri: op.photo_uri,
          $latitude: op.latitude,
          $longitude: op.longitude,
          $synced: op.synced,
          $created_at: op.created_at,
          $updated_at: op.updated_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflinePlantingOperation[]> {
      return db.getAllAsync<OfflinePlantingOperation>(
        'SELECT * FROM planting_operations WHERE farm_id = ? ORDER BY planting_date DESC',
        farmId,
      );
    },

    async getUnsynced(): Promise<OfflinePlantingOperation[]> {
      return db.getAllAsync<OfflinePlantingOperation>(
        'SELECT * FROM planting_operations WHERE synced = 0 ORDER BY created_at ASC',
      );
    },

    async markSynced(id: string): Promise<void> {
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE planting_operations SET synced = 1, updated_at = ? WHERE id = ?',
        now,
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM planting_operations WHERE id = ?', id);
    },
  };
}
