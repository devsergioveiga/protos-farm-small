# US-034 CA2 — Operações CRUD offline com flag pendente

## O que

Fila de operações pendentes que permite salvar writes localmente quando offline,
com timestamp, tipo de operação, e status (pending/syncing/error).

## Por quê

Permitir que operadores registrem dados no campo sem internet.
Operações ficam em fila e são sincronizadas automaticamente ao reconectar.

## Decisões técnicas

### Tabela pending_operations (migration V2)

- `id` (autoincrement), `entity`, `entity_id`, `operation` (CREATE/UPDATE/DELETE)
- `payload` (JSON), `endpoint`, `method` (POST/PATCH/DELETE)
- `created_at`, `retries`, `last_error`, `status` (pending/syncing/error)
- Índices em status e entity+entity_id

### Colapso de operações

- UPDATE sobre CREATE pendente → merge no payload do CREATE
- DELETE sobre CREATE pendente → remove tudo (item nunca existiu no servidor)
- Evita envio redundante e mantém fila limpa

### Flush automático

- `usePendingOperations` hook monitora count e auto-flush ao reconectar
- Processamento FIFO (ordem de criação)
- Max 5 retries por operação
- Erros 4xx (exceto 409) são irrecuperáveis
- Erros de rede/5xx permitem retry

### SyncContext expandido

- `pendingCount` — total de operações pendentes
- `isFlushing` / `flushProgress` — estado de flush
- `flushNow()` — flush manual

## Arquivos criados/modificados

- `services/database.ts` — migration V2 (pending_operations table)
- `services/db/pending-operations-repository.ts` — CRUD da fila
- `services/offline-queue.ts` — enqueue, flush, colapso de operações
- `hooks/usePendingOperations.ts` — auto-flush + count tracking
- `hooks/useOfflineData.ts` — adicionado queue e pendingOps
- `stores/SyncContext.tsx` — pendingCount, isFlushing, flushNow
- `services/db/index.ts` — barrel exports atualizados
