import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineTeamOperation } from '@/types/offline';

export function createTeamOperationsRepository(db: SQLiteDatabase) {
  return {
    async create(op: OfflineTeamOperation): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO team_operations (
          id, farm_id, field_plot_id, field_plot_name,
          team_id, team_name, operation_type,
          performed_at, time_start, time_end,
          member_ids, entry_data, notes,
          synced, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $field_plot_id, $field_plot_name,
          $team_id, $team_name, $operation_type,
          $performed_at, $time_start, $time_end,
          $member_ids, $entry_data, $notes,
          $synced, $created_at, $updated_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: op.id,
          $farm_id: op.farm_id,
          $field_plot_id: op.field_plot_id,
          $field_plot_name: op.field_plot_name,
          $team_id: op.team_id,
          $team_name: op.team_name,
          $operation_type: op.operation_type,
          $performed_at: op.performed_at,
          $time_start: op.time_start,
          $time_end: op.time_end,
          $member_ids: op.member_ids,
          $entry_data: op.entry_data,
          $notes: op.notes,
          $synced: op.synced,
          $created_at: op.created_at,
          $updated_at: op.updated_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflineTeamOperation[]> {
      return db.getAllAsync<OfflineTeamOperation>(
        'SELECT * FROM team_operations WHERE farm_id = ? ORDER BY performed_at DESC LIMIT 50',
        farmId,
      );
    },

    async getUnsynced(): Promise<OfflineTeamOperation[]> {
      return db.getAllAsync<OfflineTeamOperation>(
        'SELECT * FROM team_operations WHERE synced = 0 ORDER BY created_at ASC',
      );
    },

    async markSynced(id: string): Promise<void> {
      await db.runAsync(
        'UPDATE team_operations SET synced = 1, updated_at = ? WHERE id = ?',
        new Date().toISOString(),
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM team_operations WHERE id = ?', id);
    },
  };
}
