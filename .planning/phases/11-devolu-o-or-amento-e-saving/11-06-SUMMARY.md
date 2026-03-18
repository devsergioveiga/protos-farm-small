---
phase: 11-devolu-o-or-amento-e-saving
plan: '06'
subsystem: frontend
tags: [purchase-budgets, saving-analysis, recharts, frontend, analytics]
dependency_graph:
  requires: [11-03, 11-04]
  provides: [purchase-budgets-ui, saving-analysis-ui]
  affects: [sidebar, app-routes]
tech_stack:
  added: []
  patterns: [recharts-lazy-loaded, progress-bar-color-coded, inline-edit-cell, date-presets]
key_files:
  created:
    - apps/frontend/src/hooks/usePurchaseBudgets.ts
    - apps/frontend/src/pages/OrcamentoComprasPage.tsx
    - apps/frontend/src/pages/OrcamentoComprasPage.css
    - apps/frontend/src/hooks/useSavingAnalysis.ts
    - apps/frontend/src/pages/SavingAnalysisPage.tsx
    - apps/frontend/src/pages/SavingAnalysisPage.css
    - apps/frontend/src/components/saving-analysis/PriceHistoryChart.tsx
    - apps/frontend/src/components/saving-analysis/TopItemsChart.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - 'Lazy-loaded PriceHistoryChart and TopItemsChart follow FinancialDashboardPage pattern — avoids recharts in main bundle'
  - 'useSavingDashboard calls /dashboard endpoint (single request) then distributes data to all sections — avoids 5 parallel requests on page load'
  - 'TopItemsChart is shared component for both top-products and top-suppliers with generic items prop'
  - 'Progress bar track uses flex layout with fixed-width fill div and separate label span — avoids complex CSS position tricks'
  - 'Date presets hardcoded in frontend (Último Mês / Trimestre / Safra / Último Ano) — no backend dependency needed'
metrics:
  duration: 580s
  completed_date: '2026-03-18'
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 11 Plan 06: Purchase Budgets and Saving Analysis Frontend Summary

Frontend for Purchase Budgets (FINC-02) and Saving Analysis (FINC-03): OrcamentoComprasPage with editable budget execution table and progress bars, plus SavingAnalysisPage with 6 sections including KPI cards, Recharts LineChart and horizontal BarCharts.

## Tasks Completed

| Task | Name                                                  | Commit  | Files                                                                                       |
| ---- | ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 1    | OrcamentoComprasPage with budget execution table      | 1126236 | usePurchaseBudgets.ts, OrcamentoComprasPage.tsx/.css, App.tsx, Sidebar.tsx                  |
| 2    | SavingAnalysisPage with KPI cards and Recharts charts | fb85d2c | useSavingAnalysis.ts, SavingAnalysisPage.tsx/.css, PriceHistoryChart.tsx, TopItemsChart.tsx |

## What Was Built

### OrcamentoComprasPage (`/purchase-budgets`)

- **Two tabs:** Execução Orçamentária and Desvios
- **Tab 1 — Execução:** Table with Categoria, Fazenda, Orçado (inline-editable), Requisitado, Comprado, Pago, % Utilizado (progress bar)
  - Progress bars: green (<80%), yellow (80-100%), red (>100%)
  - Inline edit: click edit icon on Orçado cell, save on blur/Enter
  - Delete per row with ConfirmModal (danger variant)
  - Totals row at bottom
  - Mobile: card layout with mini progress bar
- **Tab 2 — Desvios:** Rows where percentUsed > 100, expandable to show RC/OC contributions
- **Create modal:** category select, farm select, period type, date range, amount
- **Filters:** farm, period type, date range with auto-date calculation on period type change
- **Empty state** with CTA

### SavingAnalysisPage (`/saving-analysis`)

- **Date presets:** Último Mês, Último Trimestre, Safra Atual, Último Ano
- **Section 1 — KPI Cards (4):** Saving Total, Saving Médio, % Compras Formais, % Emergenciais (color-coded accent)
- **Section 2 — Saving por Cotação:** Expandable/collapsible table with item-level detail
- **Section 3 — Histórico de Preços:** Product select → lazy-loaded Recharts LineChart with custom tooltip (price, date, OC number, supplier)
- **Section 4 — Indicadores de Ciclo:** 4 KPI cards (Prazo Médio, Total Pedidos, % Formais, % Emergenciais)
- **Sections 5 & 6 — Top 10 Produtos / Top 5 Fornecedores:** Lazy-loaded horizontal Recharts BarChart (shared TopItemsChart component)
- All sections: skeleton loading, empty states

### Hooks

- **usePurchaseBudgets:** list hook
- **useBudgetExecution:** execution endpoint hook
- **useBudgetDeviations:** deviations endpoint hook
- **createPurchaseBudget / updatePurchaseBudget / deletePurchaseBudget:** API functions
- **useSavingDashboard:** combined dashboard endpoint (single request, no waterfall)
- **useSavingByQuotation / usePriceHistory / useCycleIndicators / useTopProducts / useTopSuppliers:** individual endpoint hooks

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `apps/frontend/src/hooks/usePurchaseBudgets.ts` — EXISTS
- [x] `apps/frontend/src/pages/OrcamentoComprasPage.tsx` — EXISTS
- [x] `apps/frontend/src/pages/OrcamentoComprasPage.css` — EXISTS
- [x] `apps/frontend/src/hooks/useSavingAnalysis.ts` — EXISTS
- [x] `apps/frontend/src/pages/SavingAnalysisPage.tsx` — EXISTS
- [x] `apps/frontend/src/pages/SavingAnalysisPage.css` — EXISTS
- [x] Commits 1126236, fb85d2c — verified
- [x] `npx tsc --noEmit` — exits 0

## Self-Check: PASSED
