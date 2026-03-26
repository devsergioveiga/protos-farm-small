---
phase: 23-relatorios-dashboard-patrimonial
verified: 2026-03-23T13:36:30Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Visual inspection of AssetReportsPage 3 tabs"
    expected: "Inventario tab shows KPI cards (Valor Bruto, Depr Acumulada, Valor Liquido, Qtd Ativos) and classification table. Depreciacao tab shows ComposedChart with horizon selector (12/36/60 months). TCO tab shows fleet table with OK/Monitorar/Substituir/Sem dados badges."
    why_human: "Chart rendering (recharts ComposedChart), responsive card-to-table transformation, and badge colors cannot be verified programmatically."
  - test: "PDF/Excel/CSV export triggers file download"
    expected: "Clicking PDF, Excel, or CSV export buttons initiates a browser download of the report file."
    why_human: "Blob download pattern via temporary <a> element with URL.createObjectURL requires a running browser."
  - test: "CostCenterWizardModal wizard navigation and POST"
    expected: "Clicking 'Criar Centro de Custo' in the header opens the 4-step wizard. Step 1 shows 5 asset-type cards. Step 4 submits to backend and closes modal on success."
    why_human: "Multi-step wizard flow, focus trapping, and actual POST confirmation require visual browser interaction."
---

# Phase 23: Relatorios Dashboard Patrimonial — Verification Report

**Phase Goal:** Contador e gerente tem acesso a relatorios completos do patrimonio — inventario, depreciacao, TCO, custo por centro de custo — e ao wizard de criacao de centro de custo, consumindo dados produzidos por todas as fases anteriores.
**Verified:** 2026-03-23T13:36:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Contador pode gerar relatorio patrimonial com valor bruto, depreciacao acumulada e valor liquido por classe de ativo, exportavel em PDF/Excel/CSV | VERIFIED | `getInventoryReport` + `exportInventoryReport` service with real Prisma queries; 5 route endpoints; 26 tests passing |
| 2  | Contador pode ver relatorio de depreciacao acumulada por periodo e projecao para os proximos 12/36/60 meses | VERIFIED | `getDepreciationProjection` with `horizonMonths: 12 \| 36 \| 60` parameter, forward simulation loop reusing `computeDepreciation` engine |
| 3  | Sistema exibe dashboard de TCO por ativo e por frota, com alerta de "reparar vs substituir" quando custo acumulado de manutencao ultrapassa 60-70% do custo de reposicao | VERIFIED | `getTCOFleet` with `repairRatio >= 0.70 -> REPLACE`, `>= 0.60 -> MONITOR`; `TCOFleetView` renders badge with color + icon + text |
| 4  | Sistema oferece wizard de decisao para orientar o gerente na criacao de centro de custo por tipo de ativo, com exemplos e templates por tipo de fazenda | VERIFIED | `CostCenterWizardModal` with `CC_TEMPLATES` (5 types), 4-step wizard, POSTs to `/api/org/farms/:farmId/cost-centers`; 6 Vitest tests passing |
| 5  | Usuario navega para /asset-reports e ve 3 abas: Inventario, Depreciacao, TCO e Frota | VERIFIED | `AssetReportsPage` at route `/asset-reports`; Sidebar entry `{ to: '/asset-reports', icon: FileBarChart, label: 'Relatorios' }` in PATRIMONIO group |
| 6  | Inventario tab shows KPI cards and classification table wired to backend | VERIFIED | `useAssetReports` calls `api.get('/orgs/${orgId}/asset-reports/inventory')` (api service baseUrl='/api'); `InventarioTab` renders 4 KPI cards from `data.totals` |
| 7  | Backend asset-reports module wired in app.ts | VERIFIED | `grep -c "assetReportsRouter" app.ts` returns 2 (import + use) |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `apps/backend/src/modules/asset-reports/asset-reports.types.ts` | — | 85 | VERIFIED | Exports `RepairAlert`, `InventoryReportRow`, `DepreciationProjectionRow`, `TCOFleetRow`, `ExportFormat` |
| `apps/backend/src/modules/asset-reports/asset-reports.service.ts` | — | 637 | VERIFIED | Exports `getInventoryReport`, `getDepreciationProjection`, `getTCOFleet`, `exportInventoryReport` |
| `apps/backend/src/modules/asset-reports/asset-reports.service.spec.ts` | — | 355 | VERIFIED | 16 unit tests, covers inventory roll-up, projection series, TCO alert thresholds, NO_DATA guard |
| `apps/backend/src/modules/asset-reports/asset-reports.routes.ts` | — | 138 | VERIFIED | 5 endpoints wired, auth + permission guards |
| `apps/backend/src/modules/asset-reports/asset-reports.routes.spec.ts` | — | 268 | VERIFIED | 10 route tests covering endpoints, validation, auth guards |
| `apps/frontend/src/components/cost-centers/CostCenterWizardModal.tsx` | 150 | 531 | VERIFIED | 4-step wizard with CC_TEMPLATES (5 types), display:none/block transitions |
| `apps/frontend/src/components/cost-centers/CostCenterWizardModal.css` | 40 | (present) | VERIFIED | Wizard styling with step display:none/block, 48px touch targets |
| `apps/frontend/src/components/cost-centers/CostCenterWizardModal.spec.tsx` | — | (present) | VERIFIED | 6 Vitest tests: step rendering, navigation, POST submission, error handling |
| `apps/frontend/src/pages/AssetReportsPage.tsx` | 150 | 470 | VERIFIED | 3 tabs, KPI cards, classification table, export toolbar, horizon selector, wizard launch |
| `apps/frontend/src/components/assets/DepreciationProjectionChart.tsx` | 40 | 148 | VERIFIED | ComposedChart with 2 series (projectedDepreciation + remainingBookValue) |
| `apps/frontend/src/components/assets/TCOFleetView.tsx` | 80 | 166 | VERIFIED | Fleet table with alert badges using color + icon + text pattern |
| `apps/frontend/src/hooks/useAssetReports.ts` | — | 120 | VERIFIED | Fetches inventory via `api.get('/orgs/${orgId}/asset-reports/inventory')` with exportReport function |
| `apps/frontend/src/hooks/useDepreciationProjection.ts` | — | 75 | VERIFIED | Fetches projection via `api.get('/orgs/${orgId}/asset-reports/depreciation-projection')` |
| `apps/frontend/src/hooks/useTCOFleet.ts` | — | 86 | VERIFIED | Fetches TCO via `api.get('/orgs/${orgId}/asset-reports/tco-fleet')` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `asset-reports.service.ts` | `depreciation-engine.service.ts` | `import computeDepreciation` | WIRED | Line 4 imports `computeDepreciation`; called at line 249 in forward simulation loop |
| `asset-reports.routes.ts` | `app.ts` | `app.use('/api', assetReportsRouter)` | WIRED | `grep -c "assetReportsRouter" app.ts` returns 2 |
| `AssetReportsPage.tsx` | `/api/orgs/:orgId/asset-reports/inventory` | `useAssetReports` hook | WIRED | Hook uses `api.get()` (baseUrl='/api') → full URL `/api/orgs/${orgId}/asset-reports/inventory` |
| `DepreciationProjectionChart.tsx` | `/api/orgs/:orgId/asset-reports/depreciation-projection` | `useDepreciationProjection` hook | WIRED | Hook passed into chart from `DepreciacaoTab`; endpoint confirmed in hook |
| `TCOFleetView.tsx` | `/api/orgs/:orgId/asset-reports/tco-fleet` | `useTCOFleet` hook | WIRED | `TCOFleetTab` calls `useTCOFleet()` and passes `data.assets` to `<TCOFleetView>` |
| `Sidebar.tsx` | `AssetReportsPage` | route `/asset-reports` | WIRED | `{ to: '/asset-reports', icon: FileBarChart, label: 'Relatorios' }` confirmed in Sidebar |
| `App.tsx` | `AssetReportsPage` | `Route path=/asset-reports` | WIRED | `<Route path="/asset-reports" element={<AssetReportsPage />} />` confirmed |
| `CostCenterWizardModal.tsx` | `POST /api/org/farms/:farmId/cost-centers` | `fetch()` on step 4 confirm | WIRED | Line 236: `fetch('/api/org/farms/${effectiveFarmId}/cost-centers', { method: 'POST' })` matches backend route `/org/farms/:farmId/cost-centers` |
| `CostCenterWizardModal.tsx` | `FarmContext` | `useFarmContext()` for farmId | WIRED | Line 14 imports `useFarmContext`; line 113 destructures `selectedFarm, farms, selectedFarmId` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AssetReportsPage.tsx (InventarioTab)` | `data.totals`, `data.rows` | `useAssetReports` → `api.get('/orgs/.../asset-reports/inventory')` → `getInventoryReport` | Yes — Prisma `asset.groupBy` + `depreciationEntry.groupBy` | FLOWING |
| `DepreciationProjectionChart.tsx` | `data.rows` (projectedDepreciation, remainingBookValue) | `useDepreciationProjection` → `getDepreciationProjection` | Yes — `prisma.asset.findMany` + `computeDepreciation` forward simulation | FLOWING |
| `TCOFleetView.tsx` | `data` (TCOFleetRow[]) | `useTCOFleet` → `getTCOFleet` | Yes — Prisma `workOrder.groupBy`, `fuelRecord.groupBy`, `depreciationEntry.groupBy` | FLOWING |
| `CostCenterWizardModal.tsx` | POST body (code, name, description) | User form input → `fetch POST` | Yes — live user input, submitted to `costCentersRouter.post` which writes to DB | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend asset-reports tests pass | `pnpm test --testPathPattern=asset-reports --forceExit` | 26 tests passed, 2 suites | PASS |
| Frontend CostCenterWizardModal tests pass | `pnpm test --run CostCenterWizardModal` | 6 tests passed, 1 suite | PASS |
| assetReportsRouter wired in app.ts | `grep -c "assetReportsRouter" app.ts` | 2 (import + use) | PASS |
| Asset-reports route registered in App.tsx | `grep "asset-reports" App.tsx` | Route confirmed | PASS |
| Sidebar Relatorios entry confirmed | `grep "Relatorios" Sidebar.tsx` | Entry confirmed in PATRIMONIO group | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEPR-04 | 23-01, 23-03 | Contador pode gerar relatorios patrimoniais (inventario, depreciacao acumulada, movimentacao, TCO) com filtros e exportacao PDF/Excel/CSV | SATISFIED | Backend: `getInventoryReport`, `getDepreciationProjection`, `getTCOFleet`, `exportInventoryReport`; Frontend: AssetReportsPage with 3 tabs, KPI cards, chart, fleet table, export buttons |
| CCPA-04 | 23-02, 23-03 | Sistema oferece guia de decisao (wizard) para orientar criacao de centro de custo por ativo com exemplos e templates por tipo de fazenda | SATISFIED | `CostCenterWizardModal` with CC_TEMPLATES (5 types: MAQUINA, VEICULO, IMPLEMENTO, BENFEITORIA, TERRA), 4-step flow, launched from AssetReportsPage header |

### Anti-Patterns Found

No blockers found. All files scanned for TODO/FIXME/placeholder/empty returns.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

Notable observations (not blockers):
- `useAssetReports.ts` uses `api.get()` (with baseUrl='/api') for inventory fetch but uses raw `fetch('/api/...')` directly for export download — this is intentional since the export returns a blob, not JSON.
- `CostCenterWizardModal.tsx` POSTs to `/api/org/farms/:farmId/cost-centers` (singular `org`, no `:orgId` in path) which matches the existing backend `costCentersRouter` route pattern at `/org/farms/:farmId/cost-centers`. This diverges from the PLAN spec which stated `/orgs/:orgId/farms/:farmId/cost-centers` but is consistent with the actual backend implementation.

### Human Verification Required

#### 1. AssetReportsPage Visual Rendering

**Test:** Start dev server, navigate to `/asset-reports`. Click each of the 3 tabs.
**Expected:**
- Inventario tab: 4 KPI cards (Valor Bruto Total, Depreciacao Acumulada, Valor Liquido, Qtd Ativos) in a 2-col mobile / 4-col desktop grid; classification table below with monetary values in JetBrains Mono; PDF/Excel/CSV export buttons in top-right.
- Depreciacao tab: 3-button segmented control (12 meses / 36 meses / 60 meses) switching the ComposedChart horizon; chart shows two series (green area for projected depreciation, dashed blue line for remaining book value).
- TCO e Frota tab: 3 summary cards (Custo Medio/Hora, Custo Manutencao, Custo Combustivel); fleet table grouped by asset type (details/summary); alert badges render color+icon+text correctly (OK in neutral, Monitorar in yellow with triangle, Substituir in red with circle).
**Why human:** Chart rendering and responsive layout require visual browser inspection.

#### 2. PDF/Excel/CSV Export

**Test:** On the Inventario tab, click each of the 3 export buttons.
**Expected:** Browser triggers file download named `relatorio-patrimonial.pdf`, `.xlsx`, and `.csv` respectively with non-zero file sizes.
**Why human:** Blob download via URL.createObjectURL and Content-Disposition headers require browser environment.

#### 3. CostCenterWizardModal Full Flow

**Test:** Click "Criar Centro de Custo" button in the page header. Navigate through all 4 steps. Submit on step 4.
**Expected:**
- Step 1: 5 radio card grid (Maquina/Veiculo/Implemento/Benfeitoria/Terra) with icons. Selecting a card highlights border in primary green.
- Step 2: Code prefix badge (e.g., "MAQ" in JetBrains Mono) with 2-3 examples listed.
- Step 3: Code input pre-filled with `MAQ-` (or selected type's prefix); Nome required; Fazenda shows read-only farm name if farm selected in context.
- Step 4: Summary shows all 4 fields. "Criar Centro de Custo" button POSTs and closes modal.
**Why human:** Focus trapping, form validation on blur, and POST confirmation require live browser interaction.

### Gaps Summary

No blocking gaps found. All 7 observable truths are verified, all 14 artifacts exist and are substantive, all 9 key links are wired, and both requirements (DEPR-04, CCPA-04) are satisfied. Three items require human verification due to visual/interactive nature (chart rendering, export download, wizard UX flow).

---

_Verified: 2026-03-23T13:36:30Z_
_Verifier: Claude (gsd-verifier)_
