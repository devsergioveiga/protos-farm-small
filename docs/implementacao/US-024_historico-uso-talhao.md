# US-024: Histórico de Uso do Talhão

## Resumo

Permite visualizar e gerenciar o histórico de safras e análises de solo de cada talhão, com indicador de rotação de culturas e exportação CSV.

## O que foi implementado

### Etapa 1: Migration + Schema Prisma

**Migration `20260310100000_plot_usage_history`:**

- Enum `SeasonType` (SAFRA, SAFRINHA, INVERNO)
- Tabela `plot_crop_seasons` — safra, cultura, variedade, produtividade, operações (JSONB)
- Tabela `plot_soil_analyses` — análise completa (pH, MO, P, K, Ca, Mg, Al, CTC, V%, S, argila)
- RLS para ambas (tenant isolation via farmId → farms → organizationId)
- Índices em plotId, farmId, startDate/analysisDate

### Etapa 2: Backend — Types + Service

**`plot-history.types.ts`** — Interfaces para CRUD (Create/Update/Item) de safras e análises, RotationIndicator.

**`plot-history.service.ts`** — 10 funções com RLS:

- `listCropSeasons`, `createCropSeason`, `updateCropSeason`, `deleteCropSeason`
- `listSoilAnalyses`, `createSoilAnalysis`, `updateSoilAnalysis`, `deleteSoilAnalysis`
- `getRotationIndicator` — últimas 6 safras: 0=sem dados, 1=monocultura, 2=rotação simples, 3+=diversificada
- `exportPlotHistory` — CSV com BOM UTF-8, separador `;`, seções Safras e Análises de Solo

**Validações:** seasonType enum, startDate < endDate, productivity >= 0, pH 0-14, V% 0-100, clay 0-100.

### Etapa 3: Backend — Routes

**`plot-history.routes.ts`** — Router com mergeParams, montado em `farms.routes.ts` sob `/org/farms/:farmId/plots/:plotId`:

| Método | Rota                       | Permissão    |
| ------ | -------------------------- | ------------ |
| GET    | /crop-seasons              | farms:read   |
| POST   | /crop-seasons              | farms:update |
| PATCH  | /crop-seasons/:seasonId    | farms:update |
| DELETE | /crop-seasons/:seasonId    | farms:update |
| GET    | /soil-analyses             | farms:read   |
| POST   | /soil-analyses             | farms:update |
| PATCH  | /soil-analyses/:analysisId | farms:update |
| DELETE | /soil-analyses/:analysisId | farms:update |
| GET    | /rotation-indicator        | farms:read   |
| GET    | /history/export?format=csv | farms:read   |

Middleware: `authenticate → checkPermission → checkFarmAccess`. Audit log em todas as mutações.

### Etapa 4: Frontend — Componentes

**Tipos adicionados em `farm.ts`:** CropSeasonItem, SoilAnalysisItem, RotationIndicator.

**`api.getBlob()`** — Método para download de arquivos binários (CSV).

**`usePlotHistory`** — Hook que faz fetch paralelo de safras, análises e rotação.

**Componentes:**

1. **RotationBadge** — Badge com ícone RefreshCw, cores por nível (vermelho/amarelo/verde)
2. **PlotHistoryPanel** — Painel slide-in 400px com tabs (Safras/Solo/Exportar), z-index 1002
3. **PlotSeasonTimeline** — Timeline vertical com cards por safra, cores CROP_COLORS
4. **PlotSoilTable** — Tabela desktop / cards mobile, setas delta entre análises
5. **PlotHistoryExport** — Botão download CSV via getBlob()

**Integrações:**

- PlotDetailsPanel — botão BookOpen "Ver histórico do talhão" no header
- FarmMapPage — state `historyPlot`, lazy-load PlotHistoryPanel

### Etapa 5: Seed + Testes

**Seed:** 3 safras (Soja 24/25, Milho safrinha 24, Milho 24/25) + 2 análises de solo (2023, 2024) para Fazenda Santa Helena.

**Testes backend (plot-history.routes.spec.ts):** ~20 testes cobrindo CRUD seasons, CRUD analyses, rotation indicator, CSV export, permissões.

**Testes frontend:** RotationBadge (5), PlotSeasonTimeline (6), PlotSoilTable (4), PlotHistoryPanel (6) = ~21 testes.

## Decisões técnicas

1. **Router separado com mergeParams** — Mantém o farms.routes.ts limpo, reutiliza farmId/plotId do path pai
2. **CSV com BOM UTF-8 + separador `;`** — Compatível com Excel em pt-BR sem necessidade de import wizard
3. **Rotation indicator baseado em últimas 6 safras** — Número suficiente para identificar padrão sem sobrecarregar
4. **PlotHistoryPanel com z-index 1002** — Acima do PlotDetailsPanel (1001) para poder coexistir
5. **Tabs ao invés de scroll único** — Melhor para mobile, separa preocupações visualmente

## Arquivos criados

- `apps/backend/prisma/migrations/20260310100000_plot_usage_history/migration.sql`
- `apps/backend/src/modules/farms/plot-history.types.ts`
- `apps/backend/src/modules/farms/plot-history.service.ts`
- `apps/backend/src/modules/farms/plot-history.routes.ts`
- `apps/backend/src/modules/farms/plot-history.routes.spec.ts`
- `apps/frontend/src/hooks/usePlotHistory.ts`
- `apps/frontend/src/components/map/RotationBadge.tsx` + `.css` + `.spec.tsx`
- `apps/frontend/src/components/map/PlotSeasonTimeline.tsx` + `.css` + `.spec.tsx`
- `apps/frontend/src/components/map/PlotSoilTable.tsx` + `.css` + `.spec.tsx`
- `apps/frontend/src/components/map/PlotHistoryExport.tsx` + `.css`
- `apps/frontend/src/components/map/PlotHistoryPanel.tsx` + `.css` + `.spec.tsx`

## Arquivos modificados

- `apps/backend/prisma/schema.prisma` — enum SeasonType, models PlotCropSeason/PlotSoilAnalysis, relações
- `apps/backend/src/modules/farms/farms.routes.ts` — mount plotHistoryRouter
- `apps/backend/prisma/seed.ts` — 3 safras + 2 análises de solo
- `apps/frontend/src/types/farm.ts` — CropSeasonItem, SoilAnalysisItem, RotationIndicator
- `apps/frontend/src/services/api.ts` — método getBlob()
- `apps/frontend/src/components/map/PlotDetailsPanel.tsx` — botão BookOpen + prop onViewHistory
- `apps/frontend/src/pages/FarmMapPage.tsx` — state historyPlot, lazy PlotHistoryPanel
