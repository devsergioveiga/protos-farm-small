---
phase: 09-cota-o-e-pedido-de-compra
plan: '04'
subsystem: frontend-quotations
tags: [frontend, quotations, comparative-map, purchase-flow]
dependency_graph:
  requires: [09-02]
  provides: [quotations-ui, comparative-map-ui]
  affects: [App.tsx, Sidebar.tsx]
tech_stack:
  added: []
  patterns: [useQuotations-hook, ComparativeMapTable-split-selection, inline-proposal-form]
key_files:
  created:
    - apps/frontend/src/types/quotation.ts
    - apps/frontend/src/hooks/useQuotations.ts
    - apps/frontend/src/pages/QuotationsPage.tsx
    - apps/frontend/src/pages/QuotationsPage.css
    - apps/frontend/src/components/quotations/QuotationModal.tsx
    - apps/frontend/src/components/quotations/QuotationModal.css
    - apps/frontend/src/components/quotations/QuotationDetailModal.tsx
    - apps/frontend/src/components/quotations/QuotationDetailModal.css
    - apps/frontend/src/components/quotations/ComparativeMapTable.tsx
    - apps/frontend/src/components/quotations/ComparativeMapTable.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - useQuotations hook has no filter parameters — internal state managed via setStatus/setSearch; filters param removed to avoid ESLint unused-vars errors
  - PriceCell props purchaseRequestItemId/quotationSupplierId made optional to avoid unused-vars — parent supplies them via onSelect closure
  - Pre-selection of lowest-price supplier applied via useEffect on comparativeData load (only if selections array is empty)
metrics:
  duration: 975s
  completed: '2026-03-17'
  tasks: 2
  files: 12
---

# Phase 09 Plan 04: Quotations Frontend Summary

Full quotations UI with comparative map, proposal registration and approval flow.

## Completed Tasks

| Task | Name                                                                       | Commit  | Files   |
| ---- | -------------------------------------------------------------------------- | ------- | ------- |
| 1    | Types + hook + QuotationsPage + QuotationModal + sidebar + App.tsx routing | 64ad60d | 8 files |
| 2    | QuotationDetailModal + ComparativeMapTable + approval flow                 | 506dfa5 | 5 files |

## What Was Built

**Task 1 — Foundation:**

- `types/quotation.ts`: Full type system — Quotation, ComparativeMapData, SC_STATUS_LABELS/COLORS, CreateQuotationInput, RegisterProposalInput, ApproveQuotationInput
- `hooks/useQuotations.ts`: useQuotations (list), useQuotation (single), useComparativeMap, plus mutation functions (createQuotation, registerProposal, approveQuotation, transitionQuotation, deleteQuotation)
- `QuotationsPage.tsx`: Breadcrumb Compras > Cotacoes, filter bar (status + search), responsive table/cards, skeleton loading, empty states, delete with ConfirmModal
- `QuotationModal.tsx`: RC dropdown (APROVADA filter), items preview, supplier multi-select with status badges, Top 3 suggestion support, date + notes fields
- Sidebar: `{ to: '/quotations', icon: FileSearch, label: 'Cotacoes' }` in COMPRAS group
- App.tsx: lazy import + `/quotations` route

**Task 2 — Detail and Comparative Map:**

- `QuotationDetailModal.tsx`: Header with status badge + action buttons, 3-tab navigation (Fornecedores/Mapa/Detalhes), supplier cards with inline proposal form, approval section
- Inline proposal form: per-item price inputs, freight/tax/delivery/payment terms/validity/file upload/notes
- `ComparativeMapTable.tsx`: Suppliers-as-columns x items-as-rows grid, green highlight for min price, red for max, diff% label, split selection per item, sticky first column, totals row, pre-select lowest price

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Bug] Unused parameter in useQuotations**

- **Found during:** Task 1 commit
- **Issue:** ESLint `@typescript-eslint/no-unused-vars` rejected `_filters` parameter; Prettier reverted prefix-underscore pattern
- **Fix:** Removed filters parameter entirely — hook manages status/search state internally via setStatus/setSearch
- **Files modified:** apps/frontend/src/hooks/useQuotations.ts

**2. [Rule 2 - Bug] Unused destructured props in PriceCell**

- **Found during:** Task 2 commit
- **Issue:** ESLint flagged `purchaseRequestItemId` and `quotationSupplierId` as unused in PriceCell — they were in the interface but not consumed in the body (parent closes over them via onSelect)
- **Fix:** Made them optional in the interface and removed from destructuring
- **Files modified:** apps/frontend/src/components/quotations/ComparativeMapTable.tsx

## Self-Check: PASSED

Files verified:

- apps/frontend/src/types/quotation.ts — EXISTS
- apps/frontend/src/hooks/useQuotations.ts — EXISTS
- apps/frontend/src/pages/QuotationsPage.tsx — EXISTS
- apps/frontend/src/components/quotations/QuotationModal.tsx — EXISTS
- apps/frontend/src/components/quotations/QuotationDetailModal.tsx — EXISTS
- apps/frontend/src/components/quotations/ComparativeMapTable.tsx — EXISTS

Commits verified:

- 64ad60d — feat(09-04): quotations list page... — EXISTS
- 506dfa5 — feat(09-04): QuotationDetailModal... — EXISTS

TypeScript: `npx tsc --noEmit` — no errors
