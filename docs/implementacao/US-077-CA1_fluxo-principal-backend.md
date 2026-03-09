# US-077 CA1 — Fluxo principal: modelo de dados + backend CRUD

## O quê

Modelo de dados e API REST para lançamento de operação em bloco para equipe de campo. Uma operação-mãe (`TeamOperation`) gera apontamentos individuais (`TeamOperationEntry`) para cada membro selecionado.

## Por quê

Evitar que o encarregado registre a mesma atividade pessoa por pessoa. Uma única chamada POST cria registros para todos os membros selecionados.

## Modelo de dados

### TeamOperation (operação-mãe)

- farmId, fieldPlotId, teamId, operationType (FieldOperationType enum)
- performedAt, timeStart, timeEnd (duração calculada)
- notes, photoUrl, latitude, longitude
- recordedBy, deletedAt (soft delete)

### TeamOperationEntry (apontamento individual)

- teamOperationId, userId (unique constraint)
- hoursWorked (ajuste individual), productivity, productivityUnit
- notes individual

## Endpoints

- `GET /org/farms/:farmId/team-operations/types` — lista 12 tipos
- `POST /org/farms/:farmId/team-operations` — cria operação + entries em transação
- `GET /org/farms/:farmId/team-operations` — lista com filtros (teamId, fieldPlotId, operationType, dateFrom, dateTo)
- `GET /org/farms/:farmId/team-operations/:operationId` — detalhe com entries
- `DELETE /org/farms/:farmId/team-operations/:operationId` — soft delete

## Validações

- Talhão pertence à fazenda
- Equipe pertence à fazenda
- Tipo de operação válido (enum FieldOperationType)
- timeEnd > timeStart
- Ao menos 1 membro selecionado
- memberIds deduplicados

## Testes

- 10 testes de rota (create, validações, list, get, delete, auth, errors)
