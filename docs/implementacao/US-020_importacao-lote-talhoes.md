# US-020: Importação em Massa de Talhões

## Resumo

Permite importar todos os talhões de uma fazenda a partir de um único arquivo geo (GeoJSON, KML, KMZ, Shapefile) contendo múltiplos polígonos. Fluxo em 2 passos: upload → preview (tabela + mapa) → confirmar importação. Importação parcial: ignora inválidos, importa válidos.

## Decisões Técnicas

1. **Sem migration** — tabela `field_plots` já suporta tudo que é necessário
2. **Re-upload no confirm** — arquivo é enviado novamente na confirmação, evitando armazenamento temporário no servidor; arquivos geo são pequenos (<10MB)
3. **Overlap inter-feature** — preview usa turf.js (in-memory); confirm usa PostGIS (insert sequencial na mesma transação, cada insert visível ao próximo overlap check)
4. **Column mapping no backend** — frontend envia config de mapeamento, backend resolve e valida
5. **Limite: 500 features** por importação

## O que foi implementado

### Etapa 1: geo-parser + types

**Arquivo:** `apps/backend/src/modules/farms/geo-parser.ts`

- Nova interface `ParsedFeature` — preserva `polygon`, `properties` e `sourceIndex`
- Nova interface `ParseResultWithFeatures` — inclui `features`, `propertyKeys` (união de todas as chaves) e `warnings`
- Nova função `extractFeatures()` — mesmo fluxo de `extractPolygons()` mas preserva properties das features
- Nova função `parseGeoFileWithFeatures()` — reutiliza parsers existentes (GeoJSON/KML/KMZ/Shapefile) com `extractFeatures()`
- Funções existentes (`parseGeoFile`, `extractPolygons`) inalteradas (backward compatible)

**Arquivo:** `apps/backend/src/modules/farms/farms.types.ts`

Novos tipos: `BulkPreviewFeature`, `BulkPreviewResult`, `ColumnMapping`, `BulkImportInput`, `BulkImportResultItem`, `BulkImportResult`, `MAX_BULK_FEATURES` (500)

### Etapa 2: service + routes + testes

**Arquivo:** `apps/backend/src/modules/farms/farms.service.ts`

- `previewBulkImport()` — parse, valida geometria, calcula área via turf, containment check (ST_Within), overlap contra existentes (ST_Intersects), overlap inter-feature (turf intersect pairwise)
- `executeBulkImport()` — re-parse, filtra por selectedIndices, aplica columnMapping, fallback nome com template `{n}`, valida soilType, insert sequencial com overlap check por plot, audit log `BULK_IMPORT_FIELD_PLOTS`
- `applyColumnMapping()` — resolve propriedades do feature para campos do sistema

**Arquivo:** `apps/backend/src/modules/farms/farms.routes.ts`

2 novos endpoints (registrados ANTES de `/plots/:plotId`):

| Método | Rota                                    | Permissão      | Descrição                      |
| ------ | --------------------------------------- | -------------- | ------------------------------ |
| POST   | `/org/farms/:farmId/plots/bulk/preview` | `farms:create` | Upload → preview com validação |
| POST   | `/org/farms/:farmId/plots/bulk`         | `farms:create` | Upload + mapping → importação  |

Ambos usam `handleGeoUpload()` existente. O confirm recebe campos JSON stringificados via multipart (`columnMapping`, `selectedIndices`, `registrationId`, `defaultName`).

**Testes:** 15 novos em `farms.routes.spec.ts`

### Etapa 3: Frontend

**Arquivo:** `apps/frontend/src/services/api.ts`

- Novo método `postFormData<T>()` — fetch com multipart sem Content-Type manual

**Arquivo:** `apps/frontend/src/types/farm.ts`

Tipos espelhados do backend: `BulkPreviewFeature`, `BulkPreviewResult`, `ColumnMapping`, `BulkImportResultItem`, `BulkImportResult`

**Arquivo:** `apps/frontend/src/hooks/useBulkImport.ts`

State machine: `idle` → `uploading` → `mapping` → `previewing` → `confirming` → `done`

Features:

- Auto-mapping de property keys comuns (nome, cultura, solo, etc.)
- Auto-seleção de todas as features válidas
- Navegação entre steps (goToPreview, goToMapping)
- Toggle de seleção individual e em lote

**Componentes em `apps/frontend/src/components/bulk-import/`:**

| Componente              | Responsabilidade                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `BulkImportModal.tsx`   | Orquestrador: modal com steps, lazy load do mapa                                   |
| `BulkUploadZone.tsx`    | Drag-and-drop + input file                                                         |
| `ColumnMappingForm.tsx` | Select para cada campo do sistema → property key do arquivo                        |
| `BulkPreviewTable.tsx`  | Tabela com checkbox, nome, área, status (ícones CheckCircle/AlertTriangle/XCircle) |
| `BulkPreviewMap.tsx`    | Mini mapa Leaflet: farm boundary + features coloridos por status                   |
| `BulkImportReport.tsx`  | Resultado: X importados, Y ignorados (com motivos)                                 |
| `BulkImportModal.css`   | Estilos seguindo design system (cores, tipografia, espaçamento, acessibilidade)    |

**Integração em `FarmMapPage.tsx`:**

- Botão "Importar talhões" no header (ícone Upload, lucide-react)
- Label visível em desktop, apenas ícone em mobile
- Lazy load do `BulkImportModal`
- Após import, chama `refetch()` do `useFarmMap`

**Testes:** 12 novos em `BulkImportModal.spec.tsx`

### Etapa 4: Fixture + documentação

- `apps/backend/prisma/fixtures/sample-plots.geojson` — FeatureCollection com 5 polígonos dentro do perímetro da Fazenda Santa Helena, com properties: nome, cultura, solo, codigo
- Este documento

## Acessibilidade

- Modal com `role="dialog"`, `aria-modal="true"`, `aria-label`
- Escape fecha o modal
- Focus visible em todos os controles interativos
- Checkboxes com `aria-label` descritivo
- Erros com `role="alert"`
- `prefers-reduced-motion` respeitado (desabilita spinners)
- Ícones decorativos com `aria-hidden="true"`
- Labels visíveis em todos os campos

## Contagem de testes

- Backend: 83 testes em farms.routes.spec (+15 novos) + 20 em geo-parser.spec
- Frontend: 59 testes total (+12 novos)

## Dependências adicionadas

- `@turf/intersect` — cálculo de interseção entre polígonos
- `@turf/boolean-within` — verificação de contenção (instalada mas usada via PostGIS ST_Within)
