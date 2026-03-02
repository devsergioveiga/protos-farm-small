# US-019: Cadastro de talhão com georreferenciamento

## Resumo

Implementação do CRUD de talhões (field plots) — subdivisões produtivas da fazenda com geometria própria, vinculados obrigatoriamente a uma fazenda e opcionalmente a uma matrícula. Inclui validações espaciais (containment e overlap), cálculo automático de área via PostGIS, visualização no mapa com cores por cultura, e totalização de áreas.

## O que foi implementado

### Etapa 1: Migration

- **Nova tabela `field_plots`** com campos: nome, código, tipo de solo (`SoilType` enum), cultura atual/anterior, notas, boundary PostGIS (Polygon 4326), área calculada, status, soft delete
- **Enum `SoilType`** com 9 valores (latossolo vermelho/amarelo, argissolo, neossolo, etc.)
- **Índices:** farmId, registrationId, GiST para boundary, deletedAt
- **RLS:** mesma pattern de `farm_boundary_versions` — policy via `is_rls_bypassed()` ou verificação de `organizationId` via farms

### Etapa 2: Backend — CRUD + Validações Espaciais

8 novos endpoints sob `/org/farms/:farmId/plots`:

| Método | Rota                                        | Permissão      | Descrição                                    |
| ------ | ------------------------------------------- | -------------- | -------------------------------------------- |
| POST   | `/org/farms/:farmId/plots`                  | `farms:create` | Criar talhão (multipart: file + JSON fields) |
| GET    | `/org/farms/:farmId/plots`                  | `farms:read`   | Listar talhões da fazenda                    |
| GET    | `/org/farms/:farmId/plots/summary`          | `farms:read`   | Totalização (áreas vs. total)                |
| GET    | `/org/farms/:farmId/plots/:plotId`          | `farms:read`   | Detalhe do talhão                            |
| PATCH  | `/org/farms/:farmId/plots/:plotId`          | `farms:update` | Editar campos do talhão                      |
| PUT    | `/org/farms/:farmId/plots/:plotId/boundary` | `farms:update` | Re-upload perímetro                          |
| GET    | `/org/farms/:farmId/plots/:plotId/boundary` | `farms:read`   | GeoJSON do perímetro                         |
| DELETE | `/org/farms/:farmId/plots/:plotId`          | `farms:delete` | Soft delete                                  |

**Validações espaciais:**

- **Containment:** `ST_Within(plot, farm.boundary)` — se o talhão extrapola o perímetro da fazenda, retorna warning (não bloqueia)
- **Overlap:** `ST_Area(ST_Intersection(plot, existing)) / ST_Area(plot)` — se sobreposição >5% com qualquer talhão existente, rejeita com 422
- **Área automática:** calculada via `ST_Area(boundary::geography) / 10000` em hectares

**Reutilização:** `parseGeoFile`, `validateGeometry` de `geo-parser.ts`, `handleGeoUpload()`, multer config, `withRlsContext` de `rls.ts`.

**Modificação em listFarms:** agora inclui `_count.fieldPlots` (filtrando deletedAt null).

### Etapa 3: Frontend

- **Layer "Talhões" ativada** no mapa (removido `disabled: true, futureLabel: 'Em breve'`)
- **useFarmMap** agora busca lista de plots + boundary de cada plot
- **FarmMap** renderiza polígonos de talhões com cores baseadas em `currentCrop` (CROP_COLORS: soja=#DAA520, milho=#228B22, café=#8B4513, etc.)
- **Popups** com nome, área, cultura atual e tipo de solo
- **FarmsPage** exibe contagem real de talhões via `farm._count.fieldPlots`
- **Tipos** atualizados: `FarmListItem._count` agora inclui `fieldPlots`, novos tipos `FieldPlot` e `FieldPlotsSummary`

### Etapa 4: Seed + Documentação

- **3 talhões** na Fazenda Santa Helena (Soja, Milho, Café) com geometrias dentro do perímetro existente
- Vinculados às matrículas 15.234 e 15.235
- Tipos de solo variados (Latossolo Vermelho, Argissolo)

## Decisões técnicas

1. **IDs TEXT (não UUID):** mantendo padrão do projeto para PKs
2. **Soft delete:** mesma pattern de farms (campo `deletedAt`)
3. **Containment como warning:** não bloqueia criação para permitir talhões que ultrapassem ligeiramente o perímetro (erro de GPS comum)
4. **Overlap como bloqueio:** sobreposição >5% indica erro de mapeamento e deve ser corrigida
5. **Cores por cultura:** mapeamento estático no frontend; culturas não reconhecidas usam cor neutra (#6B7280)
6. **Permissões:** reutiliza módulo `farms` existente (farms:create/read/update/delete)

## Testes

- **Backend:** 20 novos testes para endpoints de field plots (444 total)
- **Frontend:** 47 testes passando (ajustes em testes existentes para novo `_count.fieldPlots`)

## Arquivos modificados/criados

| Ação | Arquivo                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| NEW  | `apps/backend/prisma/migrations/20260308100000_add_field_plots/migration.sql` |
| MOD  | `apps/backend/prisma/schema.prisma`                                           |
| MOD  | `apps/backend/src/modules/farms/farms.types.ts`                               |
| MOD  | `apps/backend/src/modules/farms/farms.service.ts`                             |
| MOD  | `apps/backend/src/modules/farms/farms.routes.ts`                              |
| MOD  | `apps/backend/src/modules/farms/farms.routes.spec.ts`                         |
| MOD  | `apps/backend/prisma/seed.ts`                                                 |
| MOD  | `apps/frontend/src/types/farm.ts`                                             |
| MOD  | `apps/frontend/src/pages/FarmMapPage.tsx`                                     |
| MOD  | `apps/frontend/src/hooks/useFarmMap.ts`                                       |
| MOD  | `apps/frontend/src/hooks/useFarmMap.spec.ts`                                  |
| MOD  | `apps/frontend/src/components/map/FarmMap.tsx`                                |
| MOD  | `apps/frontend/src/components/map/LayerControlPanel.spec.tsx`                 |
| MOD  | `apps/frontend/src/pages/FarmsPage.tsx`                                       |
| MOD  | `apps/frontend/src/pages/FarmsPage.spec.tsx`                                  |
| MOD  | `apps/frontend/src/pages/FarmMapPage.spec.tsx`                                |
| NEW  | `docs/implementacao/US-019_cadastro-talhao.md`                                |
