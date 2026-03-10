# US-081 CA7 — Previsão de execução por operação (Data fixa e Fase fenológica)

## O que foi implementado

Duas modalidades de agendamento para tipos de operação, configuráveis por cultura:

### 1. Data fixa

Dia/mês de início e fim previstos. Ex: calagem de 01/mar a 15/mar.

### 2. Fenológico

Operação vinculada a uma fase fenológica com offset em dias. Ex: adubação de cobertura = 30 dias após plantio (V4).

## Modelo de dados

Nova tabela `operation_type_schedules`:

- `id`, `organization_id`, `operation_type_id` (FK), `crop`
- `schedule_type`: `"fixed_date"` | `"phenological"`
- Data fixa: `start_day`, `start_month`, `end_day`, `end_month` (1-31, 1-12)
- Fenológico: `pheno_stage` (nome da fase), `offset_days` (negativo = antes)
- `notes`
- Unique: (org, operation_type, crop)
- CHECK constraints no banco para validar campos por tipo
- RLS por organização

## Endpoints

| Método | Rota                                      | Permissão    | Descrição                                                          |
| ------ | ----------------------------------------- | ------------ | ------------------------------------------------------------------ |
| GET    | `/api/org/operation-schedules`            | farms:read   | Listar agendamentos (filtros: crop, operationTypeId, scheduleType) |
| GET    | `/api/org/operation-schedules/:id`        | farms:read   | Detalhes de um agendamento                                         |
| PUT    | `/api/org/operation-schedules`            | farms:update | Criar/atualizar agendamento (upsert por operationType+crop)        |
| PUT    | `/api/org/operation-schedules/bulk/:crop` | farms:update | Definir todos agendamentos de uma cultura                          |
| DELETE | `/api/org/operation-schedules/:id`        | farms:update | Remover agendamento                                                |

### PUT body — Data fixa

```json
{
  "operationTypeId": "uuid",
  "crop": "Soja",
  "scheduleType": "fixed_date",
  "startDay": 1,
  "startMonth": 3,
  "endDay": 15,
  "endMonth": 3,
  "notes": "Correção de solo"
}
```

### PUT body — Fenológico

```json
{
  "operationTypeId": "uuid",
  "crop": "Milho",
  "scheduleType": "phenological",
  "phenoStage": "V4",
  "offsetDays": 30,
  "notes": "Nitrogênio 30 dias após plantio"
}
```

## Validações

- `scheduleType` obrigatório: `fixed_date` ou `phenological`
- Data fixa: todos 4 campos (day/month) obrigatórios, dia 1-31, mês 1-12
- Fenológico: `phenoStage` e `offsetDays` obrigatórios
- Tipo de operação deve existir na organização
- Bulk: sem operação duplicada, cultura obrigatória

## Design

- Upsert semântico: PUT no mesmo operationType+crop substitui o anterior
- Bulk PUT substitui todos agendamentos de uma cultura de vez
- `offsetDays` suporta valores negativos (ex: -10 = 10 dias antes da fase)
- `phenoStage` é string livre agora; será vinculado à tabela de fases fenológicas no CA8
- CHECK constraints no PostgreSQL garantem integridade mesmo sem validação app

## Testes

18 testes cobrindo GET (filtros), PUT (ambos tipos, validações, 404, 403), bulk, DELETE.
Total: 63 testes no módulo operation-types.
