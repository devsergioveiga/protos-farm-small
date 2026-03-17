import type { SQLiteDatabase } from 'expo-sqlite';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type OperationEntity =
  | 'animals'
  | 'animal_lots'
  | 'farm_locations'
  | 'animal_weighings'
  | 'animal_health_records'
  | 'animal_reproductive_records'
  | 'animal_lot_movements'
  | 'field_operations'
  | 'pesticide_applications'
  | 'monitoring_records'
  | 'planting_operations'
  | 'vaccinations'
  | 'dewormings'
  | 'therapeutic_treatments'
  | 'heat_records'
  | 'inseminations'
  | 'pregnancy_diagnoses'
  | 'calving_events'
  | 'mastitis_cases'
  | 'purchase_requests';

export type OperationPriority = 0 | 1;
export const PRIORITY_NORMAL: OperationPriority = 0;
export const PRIORITY_CRITICAL: OperationPriority = 1;

/** Entities that are classified as CRITICAL priority */
const CRITICAL_ENTITIES: ReadonlySet<OperationEntity> = new Set([
  'vaccinations',
  'dewormings',
  'therapeutic_treatments',
  'heat_records',
  'inseminations',
  'pregnancy_diagnoses',
  'calving_events',
  'mastitis_cases',
  'animal_health_records',
  'animal_reproductive_records',
]);

/** Determine the default priority for an entity */
export function getDefaultPriority(entity: OperationEntity): OperationPriority {
  return CRITICAL_ENTITIES.has(entity) ? PRIORITY_CRITICAL : PRIORITY_NORMAL;
}

export interface PendingOperation {
  id: number;
  entity: OperationEntity;
  entity_id: string;
  operation: OperationType;
  payload: string;
  endpoint: string;
  method: string;
  created_at: string;
  retries: number;
  last_error: string | null;
  status: 'pending' | 'syncing' | 'error';
  priority: OperationPriority;
}

export function createPendingOperationsRepository(db: SQLiteDatabase) {
  return {
    async getAll(): Promise<PendingOperation[]> {
      return db.getAllAsync<PendingOperation>(
        'SELECT * FROM pending_operations ORDER BY priority DESC, created_at ASC',
      );
    },

    async getPending(): Promise<PendingOperation[]> {
      return db.getAllAsync<PendingOperation>(
        "SELECT * FROM pending_operations WHERE status IN ('pending', 'error') ORDER BY priority DESC, created_at ASC",
      );
    },

    async getByEntity(entity: OperationEntity, entityId: string): Promise<PendingOperation[]> {
      return db.getAllAsync<PendingOperation>(
        'SELECT * FROM pending_operations WHERE entity = ? AND entity_id = ? ORDER BY priority DESC, created_at ASC',
        entity,
        entityId,
      );
    },

    async add(
      entity: OperationEntity,
      entityId: string,
      operation: OperationType,
      payload: unknown,
      endpoint: string,
      method: string,
      priority?: OperationPriority,
    ): Promise<number> {
      const effectivePriority = priority ?? getDefaultPriority(entity);
      const result = await db.runAsync(
        `INSERT INTO pending_operations (entity, entity_id, operation, payload, endpoint, method, created_at, retries, last_error, status, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 'pending', ?)`,
        entity,
        entityId,
        operation,
        JSON.stringify(payload),
        endpoint,
        method,
        new Date().toISOString(),
        effectivePriority,
      );
      return result.lastInsertRowId;
    },

    async markSyncing(id: number): Promise<void> {
      await db.runAsync("UPDATE pending_operations SET status = 'syncing' WHERE id = ?", id);
    },

    async markError(id: number, error: string): Promise<void> {
      await db.runAsync(
        "UPDATE pending_operations SET status = 'error', last_error = ?, retries = retries + 1 WHERE id = ?",
        error,
        id,
      );
    },

    async remove(id: number): Promise<void> {
      await db.runAsync('DELETE FROM pending_operations WHERE id = ?', id);
    },

    async removeByEntityId(entity: OperationEntity, entityId: string): Promise<void> {
      await db.runAsync(
        'DELETE FROM pending_operations WHERE entity = ? AND entity_id = ?',
        entity,
        entityId,
      );
    },

    async count(): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM pending_operations',
      );
      return row?.count ?? 0;
    },

    async countPending(): Promise<number> {
      const row = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM pending_operations WHERE status IN ('pending', 'error')",
      );
      return row?.count ?? 0;
    },

    async countByPriority(): Promise<{ critical: number; normal: number }> {
      const critical = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM pending_operations WHERE status IN ('pending', 'error') AND priority = 1",
      );
      const normal = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM pending_operations WHERE status IN ('pending', 'error') AND priority = 0",
      );
      return {
        critical: critical?.count ?? 0,
        normal: normal?.count ?? 0,
      };
    },

    async clear(): Promise<void> {
      await db.runAsync('DELETE FROM pending_operations');
    },
  };
}
