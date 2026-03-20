---
phase: 17-engine-de-deprecia-o
plan: '03'
subsystem: frontend
tags: [depreciation, frontend, react, typescript, hooks, components]
dependency_graph:
  requires: [17-02]
  provides: [depreciation-frontend, depreciation-ui, asset-drawer-depreciation-tab]
  affects: [assets-module, sidebar-navigation, app-routing]
tech_stack:
  added: []
  patterns:
    - React.lazy for code splitting
    - Custom hooks pattern (useDepreciationConfig, useDepreciationRun, useDepreciationReport)
    - Blob URL download for CSV/XLSX export
    - display:none conditional field toggle (no animation)
    - ConfirmModal for all destructive/risky actions
    - Mobile-first responsive with stacked cards <768px
key_files:
  created:
    - apps/frontend/src/types/depreciation.ts
    - apps/frontend/src/hooks/useDepreciationConfig.ts
    - apps/frontend/src/hooks/useDepreciationRun.ts
    - apps/frontend/src/hooks/useDepreciationReport.ts
    - apps/frontend/src/pages/DepreciationPage.tsx
    - apps/frontend/src/pages/DepreciationPage.css
    - apps/frontend/src/components/depreciation/DepreciationConfigModal.tsx
    - apps/frontend/src/components/depreciation/DepreciationConfigModal.css
    - apps/frontend/src/components/depreciation/DepreciationReportTable.tsx
    - apps/frontend/src/components/depreciation/DepreciationRunBadge.tsx
  modified:
    - apps/frontend/src/components/assets/AssetDrawer.tsx
    - apps/frontend/src/components/assets/AssetDrawer.css
    - apps/frontend/src/pages/AssetsPage.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - display:none used for conditional form fields in DepreciationConfigModal (no animation per CLAUDE.md)
  - DepreciationRunBadge CSS co-located in DepreciationPage.css to avoid extra file for small component
  - AssetDepreciationTab fetches last 12 entries using current month/year by default
  - fetchReport added to useEffect deps in AssetDepreciationTab after ESLint fix (removed exhaustive-deps disable comment)
metrics:
  duration: ~25min
  completed: 2026-03-20
  tasks_completed: 2
  tasks_total: 3
  files_created: 10
  files_modified: 5
---

# Phase 17 Plan 03: Depreciation Frontend — Summary

**One-liner:** Complete React frontend for depreciation engine with DepreciationPage (report table, export dropdown, run/reversal flows), DepreciationConfigModal with RFB defaults, AssetDrawer "Depreciacao" tab fetching per-asset entries via assetId filter, and sidebar navigation under PATRIMONIO.

## Tasks Completed

| Task | Name                                          | Commit   | Files                     |
| ---- | --------------------------------------------- | -------- | ------------------------- |
| 1    | Types + hooks + DepreciationPage + components | 7622489f | 10 new files              |
| 2    | AssetDrawer tab + Sidebar + App route wiring  | 95b8fbdb | 5 modified files          |
| 3    | Verify depreciation UI end-to-end             | —        | Checkpoint (human verify) |

## What Was Built

### Types (`depreciation.ts`)

Full TypeScript type definitions mirroring backend DTOs: `DepreciationMethod`, `DepreciationTrack`, `DepreciationConfig`, `DepreciationEntry`, `DepreciationRun`, `DepreciationReportResponse`, plus `METHOD_LABELS`, `TRACK_LABELS`, `MONTH_LABELS`, `DEFAULT_RFB_RATES` (MAQUINA 10%, VEICULO 20%, IMPLEMENTO 10%, BENFEITORIA 4%, TERRA 0%).

### Hooks

- `useDepreciationConfig`: get/create/update/remove per-asset config via `/org/{orgId}/depreciation/config/`
- `useDepreciationRun`: triggerRun + getLastRun via `/org/{orgId}/depreciation/run` and `/last-run`
- `useDepreciationReport`: fetchReport with optional `assetId` filter, `reverseEntry`, `exportReport` (blob download via `URL.createObjectURL`)

### DepreciationRunBadge

5-state status badge (none/PENDING/COMPLETED/PARTIAL/FAILED) with `role="status"` + `aria-live="polite"`. PENDING shows CSS spinner. PARTIAL shows skipped count.

### DepreciationReportTable

Full table with columns: Ativo | Tipo | Fazenda | Valor Anterior | Depreciacao | Valor Atual | Centro de Custo | Track. Numeric values in `var(--font-mono)`. Skeleton rows. Empty state with TrendingDown icon + CTA. Mobile card stack <768px. Overflow menu with "Estornar lancamento" option.

### DepreciationConfigModal

Form with 8 fields, conditional visibility via `display:none` (STRAIGHT_LINE shows vida util, ACCELERATED shows fator, HOURS_OF_USE shows total horas, UNITS_OF_PRODUCTION shows total unidades). RFB hint inline below taxa fiscal field. Pre-fills from `DEFAULT_RFB_RATES[asset.assetType]`. Full a11y: `role="dialog"`, `aria-labelledby`, `htmlFor`, `aria-required`, `role="alert"` for errors.

### DepreciationPage

Main page at `/depreciation` with:

- Breadcrumb "Patrimonio > Depreciacao"
- Header with DepreciationRunBadge + period/track selectors + export dropdown + "Executar Depreciacao" primary button
- Export dropdown: "Exportar CSV" and "Exportar XLSX" — calls `exportReport` blob download
- Run flow: ConfirmModal `variant="warning"` → triggerRun → success/skipped/error toasts
- Reversal flow: ConfirmModal `variant="danger"` → reverseEntry → toast
- Skipped warning banner when `lastRun.skippedCount > 0`
- Responsive: single column <768px (export hidden), two-column 768-1024px, full row ≥1024px

### AssetDrawer Integration

New `'depreciacao'` tab (7th tab, before timeline) with `AssetDepreciationTab` component:

- Empty state: Settings icon (48px) + "Ativo sem configuracao de depreciacao" + "Configurar depreciacao" CTA
- Config state: summary card (method, rates, residual value, track) + "Editar configuracao" button + last 12 entries mini-table
- Mini-table fetches via `useDepreciationReport` with `assetId` query param

### Sidebar + App Routing

- Sidebar: "Depreciacao" entry under PATRIMONIO group with TrendingDown icon
- App.tsx: `React.lazy(() => import('@/pages/DepreciationPage'))` + `<Route path="/depreciation">`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports from AssetDrawer**

- **Found during:** Task 2 pre-commit hook (ESLint)
- **Issue:** `TrendingDown` imported but not used directly in AssetDrawer (used in Sidebar instead). `DepreciationConfig` type imported but not referenced.
- **Fix:** Removed `TrendingDown` from lucide-react import. Removed `type { DepreciationConfig }` import.
- **Files modified:** `AssetDrawer.tsx`
- **Commit:** 95b8fbdb

**2. [Rule 1 - Bug] Replaced eslint-disable comment with proper deps array**

- **Found during:** Task 2 pre-commit hook (ESLint rule not found error)
- **Issue:** `// eslint-disable-next-line react-hooks/exhaustive-deps` caused "definition for rule not found" error because the project uses a different eslint config.
- **Fix:** Added `fetchReport` to the useEffect dependency array instead.
- **Files modified:** `AssetDrawer.tsx`
- **Commit:** 95b8fbdb

## Self-Check: PASSED

All 10 created files exist. Both task commits verified:

- `7622489f` — 10 new files (types, hooks, page, components)
- `95b8fbdb` — 5 modified files (AssetDrawer, AssetsPage, Sidebar, App)

TypeScript compilation: `npx tsc --noEmit` exits 0 (no errors).

All 20 acceptance criteria verified via grep checks.
