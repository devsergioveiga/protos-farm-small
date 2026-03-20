---
phase: 16-cadastro-de-ativos
plan: '03'
subsystem: frontend
tags: [react, typescript, assets, crud, modal, sidebar, routing, vitest]

requires:
  - 16-cadastro-de-ativos/16-01
  - 16-cadastro-de-ativos/16-02
provides:
  - 'AssetsPage at /assets with filters, summary cards, table/card list'
  - 'AssetModal for create/edit with type-conditional sections'
  - 'PATRIMONIO sidebar group between ESTOQUE and FINANCEIRO'
  - 'Route /assets registered in App.tsx'
  - 'useAssets hook: list, summary, delete, export CSV/PDF'
  - 'useAssetForm hook: form state, validation, type-conditional field clearing'
affects:
  - 16-cadastro-de-ativos/16-04
  - 16-cadastro-de-ativos/16-05

tech-stack:
  added: []
  patterns:
    - 'Mobile-first responsive: card stack <768px, table >=768px via CSS display none/block'
    - 'Type-conditional form sections in AssetModal driven by formData.assetType'
    - 'TERRA type auto-sets classification to NON_DEPRECIABLE_CPC27 in useAssetForm.setField'
    - 'useAssets fetchAssets called with ListAssetsQuery; loadData useCallback deps list individual filters'
    - 'AssetModal stub approach: commit stub first to unblock TSC, then replace in same task'

key-files:
  created:
    - apps/frontend/src/types/asset.ts
    - apps/frontend/src/hooks/useAssets.ts
    - apps/frontend/src/hooks/useAssetForm.ts
    - apps/frontend/src/pages/AssetsPage.tsx
    - apps/frontend/src/pages/AssetsPage.css
    - apps/frontend/src/pages/AssetsPage.spec.tsx
    - apps/frontend/src/components/assets/AssetModal.tsx
    - apps/frontend/src/components/assets/AssetModal.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx

key-decisions:
  - 'AssetModal stub committed first in Task 2 to keep TSC clean, full implementation in Task 3 overwrites it'
  - 'FormData type in useAssetForm extended with status field to support edit-mode status dropdown'
  - 'useCallback deps in AssetsPage.loadData list individual filter state vars (not currentQuery object) to avoid stale closures'
  - 'react-hooks/exhaustive-deps left as warning (not error) — plugin produces warnings only in this project config'

requirements-completed:
  - ATIV-01
  - ATIV-02
  - ATIV-06

duration: 31min
completed: '2026-03-19'
---

# Phase 16 Plan 03: AssetsPage Frontend Summary

**AssetsPage at /assets with breadcrumb, 4 summary cards, 5-filter bar, table+card list, AssetModal with type-conditional sections, PATRIMONIO sidebar group, and 7 passing render tests**

## Performance

- **Duration:** 31 min
- **Started:** 2026-03-19T21:45:52Z
- **Completed:** 2026-03-19T22:17:00Z
- **Tasks:** 3
- **Files modified:** 10 (8 created + 2 modified)

## Accomplishments

### Task 1: Frontend types + hooks

- Created `types/asset.ts` with Asset, CreateAssetInput, UpdateAssetInput, AssetSummary, ListAssetsQuery, AssetListResponse, and all label maps (ASSET_TYPE_LABELS, ASSET_STATUS_LABELS, ASSET_CLASSIFICATION_LABELS)
- Created `hooks/useAssets.ts` with fetchAssets (GET with query params), fetchSummary, deleteAsset (DELETE + refetch), exportCsv (blob download), exportPdf (blob download)
- Created `hooks/useAssetForm.ts` with form state management, type-conditional field clearing on assetType change, TERRA auto-classification, validate(), handleSubmit() (POST or PATCH), resetForm(), loadAsset()

### Task 2: AssetsPage with filters, summary cards, table/card list, and render spec

- `AssetsPage.tsx`: breadcrumb, header with "Novo ativo" primary CTA + "Importar ativos" disabled secondary button, 4 summary cards (total, value, maintenance, recent), filter bar (5 filters + CSV/PDF export), loading skeleton, error state, filter empty state, data empty state, mobile card stack, desktop table, pagination
- Status badges: icon + text for all 5 statuses, never color alone
- ConfirmModal variant="danger" for delete, toast notifications
- `AssetsPage.spec.tsx`: 7 render tests — page title, empty state, summary cards, disabled import button, skeleton, error state, asset list with tag

### Task 3: AssetModal + Sidebar + App.tsx routing

- `AssetModal.tsx`: type selector (5 buttons, aria-pressed), Section 2 Identificacao (name, tag readonly in edit, farm, status, classification, description), Section 3 Aquisicao (collapsible), Section 4 Dados Especificos (conditional by type), Section 5 Fotos (collapsible dropzone)
- Type-specific sections: MAQUINA (HP, fuel, manufacturer, model, year, serial, hourmeter), VEICULO (RENAVAM, plate, manufacturer, model, year, odometer, fuel), IMPLEMENTO (manufacturer, model, year, serial, parent machine picker), BENFEITORIA (material, area m2, capacity, lat/lon inputs only), TERRA (matricula, area ha, CAR code)
- TERRA: classification auto-set and disabled in selector
- Type selector disabled in edit mode
- Sidebar: PATRIMONIO group with Tractor icon + Ativos item between ESTOQUE and FINANCEIRO
- App.tsx: lazy import + Route `/assets` -> AssetsPage

## Task Commits

1. **Task 1 — types + hooks** - `b46dd816` (feat)
2. **Task 2 — AssetsPage + spec** - `9be9d756` (feat)
3. **Task 3 — AssetModal + Sidebar + route** - `a1753d10` (feat)

## Files Created/Modified

- `apps/frontend/src/types/asset.ts` — All frontend types for asset module
- `apps/frontend/src/hooks/useAssets.ts` — List, summary, delete, export hooks
- `apps/frontend/src/hooks/useAssetForm.ts` — Form state, validation, type-conditional clearing
- `apps/frontend/src/pages/AssetsPage.tsx` — Main asset listing page (290 lines)
- `apps/frontend/src/pages/AssetsPage.css` — Mobile-first responsive styles
- `apps/frontend/src/pages/AssetsPage.spec.tsx` — 7 passing Vitest render tests
- `apps/frontend/src/components/assets/AssetModal.tsx` — Create/edit modal with conditional sections
- `apps/frontend/src/components/assets/AssetModal.css` — Modal styles (full-screen mobile, 640px desktop)
- `apps/frontend/src/components/layout/Sidebar.tsx` — PATRIMONIO group added
- `apps/frontend/src/App.tsx` — /assets route registered

## Decisions Made

1. **AssetModal stub committed first in Task 2** — TSC check requires the modal import to resolve before Task 3. Stub (props-only, returns null) committed in Task 2, full implementation overwrites it in Task 3 commit.

2. **FormData extended with status** — The UpdateAssetInput type doesn't have status (it's on the PATCH endpoint), but the edit-mode form needs to display/change it. FormData type extended with `status?: AssetStatus`.

3. **react-hooks/exhaustive-deps as warning** — The plugin exists but configured to warn, not error. The useCallback in AssetsPage lists individual filter state vars rather than the derived currentQuery object to avoid stale closures.

4. **Photo upload in edit mode only** — Photo upload requires an asset ID. In create mode, the dropzone shows "Salve o ativo primeiro para adicionar fotos." In edit mode, a file input is rendered. Full drag-and-drop will be a future enhancement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint: `_props` unused variable in AssetModal stub**

- **Found during:** Task 2 (pre-commit hook)
- **Issue:** Initial stub used `function AssetModal(_props: AssetModalProps)` but ESLint rejects underscore-prefixed destructured params in this project config
- **Fix:** Rewrote stub to `function AssetModal(props: AssetModalProps) { if (!props.isOpen) return null; }`
- **Files modified:** apps/frontend/src/components/assets/AssetModal.tsx

**2. [Rule 1 - Bug] ESLint: `formatDate` unused in AssetsPage**

- **Found during:** Task 2 (pre-commit hook)
- **Issue:** formatDate was defined but not used (status badges don't show dates in the list)
- **Fix:** Removed formatDate helper
- **Files modified:** apps/frontend/src/pages/AssetsPage.tsx

**3. [Rule 1 - Bug] ESLint: `react-hooks/exhaustive-deps` disable comment failed**

- **Found during:** Task 2 (pre-commit hook)
- **Issue:** Project doesn't have react-hooks ESLint plugin, so `// eslint-disable-next-line react-hooks/exhaustive-deps` caused an "unknown rule" error
- **Fix:** Removed the disable comment; left a plain comment explaining the dep list
- **Files modified:** apps/frontend/src/pages/AssetsPage.tsx

**4. [Rule 1 - Bug] ESLint: `setSubmitError(null)` in useEffect**

- **Found during:** Task 3 (pre-commit hook)
- **Issue:** The react-hooks/set-state-in-effect rule rejects `setState` calls synchronously inside effect bodies
- **Fix:** Moved submit error clearing to onSubmit handler only; modal uses useState(null) initial value
- **Files modified:** apps/frontend/src/components/assets/AssetModal.tsx

## Self-Check: PASSED

Files exist:

- FOUND: apps/frontend/src/types/asset.ts
- FOUND: apps/frontend/src/hooks/useAssets.ts
- FOUND: apps/frontend/src/hooks/useAssetForm.ts
- FOUND: apps/frontend/src/pages/AssetsPage.tsx
- FOUND: apps/frontend/src/pages/AssetsPage.css
- FOUND: apps/frontend/src/pages/AssetsPage.spec.tsx
- FOUND: apps/frontend/src/components/assets/AssetModal.tsx
- FOUND: apps/frontend/src/components/assets/AssetModal.css

Commits exist:

- FOUND: b46dd816 — feat(16-03): add frontend types and hooks for asset module
- FOUND: 9be9d756 — feat(16-03): add AssetsPage with filters, summary cards, list, and spec
- FOUND: a1753d10 — feat(16-03): add AssetModal, PATRIMONIO sidebar group, /assets route

Tests: 916 passing (0 failures)

---

_Phase: 16-cadastro-de-ativos_
_Completed: 2026-03-19_
