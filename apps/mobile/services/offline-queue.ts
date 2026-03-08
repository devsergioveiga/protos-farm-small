import type { SQLiteDatabase } from 'expo-sqlite';
import { api } from './api';
import {
  createPendingOperationsRepository,
  createConflictLogRepository,
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
 * Uses last-write-wins conflict resolution with conflict logging.
 */
export function createOfflineQueue(db: SQLiteDatabase) {
  const pendingOps = createPendingOperationsRepository(db);
  const conflictLog = createConflictLogRepository(db);

  return {
    async enqueue(
      entity: OperationEntity,
      entityId: string,
      operation: OperationType,
      payload: unknown,
      endpoint: string,
      method: string,
    ): Promise<QueuedWrite> {
      if (operation === 'UPDATE' || operation === 'DELETE') {
        const existing = await pendingOps.getByEntity(entity, entityId);
        const pendingCreate = existing.find(
          (op) => op.operation === 'CREATE' && op.status !== 'syncing',
        );

        if (pendingCreate && operation === 'UPDATE') {
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
          await pendingOps.remove(pendingCreate.id);
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
     * On 409 conflict: logs conflict with local+server data, applies server version (last-write-wins).
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

          if (status === 409) {
            // Conflict: server has newer data. Log and accept server version.
            let serverData: unknown = null;
            try {
              serverData = await fetchServerVersion(op);
            } catch {
              // If we can't fetch server version, log what we have
            }
            await conflictLog.log(
              op.entity,
              op.entity_id,
              JSON.parse(op.payload),
              serverData,
              'server_wins',
            );
            await pendingOps.remove(op.id);
            processed++;
          } else if (status && status >= 400 && status < 500) {
            await pendingOps.markError(op.id, `${status}: ${error}`);
            failed++;
          } else {
            await pendingOps.markError(op.id, error);
            failed++;
          }
        }

        onProgress?.('progress', processed, ops.length, failed);
      }

      onProgress?.('done', processed, ops.length, failed);
      return { processed, failed };
    },

    pendingCount: () => pendingOps.countPending(),
    getPending: () => pendingOps.getPending(),
    clear: () => pendingOps.clear(),

    /** Get unreviewed conflict count */
    conflictCount: () => conflictLog.countUnreviewed(),
    /** Get all unreviewed conflicts */
    getConflicts: () => conflictLog.getUnreviewed(),
    /** Mark a conflict as reviewed */
    reviewConflict: (id: number) => conflictLog.markReviewed(id),
    /** Mark all conflicts as reviewed */
    reviewAllConflicts: () => conflictLog.markAllReviewed(),
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

/** Fetch current server version of an entity for conflict logging */
async function fetchServerVersion(op: PendingOperation): Promise<unknown> {
  // For updates, GET the entity to see what the server has
  if (op.operation === 'UPDATE') {
    // endpoint is like /org/farms/:farmId/animals/:id — GET same URL
    return api.get(op.endpoint);
  }
  return null;
}
