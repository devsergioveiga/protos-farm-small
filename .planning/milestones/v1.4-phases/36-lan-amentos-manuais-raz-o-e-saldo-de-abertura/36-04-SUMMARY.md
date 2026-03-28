---
phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
plan: '04'
subsystem: frontend-accounting
tags: [frontend, journal-entries, opening-balance, accounting, modal, wizard]
dependency_graph:
  requires: [36-01, 36-02, 35-04]
  provides: [journal-entries-ui, opening-balance-wizard, reversal-modal, template-modal]
  affects: [accounting-entries-route]
tech_stack:
  added: []
  patterns:
    - Multi-line debit/credit entry modal with live BalanceIndicator
    - 2-step wizard modal with step transition and back-navigation
    - Searchable combobox for COA accounts (account picker pattern)
    - CSV import with preview modal (upload -> preview -> confirm -> create drafts)
    - useJournalEntryActions hook with full CRUD + lifecycle operations
key_files:
  created:
    - apps/frontend/src/types/journal-entries.ts
    - apps/frontend/src/hooks/useJournalEntries.ts
    - apps/frontend/src/hooks/useOpeningBalance.ts
    - apps/frontend/src/pages/JournalEntriesPage.tsx
    - apps/frontend/src/pages/JournalEntriesPage.css
    - apps/frontend/src/components/accounting/JournalEntryModal.tsx
    - apps/frontend/src/components/accounting/JournalEntryModal.css
    - apps/frontend/src/components/accounting/ReversalModal.tsx
    - apps/frontend/src/components/accounting/ReversalModal.css
    - apps/frontend/src/components/accounting/OpeningBalanceWizard.tsx
    - apps/frontend/src/components/accounting/OpeningBalanceWizard.css
    - apps/frontend/src/components/accounting/JournalEntryTemplateModal.tsx
    - apps/frontend/src/components/accounting/JournalEntryTemplateModal.css
  modified:
    - apps/frontend/src/App.tsx
decisions:
  - '/accounting-entries route now points to JournalEntriesPage (full manual entry UI replacing the payroll-only accounting entries page)'
  - 'CSV import uses preview-first flow: upload -> importCsv() -> CsvPreviewModal -> createDraft per entry (per LANC-03 spec)'
  - 'JournalEntriesPage lazy-imports OpeningBalanceWizard via React.lazy + Suspense to keep bundle split'
  - 'BalanceIndicator uses role=status for live updates without interrupting screen reader focus'
  - 'AccountCombobox filters to isSynthetic=false + allowManualEntry=true accounts only'
metrics:
  duration_seconds: 806
  completed_date: '2026-03-27'
  tasks_completed: 3
  tasks_total: 3
  files_created: 13
  files_modified: 1
---

# Phase 36 Plan 04: Frontend Journal Entries UI Summary

Frontend for journal entries module: listing page, multi-line entry modal with CSV import, reversal modal, opening balance wizard, and template management — all connected to the backend implemented in plans 36-01 and 36-02.

## What Was Built

### Task 1: Frontend Types + Hooks (commit 4f74b6a1)

**`types/journal-entries.ts`** — Complete type definitions mirroring backend output:

- `JournalEntry`, `JournalEntryLine`, `JournalEntryStatus`, `JournalEntryType`, `LedgerSide`
- `CreateJournalEntryInput`, `OpeningBalanceLinePreview`, `CsvImportPreview`
- `LedgerOutput`, `TrialBalanceOutput` (for Plan 05 use)

**`hooks/useJournalEntries.ts`** — Full hook suite:

- `useJournalEntries(filters?)` — paginated list with status/period/type filters
- `useJournalEntry(entryId)` — single entry fetch
- `useJournalEntryActions()` — all mutations: `createDraft`, `updateDraft`, `postEntry`, `reverseEntry`, `deleteDraft`, `saveTemplate`, `listTemplates`, `deleteTemplate`, `importCsv`

**`hooks/useOpeningBalance.ts`** — Opening balance hooks:

- `useOpeningBalancePreview(fiscalYearId)` — GET preview lines
- `usePostOpeningBalance()` — POST to create opening balance entry

### Task 2: JournalEntriesPage + JournalEntryModal + ReversalModal (commit 4c5e76ab)

**`JournalEntriesPage.tsx`**:

- Table with 7 columns: Número, Data, Histórico, Tipo, Valor Total, Status, Ações
- Status badges with icons: RASCUNHO (FileText, neutral-200), POSTADO (CheckCircle, success-100), ESTORNADO (RotateCcw, error-100)
- Action dropdown menu per row: Visualizar (all), Editar (DRAFT only), Estornar (POSTED only), Excluir (DRAFT only)
- Filter bar: period selector (from useFiscalYears), status filter, entryType filter
- CSV import flow: hidden file input → `importCsv(file)` → `CsvPreviewModal` → `createDraft` per entry
- Empty state with BookOpen icon + CTA
- Responsive: table hidden <768px, mobile card list shown
- 5-row skeleton loading

**`JournalEntryModal.tsx`**:

- 800px max-width, full-screen on mobile
- Header fields: Data (auto-selects period), Período (disabled for POSTED), Histórico (textarea 500 max)
- Line table with `<table>/<th scope="col">`: AccountCombobox (searches analytic accounts by code/name), DEBIT/CREDIT segmented toggle (`role="group"`, `aria-pressed`), amount input (JetBrains Mono, `inputMode="decimal"`), description, remove button
- Starts with 2 lines (1 debit + 1 credit placeholder)
- `BalanceIndicator` (role="status"): live totals, 3 states (pending/balanced/unbalanced) with color + icon
- "Lançar" button disabled until balanced
- Post confirmation via ConfirmModal (variant="warning")
- "Modelos" button opens JournalEntryTemplateModal

**`ReversalModal.tsx`**:

- 640px max-width
- Read-only summary of original entry (date, description, amount, line count)
- Reason textarea: required, min 10 chars, validation on blur, `role="alert"` on error
- Two-step confirmation: "Confirmar Estorno" → ConfirmModal variant="danger"
- Success toast: "Lançamento #{número} estornado. Estorno #{novo_número} criado."

### Task 3: OpeningBalanceWizard + JournalEntryTemplateModal + Routing (commit 5fdceaa6)

**`OpeningBalanceWizard.tsx`** (2-step, 800px):

- Step indicator: "Etapa 1 de 2 — Revisão" / "Etapa 2 de 2 — Contrapartida"
- Step 1: editable table pre-populated from `useOpeningBalancePreview`, fiscal year + date controls, add/remove lines, side toggle, 4-row skeleton loading, empty state
- Step 2: read-only net diff summary + "Lucros e Prejuízos Acumulados" contra-entry explanation
- "Postar Saldo de Abertura" primary CTA (disabled during posting)
- Back button on step 2 returns to step 1 without losing edits
- Error handling for "already exists" case

**`JournalEntryTemplateModal.tsx`**:

- Save current lines as named template (name input + save button)
- List of saved templates with name, description, line count
- "Usar" button loads template lines back into JournalEntryModal
- "Excluir" button with ConfirmModal danger confirmation
- Skeleton loading + empty state

**Routing** (`App.tsx`):

- Added lazy import: `const JournalEntriesPage = lazy(() => import('@/pages/JournalEntriesPage'))`
- Route `/accounting-entries` now points to `JournalEntriesPage` (the full manual entry UI)
- Previous `AccountingEntriesPage` (payroll-auto entries) still available as import for potential future use

## Acceptance Criteria Met

- [x] Contador can create a multi-line debit/credit journal entry via modal form
- [x] Balance indicator shows real-time balanced/unbalanced state with diff amount
- [x] Lançamento can be posted (primary CTA disabled until balanced)
- [x] Estorno opens ReversalModal with mandatory reason textarea and ConfirmModal danger variant
- [x] Opening balance wizard shows pre-populated lines in step 1, contra-entry summary in step 2
- [x] Templates can be saved and loaded from a template modal
- [x] Journal entries page lists entries with status badges and action menu
- [x] CSV file can be uploaded via file input in JournalEntriesPage, previewed, and imported as drafts (per LANC-03)

## Deviations from Plan

### Auto-Fixes

None. Plan executed exactly as written.

### Notes

- App.tsx already had LedgerPage and TrialBalancePage imports/routes (added by parallel agent 36-05) — no conflict, simply added JournalEntriesPage alongside them
- The CSV import button is in JournalEntriesPage (not in JournalEntryModal) per the plan spec, which says "Three action buttons: 'Importar CSV' (secondary...)"

## Known Stubs

None — all data flows are wired to real API endpoints via hooks.

## Self-Check: PASSED
