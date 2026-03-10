# US-083 — Registro de Operação de Plantio (CA1-CA9)

## O que foi implementado

Backend completo para registro de plantio com todos os campos técnicos, tratamento de sementes, adubação de base, máquina/operador, cálculo de custo e plantio parcial.

## Critérios de Aceite Cobertos

| CA  | Descrição                                                    | Status               |
| --- | ------------------------------------------------------------ | -------------------- |
| CA1 | Campos obrigatórios (talhão, data, cultura, cultivar, safra) | Implementado         |
| CA2 | Campos técnicos (população, espaçamento, profundidade, taxa) | Implementado         |
| CA3 | Tratamento de sementes (produto, dose, responsável técnico)  | Implementado         |
| CA4 | Adubação de base (formulação, dose, modo aplicação)          | Implementado         |
| CA5 | Máquina plantadeira, operador, velocidade média              | Implementado         |
| CA6 | Baixa automática estoque                                     | Postergado (EPIC-10) |
| CA7 | Talhão muda status para 'Plantado'                           | Implementado         |
| CA8 | Cálculo custo (semente + adubo + tratamento + operação)      | Implementado         |
| CA9 | Plantio parcial (% da área)                                  | Implementado         |

## Arquivos Criados/Modificados

### Prisma

- `apps/backend/prisma/schema.prisma` — Modelo `PlantingOperation` + relações
- `apps/backend/prisma/migrations/20260336200000_add_planting_operations/migration.sql`

### Backend Module

- `apps/backend/src/modules/planting-operations/planting-operations.types.ts`
- `apps/backend/src/modules/planting-operations/planting-operations.service.ts`
- `apps/backend/src/modules/planting-operations/planting-operations.routes.ts`
- `apps/backend/src/modules/planting-operations/planting-operations.routes.spec.ts`
- `apps/backend/src/app.ts` — Registro do `plantingRouter`

## API Endpoints

| Método | Rota                                             | Descrição         |
| ------ | ------------------------------------------------ | ----------------- |
| POST   | `/api/org/farms/:farmId/planting-operations`     | Criar plantio     |
| GET    | `/api/org/farms/:farmId/planting-operations`     | Listar plantios   |
| GET    | `/api/org/farms/:farmId/planting-operations/:id` | Buscar por ID     |
| PATCH  | `/api/org/farms/:farmId/planting-operations/:id` | Atualizar plantio |
| DELETE | `/api/org/farms/:farmId/planting-operations/:id` | Deletar (soft)    |

### Query Parameters (LIST)

- `fieldPlotId`, `crop`, `seasonYear`, `search`, `dateFrom`, `dateTo`, `page`, `limit`

## Modelo de Dados

```
PlantingOperation
├── farmId, fieldPlotId (FKs obrigatórias)
├── cultivarId, operationTypeId (FKs opcionais)
├── seasonYear, seasonType, crop, plantingDate (CA1)
├── plantedAreaPercent (CA9 — padrão 100%)
├── populationPerM, rowSpacingCm, depthCm, seedRateKgHa (CA2)
├── seedTreatments JSON[] (CA3)
├── baseFertilizations JSON[] (CA4)
├── machineName, operatorName, averageSpeedKmH (CA5)
├── seedCost, fertilizerCost, treatmentCost, operationCost (CA8)
└── totalCost (calculado automaticamente)
```

## Testes

15 testes cobrindo CRUD, auth, permissões e validações.
