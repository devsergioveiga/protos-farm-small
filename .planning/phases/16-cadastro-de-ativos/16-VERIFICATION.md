---
phase: 16-cadastro-de-ativos
verified: 2026-03-19T23:40:42Z
status: gaps_found
score: 5/6 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 0/5
  gaps_closed:
    - "Gerente pode cadastrar máquina, veículo, benfeitoria, terra ou implemento com classificação CPC definida"
    - "Gerente pode importar ativos em massa via CSV/Excel com mapeamento de colunas e relatório de erros"
    - "Gerente pode ver inventário completo com filtros, exportação CSV e PDF"
    - "Gerente pode acessar ficha completa do ativo com documentos, fuel, horímetro e timeline (drawer lateral)"
    - "Gerente pode registrar abastecimentos com custo/litro e benchmarking de eficiência vs frota"
    - "Operador pode registrar horímetro/odômetro com validação anti-regressão"
  gaps_remaining:
    - "Benfeitoria não aparece no mapa da fazenda (FarmMapPage sem integração assets)"
    - "AssetsPage não tem visão em mapa do inventário"
  regressions: []
gaps:
  - truth: "Gerente pode cadastrar benfeitoria com geolocalização visualizando no mapa da fazenda"
    status: partial
    reason: "Coordenadas lat/lon são armazenadas no schema Prisma com colunas PostGIS (geoPoint geometry(Point,4326)), mas FarmMapPage.tsx não renderiza marcadores de ativos. Nenhum endpoint retorna ativos com coordenadas no formato GeoJSON para o mapa. O requisito ATIV-02 exige explicitamente 'visualizando no mapa da fazenda'."
    artifacts:
      - path: "apps/frontend/src/pages/FarmMapPage.tsx"
        issue: "Nenhuma referência a assets, Asset, benfeitoria ou geoPoint — marcadores de ativos não são renderizados"
      - path: "apps/backend/src/modules/assets/assets.routes.ts"
        issue: "Nenhum endpoint /map ou /geo que retorne assets com coordenadas para uso pelo mapa da fazenda"
    missing:
      - "Endpoint GET /org/:orgId/assets/map?farmId=:farmId retornando assets com geoPoint serializado como {lat,lon}"
      - "Integração em FarmMapPage.tsx para buscar e renderizar marcadores de benfeitorias usando useEffect + fetch"
      - "Marcador distinto para BENFEITORIA no mapa (ícone Building2 ou similar)"

  - truth: "Gerente pode ver inventário de ativos com visão em mapa (ATIV-06)"
    status: partial
    reason: "AssetsPage.tsx implementa list view e card view mas não tem tab/toggle de visão em mapa. ATIV-06 em REQUIREMENTS.md especifica 'visão em mapa' como parte do inventário."
    artifacts:
      - path: "apps/frontend/src/pages/AssetsPage.tsx"
        issue: "Apenas list view e card view implementados — sem toggle para map view"
    missing:
      - "Aba ou toggle 'Mapa' em AssetsPage que renderiza Leaflet com markers para assets com coordenadas"
      - "useAssetsMap hook ou extensão de useAssets para buscar somente assets com geoPoint preenchido"

human_verification:
  - test: "Verificar se os campos de geolocalização (Latitude/Longitude) no AssetModal exibem tooltips de ajuda indicando o formato esperado"
    expected: "Campos com hints sobre coordenadas decimais (-23.55 não '23°33')"
    why_human: "Verificação de UX de texto de ajuda nos campos de coordenadas"
  - test: "Verificar o wizard de importação em massa (AssetImportModal) passando por todos os 5 passos com um arquivo CSV real"
    expected: "upload → mapeamento colunas → preview dados → confirmar importação → relatório com erros/sucessos"
    why_human: "Fluxo multi-step com estado assíncrono não verificável por análise estática"
---

# Phase 16: Cadastro de Ativos — Verification Report (Re-verification)

**Phase Goal:** Gerente pode cadastrar, buscar e visualizar ativos com classificação CPC correta (máquina, veículo, implemento, benfeitoria, terra) — tornando a entidade ativo disponível como raiz de todo o módulo patrimonial, com controle operacional básico (combustível, horímetro, documentos)
**Verified:** 2026-03-19T23:40:42Z
**Status:** gaps_found — 5/6 success criteria verified; 2 gaps blocking full ATIV-02 and ATIV-06 compliance
**Re-verification:** Yes — after gap closure (previous score 0/5, now 5/6)

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                                                                                           | Status   | Evidence                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gerente pode cadastrar máquina, veículo, implemento, benfeitoria ou terra com classificação CPC definida, dados de aquisição, tag patrimônio sequencial e fotos | VERIFIED | `assets.service.ts` 429 lines; schema has `AssetType`, `AssetClassification`, `AssetStatus` enums; tag gerada como `PAT-NNNNN`; `photoUrls Json?`; `AssetModal.tsx` 825 lines com type selector e conditional sections por tipo |
| 2   | Gerente pode atribuir ativo a fazenda e centro de custo com campos específicos por tipo (HP/RENAVAM, área m², hectares/matrícula)                               | VERIFIED | `farmId`, `costCenterId`, `costCenterMode`, `costCenterPercent` no schema; `engineHp`/`renavamCode` para MAQUINA/VEICULO; `areaM2` para BENFEITORIA; `areaHa`/`registrationNumber` para TERRA; `parentAssetId` para IMPLEMENTO  |
| 3   | Gerente pode visualizar ficha completa do ativo com abas (drawer lateral) e buscar/filtrar por tipo, fazenda, status e período                                  | VERIFIED | `AssetDrawer.tsx` 275 lines com 6 abas (geral, documentos, combustivel, leituras, manutencao, timeline); `AssetsPage.tsx` tem filtros por `farmId`, `assetType`, `status`, `acquisitionFrom`, `acquisitionTo`                   |
| 4   | Gerente pode exportar lista filtrada em CSV e PDF                                                                                                               | VERIFIED | `asset-export.service.ts` existe; rotas `GET /org/:orgId/assets/export/csv` e `/export/pdf` em `assets.routes.ts`; `useAssets.ts` chama `exportCsv` e `exportPdf`; `AssetsPage.tsx` tem botões de exportação                    |
| 5   | Operador pode registrar leituras de horímetro/odômetro com validação anti-regressão e cadastrar documentos com alerta de vencimento (30/15/7 dias)              | VERIFIED | `meter-readings.service.ts` valida `newValue.lte(lastValue)` lançando erro; `asset-documents.service.ts` implementa alertas em 7/15/30 dias com categorias `expired`/`expiring7`/`expiring15`/`expiring30`                      |
| 6   | Gerente pode registrar abastecimentos com custo/litro e ver benchmarking de eficiência vs frota                                                                 | VERIFIED | `fuel-records.service.ts` calcula `fleetAvgLitersPerHour` e `fleetCostPerHour` com Prisma aggregate; `AssetFuelTab.tsx` exibe benchmark visual com comparação `assetCostPerHour` vs `fleetCostPerHour`                          |

**Score: 5/6 truths verified**

The gap is on map rendering for benfeitorias (ATIV-02) and map view in inventory (ATIV-06).

---

## Required Artifacts

### Backend

| Artifact                                                            | Expected                                      | Status   | Details                                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/assets/assets.routes.ts`                  | CRUD + search + export + photo upload routes  | VERIFIED | 432 lines; endpoints: list, summary, get, create, update, patch-status, delete, export/csv, export/pdf, bulk-import, photo-upload |
| `apps/backend/src/modules/assets/assets.service.ts`                 | Business logic, sequential tag PAT-NNNNN      | VERIFIED | 429 lines; sequential tag via `getNextAssetTag`; PostGIS via raw SQL; TERRA forces NON_DEPRECIABLE_CPC27                          |
| `apps/backend/src/modules/assets/assets.types.ts`                   | CreateAssetInput, UpdateAssetInput, AssetItem | VERIFIED | Exists with full typed inputs                                                                                                     |
| `apps/backend/src/modules/assets/assets.routes.spec.ts`             | Integration tests                             | VERIFIED | 755 lines, 33 test cases                                                                                                          |
| `apps/backend/src/modules/assets/asset-file-parser.ts`              | CSV/XLSX parser for bulk import               | VERIFIED | 215 lines; supports `.csv`, `.xlsx`, `.xls` with ExcelJS                                                                          |
| `apps/backend/src/modules/assets/asset-bulk-import.service.ts`      | Bulk import validation + insert               | VERIFIED | 482 lines                                                                                                                         |
| `apps/backend/src/modules/assets/asset-documents.routes.ts`         | Document CRUD + expiry alerts                 | VERIFIED | Exists; wired to app.ts                                                                                                           |
| `apps/backend/src/modules/assets/asset-documents.service.ts`        | Expiry logic 7/15/30 days                     | VERIFIED | 30/15/7 day cutoffs computed                                                                                                      |
| `apps/backend/src/modules/assets/asset-export.service.ts`           | CSV + PDF export                              | VERIFIED | Exists                                                                                                                            |
| `apps/backend/src/modules/fuel-records/fuel-records.routes.ts`      | Fuel records CRUD + benchmarking              | VERIFIED | Exists; wired to app.ts                                                                                                           |
| `apps/backend/src/modules/fuel-records/fuel-records.service.ts`     | Fleet avg benchmarking                        | VERIFIED | Calculates `fleetAvgLitersPerHour`, `fleetCostPerHour`                                                                            |
| `apps/backend/src/modules/meter-readings/meter-readings.routes.ts`  | Meter reading CRUD with anti-regression       | VERIFIED | Exists; wired to app.ts                                                                                                           |
| `apps/backend/src/modules/meter-readings/meter-readings.service.ts` | Anti-regression validation                    | VERIFIED | `newValue.lte(lastValue)` check with clear error message                                                                          |
| Backend map endpoint                                                | GET assets/map with geoPoint for FarmMapPage  | MISSING  | No geo/map endpoint exists for the farm map integration                                                                           |

### Prisma Schema

| Model/Enum                 | Expected                                                                       | Status   | Details                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `enum AssetType`           | MAQUINA, VEICULO, IMPLEMENTO, BENFEITORIA, TERRA, EQUIPAMENTO                  | VERIFIED | Lines 6614–6627 in schema.prisma                                                                                                    |
| `enum AssetClassification` | DEPRECIABLE_CPC27, NON_DEPRECIABLE_CPC27, FAIR_VALUE_CPC29, BEARER_PLANT_CPC27 | VERIFIED | Lines 6622–6628                                                                                                                     |
| `enum AssetStatus`         | ATIVO, INATIVO, EM_MANUTENCAO, ALIENADO, EM_ANDAMENTO                          | VERIFIED | Lines 6629–6636                                                                                                                     |
| `model Asset`              | Full asset entity with PostGIS geoPoint + geoBoundary                          | VERIFIED | Lines 6648–6705; `geoPoint Unsupported("geometry(Point, 4326)")?` and `geoBoundary Unsupported("geometry(Polygon, 4326)")?` present |
| `model FuelRecord`         | Fuel consumption linked to Asset                                               | VERIFIED | Lines 6707–6728                                                                                                                     |
| `model MeterReading`       | Hourmeter/odometer history with anti-regression                                | VERIFIED | Lines 6730–6745                                                                                                                     |
| `model AssetDocument`      | Document with expiresAt                                                        | VERIFIED | Lines 6747–6762                                                                                                                     |
| Prisma migration           | Asset schema migration                                                         | VERIFIED | `20260412200000_add_asset_models`                                                                                                   |

### Frontend

| Artifact                                                      | Expected                              | Status   | Details                                                                                |
| ------------------------------------------------------------- | ------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `apps/frontend/src/pages/AssetsPage.tsx`                      | List + filters + export + card toggle | VERIFIED | 834 lines; filters: farm, type, status, acquisition date range; export CSV + PDF       |
| `apps/frontend/src/components/assets/AssetDrawer.tsx`         | Tabbed detail drawer                  | VERIFIED | 275 lines; 6 tabs fully wired with all tab components                                  |
| `apps/frontend/src/components/assets/AssetModal.tsx`          | Create/edit modal                     | VERIFIED | 825 lines; type selector + conditional sections per type                               |
| `apps/frontend/src/components/assets/AssetImportModal.tsx`    | 6-step bulk import wizard             | VERIFIED | 537 lines; steps: idle → uploading → mapping → previewing → confirming → done          |
| `apps/frontend/src/components/assets/AssetGeneralTab.tsx`     | General data + photos tab             | VERIFIED | 234 lines                                                                              |
| `apps/frontend/src/components/assets/AssetDocumentsTab.tsx`   | Documents with expiry tab             | VERIFIED | 257 lines                                                                              |
| `apps/frontend/src/components/assets/AssetFuelTab.tsx`        | Fuel records tab with benchmarking    | VERIFIED | Exists; shows fleet benchmark comparison                                               |
| `apps/frontend/src/components/assets/AssetReadingsTab.tsx`    | Meter readings tab                    | VERIFIED | 303 lines                                                                              |
| `apps/frontend/src/components/assets/AssetMaintenanceTab.tsx` | Empty state tab (Phase 18)            | VERIFIED | 26 lines; proper empty state with Wrench icon and explanatory text                     |
| `apps/frontend/src/components/assets/AssetTimelineTab.tsx`    | Event timeline tab                    | VERIFIED | 80 lines; no stubs                                                                     |
| `apps/frontend/src/hooks/useAssets.ts`                        | Assets list hook with export          | VERIFIED | Calls `/org/:orgId/assets`, `assets/summary`, `assets/export/csv`, `assets/export/pdf` |
| `apps/frontend/src/hooks/useAssetDetail.ts`                   | Asset detail hook                     | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/hooks/useAssetForm.ts`                     | Asset form hook                       | VERIFIED | Exists; BENFEITORIA_FIELDS separated                                                   |
| `apps/frontend/src/hooks/useAssetBulkImport.ts`               | Bulk import hook                      | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/hooks/useFuelRecords.ts`                   | Fuel records hook                     | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/hooks/useMeterReadings.ts`                 | Meter readings hook                   | VERIFIED | Exists                                                                                 |
| `apps/frontend/src/types/asset.ts`                            | Frontend type definitions             | VERIFIED | 155 lines                                                                              |
| Map view in AssetsPage                                        | Map toggle for inventory              | MISSING  | Only list and card views; no map view tab/toggle                                       |

### Navigation/Routing

| Item                                  | Expected                                                | Status   | Details                                                                                                      |
| ------------------------------------- | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `Sidebar.tsx` PATRIMONIO group        | `title: 'PATRIMONIO'`, item `/assets` with Tractor icon | VERIFIED | Line 192: `title: 'PATRIMONIO'`; line 193: `{ to: '/assets', icon: Tractor, label: 'Ativos' }`               |
| React Router route `/assets`          | `AssetsPage` lazy-loaded                                | VERIFIED | `App.tsx` line 109 (lazy import) + line 217 (Route)                                                          |
| React Router route `/assets/:assetId` | Separate detail page                                    | N/A      | Detail implemented as drawer inside AssetsPage — no dedicated route needed; acceptable pattern per CLAUDE.md |

---

## Key Link Verification

| From                  | To                                            | Via                      | Status    | Details                                                                  |
| --------------------- | --------------------------------------------- | ------------------------ | --------- | ------------------------------------------------------------------------ |
| AssetsPage.tsx        | GET /org/:orgId/assets                        | useAssets hook           | WIRED     | `useAssets.ts` calls `api.get('/org/${orgId}/assets${qs}')`              |
| AssetsPage.tsx        | GET /org/:orgId/assets/export/csv             | useAssets.exportCsv      | WIRED     | `useAssets.ts` calls `api.getBlob('/org/${orgId}/assets/export/csv')`    |
| AssetModal.tsx        | POST/PUT /org/:orgId/assets                   | useAssetForm hook        | WIRED     | `useAssetForm.ts` handles create/update; AssetModal uses it              |
| AssetDrawer.tsx       | GET /org/:orgId/assets/:id                    | useAssetDetail hook      | WIRED     | `useAssetDetail` called with `isOpen ? assetId : null`; loads full asset |
| AssetFuelTab.tsx      | GET /org/:orgId/assets/:id/fuel-records/stats | useFuelRecords           | WIRED     | Benchmarking data fetched; displayed with fleet comparison               |
| AssetReadingsTab.tsx  | POST /org/:orgId/assets/:id/meter-readings    | useMeterReadings         | WIRED     | Anti-regression validation on backend; tab submits new readings          |
| AssetDocumentsTab.tsx | GET /org/:orgId/assets/:id/documents          | useAssetDocuments        | WIRED     | Exists                                                                   |
| app.ts                | assetsRouter                                  | import + app.use('/api') | WIRED     | Lines 110 + 230                                                          |
| app.ts                | assetDocumentsRouter                          | import + app.use('/api') | WIRED     | Lines 111 + 231                                                          |
| app.ts                | fuelRecordsRouter                             | import + app.use('/api') | WIRED     | Lines 112 + 232                                                          |
| app.ts                | meterReadingsRouter                           | import + app.use('/api') | WIRED     | Lines 113 + 233                                                          |
| Asset schema          | PostGIS geoPoint                              | Unsupported() raw SQL    | WIRED     | `assets.service.ts` uses `$executeRawUnsafe` for ST_MakePoint            |
| FarmMapPage.tsx       | GET assets/map                                | map integration          | NOT_WIRED | FarmMapPage has no asset fetching or rendering                           |

---

## Requirements Coverage

| Requirement | REQUIREMENTS.md Phase                              | Description                                                                                             | Status          | Evidence                                                                                                                                                                                             |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATIV-01     | Phase 16                                           | Cadastro máquinas, veículos e implementos com NF, fornecedor, valor, horímetro, potência, status, fotos | SATISFIED       | Schema fields: `invoiceNumber`, `supplierId`, `acquisitionValue`, `currentHourmeter`, `engineHp`, `photoUrls`; full CRUD with conditional type fields                                                |
| ATIV-02     | Phase 16                                           | Benfeitorias com geolocalização + **visualização no mapa da fazenda**                                   | PARTIAL         | geoPoint/geoBoundary PostGIS columns in schema; lat/lon inputs in AssetModal; FarmMapPage NOT updated to render benfeitoria markers                                                                  |
| ATIV-03     | Phase 16                                           | Terras como ativo não-depreciável (CPC 27)                                                              | SATISFIED       | TERRA type forces `NON_DEPRECIABLE_CPC27`; fields: `registrationNumber`, `areaHa`, `carCode`; AssetModal shows conditional TERRA section                                                             |
| ATIV-04     | Phase 16                                           | Implementos com vinculação a máquina principal                                                          | SATISFIED       | `parentAssetId` self-referencing FK; `parentAsset` selector in AssetModal; service validates parent exists and is MAQUINA type                                                                       |
| ATIV-05     | Phase 16                                           | Importação em massa CSV/Excel com mapeamento flexível, preview e relatório                              | SATISFIED       | `asset-file-parser.ts` (CSV+XLSX), `asset-bulk-import.service.ts` (482 lines), `AssetImportModal.tsx` (537 lines) with 5-step wizard                                                                 |
| ATIV-06     | Phase 16                                           | Inventário com filtros, busca, totalização, exportação CSV/Excel/PDF + **visão em mapa**                | PARTIAL         | Filters (type/farm/status/date), search, summary stats, CSV+PDF export implemented; **map view missing**                                                                                             |
| ATIV-07     | Phase 16                                           | Ficha completa com gráfico depreciação, histórico manutenções, TCO, indicadores, timeline               | PARTIAL         | Timeline tab exists (AssetTimelineTab); AssetMaintenanceTab is empty state (deferred to Phase 18); depreciation chart, TCO, availability metric NOT implemented — these are listed as Phase 18 scope |
| OPER-01     | Phase 21 (REQUIREMENTS.md) but in Phase 16 ROADMAP | Abastecimentos com custo/litro e benchmarking                                                           | DELIVERED EARLY | Fully implemented in Phase 16; REQUIREMENTS.md phase assignment should be updated to Phase 16                                                                                                        |
| OPER-03     | Phase 21 (REQUIREMENTS.md) but in Phase 16 ROADMAP | Horímetro/odômetro mobile anti-regressão                                                                | DELIVERED EARLY | Fully implemented in Phase 16; REQUIREMENTS.md phase assignment should be updated to Phase 16                                                                                                        |

### Notes on ATIV-07

ATIV-07 (depreciation chart, TCO, indicators) is listed in REQUIREMENTS.md as Phase 16 but the ROADMAP.md success criteria for Phase 16 do NOT include depreciation charts or TCO. These are deferred to Phase 17 (Depreciação) based on the ROADMAP. The AssetMaintenanceTab correctly shows an empty state referencing Phase 18. ATIV-07 is not fully covered by Phase 16 implementation, but this appears to be an intentional scope split.

---

## Anti-Patterns Found

| File                      | Line | Pattern                                                       | Severity | Impact                                                                                      |
| ------------------------- | ---- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `AssetMaintenanceTab.tsx` | 10   | `if (!props.assetId) return null` + Phase 18 placeholder text | Info     | Intentional empty state for deferred maintenance feature; proper UX with icon + description |

No blockers found. The only anti-pattern is an intentional deferred tab which is correct per the phase scope.

---

## Human Verification Required

### 1. Wizard de Importação em Massa

**Test:** Preparar um CSV com colunas nome, tipo, fazenda, valor_aquisicao e subir via AssetImportModal. Verificar que o passo de mapeamento de colunas mostra os cabeçalhos detectados, permite vincular cada coluna ao campo correto, o preview mostra 5 linhas de amostra, e o relatório pós-importação exibe linhas com erro em vermelho.
**Expected:** Fluxo de 5 passos completo; erros de validação visíveis no relatório; animação de loading no passo "confirming"
**Why human:** Fluxo multi-step assíncrono com estado de upload, mapeamento dinâmico e previews não verificável por análise estática

### 2. Campos de geolocalização no AssetModal para BENFEITORIA

**Test:** Criar uma benfeitoria e inserir valores de latitude/longitude. Verificar que os campos aceitam decimais negativos e que o valor é salvo e recuperado corretamente na aba Geral do drawer.
**Expected:** Coordenadas salvas no banco; AssetGeneralTab exibe as coordenadas na aba Geral
**Why human:** Verificar que o `geoLat`/`geoLon` → `ST_MakePoint` → raw SQL → serialização de volta para o frontend funciona end-to-end

---

## Gaps Summary

Phase 16 foi amplamente implementada desde a verificação inicial (0/5 para 5/6). A implementação cobre o núcleo do módulo patrimonial: schema Prisma completo com PostGIS, 3 módulos backend, frontend com drawer, import wizard, e controle operacional básico.

**Gap remanescente (1 root cause, 2 manifestações):** a integração de mapa para ativos não foi implementada:

1. **ATIV-02 parcial** — `FarmMapPage.tsx` não renderiza marcadores de benfeitorias com coordenadas. O dado está correto no banco (PostGIS), mas o frontend não busca nem exibe. Falta: endpoint `GET /org/:orgId/assets/map?farmId=X` + integração no FarmMapPage.

2. **ATIV-06 parcial** — `AssetsPage.tsx` tem list view e card view, mas ATIV-06 especifica "visão em mapa" como parte do inventário. Falta: toggle de mapa em AssetsPage com Leaflet mostrando markers por tipo.

Ambas as gaps compartilham o mesmo fix: criar uma camada de mapa para assets. O dado de coordenadas já está persistido corretamente — é exclusivamente um gap de apresentação/integração de mapa no frontend.

**Scope note:** OPER-01 e OPER-03 (atribuídos à Phase 21 no REQUIREMENTS.md) foram entregues antecipadamente no Phase 16 conforme o ROADMAP. REQUIREMENTS.md deve ser atualizado para refletir isso. ATIV-07 (depreciação, TCO) é parcialmente adiado para Phase 17 de forma intencional e não constitui um gap desta fase.

---

_Verified: 2026-03-19T23:40:42Z_
_Verifier: Claude (gsd-verifier) — Re-verification after gap closure_
