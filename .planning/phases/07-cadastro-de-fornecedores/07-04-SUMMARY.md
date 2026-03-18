---
phase: 07-cadastro-de-fornecedores
plan: '04'
subsystem: frontend/suppliers
tags: [suppliers, import, export, rating, top3, frontend]
dependency_graph:
  requires: [07-02, 07-03]
  provides: [FORN-02-frontend, FORN-03-frontend]
  affects: [SuppliersPage]
tech_stack:
  added: []
  patterns:
    - two-step modal (upload → preview) with drag-drop zone
    - blob download pattern for CSV/PDF export with auth header
    - Top 3 ranking section with useEffect + refetch counter
    - star radiogroup with aria-checked accessibility
key_files:
  created:
    - apps/frontend/src/components/suppliers/SupplierImportModal.tsx
    - apps/frontend/src/components/suppliers/SupplierImportModal.css
    - apps/frontend/src/components/suppliers/SupplierRatingModal.tsx
    - apps/frontend/src/components/suppliers/SupplierRatingModal.css
    - apps/frontend/src/hooks/useSupplierRating.ts
  modified:
    - apps/frontend/src/pages/SuppliersPage.tsx
    - apps/frontend/src/pages/SuppliersPage.css
decisions:
  - 'Export uses api.getBlob() (already exists in api.ts) rather than window.open — preserves auth header and enables loading state'
  - 'Top 3 refetch uses a counter state pattern to re-trigger useEffect without changing the category dependency'
  - 'SupplierRatingModal form uses id/form attribute pattern so footer submit button is outside the form element'
metrics:
  duration: 7min
  completed: 2026-03-17
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 2
---

# Phase 7 Plan 04: Import/Export/Rating UI Summary

Complete supplier management module UI — import CSV/XLSX with preview, export CSV/PDF with blob download, 4-criteria star rating modal with history, and Top 3 ranked supplier cards with category selector.

## Completed Tasks

| Task | Description                                      | Commit  | Files                                              |
| ---- | ------------------------------------------------ | ------- | -------------------------------------------------- |
| 1    | SupplierImportModal + useSupplierRating hook     | eb69f81 | SupplierImportModal.tsx/css, useSupplierRating.ts  |
| 2    | SupplierRatingModal + Top 3 + wire SuppliersPage | 5779ee3 | SupplierRatingModal.tsx/css, SuppliersPage.tsx/css |
| 3    | Human verification — complete supplier flow      | —       | checkpoint approved                                |

## What Was Built

### SupplierImportModal

- Two-step modal: Step 1 drag-drop upload zone (180px, dashed border, 5MB limit), Step 2 preview table
- Preview table shows valid (green), invalid (red), existing (neutral) rows with icons and error messages
- Summary bar shows counts for each category
- Calls `POST /api/org/suppliers/import/preview` for preview, `POST /api/org/suppliers/import/execute` for confirmation
- "Baixar modelo" link opens `/api/org/suppliers/import/template`
- Accessible: role=dialog, aria-modal, Escape to close, focus within dropzone

### useSupplierRating hook

- `submitRating(supplierId, input)` → `POST /api/org/suppliers/:id/ratings`
- `getRatingHistory(supplierId)` → `GET /api/org/suppliers/:id/ratings`
- Exposes: ratings, isSubmitting, isLoadingRatings, error

### SupplierRatingModal

- 4 criteria: Prazo de Entrega, Qualidade do Produto, Preco, Atendimento
- Stars: 24px, role="radiogroup" + role="radio" + aria-checked, sun-500 fill on hover/selected
- Inline history list toggle — loads lazily on first open
- Submit disabled until all 4 criteria filled

### Top Fornecedores section

- Category `<select>` (200px) triggers `GET /api/org/suppliers/top3?category=X`
- 3 ranked cards: Trophy icon (#1 sun-500), Medal (#2 neutral-400, #3 earth-500)
- Card hover: translateY(-2px) + shadow-lg, 200ms ease-out
- Skeleton loading state (3 placeholder cards)
- Empty state with helpful copy

### SuppliersPage wiring

- Import button → opens SupplierImportModal, refetches list on success
- Export CSV → `api.getBlob()` + programmatic `<a>` click, loading spinner
- Export PDF → same blob download pattern
- Star action → opens SupplierRatingModal, refetches list + top3 on success
- Mobile cards include "Avaliar" button

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] SupplierImportModal.tsx exists at correct path
- [x] SupplierRatingModal.tsx exists at correct path
- [x] useSupplierRating.ts exists at correct path
- [x] SuppliersPage.tsx updated with all imports
- [x] TypeScript compiles without errors
- [x] Vite build succeeds (4.77s)
- [x] Task 1 committed: eb69f81
- [x] Task 2 committed: 5779ee3
