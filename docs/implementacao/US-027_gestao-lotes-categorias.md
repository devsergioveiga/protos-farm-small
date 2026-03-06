# US-027: Gestão de Lotes e Categorias

## Resumo

Implementação da gestão de lotes (grupos de manejo) para organização de animais. Inclui CRUD de lotes, movimentação de animais entre lotes, dashboard por lote, histórico de composição e alertas de capacidade.

## Critérios de Aceite

| CA  | Descrição                                                          | Status                                        |
| --- | ------------------------------------------------------------------ | --------------------------------------------- |
| CA1 | CRUD de lotes com nome, categoria, local, tipo, capacidade         | Implementado                                  |
| CA2 | Categorias pré-definidas                                           | Já satisfeito (AnimalCategory enum existente) |
| CA3 | Movimentação de animais entre lotes com histórico                  | Implementado                                  |
| CA4 | Dashboard do lote (contagem, peso médio, dias no lote, capacidade) | Implementado                                  |
| CA5 | Histórico de composição do lote (agrupamento mensal por categoria) | Implementado                                  |
| CA6 | Alertas de capacidade (visual + endpoint /alerts)                  | Implementado                                  |

## Arquitetura

### Backend

**Migration:** `20260314100000_animal_lots`

- Enum `LotLocationType` (PASTO, GALPAO, BEZERREIRO, CURRAL, BAIA, CONFINAMENTO, OUTRO)
- Tabela `animal_lots` (soft delete, unique parcial nome/fazenda)
- Tabela `animal_lot_movements` (tracking de movimentações)
- FK `animals.lotId → animal_lots.id` (ON DELETE SET NULL)
- RLS via `farms.organizationId` (padrão existente)

**Módulo:** `modules/animals/animal-lots.*` (colocalizado com animals)

- `animal-lots.types.ts` — AnimalLotError, LOT_LOCATION_TYPES, DTOs
- `animal-lots.service.ts` — 10 funções (CRUD + move + remove + dashboard + history + alerts)
- `animal-lots.routes.ts` — 10 endpoints, RBAC module `animals`
- `animal-lots.routes.spec.ts` — 20 testes

**Endpoints:**

| Método | Rota                                       | Permissão      |
| ------ | ------------------------------------------ | -------------- |
| POST   | `/org/farms/:farmId/lots`                  | animals:create |
| GET    | `/org/farms/:farmId/lots`                  | animals:read   |
| GET    | `/org/farms/:farmId/lots/alerts`           | animals:read   |
| GET    | `/org/farms/:farmId/lots/:lotId`           | animals:read   |
| PATCH  | `/org/farms/:farmId/lots/:lotId`           | animals:update |
| DELETE | `/org/farms/:farmId/lots/:lotId`           | animals:delete |
| POST   | `/org/farms/:farmId/lots/:lotId/move`      | animals:update |
| POST   | `/org/farms/:farmId/lots/:lotId/remove`    | animals:update |
| GET    | `/org/farms/:farmId/lots/:lotId/dashboard` | animals:read   |
| GET    | `/org/farms/:farmId/lots/:lotId/history`   | animals:read   |

### Frontend

**Página:** `/lots` (lazy loaded)

- Grid de cards com nome, categoria badge, localização, contagem, barra de capacidade
- Search debounced + filtros (categoria, tipo de local)
- Paginação, skeleton loading, empty state

**Componentes:**

- `CreateLotModal` — Formulário com 7 campos (4 obrigatórios)
- `LotDetailModal` — 3 tabs (Dashboard, Animais, Histórico)
- `ManageAnimalsModal` — Multi-select de animais com busca

**Hooks:**

- `useLots` — Listagem paginada com filtros
- `useLotDashboard` — Estatísticas do lote
- `useLotHistory` — Histórico de composição mensal

**Navegação:** Link "Lotes" com ícone Layers no topbar

### Seed

- 3 lotes na Fazenda Santa Helena (Maternidade, Recria Fêmeas, Lactação)
- 5 animais atribuídos a lotes com movimentos registrados

## Decisões de Design

1. **RBAC:** Reutiliza módulo `animals` (lotes são sub-feature do rebanho)
2. **Produção L/dia:** Retorna `null` (sem tabela de produção ainda)
3. **Capacidade:** Calculada em read-time via `_count.animals`
4. **Histórico:** Baseado em `animal_lot_movements` (enteredAt/exitedAt)
5. **Soft delete:** Ao excluir lote, animais ficam sem lote (lotId = null)
