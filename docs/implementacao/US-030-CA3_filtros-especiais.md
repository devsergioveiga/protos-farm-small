# US-030 CA3 — Filtros Especiais

## Resumo

Filtros especiais para manejo do rebanho: prenhas, vazias, em carência, em lactação, secas, aptas para descarte.

## Decisões de Design

| Decisão                                 | Motivo                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| LACTATING/DRY/CULLING via category      | Mapeiam direto para AnimalCategory existente                                   |
| PREGNANT/EMPTY via raw SQL              | Requer lógica cross-table (reproductive records) que Prisma where não expressa |
| WITHDRAWAL via raw SQL + withdrawalDays | Novo campo na tabela, cálculo `eventDate + withdrawalDays > today`             |
| Single dropdown "Filtro especial"       | Filtros são mutuamente exclusivos (prenha vs vazia)                            |

## Database

### Migration `20260319100000_health_withdrawal_days`

- `ALTER TABLE animal_health_records ADD COLUMN "withdrawalDays" INTEGER`

### Schema

- `AnimalHealthRecord.withdrawalDays Int?`

## Backend

### Tipos (`animals.types.ts`)

- `SPECIAL_FILTERS` constant: PREGNANT, EMPTY, WITHDRAWAL, LACTATING, DRY, CULLING
- `SpecialFilter` type, `SPECIAL_FILTER_LABELS_PT`
- `specialFilter?: SpecialFilter` em `ListAnimalsQuery`

### Service (`animals.service.ts`)

- `getSpecialFilterIds(tx, farmId, specialFilter)` — raw SQL para PREGNANT (sem CALVING posterior), EMPTY (fêmeas não prenhas), WITHDRAWAL (carência ativa)
- `buildAnimalsWhere`: LACTATING/DRY/CULLING → `where.category`
- `listAnimals` e `exportAnimalsCsv`: resolve IDs complexos via `getSpecialFilterIds`, adiciona `where.id = { in: ids }`

### Routes (`animals.routes.ts`)

- `specialFilter` query param em list e export endpoints

### Testes — 1 novo spec (specialFilter passado ao service)

## Frontend

### Hook (`useAnimals.ts`)

- Novo param `specialFilter?: string`

### Página (`AnimalsPage.tsx`)

- Dropdown "Filtro especial" no painel avançado com 6 opções pt-BR
- Integrado em: hasAdvancedFilters, activeFilterCount, clearAllFilters, export

### Testes — 1 novo spec (specialFilter passado ao hook)

## Seed

- `withdrawalDays: 35` em vermifugação Ivomec Gold (Mimosa)
- `withdrawalDays: 14` em tratamento Mastofin (Estrela, data recente para carência ativa)
- INSERT atualizado com coluna `"withdrawalDays"`

## Contagem de Testes

- **Backend:** 690 (1 novo)
- **Frontend:** 730 (1 novo)
- **Total:** 1420

## Referência — US-030

> 1. ✅ Busca por brinco, nome ou RFID — **CA1**
> 2. ✅ Filtros combináveis — **CA2**
> 3. ✅ Filtros especiais: prenhas, vazias, em carência, em lactação, secas, aptas para descarte — **CA3**
> 4. ⬜ Resultado com contagem total e peso médio do grupo filtrado
> 5. ✅ Exportação do resultado filtrado — **CA1**
> 6. ⬜ Seleção múltipla para ações em lote
