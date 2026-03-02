# US-023: Subdivisão e Merge de Talhões

## Resumo

Permite subdividir um talhão em dois usando uma linha de corte e mesclar dois ou mais talhões adjacentes em um só, preservando o histórico de boundaries via versionamento.

## O que foi implementado

### CA1: Subdividir talhão com linha de corte

- Desenho de Polyline sobre o talhão via leaflet-draw
- Backend usa PostGIS `ST_Split` para dividir o polígono pela linha
- Preview retorna as 2 partes com áreas calculadas e nomes sugeridos

### CA2: Dois novos talhões criados com geometria calculada

- Endpoint `POST /org/farms/:farmId/plots/:plotId/subdivide` cria 2 novos talhões
- Talhão original é soft-deleted (deletedAt)
- Propriedades herdadas: soilType, currentCrop, previousCrop, registrationId

### CA3: Mesclar 2+ talhões adjacentes

- Seleção por click no mapa (PlotMergeEditor)
- Backend usa PostGIS `ST_Union` para unir os polígonos
- Preview retorna geometria mesclada, área total e nome sugerido

### CA4: Histórico preservado

- Boundaries dos talhões originais salvos em `field_plot_boundary_versions`
- Campo `editSource` = `'subdivide'` ou `'merge'` para rastreabilidade

### CA5: Nomes sugeridos editáveis

- Subdivisão: nome original + sufixo A/B (editável no preview)
- Merge: concatenação dos nomes (editável no preview)

## Decisões técnicas

1. **Soft-delete dos originais** — Mantém rastreabilidade, permite auditoria futura
2. **PostGIS ST_Split + ST_Union** — Operações geométricas server-side para precisão
3. **Preview antes de executar** — Fluxo em 2 etapas (preview → confirm) evita operações irreversíveis acidentais
4. **leaflet-draw para Polyline** — Reutiliza a dependência já presente (US-022)

## Endpoints

| Método | Rota                                               | Permissão    |
| ------ | -------------------------------------------------- | ------------ |
| POST   | /org/farms/:farmId/plots/:plotId/subdivide/preview | farms:update |
| POST   | /org/farms/:farmId/plots/:plotId/subdivide         | farms:update |
| POST   | /org/farms/:farmId/plots/merge/preview             | farms:update |
| POST   | /org/farms/:farmId/plots/merge                     | farms:update |

## Arquivos criados

- `apps/frontend/src/components/map/PlotSubdivideEditor.tsx` + `.css` + `.spec.tsx`
- `apps/frontend/src/components/map/PlotMergeEditor.tsx` + `.css` + `.spec.tsx`

## Arquivos modificados

- `apps/backend/src/modules/farms/farms.service.ts` — `previewSubdivide`, `executeSubdivide`, `previewMerge`, `executeMerge`
- `apps/backend/src/modules/farms/farms.routes.ts` — 4 novos endpoints
- `apps/backend/src/modules/farms/farms.routes.spec.ts` — 10 novos testes
- `apps/backend/src/modules/farms/farms.types.ts` — tipos Subdivide/Merge
- `apps/frontend/src/components/map/PlotDetailsPanel.tsx` — botão Scissors (subdividir)
- `apps/frontend/src/pages/FarmMapPage.tsx` — state subdividingPlot/isMergeMode, botão Mesclar no header
- `apps/frontend/src/types/farm.ts` — tipos SubdividePreviewResult, MergePreviewResult, etc.

## Testes

- 476 backend + 95 frontend = 571 testes total (10 novos backend + 12 novos frontend)
