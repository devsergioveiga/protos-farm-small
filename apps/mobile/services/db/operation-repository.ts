import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineFieldOperation, OfflineOperationTemplate } from '@/types/offline';

export function createOperationRepository(db: SQLiteDatabase) {
  return {
    async create(op: OfflineFieldOperation): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO field_operations (
          id, farm_id, location_id, location_type, location_name,
          operation_type, notes, photo_uri, latitude, longitude,
          recorded_at, synced, created_at, updated_at
        ) VALUES (
          $id, $farm_id, $location_id, $location_type, $location_name,
          $operation_type, $notes, $photo_uri, $latitude, $longitude,
          $recorded_at, $synced, $created_at, $updated_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: op.id,
          $farm_id: op.farm_id,
          $location_id: op.location_id,
          $location_type: op.location_type,
          $location_name: op.location_name,
          $operation_type: op.operation_type,
          $notes: op.notes,
          $photo_uri: op.photo_uri,
          $latitude: op.latitude,
          $longitude: op.longitude,
          $recorded_at: op.recorded_at,
          $synced: op.synced,
          $created_at: op.created_at,
          $updated_at: op.updated_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflineFieldOperation[]> {
      return db.getAllAsync<OfflineFieldOperation>(
        'SELECT * FROM field_operations WHERE farm_id = ? ORDER BY recorded_at DESC',
        farmId,
      );
    },

    async getUnsynced(): Promise<OfflineFieldOperation[]> {
      return db.getAllAsync<OfflineFieldOperation>(
        'SELECT * FROM field_operations WHERE synced = 0 ORDER BY created_at ASC',
      );
    },

    async markSynced(id: string): Promise<void> {
      await db.runAsync(
        'UPDATE field_operations SET synced = 1, updated_at = ? WHERE id = ?',
        new Date().toISOString(),
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM field_operations WHERE id = ?', id);
    },

    async countByFarmId(farmId: string): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM field_operations WHERE farm_id = ?',
        farmId,
      );
      return row?.count ?? 0;
    },
  };
}

export function createTemplateRepository(db: SQLiteDatabase) {
  return {
    async create(tpl: OfflineOperationTemplate): Promise<void> {
      const stmt = await db.prepareAsync(`
        INSERT INTO operation_templates (
          id, farm_id, name, operation_type, default_notes, usage_count, created_at
        ) VALUES (
          $id, $farm_id, $name, $operation_type, $default_notes, $usage_count, $created_at
        )
      `);
      try {
        await stmt.executeAsync({
          $id: tpl.id,
          $farm_id: tpl.farm_id,
          $name: tpl.name,
          $operation_type: tpl.operation_type,
          $default_notes: tpl.default_notes,
          $usage_count: tpl.usage_count,
          $created_at: tpl.created_at,
        });
      } finally {
        await stmt.finalizeAsync();
      }
    },

    async getByFarmId(farmId: string): Promise<OfflineOperationTemplate[]> {
      return db.getAllAsync<OfflineOperationTemplate>(
        'SELECT * FROM operation_templates WHERE farm_id = ? ORDER BY usage_count DESC, name ASC',
        farmId,
      );
    },

    async incrementUsage(id: string): Promise<void> {
      await db.runAsync(
        'UPDATE operation_templates SET usage_count = usage_count + 1 WHERE id = ?',
        id,
      );
    },

    async deleteById(id: string): Promise<void> {
      await db.runAsync('DELETE FROM operation_templates WHERE id = ?', id);
    },
  };
}
