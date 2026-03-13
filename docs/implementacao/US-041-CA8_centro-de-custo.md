# US-041 CA8 — Centro de custo em equipes de campo

## O quê

Modelo `CostCenter` com CRUD completo e vinculação opcional a `FieldTeam`. Permite categorizar equipes por centro de custo para futuro controle financeiro (Fase 3).

## Por quê

Equipes de campo geram custos (mão de obra, insumos). Vincular a um centro de custo permite rastrear despesas por área/atividade, preparando a base para o módulo financeiro.

## Backend

### Modelo CostCenter (Prisma)

- `id`, `farmId`, `code` (único por fazenda), `name`, `description`, `isActive`
- Relação: `Farm 1:N CostCenter 1:N FieldTeam`
- Migration: `20260346100000_add_cost_centers`

### Módulo `modules/cost-centers/`

- **types.ts:** `CostCenterError`, `CreateCostCenterInput`, `UpdateCostCenterInput`, `CostCenterItem`
- **service.ts:** CRUD com validações (código único por fazenda, deleção bloqueada se há equipes vinculadas)
- **routes.ts:** 5 endpoints sob `/org/farms/:farmId/cost-centers`
  - `POST /` — criar
  - `GET /` — listar (query `?activeOnly=true`)
  - `GET /:costCenterId` — detalhe
  - `PATCH /:costCenterId` — atualizar (inclusive `isActive`)
  - `DELETE /:costCenterId` — excluir (409 se há equipes vinculadas)

### Alterações em `field-teams`

- Campo `costCenterId` (opcional) adicionado ao `FieldTeam`
- `INCLUDE_RELATIONS` inclui `costCenter` (id, code, name)
- `toItem()` retorna `costCenterId`, `costCenterName`, `costCenterCode`
- `createFieldTeam` e `updateFieldTeam` validam se o centro de custo existe e está ativo
- `costCenterId: null` remove o vínculo

## Frontend

### Tipos (`types/field-team.ts`)

- `FieldTeamItem`: novos campos `costCenterId`, `costCenterName`, `costCenterCode`
- `CreateFieldTeamInput`: novo campo `costCenterId`
- Nova interface `CostCenterItem`

### Modal (`FieldTeamModal.tsx`)

- Carrega centros de custo ativos junto com usuários ao abrir
- Select "Centro de custo" aparece quando há centros cadastrados
- Formato: `{código} — {nome}`

### Cards (`FieldTeamsPage.tsx`)

- Exibe centro de custo no card com ícone `Wallet` quando vinculado

## Testes

- Backend: 13 testes (cost-centers) + 12 testes (field-teams) = 25 passando
- Frontend: 14 testes (FieldTeamsPage) passando
