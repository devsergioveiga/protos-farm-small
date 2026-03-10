import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineQuickService } from '@/types/offline';

export function createQuickServiceRepository(db: SQLiteDatabase) {
  return {
    async create(qs: OfflineQuickService): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO quick_services (
          id, farm_id, team_id, team_name,
          field_plot_id, field_plot_name,
          location_id, location_type, location_name,
          operation_type, performed_at, time_start, time_end,
          present_member_ids, notes, synced, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $team_id, $team_name,
          $field_plot_id, $field_plot_name,
          $location_id, $location_type, $location_name,
          $operation_type, $performed_at, $time_start, $time_end,
          $present_member_ids, $notes, $synced, $created_at, $updated_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: qs.id,
          $farm_id: qs.farm_id,
          $team_id: qs.team_id,
          $team_name: qs.team_name,
          $field_plot_id: qs.field_plot_id,
          $field_plot_name: qs.field_plot_name,
          $location_id: qs.location_id,
          $location_type: qs.location_type,
          $location_name: qs.location_name,
          $operation_type: qs.operation_type,
          $performed_at: qs.performed_at,
          $time_start: qs.time_start,
          $time_end: qs.time_end,
          $present_member_ids: qs.present_member_ids,
          $notes: qs.notes,
          $synced: qs.synced,
          $created_at: qs.created_at,
          $updated_at: qs.updated_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflineQuickService[]> {
      return db.getAllAsync<OfflineQuickService>(
        'SELECT * FROM quick_services WHERE farm_id = ? ORDER BY performed_at DESC LIMIT 50',
        farmId,
      );
    },

    async getLatestByFarm(farmId: string): Promise<OfflineQuickService | null> {
      return db.getFirstAsync<OfflineQuickService>(
        'SELECT * FROM quick_services WHERE farm_id = ? ORDER BY performed_at DESC LIMIT 1',
        farmId,
      );
    },

    async getUnsynced(): Promise<OfflineQuickService[]> {
      return db.getAllAsync<OfflineQuickService>(
        'SELECT * FROM quick_services WHERE synced = 0 ORDER BY created_at ASC',
      );
    },

    async markSynced(id: string): Promise<void> {
      await db.runAsync(
        'UPDATE quick_services SET synced = 1, updated_at = ? WHERE id = ?',
        new Date().toISOString(),
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM quick_services WHERE id = ?', id);
    },
  };
}
