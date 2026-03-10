# US-034 — Registro de operação de preparo de solo

**Data:** 2026-03-10
**Status:** Implementado (CA4 e CA6 pendentes)

## O que foi feito

### Banco de dados

- **Migration `20260336100000_add_soil_prep_operations`:** tabela `soil_prep_operations`
- Campos: id, farmId, fieldPlotId, operationTypeId (FK → operation_types), operationTypeName, startedAt, endedAt
- Máquina/implemento/operador: machineName, implementName, operatorName, depthCm
- Insumos: campo JSONB `inputs` (array de {productName, dose, doseUnit, totalQuantity, batchCode})
- Condições: soilMoisturePercent, weatherCondition (enum: ENSOLARADO, NUBLADO, etc.)
- Custos: durationHours, machineCostPerHour, laborCount, laborHourCost, inputsCost → totalCost calculado
- Índices: farmId, fieldPlotId, startedAt, operationTypeId
- Relações: Farm, FieldPlot, OperationType (opcional), User (recorder)

### Backend — módulo `soil-prep-operations`

- **Types:** SoilPrepError, constantes (WEATHER_CONDITIONS, DOSE_UNITS), CreateSoilPrepInput, SoilPrepItem
- **Service:** CRUD completo + `createSoilPrepBulk()` para múltiplos talhões
  - Auto-cálculo de totalQuantity (dose × área do talhão) nos insumos
  - Cálculo de totalCost: (duração × custoMáquina/hora) + (duração × laborCount × laborHourCost) + inputsCost
  - Validações: datas, profundidade, umidade 0-100%, condição climática, insumos
- **Routes:** 6 endpoints sob `/org/farms/:farmId/soil-prep-operations`
  - `POST /` — criar (CA2)
  - `POST /bulk` — criar em lote para múltiplos talhões (CA8)
  - `GET /` — listar (paginado, filtros: fieldPlotId, search, dateFrom, dateTo)
  - `GET /:operationId` — detalhe
  - `PATCH /:operationId` — atualizar
  - `DELETE /:operationId` — soft delete
- **Testes:** 17/17 passando

### CAs atendidos

| CA  | Descrição                                                                | Status                                      |
| --- | ------------------------------------------------------------------------ | ------------------------------------------- |
| CA1 | Tipos de preparo (aração, gradagem, etc.)                                | ✅ Satisfeito pelo seed de US-081 CA4       |
| CA2 | Campos: talhão, datas, tipo, máquina, implemento, operador, profundidade | ✅ Implementado                             |
| CA3 | Insumos: produto, dose, totalQuantity auto-calculada, lote               | ✅ Implementado                             |
| CA4 | Baixa automática no estoque                                              | ⏳ Depende do módulo Estoque (EPIC-10)      |
| CA5 | Condições: umidade do solo, clima                                        | ✅ Implementado                             |
| CA6 | Registro via web e mobile                                                | ⏳ Frontend web neste commit, mobile futuro |
| CA7 | Custo calculado: máquina + insumos + mão de obra                         | ✅ Implementado                             |
| CA8 | Registro em lote para múltiplos talhões                                  | ✅ Implementado                             |

## Por que assim

- Insumos como JSONB: flexível para N produtos sem tabela extra, auto-cálculo por área
- Vinculação a OperationType (US-081) permite herdar campos configuráveis e filtro por cultura
- Bulk endpoint cria uma operação por talhão com mesma configuração, recalculando totalQuantity pela área individual

## Arquivos criados/modificados

- `apps/backend/prisma/schema.prisma` — model SoilPrepOperation + relações
- `apps/backend/prisma/migrations/20260336100000_add_soil_prep_operations/migration.sql`
- `apps/backend/src/modules/soil-prep-operations/soil-prep-operations.types.ts`
- `apps/backend/src/modules/soil-prep-operations/soil-prep-operations.service.ts`
- `apps/backend/src/modules/soil-prep-operations/soil-prep-operations.routes.ts`
- `apps/backend/src/modules/soil-prep-operations/soil-prep-operations.routes.spec.ts`
- `apps/backend/src/app.ts` — registro do router
