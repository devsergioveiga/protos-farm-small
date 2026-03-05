# US-025: Cadastro Individual de Animal

## Resumo

Implementa o CRUD completo de animais com composição racial estruturada, classificação Girolando automática e registro genealógico. Primeira US do EPIC-05 (Rebanho).

## Estrutura de Dados

### 4 Enums

- `AnimalSex` — MALE, FEMALE
- `AnimalCategory` — BEZERRO, BEZERRA, NOVILHA, NOVILHO, VACA_LACTACAO, VACA_SECA, TOURO_REPRODUTOR, DESCARTE
- `AnimalOrigin` — BORN, PURCHASED
- `GenealogyClass` — PO, PC_OC, PC_OD, GC_01, GC_02, GC_03, PA, LA, CCG, SRD

### 4 Tabelas

1. **`breeds`** — Catálogo de raças (globais + org-specific)
   - 15 raças pré-carregadas (Holandesa, Gir Leiteiro, Nelore, Angus, etc.)
   - Unique: `(name, COALESCE(organizationId, '___global___'))`
   - RLS: raças globais visíveis a todas as orgs

2. **`animals`** — Tabela principal
   - Unique parcial: `(farmId, earTag) WHERE deletedAt IS NULL`
   - Self-referencing: `sireId` (pai, must be MALE), `damId` (mãe, must be FEMALE)
   - Soft delete via `deletedAt`

3. **`animal_breed_compositions`** — Composição racial (1:N)
   - Soma das percentagens deve ser exatamente 100%
   - Unique: `(animalId, breedId)`

4. **`animal_genealogical_records`** — Registro genealógico (1:1 por classe)
   - Unique: `(animalId, genealogyClass)`
   - Inclui grau Girolando quando aplicável

## Backend

### Endpoints (9)

| Método | Rota                                   | Permissão                     |
| ------ | -------------------------------------- | ----------------------------- |
| POST   | `/org/farms/:farmId/animals`           | `animals:create` + farmAccess |
| GET    | `/org/farms/:farmId/animals`           | `animals:read` + farmAccess   |
| GET    | `/org/farms/:farmId/animals/summary`   | `animals:read` + farmAccess   |
| GET    | `/org/farms/:farmId/animals/:animalId` | `animals:read` + farmAccess   |
| PATCH  | `/org/farms/:farmId/animals/:animalId` | `animals:update` + farmAccess |
| DELETE | `/org/farms/:farmId/animals/:animalId` | `animals:delete` + farmAccess |
| GET    | `/org/breeds`                          | `animals:read`                |
| POST   | `/org/breeds`                          | `animals:create`              |
| DELETE | `/org/breeds/:breedId`                 | `animals:delete`              |

### Lógica de Negócio

- **Auto-sugestão de categoria:** baseada em sexo + idade (bezerro < 12m, novilho 12-36m, etc.)
- **Detecção Girolando:** se composição = Holandesa + Gir Leiteiro, detecta grau (F1=50/50, 3/4=75/25, 5/8=62.5/37.5, 3/8=37.5/62.5, 7/8=87.5/12.5)
- **Validação composição:** soma = 100%, mínimo 1 entrada
- **`breedSummary`:** string formatada na listagem (ex: "Holandesa 50% + Gir Leiteiro 50%")

### RBAC

| Papel                 | Permissões           |
| --------------------- | -------------------- |
| ADMIN/SUPER_ADMIN     | CRUD completo        |
| MANAGER               | create, read, update |
| AGRONOMIST/CONSULTANT | read                 |
| OPERATOR/COWBOY       | create, read         |

## Frontend

### AnimalsPage (`/animals`)

- Header com título + "Novo animal" (PermissionGate `animals:create`)
- Toolbar: busca (debounce 300ms), filtros por sexo, categoria, raça
- Desktop: tabela com brinco, nome, sexo (badge), categoria (badge), raça, nascimento
- Mobile: cards empilhados (<768px)
- Empty state com ícone Beef + mensagem contextual (com/sem filtros)
- Skeleton loading, paginação

### CreateAnimalModal (3 passos)

1. **Dados básicos:** brinco*, sexo*, nascimento, categoria (auto-sugerida), origem, peso, ECC
2. **Composição racial:** linhas dinâmicas [raça + %], soma = 100%, badge Girolando
3. **Genealogia (opcional):** classe, nº registro, associação

### Hooks

- `useAnimals(params)` — listagem paginada com filtros
- `useBreeds()` — catálogo de raças

## Seed

8 animais na Fazenda Santa Helena:

- SH-001 Mimosa (Vaca lactação, Girolando F1)
- SH-002 Estrela (Vaca lactação, 3/4 Holandesa)
- SH-003 Princesa (Vaca seca, 5/8 Holandesa)
- SH-004 Trovão (Touro reprodutor, Girolando F1, com registro PO)
- SH-005 (Bezerra, filha de Trovão × Mimosa)
- SH-006 (Bezerro, filho de Trovão × Estrela)
- SH-007 Flor (Novilha, Nelore pura)
- SH-008 Relâmpago (Novilho, Angus × Nelore)

## Arquivos Criados/Modificados

### Criados

- `apps/backend/prisma/migrations/20260313100000_animals/migration.sql`
- `apps/backend/src/modules/animals/animals.types.ts`
- `apps/backend/src/modules/animals/animals.service.ts`
- `apps/backend/src/modules/animals/animals.routes.ts`
- `apps/backend/src/modules/animals/animals.routes.spec.ts`
- `apps/frontend/src/types/animal.ts`
- `apps/frontend/src/hooks/useAnimals.ts`
- `apps/frontend/src/hooks/useBreeds.ts`
- `apps/frontend/src/pages/AnimalsPage.tsx` + `.css` + `.spec.tsx`
- `apps/frontend/src/components/animals/CreateAnimalModal.tsx` + `.css` + `.spec.tsx`

### Modificados

- `apps/backend/prisma/schema.prisma` — 4 enums + 4 models
- `apps/backend/src/shared/rbac/permissions.ts` — module 'animals'
- `apps/backend/prisma/seed.ts` — 15 raças + 8 animais
- `apps/backend/src/app.ts` — animalsRouter
- `apps/backend/src/middleware/check-permission.spec.ts` — 9 módulos
- `apps/frontend/src/App.tsx` — rota `/animals`
- `apps/frontend/src/components/layout/AppLayout.tsx` — link "Animais"

## Testes

- Backend: 33 novos testes (animals.routes.spec.ts)
- Frontend: 25 novos testes (AnimalsPage.spec.tsx + CreateAnimalModal.spec.tsx)
- Total: 562 backend + 608 frontend
