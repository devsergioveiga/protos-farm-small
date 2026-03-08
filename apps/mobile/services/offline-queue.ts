import type { SQLiteDatabase } from 'expo-sqlite';
import { api } from './api';
import {
  createPendingOperationsRepository,
  type OperationEntity,
  type OperationType,
  type PendingOperation,
} from './db';

const MAX_RETRIES = 5;

export interface QueuedWrite {
  operationId: number;
  entity: OperationEntity;
  entityId: string;
  operation: OperationType;
}

export type QueueFlushCallback = (
  status: 'start' | 'progress' | 'done',
  processed: number,
  total: number,
  failed: number,
) => void;

/**
 * Service for queuing offline write operations and flushing them when online.
 */
export function createOfflineQueue(db: SQLiteDatabase) {
  const pendingOps = createPendingOperationsRepository(db);

  return {
    /**
     * Queue a write operation for later sync.
     * Returns the operation ID.
     */
    async enqueue(
      entity: OperationEntity,
      entityId: string,
      operation: OperationType,
      payload: unknown,
      endpoint: string,
      method: string,
    ): Promise<QueuedWrite> {
      // If updating or deleting, remove any pending CREATE for the same entity
      // (collapse create+update into a single create with updated data)
      if (operation === 'UPDATE' || operation === 'DELETE') {
        const existing = await pendingOps.getByEntity(entity, entityId);
        const pendingCreate = existing.find(
          (op) => op.operation === 'CREATE' && op.status !== 'syncing',
        );

        if (pendingCreate && operation === 'UPDATE') {
          // Merge update into the pending create
          await pendingOps.remove(pendingCreate.id);
          const mergedPayload = {
            ...JSON.parse(pendingCreate.payload),
            ...(payload as Record<string, unknown>),
          };
          const id = await pendingOps.add(
            entity,
            entityId,
            'CREATE',
            mergedPayload,
            pendingCreate.endpoint,
            pendingCreate.method,
          );
          return { operationId: id, entity, entityId, operation: 'CREATE' };
        }

        if (pendingCreate && operation === 'DELETE') {
          // Remove the pending create — item never existed on server
          await pendingOps.remove(pendingCreate.id);
          // Also remove any pending updates
          for (const op of existing) {
            if (op.id !== pendingCreate.id) {
              await pendingOps.remove(op.id);
            }
          }
          return { operationId: -1, entity, entityId, operation: 'DELETE' };
        }
      }

      const id = await pendingOps.add(entity, entityId, operation, payload, endpoint, method);
      return { operationId: id, entity, entityId, operation };
    },

    /**
     * Flush all pending operations to the server.
     * Processes in FIFO order. Stops on unrecoverable errors.
     */
    async flush(onProgress?: QueueFlushCallback): Promise<{ processed: number; failed: number }> {
      const ops = await pendingOps.getPending();
      if (ops.length === 0) return { processed: 0, failed: 0 };

      onProgress?.('start', 0, ops.length, 0);
      let processed = 0;
      let failed = 0;

      for (const op of ops) {
        if (op.retries >= MAX_RETRIES) {
          failed++;
          continue;
        }

        try {
          await pendingOps.markSyncing(op.id);
          await sendToServer(op);
          await pendingOps.remove(op.id);
          processed++;
        } catch (err) {
          const error = err instanceof Error ? err.message : 'Erro desconhecido';
          const status = (err as Error & { status?: number }).status;

          // 4xx errors (except 409 conflict) are unrecoverable — don't retry
          if (status && status >= 400 && status < 500 && status !== 409) {
            await pendingOps.markError(op.id, `${status}: ${error}`);
            failed++;
          } else {
            // Network or 5xx — mark error but can retry later
            await pendingOps.markError(op.id, error);
            failed++;
          }
        }

        onProgress?.('progress', processed, ops.length, failed);
      }

      onProgress?.('done', processed, ops.length, failed);
      return { processed, failed };
    },

    /**
     * Get count of pending operations.
     */
    pendingCount: () => pendingOps.countPending(),

    /**
     * Get all pending operations (for UI display).
     */
    getPending: () => pendingOps.getPending(),

    /**
     * Clear all pending operations (e.g., on logout).
     */
    clear: () => pendingOps.clear(),
  };
}

async function sendToServer(op: PendingOperation): Promise<void> {
  const payload = JSON.parse(op.payload);

  switch (op.method) {
    case 'POST':
      await api.post(op.endpoint, payload);
      break;
    case 'PATCH':
      await api.patch(op.endpoint, payload);
      break;
    case 'DELETE':
      await api.delete(op.endpoint);
      break;
    default:
      throw new Error(`Método HTTP não suportado: ${op.method}`);
  }
}
