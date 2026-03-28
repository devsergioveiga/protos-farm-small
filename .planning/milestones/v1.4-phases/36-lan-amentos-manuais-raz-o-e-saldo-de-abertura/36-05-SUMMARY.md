---
phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
plan: '05'
subsystem: frontend-accounting-reports
tags: [frontend, accounting, ledger, trial-balance, daily-book, react, typescript]
dependency_graph:
  requires: [36-03]
  provides: [RAZAO-01, RAZAO-02, RAZAO-03]
  affects: [apps/frontend/src/App.tsx, apps/frontend/src/components/layout/Sidebar.tsx]
tech_stack:
  added: []
  patterns:
    - 'useLedger/useTrialBalance/useDailyBook hooks matching existing useChartOfAccounts pattern'
    - 'api.getBlob for file downloads (CSV, PDF, XLSX)'
    - 'Tabbed page layout (TrialBalancePage) with role=tabpanel/tablist'
    - 'Searchable combobox for account selection (analytic-only filter)'
key_files:
  created:
    - apps/frontend/src/hooks/useLedger.ts
    - apps/frontend/src/pages/LedgerPage.tsx
    - apps/frontend/src/pages/LedgerPage.css
    - apps/frontend/src/pages/TrialBalancePage.tsx
    - apps/frontend/src/pages/TrialBalancePage.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - 'useLedger derives startDate/endDate from fiscalYearId+month client-side — avoids extra API call'
  - 'TrialBalancePage uses tab pattern (Balancete + Livro Diário) per UI-SPEC — single page, two panels'
  - 'LedgerPage entry drill-down uses inline modal (role=dialog) — not a separate route'
  - 'orgId null→undefined coercion with ?? undefined per CLAUDE.md Prisma/null vs undefined rule'
metrics:
  duration_seconds: 444
  completed_date: '2026-03-27'
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 2
---

# Phase 36 Plan 05: Ledger + Trial Balance Frontend Summary

Ledger page (Razão Contábil) with running balance table and entry drill-down, trial balance page (Balancete de Verificação) with balance validation bar and daily book (Livro Diário) tab, CSV/PDF/XLSX exports, and sidebar CONTABILIDADE group navigation links.

## What Was Built

### Task 1 — useLedger hook + LedgerPage

**`apps/frontend/src/hooks/useLedger.ts`**

Three data hooks matching the existing project pattern:

- `useLedger(orgId, accountId, startDate, endDate, costCenterId?)` — fetches `/api/org/:orgId/ledger/razao`
- `useTrialBalance(orgId, fiscalYearId, month, comparePreviousPeriod?)` — fetches `/api/org/:orgId/ledger/balancete`
- `useDailyBook(orgId, startDate, endDate, entryType?)` — fetches `/api/org/:orgId/ledger/diario`

Five export functions using `api.getBlob` + `URL.createObjectURL` blob download pattern:

- `exportLedgerCsv`, `exportLedgerPdf`, `exportTrialBalancePdf`, `exportTrialBalanceXlsx`, `exportDailyBookPdf`

Helper `useOrgId()` returns `user?.organizationId ?? undefined` (null coercion per CLAUDE.md).

**`apps/frontend/src/pages/LedgerPage.tsx`**

- Breadcrumb: Início > Contabilidade > Razão Contábil
- Searchable combobox account selector filtered to analytic accounts only (`!isSynthetic`)
- Period selector: fiscal year dropdown + month dropdown from `useFiscalYears`
- Empty state (no account): Search icon 48px + "Selecione uma conta para visualizar o razão."
- Empty state (no data): "Nenhum lançamento nesta conta para o período selecionado."
- 8-row skeleton loading state
- Ledger `<table>` with `<th scope="col">` and `<caption>`
- Visually distinct "Saldo Anterior" row (`.saldo-anterior-row` with `--color-neutral-200` bg + bold)
- Running balance column (Saldo Progressivo) — negative in `--color-error-500`
- Drill-down: clicking entry number opens `role="dialog"` inline detail modal
- Export buttons: "Exportar CSV" and "Exportar PDF" with spinner during generation
- Responsive: `running-balance-col` hidden at `<768px`

**`apps/frontend/src/pages/LedgerPage.css`**

All colors via `var(--)` tokens only. Key classes:

- `.amount-debit` → `var(--color-error-500)`
- `.amount-credit` → `var(--color-success-500)`
- `.amount-mono` → `font-family: 'JetBrains Mono', monospace`
- `.saldo-anterior-row` → `var(--color-neutral-200)` background + bold
- Row hover 100ms ease-out; `prefers-reduced-motion` disables all transitions/animations

### Task 2 — TrialBalancePage + sidebar + routing

**`apps/frontend/src/pages/TrialBalancePage.tsx`**

- Page heading: "Balancete de Verificação" (DM Sans 700)
- Period selector: fiscal year + month dropdowns
- Tabbed layout: "Balancete" tab and "Livro Diário" tab with `role="tablist/tab/tabpanel"`
- Balance validation bar (`.validation-bar`): always visible above table
  - Balanced: `--color-success-100` bg + CheckCircle + "Balancete equilibrado"
  - Unbalanced: `--color-error-100` bg + XCircle + "Atenção: débitos e créditos divergem em R$ {valor}"
- Trial balance `<table>` with `<th scope="col">`:
  - Group rows (synthetic): `.group-row` — `--color-neutral-100` bg + bold
  - Analytic rows: alternating stripe via `.analytic-row:nth-child(even)`
  - Total rows: `.total-row` — DM Sans bold + top border `--color-neutral-300`
  - Columns: Código | Conta | Saldo Anterior | Movimento Débito | Movimento Crédito | Saldo Atual
- 10-row skeleton loading state
- Livro Diário section: date-grouped entries, each with account lines table, PDF export
- Export: "Exportar XLSX" and "Exportar PDF" with spinner

**Sidebar.tsx** — CONTABILIDADE group extended with:

```typescript
{ to: '/ledger', icon: BookOpen, label: 'Razão Contábil' },
{ to: '/trial-balance', icon: BarChart3, label: 'Balancete' },
```

**App.tsx** — lazy imports and routes added:

```typescript
const LedgerPage = lazy(() => import('@/pages/LedgerPage'));
const TrialBalancePage = lazy(() => import('@/pages/TrialBalancePage'));
// routes:
<Route path="/ledger" element={<LedgerPage />} />
<Route path="/trial-balance" element={<TrialBalancePage />} />
```

## Deviations from Plan

None — plan executed exactly as written.

Note: TypeScript compilation shows errors in `JournalEntriesPage.tsx` and `JournalEntryModal.tsx` (Plan 04 parallel agent incomplete — `JournalEntryTemplateModal` and `OpeningBalanceWizard` not yet created). These are pre-existing errors not caused by this plan. All files created/modified by Plan 05 compile without errors.

## Known Stubs

None. Both pages are fully wired to real API endpoints via hooks. Export functions use real blob download. The pages render empty states when no data is available — not hardcoded placeholders.

## Self-Check: PASSED

| Item                                           | Status |
| ---------------------------------------------- | ------ |
| `apps/frontend/src/hooks/useLedger.ts`         | FOUND  |
| `apps/frontend/src/pages/LedgerPage.tsx`       | FOUND  |
| `apps/frontend/src/pages/LedgerPage.css`       | FOUND  |
| `apps/frontend/src/pages/TrialBalancePage.tsx` | FOUND  |
| `apps/frontend/src/pages/TrialBalancePage.css` | FOUND  |
| Task 1 commit `1cdb1cb9`                       | FOUND  |
| Task 2 commit `ccfb6b5d`                       | FOUND  |
