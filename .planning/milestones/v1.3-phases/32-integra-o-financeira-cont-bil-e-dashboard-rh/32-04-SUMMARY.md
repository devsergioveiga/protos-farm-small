---
phase: 32-integra-o-financeira-cont-bil-e-dashboard-rh
plan: '04'
subsystem: payroll-frontend-accounting-frontend
tags: [payroll, accounting-entries, cp-review, frontend, integr-01, integr-02]
dependency_graph:
  requires: [32-01, 32-02]
  provides: [payroll-cp-review-modal, accounting-entries-page]
  affects: [payroll-runs-page, payroll-run-detail-modal, sidebar, app-routes]
tech_stack:
  added: []
  patterns:
    - useCpPreview hook — useState+useCallback, fetches on runId change (Phase 25 pattern)
    - useAccountingEntries hook — useState+useCallback, exportCsv via api.getBlob + blob URL download
    - PayrollCpReviewModal — details/summary for collapsible sections (keyboard-native, no custom ARIA)
    - AccountingEntriesPage — inline accordion via row expansion state, mobile card transform below 768px
    - ConfirmModal variant=danger for estorno (medium criticality, replaces ConfirmDeleteModal per UI-SPEC)
key_files:
  created:
    - apps/frontend/src/types/payroll-integration.ts
    - apps/frontend/src/hooks/useCpPreview.ts
    - apps/frontend/src/components/payroll/PayrollCpReviewModal.tsx
    - apps/frontend/src/components/payroll/PayrollCpReviewModal.css
    - apps/frontend/src/types/accounting-entries.ts
    - apps/frontend/src/hooks/useAccountingEntries.ts
    - apps/frontend/src/pages/AccountingEntriesPage.tsx
    - apps/frontend/src/pages/AccountingEntriesPage.css
  modified:
    - apps/frontend/src/pages/PayrollRunsPage.tsx
    - apps/frontend/src/components/payroll/PayrollRunDetailModal.tsx
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - 'ConfirmDeleteModal replaced by ConfirmModal variant=danger in PayrollRunDetailModal — estorno is medium criticality (reversible), no name typing required per UI-SPEC'
  - 'Sidebar gets new CONTABILIDADE group (not added to RH group) — accounting is a separate concern from HR operations'
  - 'PayrollCpReviewModal uses details/summary for section collapse — keyboard-native, no custom aria-expanded needed'
  - 'AccountingEntriesPage mobile card list hidden above 768px via CSS; desktop table hidden below 768px — clean separation, no JS needed'
metrics:
  duration: '~20 minutes'
  completed: '2026-03-26T20:24:25Z'
  tasks_completed: 2
  files_modified: 12
---

# Phase 32 Plan 04: PayrollCpReviewModal + AccountingEntriesPage Summary

Frontend delivery for INTEGR-01 (CP review before payroll close) and INTEGR-02 (accounting entries read-only page) — PayrollCpReviewModal with grouped CP preview, reconciliation row, and tax guide section; AccountingEntriesPage with filters, typed badges, drill-down accordion, CSV export, and mobile card layout.

## Tasks Completed

| #   | Task                                                                                           | Commit   | Files                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Types + useCpPreview hook + PayrollCpReviewModal + wire PayrollRunsPage + estorno ConfirmModal | 29264f41 | payroll-integration.ts, useCpPreview.ts, PayrollCpReviewModal.tsx/.css, PayrollRunsPage.tsx, PayrollRunDetailModal.tsx |
| 2   | AccountingEntriesPage + useAccountingEntries + types + route + sidebar                         | c34e8888 | accounting-entries.ts, useAccountingEntries.ts, AccountingEntriesPage.tsx/.css, App.tsx, Sidebar.tsx                   |

## What Was Built

### Task 1

- **types/payroll-integration.ts:** `CpPreviewItem`, `TaxGuidePreviewItem`, `CpPreviewResponse` interfaces. `CP_TYPE_LABELS` and `CP_SECTION_KEYS` for grouping items into "Salários Líquidos", "Encargos Patronais", "Impostos a Recolher", "Outros".
- **hooks/useCpPreview.ts:** `useCpPreview(runId)` — fetches `GET /org/:orgId/payroll-runs/:runId/cp-preview` on runId change via `useEffect`. Returns `{ data, isLoading, error, refetch }`. Resets data when runId is null.
- **PayrollCpReviewModal.tsx:** Modal with 300ms ease-out open animation. Header shows title "Revisão de Contas a Pagar — [Mês/Ano]" + `PayrollRunStatusBadge`. Body has grouped sections via `<details>`/`<summary>` (each section collapses/expands with 200ms CSS). Inner tables show per-item rows with JetBrains Mono amounts. Tax guide section lists `taxGuideItems` with `totalTaxGuides` footer. Reconciliation row at bottom: green `CheckCircle` if `reconciled=true`, orange `AlertTriangle` with divergence amount if false. Footer: "Voltar à Folha" (secondary) + "Confirmar Fechamento" (primary green). Skeleton pulse in loading, inline red border-left alert for errors. Focus trap + Escape to close. `aria-modal`, `aria-labelledby`.
- **PayrollRunsPage.tsx:** Added `showCpReview`, `selectedRunIdForClose`, `selectedRunMonthForClose`, `isConfirmingClose` state. "Fechar Folha" button added for CALCULATED rows — opens CP review modal instead of direct close. `handleCpReviewConfirm` calls `closeRun`, closes modal on success. `PayrollCpReviewModal` rendered at page bottom.
- **PayrollRunDetailModal.tsx:** Replaced `ConfirmDeleteModal` import with `ConfirmModal` from `@/components/ui/ConfirmModal`. Estorno confirmation now uses `variant="danger"` with correct UI-SPEC copy: title "Estornar fechamento da folha?", body with full reversal explanation, CTA "Estornar Folha", cancel "Manter Fechamento".

### Task 2

- **types/accounting-entries.ts:** `AccountingEntryType` and `AccountingSourceType` enums matching backend exactly. `AccountingEntry` interface with `sourceType: AccountingSourceType` (never string). `ENTRY_TYPE_LABELS` pt-BR display labels. `ENTRY_TYPE_BADGE_COLORS` matching UI-SPEC badge color table (6 colors, CSS custom property references).
- **hooks/useAccountingEntries.ts:** `useAccountingEntries(initialFilters?)` — paginated list with optional filters. `exportCsv(filters?)` — `api.getBlob` download with auto filename including referenceMonth.
- **AccountingEntriesPage.tsx:** Breadcrumb "Dashboard > Contabilidade > Lançamentos". Filter bar: month select + year select + entry type select. Desktop table with 7 columns (COMPETÊNCIA, TIPO, DÉBITO, CRÉDITO, VALOR, CENTRO DE CUSTO, ORIGEM). DÉBITO/CRÉDITO columns hidden below 640px; CENTRO DE CUSTO hidden below 1024px. Typed badge in TIPO column with colors per `ENTRY_TYPE_BADGE_COLORS`. ORIGEM column shows pill `[FOLHA-YYYY-MM]`. Click row toggles inline accordion expansion showing debitLabel + creditLabel + notes + reversedById. Mobile cards list shown below 768px (desktop table hidden). Pagination controls. Empty state with "Ir para Folha de Pagamento" CTA. CSV export button in header.
- **AccountingEntriesPage.css:** Accordion expand animation 200ms ease-out. Skeleton pulse 1.5s. Mobile card layout. Column visibility breakpoints. `prefers-reduced-motion` respected.
- **App.tsx:** `AccountingEntriesPage` lazy-imported, route `/accounting-entries` registered inside `ProtectedRoute/AppLayout`.
- **Sidebar.tsx:** `BookOpen` icon imported. New `CONTABILIDADE` group added before `CONFIGURAÇÃO` with entry `{ to: '/accounting-entries', icon: BookOpen, label: 'Lançamentos Contábeis' }`.

## Deviations from Plan

None — plan executed exactly as written, with two minor adaptations:

- **[Rule 1 - Bug] ConfirmDeleteModal → ConfirmModal:** The existing `PayrollRunDetailModal` used `ConfirmDeleteModal` (high-criticality, name typing) for estorno. Per UI-SPEC destructive actions table, estorno is medium criticality (reversible) — replaced with `ConfirmModal variant="danger"`. This is the correct per-spec behavior, not a regression.

- **[Rule 2 - Missing] CP_SECTION_KEYS mapping in types:** Plan specified grouping by type in the modal but didn't detail the mapping. Added `CP_SECTION_KEYS` constant to `payroll-integration.ts` to map section names to CP types — required for the modal's `groupItemsBySection()` function to operate correctly.

## Known Stubs

None — all data flows are wired to real backend endpoints from Plans 01 and 02. No hardcoded mock data.

## Self-Check: PASSED
