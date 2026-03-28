---
phase: 39-dre-balan-o-patrimonial-e-valida-o-cruzada
plan: '03'
subsystem: financial-statements-frontend
tags: [balance-sheet, cross-validation, frontend, react, recharts, indicators]
dependency_graph:
  requires:
    - useBalanceSheet.ts (plan 02)
    - useDre.ts (plan 02)
    - types/financial-statements.ts (plan 02)
    - GET /financial-statements/balance-sheet (plan 01)
    - GET /financial-statements/cross-validation (plan 01)
  provides:
    - BalanceSheetPage with 6 indicator cards + BP table
    - CrossValidationPage with 4 invariant cards
    - useCrossValidation hook
    - IndicatorCard, BalanceSheetTable, InvariantCard components
    - Sidebar CONTABILIDADE links for DRE, Balanco Patrimonial, Validacao Cruzada
    - App.tsx lazy routes /dre, /balance-sheet, /cross-validation
  affects:
    - Sidebar navigation (3 new entries)
    - App routing (3 new routes)
tech_stack:
  added: []
  patterns:
    - IndicatorCard with recharts LineChart sparkline (no axes, aria-hidden)
    - BalanceSheetTable 2-column CSS grid (1fr 1fr desktop, 1fr mobile at <1024px)
    - InvariantCard 3-state traffic-light pattern (PASSED/FAILED/PENDING)
    - Skeleton loading with CSS pulse animation (prefers-reduced-motion respected)
    - useCrossValidation follows useState + useEffect + useCallback pattern
key_files:
  created:
    - apps/frontend/src/hooks/useCrossValidation.ts
    - apps/frontend/src/components/financial-statements/IndicatorCard.tsx
    - apps/frontend/src/components/financial-statements/IndicatorCard.css
    - apps/frontend/src/components/financial-statements/BalanceSheetTable.tsx
    - apps/frontend/src/components/financial-statements/BalanceSheetTable.css
    - apps/frontend/src/components/financial-statements/InvariantCard.tsx
    - apps/frontend/src/components/financial-statements/InvariantCard.css
    - apps/frontend/src/pages/BalanceSheetPage.tsx
    - apps/frontend/src/pages/BalanceSheetPage.css
    - apps/frontend/src/pages/CrossValidationPage.tsx
    - apps/frontend/src/pages/CrossValidationPage.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx (3 new CONTABILIDADE items)
    - apps/frontend/src/App.tsx (3 lazy imports + routes)
decisions:
  - 'BalanceSheetPage uses IndicatorCard with recharts sparklines per D-09/D-10'
  - 'BalanceSheetTable uses SideTable helper component called twice — one table per side'
  - 'CrossValidationPage shows status banner with role=status (allPassed) or role=alert (failed)'
  - 'useCrossValidation follows identical pattern to useBalanceSheet and useDre'
metrics:
  duration_seconds: 420
  completed_date: '2026-03-28'
  tasks_completed: 2
  tasks_total: 2
  files_created: 11
  files_modified: 2
---

# Phase 39 Plan 03: Balance Sheet Page, Cross-Validation Page, and Frontend Wiring — Summary

BalanceSheetPage with 6 recharts sparkline indicator cards and 2-column BP table; CrossValidationPage with 4 invariant cards (PASSED/FAILED/PENDING traffic-light); sidebar CONTABILIDADE group and App.tsx lazy routes for all 3 financial statement pages.

## What Was Built

### useCrossValidation.ts

Hook following the same useState + useEffect + useCallback pattern as `useBalanceSheet` and `useDre`. Fetches `GET /org/${orgId}/financial-statements/cross-validation?fiscalYearId=...&month=...`. Returns `{ data: CrossValidationOutput | null, loading, error, refetch }`.

### IndicatorCard.tsx / IndicatorCard.css

Reusable card for each of the 6 BP financial indicators. Props: `label`, `value`, `tooltip`, `sparklineData`. Shows "N/D" when value is null. Sparkline uses recharts `<LineChart>` in `<ResponsiveContainer height={48}>` with no axes, no tooltip, `aria-hidden="true"` on the chart container. Shows "--" text when fewer than 2 sparkline data points. Hover animation: `translateY(-2px)` over 100ms ease-out; disabled under `prefers-reduced-motion`.

### BalanceSheetTable.tsx / BalanceSheetTable.css

Semantic `<table>` split into two `SideTable` sub-components (Ativo and Passivo e Patrimonio Liquido). Desktop layout: CSS `grid-template-columns: 1fr 1fr` with 32px gap. Mobile (<1024px): single column with an `<hr>` divider between tables. Each table has `<caption>`, `<th scope="col">` headers, group header rows, account rows with indent via `level`, subtotal rows, and a `<tfoot>` grand total. Monetary values formatted with `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Skeleton: 10 pulse-animated rows per side.

### BalanceSheetPage.tsx / BalanceSheetPage.css

Full page with breadcrumb, `<h1>` with Scale icon, filter bar (Exercicio Fiscal + Mes selects — no CC filter per D-11), 6 IndicatorCard components in `repeat(auto-fill, minmax(180px, 1fr))` grid with 48px margin-bottom before the table, export bar (PDF + XLSX toasts "Exportacao disponivel em breve"), BalanceSheetTable, and empty state (Scale 48px + messages) when no period selected. Error shows toast. Loading shows 6 skeleton rectangles (80px tall) + skeleton table rows.

### InvariantCard.tsx / InvariantCard.css

3 visual states:

- **PASSED**: green background (`--color-success-100`), CheckCircle icon, detail row with Esperado/Encontrado values in mono font.
- **FAILED**: red background (`--color-error-100`), XCircle icon, difference row in mono red, "Investigar" `<a>` button with `target="_blank" rel="noopener noreferrer"` and `aria-label="Investigar divergencia em {title}"`, min-height 36px.
- **PENDING**: gray-dashed background (`--color-neutral-100`), Clock icon, "Aguardando DFC (Phase 40)" italic body text, `opacity: 0.7`.

### CrossValidationPage.tsx / CrossValidationPage.css

Full page with breadcrumb, `<h1>` with GitMerge icon, filter bar (Exercicio Fiscal + Mes), conditional status banner (`role="status" aria-live="polite"` for all-passed green; `role="alert" aria-live="assertive"` for failures), 2x2 grid of 4 InvariantCard components, skeleton (4 gray rectangles), and empty state (GitMerge 48px + messages) when no period selected.

### Sidebar.tsx — CONTABILIDADE group

Added 3 items after "Fechamento Mensal":

- `{ to: '/dre', icon: TrendingUp, label: 'DRE' }`
- `{ to: '/balance-sheet', icon: Scale, label: 'Balanco Patrimonial' }`
- `{ to: '/cross-validation', icon: GitMerge, label: 'Validacao Cruzada' }`

All 3 icons (`TrendingUp`, `Scale`, `GitMerge`) were already imported in Sidebar.tsx.

### App.tsx — Lazy routes

Added 3 lazy imports and 3 `<Route>` elements inside the `<AppLayout>` protected block after `MonthlyClosingPage`.

## Decisions Made

1. IndicatorCard sparkline uses `<LineChart>` with no axes/tooltip/legend — minimal footprint in card layout.
2. BalanceSheetTable uses a single `SideTable` component called twice — avoids code duplication while keeping two independent `<table>` elements for semantic correctness.
3. CrossValidationPage status banner role is `"status"` for all-passed (non-urgent), `"alert"` for failures (requires attention).
4. Scale icon was already imported in Sidebar.tsx (used for weighing-session) — no new import needed.
5. useCrossValidation follows the exact same pattern as useBalanceSheet — consistency over cleverness.

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

Plan 02 was found to be partially complete: `types/financial-statements.ts`, `useDre.ts`, and `useBalanceSheet.ts` were already committed (commits 6df55885 and 2116fb47). DreTable, MarginRankingChart, and DrePage were also committed. Plan 03 execution started from a clean state with all plan 02 artifacts present.

## Known Stubs

The "Exportar PDF" and "Exportar XLSX" buttons on BalanceSheetPage show a toast "Exportacao disponivel em breve" on click. These are intentional placeholders — export endpoints are not part of Phase 39 scope.

## Self-Check: PASSED
