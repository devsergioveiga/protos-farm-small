# US-030 CA2 — Filtros Combináveis

## Resumo

Adiciona o filtro por **local** (pasto/instalação) à listagem de animais, completando os filtros combináveis do critério original: raça, sexo, categoria, lote, local, faixa de idade e faixa de peso.

## Contexto

O CA1 já havia implementado os filtros por lotId, birthDate range, weight range, age range, sortBy/sortOrder no backend e frontend. Este CA adiciona o filtro faltante (`locationId`) que filtra animais cujo lote está vinculado a um local específico (pasto ou instalação).

## Decisões de Design

| Decisão                           | Motivo                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| Filtro via `lot.locationId`       | Animais não têm locationId direto — relação é animal→lot→location |
| Reutiliza `useFarmLocations` hook | Hook já existente para o mapa, retorna lista com type/name        |
| Label "(Pasto)" / "(Instalação)"  | Diferencia locais de mesmo nome com tipos diferentes              |

## Backend

### Tipos (`animals.types.ts`)

- Novo campo `locationId?: string` em `ListAnimalsQuery`

### Service (`animals.service.ts`)

- `buildAnimalsWhere`: quando `locationId` presente, adiciona `where.lot = { locationId }` (filtro via relação Prisma)

### Routes (`animals.routes.ts`)

- `GET /org/farms/:farmId/animals` — novo query param `locationId`
- `GET /org/farms/:farmId/animals/export` — novo query param `locationId`

### Testes — 2 novos specs

| Teste                      | Verifica                             |
| -------------------------- | ------------------------------------ |
| locationId filter (list)   | Passa locationId ao service          |
| locationId filter (export) | Passa locationId ao exportAnimalsCsv |

## Frontend

### Hook (`useAnimals.ts`)

- Novo param `locationId?: string`, enviado como query param

### Página (`AnimalsPage.tsx`)

- Novo state `locationFilter` no painel avançado
- Dropdown "Local" com opções do `useFarmLocations` — label inclui "(Pasto)" ou "(Instalação)"
- Integrado em: `hasAdvancedFilters`, `activeFilterCount`, `clearAllFilters`, export

### Testes — 2 novos specs

| Teste                            | Verifica                            |
| -------------------------------- | ----------------------------------- |
| locationId passed to useAnimals  | Seleciona local, verifica hook call |
| location options with type label | Opções exibem nome + tipo correto   |

## Contagem de Testes

- **Backend:** 689 testes (2 novos)
- **Frontend:** 729 testes (2 novos)
- **Total:** 1418

## Referência — US-030 Completa

> 1. ✅ Busca por brinco, nome ou RFID — **CA1**
> 2. ✅ Filtros combináveis: raça, sexo, categoria, lote, local, faixa de idade, faixa de peso — **CA2**
> 3. ⬜ Filtros especiais: prenhas, vazias, em carência, em lactação, secas, aptas para descarte
> 4. ⬜ Resultado com contagem total e peso médio do grupo filtrado
> 5. ✅ Exportação do resultado filtrado em CSV/Excel — **CA1**
> 6. ⬜ Seleção múltipla para ações em lote (mover, registrar evento)
