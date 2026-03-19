---
phase: 16-cadastro-de-ativos
plan: '04'
subsystem: frontend
tags: [react, typescript, assets, drawer, fuel-records, meter-readings, documents, accessibility]

requires:
  - 16-cadastro-de-ativos/16-01
  - 16-cadastro-de-ativos/16-02
  - 16-cadastro-de-ativos/16-03

provides:
  - 'AssetDrawer: 480px slide-in panel from row/card click with 6 accessible tabs'
  - 'AssetGeneralTab: type-conditional data sections for MAQUINA/VEICULO/IMPLEMENTO/BENFEITORIA/TERRA'
  - 'AssetDocumentsTab: CRUD with expiry color badges (Vencido/Vence em X dias/Em dia)'
  - 'AssetFuelTab: benchmarking stats (ativo vs frota), inline form, sortable records'
  - 'AssetReadingsTab: current readings display, add form with inline anti-regression error (role=alert)'
  - 'AssetMaintenanceTab: Phase 18 placeholder'
  - 'AssetTimelineTab: chronological events from asset data'
  - 'useAssetDetail: fetch single asset by ID hook'
  - 'useAssetDocuments: CRUD + fetchExpiring for org-wide expiry badge'
  - 'useFuelRecords: CRUD + stats for fuel consumption benchmarking'
  - 'useMeterReadings: CRUD + latest readings + submitError for anti-regression'
  - 'AssetsPage: drawer opens on row/card click, expiry badge via fetchExpiring cross-reference'

affects:
  - 16-cadastro-de-ativos/16-05

tech-stack:
  added: []
  patterns:
    - 'AssetDrawer: backdrop + panel, slide-in translateX 300ms ease-out, Escape key handler'
    - 'Tab pattern: role=tablist, role=tab with aria-selected, role=tabpanel with hidden attribute, lazy render per active tab'
    - 'Anti-regression inline error: role=alert span with AlertTriangle icon, not generic toast'
    - 'Benchmarking: assetCostPerHour vs fleetCostPerHour comparison with TrendingUp/Down badge'
    - 'Expiry badge on list: fetchExpiring on page load, Set<string> of assetIds, AlertTriangle icon in name cell'
    - 'Document expiry: getExpiryStatus helper returns className + icon based on days until expiry'
    - 'useMeterReadings: 400 error sets submitError (not toast), re-throw so form knows it failed'

key-files:
  created:
    - apps/frontend/src/hooks/useAssetDetail.ts
    - apps/frontend/src/hooks/useAssetDocuments.ts
    - apps/frontend/src/hooks/useFuelRecords.ts
    - apps/frontend/src/hooks/useMeterReadings.ts
    - apps/frontend/src/components/assets/AssetDrawer.tsx
    - apps/frontend/src/components/assets/AssetDrawer.css
    - apps/frontend/src/components/assets/AssetGeneralTab.tsx
    - apps/frontend/src/components/assets/AssetDocumentsTab.tsx
    - apps/frontend/src/components/assets/AssetFuelTab.tsx
    - apps/frontend/src/components/assets/AssetReadingsTab.tsx
    - apps/frontend/src/components/assets/AssetMaintenanceTab.tsx
    - apps/frontend/src/components/assets/AssetTimelineTab.tsx
  modified:
    - apps/frontend/src/pages/AssetsPage.tsx
    - apps/frontend/src/pages/AssetsPage.css

key-decisions:
  - 'AssetFuelTab uses useAssetDetail(assetId) to get farmId for CreateFuelRecordInput — avoiding prop drilling'
  - 'useMeterReadings re-throws on 400 so the form component can use isSubmitting=false correctly while keeping submitError displayed'
  - 'AssetDrawer manages activeTab and onTabChange as controlled props from AssetsPage, not internal state, to allow parent-driven navigation in future'
  - 'Expiry badges on asset list use a Set<string> built from fetchExpiring response — O(1) lookup per row'

requirements-completed:
  - ATIV-01
  - ATIV-02
  - ATIV-06
  - OPER-01
  - OPER-03

duration: 28min
completed: '2026-03-19'
---

# Phase 16 Plan 04: Asset Detail Drawer Summary

**AssetDrawer with 6 tabs (Geral, Documentos, Combustivel, Leituras, Manutencao, Timeline), expiry badge on asset list, fuel benchmarking, and anti-regression meter reading validation**

## Performance

- **Duration:** 28 min
- **Started:** 2026-03-19T22:18:00Z
- **Completed:** 2026-03-19T22:46:00Z
- **Tasks:** 2
- **Files modified:** 14 (12 created + 2 modified)

## Accomplishments

### Task 1: Detail hooks + AssetDrawer shell + General/Documents/Maintenance/Timeline tabs

- `useAssetDetail`: Fetches single asset by orgId/assetId, clears on null, refetch function
- `useAssetDocuments`: CRUD documents + fetchExpiring for org-wide badge support
- `AssetDrawer`: 480px slide-in panel from right (full-width mobile), overlay backdrop with click-to-close, Escape key handler, body scroll lock, 6-tab bar with role=tablist/tab/tabpanel, lazy tab content render
- `AssetGeneralTab`: Type-conditional sections per AssetType, photo grid, child assets list for MAQUINA, acquisition data, timestamps
- `AssetDocumentsTab`: Inline add form (8 document types), expiry color badges (expired=red, <=7d=red, <=30d=yellow, ok=green), delete per document, empty state
- `AssetMaintenanceTab`: Phase 18 placeholder with Wrench icon
- `AssetTimelineTab`: Chronological events (creation, last update) with vertical timeline and primary-600 dots
- `AssetsPage`: Drawer opens on row click (table) and card click (mobile), expiry badge via `Set<assetId>` from fetchExpiring, edit button closes drawer and opens AssetModal

### Task 2: Fuel + Readings tabs with forms and benchmarking

- `useFuelRecords`: Fetch records + stats, create (POST), delete, auto-refetch on assetId change
- `useMeterReadings`: Fetch readings + latest, createReading with anti-regression: 400 status sets `submitError` (not generic toast), re-throws for caller
- `AssetFuelTab`: 2x2 stats cards (custo/hora ativo vs frota with TrendingUp/Down benchmark badge, total litros, total custo), inline form with conditional hourmeter (MAQUINA) / odometer (VEICULO) fields, records table sorted descending
- `AssetReadingsTab`: Current readings display cards (primary-50 bg), add form with tipo select pre-set by assetType, inline anti-regression error with role=alert + AlertTriangle icon + previous value in message, history table with Diferenca column

## Task Commits

1. **Task 1 — DrawerShell + General/Documents/Maintenance/Timeline tabs** - `eda51bc2` (feat)
2. **Task 2 — FuelTab + ReadingsTab hooks and components** - `91e35e74` (feat)

## Files Created/Modified

- `apps/frontend/src/hooks/useAssetDetail.ts` — Fetch single asset by ID
- `apps/frontend/src/hooks/useAssetDocuments.ts` — CRUD + fetchExpiring
- `apps/frontend/src/hooks/useFuelRecords.ts` — Fuel CRUD + stats
- `apps/frontend/src/hooks/useMeterReadings.ts` — Meter CRUD + latest + anti-regression
- `apps/frontend/src/components/assets/AssetDrawer.tsx` — 6-tab drawer panel
- `apps/frontend/src/components/assets/AssetDrawer.css` — All tab CSS (6 components)
- `apps/frontend/src/components/assets/AssetGeneralTab.tsx` — Type-conditional data + photos
- `apps/frontend/src/components/assets/AssetDocumentsTab.tsx` — Document CRUD with expiry badges
- `apps/frontend/src/components/assets/AssetFuelTab.tsx` — Fuel benchmarking + form + table
- `apps/frontend/src/components/assets/AssetReadingsTab.tsx` — Readings + anti-regression inline error
- `apps/frontend/src/components/assets/AssetMaintenanceTab.tsx` — Phase 18 placeholder
- `apps/frontend/src/components/assets/AssetTimelineTab.tsx` — Event timeline
- `apps/frontend/src/pages/AssetsPage.tsx` — Drawer integration + expiry badge
- `apps/frontend/src/pages/AssetsPage.css` — Clickable row + expiry icon styles

## Decisions Made

1. **AssetFuelTab uses useAssetDetail to get farmId** — The CreateFuelRecordInput requires farmId which is on the asset itself. Rather than prop-drilling farmId from AssetsPage to AssetDrawer to AssetFuelTab, the fuel tab calls useAssetDetail(assetId) directly. Minor double-fetch but correct separation of concerns.

2. **useMeterReadings re-throws on 400** — The createReading function sets `submitError` for the inline display and then re-throws. This allows `isSubmitting` to be set to false in the finally block of the form's handleSubmit, while the inline error stays visible. If it didn't re-throw, the form couldn't distinguish success from anti-regression failure.

3. **AssetDrawer activeTab as controlled prop** — AssetsPage controls `drawerTab` state and passes `activeTab`/`onTabChange` to AssetDrawer. This allows future features (e.g., navigate to Documentos tab from a notification) without touching the drawer's internal state.

4. **Expiry badge uses Set lookup** — fetchExpiring returns expired/urgent/warning arrays. Building a `Set<string>` of all assetIds at render time makes the per-row badge check O(1) vs iterating the arrays per row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint: `_assetId` unused variable in AssetMaintenanceTab stub**

- **Found during:** Task 1 (pre-commit hook)
- **Issue:** Initial implementation used `{ assetId: _assetId }` destructuring but ESLint rejects underscore-prefix in this project config
- **Fix:** Changed to `props: AssetMaintenanceTabProps` with `props.assetId` guard
- **Files modified:** apps/frontend/src/components/assets/AssetMaintenanceTab.tsx

**2. [Rule 1 - Bug] AssetImportModal import removed then re-added**

- **Found during:** Task 1 (TSC check)
- **Issue:** Linter auto-removed the `AssetImportModal` import during pre-commit, but the component was still used in AssetsPage.tsx (from Plan 16-03 implementation). Re-added the import.
- **Fix:** Restored `import AssetImportModal from '@/components/assets/AssetImportModal'`
- **Files modified:** apps/frontend/src/pages/AssetsPage.tsx

## Self-Check: PASSED

Files exist:

- FOUND: apps/frontend/src/hooks/useAssetDetail.ts
- FOUND: apps/frontend/src/hooks/useAssetDocuments.ts
- FOUND: apps/frontend/src/hooks/useFuelRecords.ts
- FOUND: apps/frontend/src/hooks/useMeterReadings.ts
- FOUND: apps/frontend/src/components/assets/AssetDrawer.tsx
- FOUND: apps/frontend/src/components/assets/AssetDrawer.css
- FOUND: apps/frontend/src/components/assets/AssetGeneralTab.tsx
- FOUND: apps/frontend/src/components/assets/AssetDocumentsTab.tsx
- FOUND: apps/frontend/src/components/assets/AssetFuelTab.tsx
- FOUND: apps/frontend/src/components/assets/AssetReadingsTab.tsx
- FOUND: apps/frontend/src/components/assets/AssetMaintenanceTab.tsx
- FOUND: apps/frontend/src/components/assets/AssetTimelineTab.tsx

Commits exist:

- FOUND: eda51bc2 — feat(16-04): add AssetDrawer with tabs, detail hooks, and expiry badge wiring
- FOUND: 91e35e74 — feat(16-04): add AssetFuelTab with benchmarking and AssetReadingsTab with anti-regression

TypeScript: `npx tsc --noEmit` passes with 0 errors.

---

_Phase: 16-cadastro-de-ativos_
_Completed: 2026-03-19_
