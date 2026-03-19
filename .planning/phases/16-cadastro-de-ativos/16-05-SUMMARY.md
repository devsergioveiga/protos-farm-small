---
phase: 16-cadastro-de-ativos
plan: '05'
subsystem: assets
tags: [bulk-import, file-parser, wizard-modal, exceljs, multer]
dependency_graph:
  requires: [16-01, 16-03]
  provides: [bulk-asset-import]
  affects: [assets.routes, AssetsPage]
tech_stack:
  added: [multer memoryStorage (import), ExcelJS (xlsx/csv parsing)]
  patterns:
    [
      state-machine hook,
      multi-step wizard modal,
      auto-column-mapping,
      sequential tag generation reuse,
    ]
key_files:
  created:
    - apps/backend/src/modules/assets/asset-file-parser.ts
    - apps/backend/src/modules/assets/asset-bulk-import.service.ts
    - apps/frontend/src/hooks/useAssetBulkImport.ts
    - apps/frontend/src/components/assets/AssetImportModal.tsx
    - apps/frontend/src/components/assets/AssetImportModal.css
  modified:
    - apps/backend/src/modules/assets/assets.routes.ts
    - apps/backend/src/modules/assets/assets.routes.spec.ts
    - apps/frontend/src/pages/AssetsPage.tsx
decisions:
  - 'Reused createAsset() from assets.service.ts in confirmAssetImport to ensure sequential PAT-NNNNN tag generation stays atomic and respects existing validation'
  - 'Used api.postFormData() (already in api.ts) for multipart file upload — no new infrastructure needed'
  - 'Auto-mapping dictionary maps Portuguese column headers to system field names (normalized: lowercase, trim, spaces→underscore)'
  - 'TERRA asset type auto-classifies to NON_DEPRECIABLE_CPC27 in preview step'
  - 'Template download failure is treated as non-critical (silent catch) to not block the import flow'
metrics:
  duration_minutes: 90
  completed_date: '2026-03-19'
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
  tests_added: 7
  tests_total: 31
---

# Phase 16 Plan 05: Bulk Asset Import Summary

Multi-step CSV/XLSX bulk import for assets with auto-column-mapping, validation preview, and sequential PAT-NNNNN tag generation reusing the `createAsset` service.

## What Was Built

### Backend (Task 1)

**`asset-file-parser.ts`** — CSV/XLSX parser:

- ExcelJS-based parser supporting both formats (BOM-stripping, separator detection)
- Row limit: 500 rows, file size limit: 5MB (enforced in multer)
- `autoMapColumns(headers)` uses AUTO_MAP dictionary to pre-select column mappings
- Returns `{ columnHeaders, rowCount, sampleRows, allRows }`

**`asset-bulk-import.service.ts`** — preview + confirm service:

- `previewAssetImport`: applies column mapping, resolves farm/cost center names to IDs, validates required fields, maps Portuguese enum values to AssetType/AssetClassification, returns `{ valid, invalid, totalValid, totalInvalid }`
- `confirmAssetImport`: calls `createAsset` per valid row, catches per-row errors to continue batch, returns `{ imported, skipped, failed, errors }`
- `generateAssetCsvTemplate()`: returns CSV string with headers and 3 example rows

**`assets.routes.ts`** — 4 new endpoints:

- `GET /org/:orgId/assets/import/template` — downloads CSV template
- `POST /org/:orgId/assets/import/parse` — multer memoryStorage upload, returns headers + suggestedMapping + allRows
- `POST /org/:orgId/assets/import/preview` — validates rows with column mapping
- `POST /org/:orgId/assets/import/confirm` — inserts valid rows, returns import summary

**`assets.routes.spec.ts`** — 7 new tests in "Asset Import" describe block:

- Template download returns CSV with correct Content-Type
- Parse with CSV returns columnHeaders + suggestedMapping
- Parse without file returns 400
- Preview returns valid/invalid rows
- Preview without rows returns 400
- Confirm inserts rows and returns count
- Confirm without validRows returns 400

Tests: 31 passing, 2 pre-existing todos.

### Frontend (Task 2)

**`useAssetBulkImport.ts`** — state machine hook:

- Steps: `idle → uploading → mapping → previewing → confirming → done`
- `uploadFile(file)`: POST multipart to /import/parse via `api.postFormData`
- `preview()`: POST rows + columnMapping to /import/preview
- `confirm()`: POST validRows to /import/confirm
- `downloadTemplate()`: GET /import/template via `api.getBlob`, triggers browser download
- `goToMapping()`: back-navigation from preview to mapping
- `reset()`: returns to idle state

**`AssetImportModal.tsx`** — 6-step wizard (490+ lines):

- Step 1 (idle): drag-and-drop zone + "Baixar modelo" template link + file input fallback
- Step 2 (uploading): skeleton loading animation
- Step 3 (mapping): required/optional field selects pre-populated from suggestedMapping
- Step 4 (previewing): valid rows table + invalid rows highlighted with error column
- Step 5 (confirming): skeleton loading
- Step 6 (done): success/partial result with icon + error table if partial
- Keyboard: Escape closes, focus trap on open
- Accessibility: `role="dialog"`, `aria-modal`, `aria-labelledby`, `role="alert"` on errors

**`AssetImportModal.css`** — design system compliant:

- 640px max-width desktop, full-screen bottom sheet on mobile
- `asset-import-modal-in` animation: 300ms ease-out, respects `prefers-reduced-motion`
- Dashed dropzone border with hover/drag-over highlight using `--color-primary-600`
- Skeleton pulse animation for loading states
- All spacing from `--space-*` CSS custom properties

**`AssetsPage.tsx`** — wired import button:

- Added `importModalOpen` state
- "Importar ativos" button no longer disabled — opens modal on click
- `onSuccess` callback refreshes asset list and summary stats

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

**Note:** The `Download` icon was imported but not used in the final modal JSX (template link uses text + `FileDown` icon). Caught by ESLint pre-commit hook and removed before the commit succeeded.

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits confirmed:

- `68d880de` — feat(16-05): add backend bulk import endpoints for assets
- `33e8315c` — feat(16-05): add AssetImportModal wizard and wire to AssetsPage
