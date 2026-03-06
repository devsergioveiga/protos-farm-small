# US-029 CA2: Histórico de Pesagens com Gráfico de Evolução de Peso

## O que foi implementado

CRUD completo de pesagens de animais com gráfico de evolução de peso, cards de estatísticas e exportação CSV.

## Arquivos criados

### Backend

- `apps/backend/prisma/migrations/20260316100000_animal_weighings/migration.sql` — tabela `animal_weighings` com RLS
- `apps/backend/src/modules/animals/animal-weighing.types.ts` — tipos e error class
- `apps/backend/src/modules/animals/animal-weighing.service.ts` — 6 funções (CRUD + stats + CSV)
- `apps/backend/src/modules/animals/animal-weighing.routes.ts` — 6 endpoints
- `apps/backend/src/modules/animals/animal-weighing.routes.spec.ts` — 13 testes

### Frontend

- `apps/frontend/src/hooks/useAnimalWeighings.ts` — hook com fetch + mutations
- `apps/frontend/src/components/animals/WeighingTab.tsx` + `.css` — container principal
- `apps/frontend/src/components/animals/WeighingStatsCards.tsx` + `.css` — 4 cards estatísticas
- `apps/frontend/src/components/animals/WeighingChart.tsx` + `.css` — gráfico recharts (lazy)
- `apps/frontend/src/components/animals/WeighingRecordsList.tsx` + `.css` — tabela/cards
- `apps/frontend/src/components/animals/CreateWeighingModal.tsx` + `.css` — modal criar/editar
- `apps/frontend/src/components/animals/WeighingExport.tsx` + `.css` — botão CSV
- `apps/frontend/src/components/animals/WeighingTab.spec.tsx` — 12 testes

## Arquivos modificados

- `apps/backend/prisma/schema.prisma` — model AnimalWeighing + relações
- `apps/backend/prisma/seed.ts` — 14 pesagens para 3 animais
- `apps/backend/src/app.ts` — registro do animalWeighingRouter
- `apps/frontend/src/types/animal.ts` — tipos WeighingItem, WeighingStats
- `apps/frontend/src/pages/AnimalDetailPage.tsx` — aba Pesagens habilitada
- `apps/frontend/src/pages/AnimalDetailPage.spec.tsx` — ajuste count `(Em breve)` + mock WeighingTab
- `apps/frontend/package.json` — dependência recharts

## Endpoints

| Método | Path                                                         | Permissão      |
| ------ | ------------------------------------------------------------ | -------------- |
| GET    | `/org/farms/:farmId/animals/:animalId/weighings`             | animals:read   |
| POST   | `/org/farms/:farmId/animals/:animalId/weighings`             | animals:update |
| PATCH  | `/org/farms/:farmId/animals/:animalId/weighings/:weighingId` | animals:update |
| DELETE | `/org/farms/:farmId/animals/:animalId/weighings/:weighingId` | animals:update |
| GET    | `/org/farms/:farmId/animals/:animalId/weighings/stats`       | animals:read   |
| GET    | `/org/farms/:farmId/animals/:animalId/weighings/export`      | animals:read   |

## Testes

- Backend: 638 testes (13 novos), todos passando
- Frontend: 35 testes novos/modificados passando (12 WeighingTab + 23 AnimalDetailPage)
