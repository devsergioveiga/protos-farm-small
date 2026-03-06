# US-029 CA5 — Movimentações

## Resumo

Aba "Movimentações" na ficha do animal, exibindo o histórico de lotes e locais (pastos/instalações) por onde o animal passou. **Read-only** — as movimentações são criadas pela gestão de lotes (LotsPage/ManageAnimalsModal).

## Decisões de Design

| Decisão                | Motivo                                                         |
| ---------------------- | -------------------------------------------------------------- |
| Sem migration          | Dados já existem em `animal_lot_movements` (US-027)            |
| Sem CRUD no tab        | Movimentações são gerenciadas via Lotes, não pela ficha animal |
| Include `lot.location` | Resolve pasto/instalação vinculado ao lote                     |
| Stats simples          | Total, lote atual, dias no lote, lotes distintos               |
| Seed enriquecido       | `previousLotId` + `exitedAt` para histórico mais rico          |

## Backend

### Tipos (`animal-movements.types.ts`)

- `AnimalMovementItem` — id, lotName, lotLocationType, locationName, previousLotName, enteredAt, exitedAt, durationDays, reason, movedByName
- `AnimalMovementStats` — totalMovements, currentLotName, currentLocationName, daysInCurrentLot, distinctLots
- `AnimalMovementsError` — error class com statusCode

### Service (`animal-movements.service.ts`)

- `listAnimalMovements(ctx, farmId, animalId)` — query `animalLotMovement` com includes (lot→name+locationType+location, previousLot→name, mover→name), ordena por enteredAt DESC, calcula durationDays
- `getAnimalMovementStats(ctx, farmId, animalId)` — conta movimentações, identifica lote atual (exitedAt null), calcula dias, conta lotes distintos

### Routes (`animal-movements.routes.ts`)

| Método | Rota                                                   | Permissão      |
| ------ | ------------------------------------------------------ | -------------- |
| GET    | `/org/farms/:farmId/animals/:animalId/movements`       | `animals:read` |
| GET    | `/org/farms/:farmId/animals/:animalId/movements/stats` | `animals:read` |

### Testes — 8 specs (`animal-movements.routes.spec.ts`)

## Frontend

### Tipos (`types/animal.ts`)

- `AnimalMovementItem`, `AnimalMovementStats`, `LOT_LOCATION_TYPE_LABELS`

### Hook (`useAnimalMovements.ts`)

- Fetch paralelo movements + stats, sem CRUD

### Componentes

- **MovementsTab** — header, skeleton/error/empty states, integração stats+list
- **MovementsStatsCards** — 3 cards: Movimentações (ArrowRightLeft), Lote Atual (FolderOpen), Dias no Lote (Clock)
- **MovementsList** — desktop tabela / mobile cards, badge "Atual", tipo de local, duração, motivo, responsável

### AnimalDetailPage

- Nova tab `movements` adicionada ao tablist (5ª aba)

### Testes — 8 specs (`MovementsTab.spec.tsx`)

## Seed Enriquecido

- **Mimosa** (SH-001): Maternidade(90d) → Recria(60d) → Lactação(atual, 30d)
- **Estrela** (SH-002): Maternidade(120d) → Lactação(atual, 90d)
- **Flor** (SH-007): Maternidade(45d) → Recria Fêmeas(atual, 60d)
- Bezerros mantêm movimentação simples (30d no Maternidade)

## Verificação

```bash
pnpm --filter backend exec jest animal-movements   # 8 testes backend
pnpm --filter frontend test -- --run                # 8 testes frontend (MovementsTab)
```
