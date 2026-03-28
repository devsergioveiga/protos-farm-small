---
phase: 39-dre-balan-o-patrimonial-e-valida-o-cruzada
plan: '02'
subsystem: frontend-financial-statements
tags: [dre, frontend, recharts, hooks, accessibility]
dependency_graph:
  requires:
    - 39-01 (backend DRE/BP/cross-validation endpoints)
    - useFiscalPeriods (fiscal year hook)
    - api.ts (API client)
    - tokens.css (design tokens)
  provides:
    - DrePage (route /dre, renders DRE with 10 sections)
    - DreTable (semantic table component with V/H toggle)
    - MarginRankingChart (recharts horizontal bar for margin ranking)
    - useDre hook (fetches /financial-statements/dre)
    - useBalanceSheet hook (fetches /financial-statements/balance-sheet)
    - financial-statements.ts types (mirrors all backend response shapes)
  affects:
    - 39-03 (BP page will use useBalanceSheet hook and BpOutput types defined here)
tech_stack:
  added: []
  patterns:
    - useDre/useBalanceSheet follow useState + useEffect + useCallback pattern from useLedger.ts
    - DreTable: semantic HTML table with colgroup for layout stability during V/H toggle
    - DreTableSkeleton: 12 <tr> rows inside <tbody> with pulse animation
    - MarginRankingChart: recharts BarChart layout=vertical + sr-only accessible table
    - DrePage: inline cost center fetch (no existing org-level CC hook)
key_files:
  created:
    - apps/frontend/src/types/financial-statements.ts
    - apps/frontend/src/hooks/useDre.ts
    - apps/frontend/src/hooks/useBalanceSheet.ts
    - apps/frontend/src/components/financial-statements/DreTable.tsx
    - apps/frontend/src/components/financial-statements/DreTable.css
    - apps/frontend/src/components/financial-statements/MarginRankingChart.tsx
    - apps/frontend/src/pages/DrePage.tsx
    - apps/frontend/src/pages/DrePage.css
  modified: []
decisions:
  - 'useCostCenters hook does not exist — inline fetch from /org/:orgId/cost-centers inside DrePage useEffect (non-blocking)'
  - 'DreTable skeleton renders as <tbody> with 12 <tr> rows inside the <table> element (not as a separate div) — maintains table structure'
  - "Export buttons show toast 'Exportação disponível em breve' — wired to future endpoints per plan spec"
metrics:
  duration: 5 minutes
  completed_date: '2026-03-28'
  tasks: 2
  files_created: 8
  files_modified: 0
---

# Phase 39 Plan 02: DRE Frontend Page Summary

Frontend DRE page with semantic table, V/H analysis toggle, cost center filter, and margin ranking chart consuming the financial-statements backend from plan 01.

## Tasks Completed

| Task | Name                                                       | Commit   | Files                                                                        |
| ---- | ---------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 1    | Frontend types and hooks (useDre, useBalanceSheet stub)    | 6df55885 | financial-statements.ts, useDre.ts, useBalanceSheet.ts                       |
| 2    | DRE page with table, V/H toggle, CC filter, margin ranking | 2116fb47 | DreTable.tsx, DreTable.css, MarginRankingChart.tsx, DrePage.tsx, DrePage.css |

## What Was Built

**Types (`financial-statements.ts`):** Full TypeScript interfaces mirroring all backend response shapes — DreOutput, DreSection, DreSectionRow, DreResponse, MarginRankingItem, BpOutput, BpGroup, BpGroupRow, BpIndicators, CrossValidationOutput, InvariantResult, InvariantStatus.

**`useDre` hook:** Follows useState + useEffect + useCallback pattern from useLedger.ts. Fetches `GET /org/:orgId/financial-statements/dre` with fiscalYearId, month, and optional costCenterId query params. Returns `{ data, loading, error, refetch }`.

**`useBalanceSheet` hook:** Same pattern, fetches `GET /org/:orgId/financial-statements/balance-sheet`. Returns `BpOutput | null`. Defined here for type ownership, consumed by plan 03.

**`DreTable` component:** Semantic `<table>` with `<caption>`, `<thead>`, `<tbody>`, `<tfoot>`. Section headers use `<th scope="row">`, column headers use `<th scope="col">`. V/H columns use opacity transition (200ms ease-out). Loading state renders 12 `<tr>` skeleton rows with pulse animation. CPC 29 rows get `--color-sun-100` background. Currency formatted with `Intl.NumberFormat('pt-BR', currency BRL)`.

**`DreTable.css`:** BEM-style, zero hardcoded hex — all values via `var(--color-*)`, `var(--font-*)`, `var(--space-*)` tokens. `prefers-reduced-motion` disables pulse animation.

**`MarginRankingChart`:** Recharts `BarChart layout="vertical"` with sorted data (descending margin). `aria-hidden="true"` on chart container, accessible data in visually-hidden `<table>`. Custom tooltip showing Receita, CPV, and Margem%.

**`DrePage`:** Full page per UI-SPEC — breadcrumb, H1 with TrendingUp icon, filter bar with three labeled `<select>` elements (Exercício Fiscal, Mês, Centro de Custo), aria-pressed V/H toggle, export buttons. Empty state when both filters not selected. MarginRankingChart conditionally rendered when `costCenterId` is falsy (Consolidado view).

## Deviations from Plan

### Auto-fixed Issues

None.

### Adaptation Notes

**1. [Inline] No useCostCenters hook existed at org level**

- **Found during:** Task 2
- **Issue:** Plan spec said "check if hook exists. If not, create inline fetch" — hook did not exist for org-level listing (only farm-level in FieldTeamModal)
- **Fix:** Inline `useEffect` in DrePage fetching `/org/${orgId}/cost-centers`, non-blocking (failure = empty CC dropdown, not an error)
- **Files modified:** DrePage.tsx

## Known Stubs

| File                         | Description                                 | Future plan                                                 |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| DrePage.tsx — export buttons | Show toast "Exportação disponível em breve" | Per plan spec: future endpoints. Plan 39-03 or later phase. |

## Self-Check: PASSED

Files exist:

- apps/frontend/src/types/financial-statements.ts — FOUND
- apps/frontend/src/hooks/useDre.ts — FOUND
- apps/frontend/src/hooks/useBalanceSheet.ts — FOUND
- apps/frontend/src/components/financial-statements/DreTable.tsx — FOUND
- apps/frontend/src/components/financial-statements/MarginRankingChart.tsx — FOUND
- apps/frontend/src/pages/DrePage.tsx — FOUND

Commits exist:

- 6df55885 — feat(39-02): frontend types and hooks — FOUND
- 2116fb47 — feat(39-02): DRE page with table, V/H toggle, CC filter — FOUND

TypeScript: zero errors (`npx tsc --noEmit` exit 0).
