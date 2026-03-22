---
phase: 21-controle-operacional
plan: "02"
subsystem: frontend-assets
tags: [assets, operational-cost, tco, frontend, react, hooks]
dependency_graph:
  requires: ["21-01"]
  provides: ["OPER-04-frontend"]
  affects: ["AssetDrawer"]
tech_stack:
  added: []
  patterns: ["hook-per-endpoint", "tab-panel-pattern", "dl-for-cost-breakdown"]
key_files:
  created:
    - apps/frontend/src/hooks/useAssetOperationalCost.ts
    - apps/frontend/src/components/assets/AssetCostTab.tsx
    - apps/frontend/src/components/assets/AssetCostTab.css
  modified:
    - apps/frontend/src/components/assets/AssetDrawer.tsx
decisions:
  - "AssetCostTab uses <dl> semantic HTML for cost breakdown (dt=label, dd=value) per accessibility spec"
  - "Insurance (N/D) rendered inline in the breakdown list with muted note — not a separate section"
  - "costPerHour card shows 'Sem leitura de horímetro' subtitle when null — avoids blank space"
metrics:
  duration: "167s"
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_changed: 4
---

# Phase 21 Plan 02: AssetCostTab — Custo Operacional Frontend Summary

**One-liner:** AssetDrawer Custo tab with TCO breakdown (acquisition, depreciation, maintenance, fuel) fetched via useAssetOperationalCost hook from /operational-cost endpoint.

## What Was Built

Added the "Custo" tab to the AssetDrawer, enabling managers to view the complete cost breakdown (TCO) per asset:

- **`useAssetOperationalCost.ts`** — hook fetching `GET /org/:orgId/assets/:assetId/operational-cost`, returning `OperationalCostData` with loading/error/refetch
- **`AssetCostTab.tsx`** — displays cost breakdown in two sections:
  - "Composição do Custo": acquisition value, accumulated depreciation (negative, error color), net book value (bold), maintenance, fuel (with record count), insurance (N/D with note)
  - "Indicadores": 3-card grid with total lifetime cost, operational cost, and cost/hour (N/D when no hourmeter)
  - Notes section when backend returns notes array
  - Skeleton loading (6 rows), error state with role="alert", empty state with DollarSign icon
- **`AssetCostTab.css`** — responsive CSS with JetBrains Mono for monetary values, DM Sans for headlines, Source Sans 3 for labels, skeleton pulse animation, 3-col to 1-col responsive grid
- **`AssetDrawer.tsx`** — updated with `'custo'` TabId, new TABS entry between Depreciacao and Timeline, tabpanel rendering AssetCostTab

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useAssetOperationalCost hook + AssetCostTab | 2d1ee024 | useAssetOperationalCost.ts, AssetCostTab.tsx, AssetCostTab.css |
| 2 | Wire AssetCostTab into AssetDrawer as 'custo' tab | ad37af24 | AssetDrawer.tsx |

## Decisions Made

1. **`<dl>` for cost breakdown** — semantic HTML (dt=label, dd=value) per accessibility requirements. Avoids div-table anti-pattern.
2. **Insurance inline in breakdown** — kept as last item in the `<dl>` list with "N/D" value and muted note, consistent with plan spec.
3. **costPerHour subtitle** — shows hourmeter value or "Sem leitura de horímetro" to fill space and provide context when null.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
