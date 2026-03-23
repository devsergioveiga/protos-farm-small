---
phase: 16-cadastro-de-ativos
verified: 2026-03-20T12:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "ATIV-02: Benfeitoria agora aparece como marcador no mapa da fazenda (FarmMapPage com layer 'Benfeitorias')"
    - "ATIV-06: AssetsPage agora tem toggle de visao em mapa com Leaflet markers para assets com coordenadas"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verificar se os campos de geolocalização (Latitude/Longitude) no AssetModal exibem tooltips de ajuda indicando o formato esperado"
    expected: "Campos com hints sobre coordenadas decimais (-23.55 nao '23 graus 33')"
    why_human: "Verificacao de UX de texto de ajuda nos campos de coordenadas"
  - test: "Verificar o wizard de importacao em massa (AssetImportModal) passando por todos os 5 passos com um arquivo CSV real"
    expected: "upload -> mapeamento colunas -> preview dados -> confirmar importacao -> relatorio com erros/sucessos"
    why_human: "Fluxo multi-step com estado assíncrono nao verificavel por analise estatica"
  - test: "Ativar layer 'Benfeitorias' no FarmMapPage e verificar que marcadores aparecem para benfeitorias com coordenadas"
    expected: "Marcadores marrom (circulos) aparecem no mapa; popup mostra nome e assetTag ao clicar"
    why_human: "Rendering Leaflet e interacao com popups nao verificavel por analise estatica"
  - test: "Clicar no toggle de mapa em AssetsPage e verificar rendering"
    expected: "Mapa OSM carrega; marcadores aparecem para ativos com coordenadas; estado vazio exibe mensagem 'Nenhum ativo com coordenadas cadastradas' quando sem dados"
    why_human: "Rendering Leaflet e estado condicional nao verificavel por analise estatica"
---

# Phase 16: Cadastro de Ativos — Verification Report (Re-verification #3)

**Phase Goal:** Gerente pode cadastrar qualquer tipo de ativo da fazenda — maquina, veiculo, benfeitoria, terra ou implemento — com classificacao CPC correta definida desde o schema, tornando a entidade ativo disponivel como raiz de todo o modulo patrimonial
**Verified:** 2026-03-20T12:00:00Z
**Status:** passed — 6/6 success criteria verified
**Re-verification:** Yes — fourth pass; previous score 5/6, gaps closed by plan 16-06

---

## Re-verification Summary

This is the fourth verification of Phase 16. The previous two verifications (2026-03-19T23:40:42Z and 2026-03-20T00:00:00Z) each identified the same 2 gaps related to map integration. Plan 16-06 was executed to close them. This pass confirms **both gaps are now closed** and all previously-verified items remain intact (no regressions).

**Gap closure status: 2/2 gaps closed.**

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                                                                                           | Status   | Evidence                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gerente pode cadastrar maquina, veiculo, implemento, benfeitoria ou terra com classificacao CPC definida, dados de aquisicao, tag patrimonio sequencial e fotos | VERIFIED | `assets.service.ts` forca `NON_DEPRECIABLE_CPC27` para TERRA; schema tem `AssetType`, `AssetClassification`, `AssetStatus` enums; tag gerada como `PAT-NNNNN`; `photoUrls Json?`; `AssetModal.tsx` 825 linhas com type selector                                         |
| 2   | Gerente pode atribuir ativo a fazenda e centro de custo com campos especificos por tipo (HP/RENAVAM, area m2, hectares/matricula)                               | VERIFIED | `farmId`, `costCenterId`, `engineHp`/`renavamCode` para MAQUINA/VEICULO; `areaM2` para BENFEITORIA; `areaHa`/`registrationNumber` para TERRA; `parentAssetId` para IMPLEMENTO                                                                                           |
| 3   | Gerente pode visualizar ficha completa do ativo com abas (drawer lateral) e buscar/filtrar por tipo, fazenda, status e periodo                                  | VERIFIED | `AssetDrawer.tsx` 275 linhas com 6 abas (geral, documentos, combustivel, leituras, manutencao, timeline); `AssetsPage.tsx` tem filtros por `farmId`, `assetType`, `status`, `acquisitionFrom`, `acquisitionTo`                                                          |
| 4   | Gerente pode exportar lista filtrada em CSV e PDF                                                                                                               | VERIFIED | `asset-export.service.ts` existe; rotas `GET /org/:orgId/assets/export/csv` e `/export/pdf` em `assets.routes.ts`; `useAssets.ts` chama `exportCsv` e `exportPdf`; `AssetsPage.tsx` tem botoes de exportacao                                                            |
| 5   | Operador pode registrar leituras de horimetro/odometro com validacao anti-regressao e cadastrar documentos com alerta de vencimento (30/15/7 dias)              | VERIFIED | `meter-readings.service.ts` valida `newValue.lte(lastValue)` lancando erro; `asset-documents.service.ts` implementa alertas em 7/15/30 dias                                                                                                                             |
| 6   | Gerente pode registrar abastecimentos com custo/litro e ver benchmarking de eficiencia vs frota; benfeitoria com coordenadas visivel no mapa da fazenda         | VERIFIED | `fuel-records.service.ts` calcula `fleetAvgLitersPerHour` e `fleetCostPerHour`; `AssetFuelTab.tsx` exibe benchmark visual; FarmMapPage tem layer 'Benfeitorias' (linha 80) passando `showAssets`/`assetMarkers` ao FarmMap; AssetsPage tem toggle mapa com MapContainer |

**Score: 6/6 truths verified**

---

## Gap Closure Verification (Plan 16-06)

Both gaps from the previous verification were verified closed by direct code inspection.

### Gap 1: ATIV-02 — FarmMapPage sem integracao de assets (CLOSED)

| Check                                                          | Expected                      | Found                                                                                                | Status |
| -------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| `assets.service.ts` contem `getAssetsForMap`                   | Function exported             | Line 410: `export async function getAssetsForMap(...)`                                               | PASS   |
| `assets.service.ts` contem `ST_Y`/`ST_X`                       | Raw SQL coordinate extraction | Lines 420-421: `ST_Y(a."geoPoint") AS lat`, `ST_X(a."geoPoint") AS lon`                              | PASS   |
| `assets.service.ts` contem `geoPoint IS NOT NULL`              | Filter NULL geometries        | Line 425: `AND a."geoPoint" IS NOT NULL`                                                             | PASS   |
| `assets.routes.ts` contem `/map` route ANTES de `/:id`         | Prevent routing conflict      | Line 276: `assetsRouter.get(`${base}/map`...)`; `/:id` em linha 315                                  | PASS   |
| `useFarmMap.ts` FarmMapData contem `assetMarkers`              | Extend data interface         | Line 24: `assetMarkers: AssetMapItem[]`                                                              | PASS   |
| `useFarmMap.ts` busca `/org/assets/map?farmId=`                | 4th parallel fetch            | Lines 52-53: `.get<AssetMapItem[]>('/org/assets/map?farmId=${farmId}')`                              | PASS   |
| `FarmMap.tsx` props contem `showAssets`/`assetMarkers`         | New props                     | Lines 112-113: `showAssets?: boolean; assetMarkers?: AssetMapItem[]`                                 | PASS   |
| `FarmMap.tsx` renderiza CircleMarker com `key="asset-"`        | Marker rendering              | Lines 400-403: `showAssets && assetMarkers.map((asset) => <CircleMarker key={'asset-'+asset.id}...>` | PASS   |
| `FarmMapPage.tsx` DEFAULT_LAYERS contem `id: 'assets'`         | Layer toggle                  | Line 80: `{ id: 'assets', label: 'Benfeitorias', enabled: false }`                                   | PASS   |
| `FarmMapPage.tsx` passa `showAssets`/`assetMarkers` ao FarmMap | Wiring                        | Lines 488-489: `showAssets={showAssets}` e `assetMarkers={data.assetMarkers}`                        | PASS   |
| `FarmMapPage.spec.tsx` tem `assetMarkers: []` no MOCK_DATA     | Testes compilam               | Line 102: `assetMarkers: []` adicionado                                                              | PASS   |

### Gap 2: ATIV-06 — AssetsPage sem visao em mapa (CLOSED)

| Check                                                                 | Expected              | Found                                                                                        | Status          |
| --------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- | --------------- | ---- |
| `useAssets.ts` contem `fetchMapAssets`                                | Nova funcao no hook   | Lines 145-162: `const fetchMapAssets = useCallback(...)` chamando `/org/${orgId}/assets/map` | PASS            |
| `useAssets.ts` importa `AssetMapItem`                                 | Tipo correto          | Line 9: `AssetMapItem` importado de `@/types/asset`                                          | PASS            |
| `AssetsPage.tsx` contem `viewMode` state                              | Toggle list/map       | Line 266: `const [viewMode, setViewMode] = useState<'list'                                   | 'map'>('list')` | PASS |
| `AssetsPage.tsx` contem `mapAssets` state                             | Estado para markers   | Line 267: `const [mapAssets, setMapAssets] = useState<AssetMapItem[]>([])`                   | PASS            |
| `AssetsPage.tsx` importa `MapContainer`                               | Leaflet componente    | Line 2: `import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'`       | PASS            |
| `AssetsPage.tsx` renderiza `MapContainer` quando `viewMode === 'map'` | Map rendering         | Lines 630-675: bloco condicional `{viewMode === 'map' && ...MapContainer...}`                | PASS            |
| `AssetsPage.tsx` contem empty state message                           | UX quando sem markers | Lines 636-640: `Nenhum ativo com coordenadas cadastradas...`                                 | PASS            |
| `AssetsPage.tsx` botoes toggle com `aria-pressed`                     | Acessibilidade        | Lines 431-442: `aria-pressed={viewMode === 'list'}` e `aria-pressed={viewMode === 'map'}`    | PASS            |
| `AssetsPage.css` contem `.assets-page__view-toggle-btn`               | Estilos do toggle     | Lines 643-688: todas as classes CSS presentes                                                | PASS            |
| `types/asset.ts` contem `AssetMapItem` com `lat/lon`                  | Tipo frontend         | Line 152: `export interface AssetMapItem` com `lat: number; lon: number`                     | PASS            |
| `assets.types.ts` (backend) contem `AssetMapItem`                     | Tipo backend          | Line 78: `export interface AssetMapItem`                                                     | PASS            |

---

## Regression Check on Previously-Verified Items

All previously-verified items confirmed intact:

| Item                             | Check                                                                      | Result                               |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| Backend modules                  | `ls apps/backend/src/modules/assets/`                                      | All 10 files present                 |
| Fuel/meter modules               | `ls fuel-records/ meter-readings/`                                         | All files present                    |
| Frontend components              | `ls apps/frontend/src/components/assets/`                                  | All 12 files present                 |
| App.tsx routing                  | `grep AssetsPage App.tsx`                                                  | Line 109 lazy import, line 218 Route |
| Sidebar PATRIMONIO               | `grep PATRIMONIO Sidebar.tsx`                                              | Line 192 confirmed                   |
| app.ts wiring                    | assetsRouter, assetDocumentsRouter, fuelRecordsRouter, meterReadingsRouter | Lines 110-113 import, 232-235 use    |
| TERRA classification             | `grep NON_DEPRECIABLE_CPC27 assets.service.ts`                             | Lines 66 and 276-277 confirmed       |
| Route order `/map` before `/:id` | Lines 276 vs 315 in assets.routes.ts                                       | CORRECT — `/map` registered first    |

---

## Required Artifacts

### Backend

| Artifact                                                            | Status   | Notes                                                                                                                       |
| ------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/assets/assets.routes.ts`                  | VERIFIED | Endpoints: list, summary, get, map, create, update, patch-status, delete, export/csv, export/pdf, bulk-import, photo-upload |
| `apps/backend/src/modules/assets/assets.service.ts`                 | VERIFIED | Sequential PAT-NNNNN tag; PostGIS raw SQL; TERRA forces NON_DEPRECIABLE_CPC27; getAssetsForMap with ST_Y/ST_X               |
| `apps/backend/src/modules/assets/assets.types.ts`                   | VERIFIED | Full typed inputs + AssetMapItem interface                                                                                  |
| `apps/backend/src/modules/assets/assets.routes.spec.ts`             | VERIFIED | 755 lines, 33 test cases                                                                                                    |
| `apps/backend/src/modules/assets/asset-file-parser.ts`              | VERIFIED | 215 lines; CSV + XLSX with ExcelJS                                                                                          |
| `apps/backend/src/modules/assets/asset-bulk-import.service.ts`      | VERIFIED | 482 lines                                                                                                                   |
| `apps/backend/src/modules/assets/asset-documents.routes.ts`         | VERIFIED | Wired to app.ts line 233                                                                                                    |
| `apps/backend/src/modules/assets/asset-documents.service.ts`        | VERIFIED | 30/15/7 day cutoffs                                                                                                         |
| `apps/backend/src/modules/assets/asset-export.service.ts`           | VERIFIED | CSV + PDF export                                                                                                            |
| `apps/backend/src/modules/fuel-records/fuel-records.routes.ts`      | VERIFIED | Wired to app.ts line 234                                                                                                    |
| `apps/backend/src/modules/fuel-records/fuel-records.service.ts`     | VERIFIED | Fleet avg benchmarking                                                                                                      |
| `apps/backend/src/modules/meter-readings/meter-readings.routes.ts`  | VERIFIED | Wired to app.ts line 235                                                                                                    |
| `apps/backend/src/modules/meter-readings/meter-readings.service.ts` | VERIFIED | Anti-regression validation                                                                                                  |
| Backend map endpoint `GET /org/:orgId/assets/map`                   | VERIFIED | Line 276 assets.routes.ts; calls getAssetsForMap; farmId query param; BEFORE /:id route                                     |

### Prisma Schema

| Model/Enum                 | Status   | Notes                                                                                                      |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `enum AssetType`           | VERIFIED | MAQUINA, VEICULO, IMPLEMENTO, BENFEITORIA, TERRA, EQUIPAMENTO                                              |
| `enum AssetClassification` | VERIFIED | DEPRECIABLE_CPC27, NON_DEPRECIABLE_CPC27, FAIR_VALUE_CPC29, BEARER_PLANT_CPC27                             |
| `enum AssetStatus`         | VERIFIED | ATIVO, INATIVO, EM_MANUTENCAO, ALIENADO, EM_ANDAMENTO                                                      |
| `model Asset`              | VERIFIED | `geoPoint Unsupported("geometry(Point, 4326)")?` and `geoBoundary Unsupported("geometry(Polygon, 4326)")?` |
| `model FuelRecord`         | VERIFIED | Linked to Asset                                                                                            |
| `model MeterReading`       | VERIFIED | Hourmeter/odometer history                                                                                 |
| `model AssetDocument`      | VERIFIED | Document with expiresAt                                                                                    |
| Migration                  | VERIFIED | `20260412200000_add_asset_models`                                                                          |

### Frontend

| Artifact                                                      | Status   | Notes                                                                                  |
| ------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `apps/frontend/src/pages/AssetsPage.tsx`                      | VERIFIED | viewMode state; MapContainer for map view; empty state; list/card views preserved      |
| `apps/frontend/src/components/assets/AssetDrawer.tsx`         | VERIFIED | 275 lines; 6 tabs                                                                      |
| `apps/frontend/src/components/assets/AssetModal.tsx`          | VERIFIED | 825 lines                                                                              |
| `apps/frontend/src/components/assets/AssetImportModal.tsx`    | VERIFIED | 537 lines; 5-step wizard                                                               |
| `apps/frontend/src/components/assets/AssetGeneralTab.tsx`     | VERIFIED | 234 lines                                                                              |
| `apps/frontend/src/components/assets/AssetDocumentsTab.tsx`   | VERIFIED | 257 lines                                                                              |
| `apps/frontend/src/components/assets/AssetFuelTab.tsx`        | VERIFIED | Fleet benchmark comparison                                                             |
| `apps/frontend/src/components/assets/AssetReadingsTab.tsx`    | VERIFIED | 303 lines                                                                              |
| `apps/frontend/src/components/assets/AssetMaintenanceTab.tsx` | VERIFIED | Intentional empty state (Phase 18 deferred)                                            |
| `apps/frontend/src/components/assets/AssetTimelineTab.tsx`    | VERIFIED | 80 lines                                                                               |
| `apps/frontend/src/components/map/FarmMap.tsx`                | VERIFIED | showAssets + assetMarkers props; brown CircleMarker rendering with Popup               |
| `apps/frontend/src/pages/FarmMapPage.tsx`                     | VERIFIED | 'assets'/'Benfeitorias' in DEFAULT_LAYERS; showAssets + assetMarkers passed to FarmMap |
| `apps/frontend/src/pages/FarmMapPage.spec.tsx`                | VERIFIED | assetMarkers: [] added to MOCK_DATA                                                    |
| `apps/frontend/src/hooks/useAssets.ts`                        | VERIFIED | fetchMapAssets function added; calls /org/${orgId}/assets/map                          |
| `apps/frontend/src/hooks/useFarmMap.ts`                       | VERIFIED | FarmMapData.assetMarkers: AssetMapItem[]; 4th parallel fetch                           |
| `apps/frontend/src/hooks/useAssetDetail.ts`                   | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/hooks/useAssetForm.ts`                     | VERIFIED | BENFEITORIA_FIELDS separated                                                           |
| `apps/frontend/src/hooks/useAssetBulkImport.ts`               | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/hooks/useFuelRecords.ts`                   | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/hooks/useMeterReadings.ts`                 | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/types/asset.ts`                            | VERIFIED | AssetMapItem interface with lat/lon added                                              |
| `apps/frontend/src/pages/AssetsPage.css`                      | VERIFIED | All 5 CSS classes for map toggle and container present                                 |
| Map view toggle in AssetsPage                                 | VERIFIED | viewMode state + MapContainer + CircleMarkers + empty state all present                |

---

## Key Link Verification

| From                  | To                                            | Via                      | Status | Details                                                                                                 |
| --------------------- | --------------------------------------------- | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------- |
| AssetsPage.tsx        | GET /org/:orgId/assets                        | useAssets hook           | WIRED  | `useAssets.ts` calls `api.get('/org/${orgId}/assets${qs}')`                                             |
| AssetsPage.tsx        | GET /org/:orgId/assets/export/csv             | useAssets.exportCsv      | WIRED  | Confirmed                                                                                               |
| AssetsPage.tsx        | GET /org/:orgId/assets/map                    | useAssets.fetchMapAssets | WIRED  | Lines 145-162 useAssets.ts; called on map view toggle (line 390 AssetsPage)                             |
| AssetModal.tsx        | POST/PUT /org/:orgId/assets                   | useAssetForm hook        | WIRED  | Confirmed                                                                                               |
| AssetDrawer.tsx       | GET /org/:orgId/assets/:id                    | useAssetDetail hook      | WIRED  | Confirmed                                                                                               |
| AssetFuelTab.tsx      | GET /org/:orgId/assets/:id/fuel-records/stats | useFuelRecords           | WIRED  | Confirmed                                                                                               |
| AssetReadingsTab.tsx  | POST /org/:orgId/assets/:id/meter-readings    | useMeterReadings         | WIRED  | Confirmed                                                                                               |
| AssetDocumentsTab.tsx | GET /org/:orgId/assets/:id/documents          | useAssetDocuments        | WIRED  | Confirmed                                                                                               |
| app.ts                | assetsRouter                                  | import + app.use('/api') | WIRED  | Lines 110 + 232                                                                                         |
| app.ts                | assetDocumentsRouter                          | import + app.use('/api') | WIRED  | Lines 111 + 233                                                                                         |
| app.ts                | fuelRecordsRouter                             | import + app.use('/api') | WIRED  | Lines 112 + 234                                                                                         |
| app.ts                | meterReadingsRouter                           | import + app.use('/api') | WIRED  | Lines 113 + 235                                                                                         |
| Asset schema          | PostGIS geoPoint                              | Unsupported() raw SQL    | WIRED  | `assets.service.ts` uses `$executeRawUnsafe` for ST_MakePoint; `$queryRawUnsafe` ST_Y/ST_X for read     |
| FarmMapPage.tsx       | GET /org/assets/map                           | useFarmMap 4th fetch     | WIRED  | useFarmMap.ts line 52-53; FarmMapPage lines 488-489 passing to FarmMap; FarmMap lines 400-403 rendering |

---

## Requirements Coverage

| Requirement | Phase                              | Description                                                                                             | Status           | Evidence                                                                                                                                                                                |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATIV-01     | 16                                 | Cadastro maquinas, veiculos e implementos com NF, fornecedor, valor, horimetro, potencia, status, fotos | SATISFIED        | Schema fields: `invoiceNumber`, `supplierId`, `acquisitionValue`, `currentHourmeter`, `engineHp`, `photoUrls`; full CRUD                                                                |
| ATIV-02     | 16                                 | Benfeitorias com geolocalizacao + visualizacao no mapa da fazenda                                       | SATISFIED        | geoPoint/geoBoundary PostGIS columns; lat/lon inputs in AssetModal; FarmMapPage layer 'Benfeitorias' (line 80) renders CircleMarkers via useFarmMap 4th fetch + FarmMap showAssets prop |
| ATIV-03     | 16                                 | Terras como ativo nao-depreciavel (CPC 27)                                                              | SATISFIED        | TERRA type forces `NON_DEPRECIABLE_CPC27`; fields: `registrationNumber`, `areaHa`, `carCode`; AssetModal shows conditional TERRA section                                                |
| ATIV-04     | 16                                 | Implementos com vinculacao a maquina principal                                                          | SATISFIED        | `parentAssetId` self-referencing FK; selector in AssetModal; service validates parent is MAQUINA type                                                                                   |
| ATIV-05     | 16                                 | Importacao em massa CSV/Excel com mapeamento flexivel, preview e relatorio                              | SATISFIED        | `asset-file-parser.ts` (CSV+XLSX), `asset-bulk-import.service.ts` (482 lines), `AssetImportModal.tsx` (537 lines) 5-step wizard                                                         |
| ATIV-06     | 16                                 | Inventario com filtros, busca, totalizacao, exportacao CSV/Excel/PDF + visao em mapa                    | SATISFIED        | Filters, search, summary stats, CSV+PDF export implemented; map view toggle (viewMode state) with MapContainer + CircleMarkers + empty state all present in AssetsPage                  |
| ATIV-07     | 16                                 | Ficha completa com grafico depreciacao, historico manutencoes, TCO, indicadores, timeline               | PARTIAL/DEFERRED | Timeline tab exists; AssetMaintenanceTab intentionally empty (Phase 18); depreciation chart, TCO not in Phase 16 ROADMAP success criteria — intentionally deferred to Phase 17/18       |
| OPER-01     | 21 (REQUIREMENTS.md), 16 (ROADMAP) | Abastecimentos com custo/litro e benchmarking                                                           | DELIVERED EARLY  | Fully implemented in Phase 16                                                                                                                                                           |
| OPER-03     | 21 (REQUIREMENTS.md), 16 (ROADMAP) | Horimetro/odometro mobile anti-regressao                                                                | DELIVERED EARLY  | Fully implemented in Phase 16                                                                                                                                                           |

### Notes on ATIV-07

ATIV-07 (depreciation chart, TCO, availability indicators) is listed in REQUIREMENTS.md as Phase 16 but the ROADMAP.md success criteria for Phase 16 do NOT include these items. They are deferred to Phase 17 (Depreciacao). The AssetMaintenanceTab correctly shows an intentional empty state with Wrench icon and Phase 18 reference text. This is not a gap — it is an intentional scope split agreed in the ROADMAP.

---

## Anti-Patterns Found

| File                      | Line | Pattern                                          | Severity | Impact                                         |
| ------------------------- | ---- | ------------------------------------------------ | -------- | ---------------------------------------------- |
| `AssetMaintenanceTab.tsx` | 10   | Intentional empty state placeholder for Phase 18 | Info     | Correct UX with icon + description; not a stub |

No blocker anti-patterns found.

---

## Human Verification Required

### 1. Wizard de Importacao em Massa

**Test:** Preparar um CSV com colunas nome, tipo, fazenda, valor_aquisicao e subir via AssetImportModal. Verificar que o passo de mapeamento de colunas mostra os cabecalhos detectados, permite vincular cada coluna ao campo correto, o preview mostra 5 linhas de amostra, e o relatorio pos-importacao exibe linhas com erro em vermelho.
**Expected:** Fluxo de 5 passos completo; erros de validacao visiveis no relatorio; animacao de loading no passo "confirming"
**Why human:** Fluxo multi-step assíncrono com estado de upload, mapeamento dinamico e previews nao verificavel por analise estatica

### 2. Campos de geolocalizacao no AssetModal para BENFEITORIA

**Test:** Criar uma benfeitoria e inserir valores de latitude/longitude. Verificar que os campos aceitam decimais negativos e que o valor e salvo e recuperado corretamente na aba Geral do drawer.
**Expected:** Coordenadas salvas no banco; AssetGeneralTab exibe as coordenadas na aba Geral
**Why human:** Verificar que o `geoLat`/`geoLon` -> `ST_MakePoint` -> raw SQL -> serializacao de volta para o frontend funciona end-to-end

### 3. Layer Benfeitorias no FarmMapPage

**Test:** Abrir FarmMapPage para uma fazenda, expandir o painel de layers, habilitar "Benfeitorias". Para testar com dados: cadastrar uma benfeitoria com lat/lon validos para a fazenda atual.
**Expected:** Marcadores marrom (CircleMarker, 7px radius) aparecem no mapa; popup ao clicar exibe nome e assetTag do ativo
**Why human:** Rendering Leaflet e interacao com popups nao verificavel por analise estatica

### 4. Toggle de Mapa em AssetsPage

**Test:** Acessar AssetsPage, clicar no icone de mapa no toggle do header. Verificar que o mapa OSM carrega e exibe marcadores para ativos com coordenadas. Verificar estado vazio quando nenhum ativo tem coordenadas.
**Expected:** Mapa carrega corretamente; marcadores exibem popup com nome, assetTag e tipo; estado vazio mostra mensagem clara e icone MapPin
**Why human:** Rendering Leaflet, estado condicional e interacao com markers nao verificavel por analise estatica

---

## Gaps Summary

No gaps remain. All 6 success criteria are verified. Phase 16 goal is fully achieved.

Plan 16-06 correctly implemented:

1. Backend endpoint `GET /org/:orgId/assets/map` with PostGIS ST_Y/ST_X extraction, positioned before `/:id` route to avoid routing conflicts
2. `useFarmMap.ts` extended with 4th parallel fetch + `assetMarkers` in FarmMapData
3. `FarmMap.tsx` extended with `showAssets`/`assetMarkers` props rendering brown CircleMarkers with Popup
4. `FarmMapPage.tsx` DEFAULT_LAYERS includes 'assets'/'Benfeitorias' entry; passes props to FarmMap
5. `useAssets.ts` extended with `fetchMapAssets()` function
6. `AssetsPage.tsx` has `viewMode` state, MapContainer rendering, empty state, and aria-compliant toggle buttons
7. `FarmMapPage.spec.tsx` updated with `assetMarkers: []` to maintain TypeScript compilation

---

_Verified: 2026-03-20T12:00:00Z_
_Verifier: Claude (gsd-verifier) — Re-verification #3, all gaps closed_
