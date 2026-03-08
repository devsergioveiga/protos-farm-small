# US-036 CA4 — Salvamento offline com sync posterior

## O que foi feito

### Backend

- Prisma model `FieldOperation` com enums `FieldOperationType` e `FieldOperationLocationType`
- Migration `20260320100000_add_field_operations`
- Módulo `field-operations/` (types, service, routes) com CRUD completo
- Rotas: POST/GET/GET:id/DELETE em `/org/farms/:farmId/field-operations`
- Audit logging e RLS context

### Mobile

- `field_operations` adicionado ao `OperationEntity` (pending-operations-repository)
- Registro salva localmente E enfileira via `createOfflineQueue().enqueue()` para sync
- Payload enviado ao backend no formato camelCase esperado pela API
- O `offline-queue.flush()` existente já cuida do envio automático ao reconectar

## Fluxo de sync

1. Usuário salva operação → SQLite local (`synced=0`) + pending_operations queue
2. Quando online, `usePendingOperations` hook chama `flush()` automaticamente
3. `flush()` envia POST para `/org/farms/:farmId/field-operations`
4. Em caso de conflito 409: log + server_wins (last-write-wins)
5. Após sync bem-sucedido, operação pendente é removida da fila
