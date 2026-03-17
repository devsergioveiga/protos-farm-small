---
phase: 05-concilia-o-e-fluxo-de-caixa
plan: '05'
subsystem: cashflow-frontend
tags: [cashflow, recharts, dfc, projection, scenarios, pdf-export, excel-export, react, frontend]
dependency_graph:
  requires:
    - plan: '05-03'
      provides: 'GET /api/org/cashflow/projection, /negative-balance-alert, /export/pdf, /export/excel'
  provides:
    - CashflowPage with farm filter, alert banner, chart, DFC table, export buttons
    - CashflowChart (Recharts ComposedChart with 3 scenarios + ReferenceLine)
    - DfcTable (3 expandable sections, 12 monthly columns, sticky first column)
    - useCashflow hook (fetch + refetch)
    - useNegativeBalanceAlert hook
    - exportCashflowPdf / exportCashflowExcel functions
    - /cashflow route registered in App.tsx
    - Sidebar: Fluxo de caixa + Conciliacao bancaria items in FINANCEIRO group
  affects:
    - App.tsx (new /cashflow route)
    - Sidebar.tsx (new nav items under FINANCEIRO)
tech-stack:
  added: []
  patterns:
    - Local farmId state in cashflow page (not FarmContext global) — same pattern as FinancialDashboardPage
    - Recharts ComposedChart with Area + 2 Lines + ReferenceLine for scenario visualization
    - Custom Recharts Tooltip component with table layout
    - max-height CSS transition for expand/collapse sections (200ms ease-out)
    - Blob download via api.getBlob + URL.createObjectURL
    - React.lazy + Suspense for CashflowChart code splitting
key-files:
  created:
    - apps/frontend/src/hooks/useCashflow.ts
    - apps/frontend/src/pages/CashflowPage.tsx
    - apps/frontend/src/pages/CashflowPage.css
    - apps/frontend/src/components/cashflow/CashflowChart.tsx
    - apps/frontend/src/components/cashflow/DfcTable.tsx
  modified:
    - apps/frontend/src/App.tsx (/cashflow route added)
    - apps/frontend/src/components/layout/Sidebar.tsx (Fluxo de caixa + Conciliacao items)
key-decisions:
  - 'CashflowChart uses React.lazy + Suspense — chart is heavy (Recharts) and not needed on mobile where chart is hidden'
  - 'formatBRLCompact returns "R$ 12k" / "R$ 1,2M" using pt-BR locale arithmetic — matches YAxis tick precision'
  - 'DfcTable uses max-height CSS transition (not grid rows or JS height) — simpler, widely supported, section body can grow dynamically'
  - 'Sidebar adds both /cashflow and /reconciliation items in this plan — /reconciliation page does not exist yet but route is prepared for plan 05-01 completion'
requirements-completed:
  - FN-13
metrics:
  duration: 10min
  completed_date: '2026-03-17'
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 05 Plan 05: Cashflow Frontend Page Summary

**Recharts ComposedChart cashflow projection page with 3-scenario Area+Lines, DFC table with expandable Operacional/Investimento/Financiamento sections, negative balance alert banner, farm filter, and PDF/Excel export.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-17T08:16:19Z
- **Completed:** 2026-03-17T08:26:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- CashflowPage renders with farm filter dropdown (local state, not FarmContext), export PDF/Excel buttons with loading spinner, skeleton screen, negative balance alert banner with role="alert"
- CashflowChart: Recharts ComposedChart with Realista (area fill green), Otimista (dashed green line), Pessimista (dashed red line), ReferenceLine at y=0 in red, custom CashflowTooltip (saldo/entradas/saidas/cheques pendentes in JetBrains Mono), Legend with pt-BR labels
- DfcTable: 3 collapsible sections (Operacional, Investimento, Financiamento), each with Entradas/Saidas sub-groups, 12 monthly columns (Jan-Dez), subtotal rows, section net row, grand total table; sticky first column on mobile; accessible with th[scope=col/row] and caption[visually-hidden]

## Task Commits

1. **Task 1: Cashflow hook + page + chart component** - `2314def` (feat)
2. **Task 2: DFC classification table component** - `5092ecb` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/frontend/src/hooks/useCashflow.ts` — useCashflow, useNegativeBalanceAlert hooks + exportCashflowPdf/exportCashflowExcel functions
- `apps/frontend/src/pages/CashflowPage.tsx` — main cashflow projection page
- `apps/frontend/src/pages/CashflowPage.css` — BEM styles, skeleton animation, alert banner, DFC table classes
- `apps/frontend/src/components/cashflow/CashflowChart.tsx` — Recharts ComposedChart with 3 scenarios, custom tooltip, formatBRLCompact helper
- `apps/frontend/src/components/cashflow/DfcTable.tsx` — expandable DFC table with 12 monthly columns
- `apps/frontend/src/App.tsx` — /cashflow route registered
- `apps/frontend/src/components/layout/Sidebar.tsx` — Fluxo de caixa + Conciliacao bancaria nav items added

## Decisions Made

- CashflowChart lazy-loaded via React.lazy since Recharts is a heavy library and chart is hidden on mobile (<640px) — avoids loading chart code when user will never see it on small screens
- formatBRLCompact shows "R$ 12k" / "R$ 1,2M" for YAxis ticks using pt-BR locale — compact format fits axis tick width constraints
- DfcTable max-height CSS transition (200ms ease-out) for expand/collapse — simpler than JS-measured height, prefers-reduced-motion handled by tokens.css global rule
- Sidebar adds /reconciliation item now even though ReconciliationPage does not exist yet (plan 05-01 is pending) — route renders null via lazy import until page is created

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Cashflow frontend complete. Backend (plan 05-03) provides all required endpoints.
- Reconciliation frontend (plan 05-01) still needed — ReconciliationPage stub not yet created.
- Both /cashflow and /reconciliation sidebar items are registered, pointing to their target paths.

---

_Phase: 05-concilia-o-e-fluxo-de-caixa_
_Completed: 2026-03-17_

## Self-Check: PASSED

- FOUND: apps/frontend/src/hooks/useCashflow.ts
- FOUND: apps/frontend/src/pages/CashflowPage.tsx
- FOUND: apps/frontend/src/pages/CashflowPage.css
- FOUND: apps/frontend/src/components/cashflow/CashflowChart.tsx
- FOUND: apps/frontend/src/components/cashflow/DfcTable.tsx
- FOUND: commit 2314def (Task 1)
- FOUND: commit 5092ecb (Task 2)
- tsc --noEmit: PASSED (no errors)
