---
phase: 23-relatorios-dashboard-patrimonial
plan: 03
subsystem: ui
tags: [react, recharts, asset-reports, tco, depreciation, frontend]

requires:
  - phase: 23-01
    provides: Asset reports backend endpoints (inventory, depreciation-projection, tco-fleet) and types
  - phase: 23-02
    provides: CostCenterWizardModal component with 4-step wizard interface

provides:
  - AssetReportsPage with 3 tabs (Inventario, Depreciacao, TCO e Frota) at route /asset-reports
  - useAssetReports hook with inventory fetch and PDF/xlsx/CSV export
  - useDepreciationProjection hook with horizonMonths parameter
  - useTCOFleet hook with farmId/assetType filters
  - DepreciationProjectionChart Recharts ComposedChart with 2 series
  - TCOFleetView fleet table with OK/Monitorar/Substituir/Sem dados alert badges
  - Sidebar entry for Relatorios in PATRIMONIO group

affects:
  - future-phases-using-asset-reports
  - cost-center-management

tech-stack:
  added: []
  patterns:
    - 'Tab page pattern with display:none/block (no animation) for tab switching'
    - 'Fetch hook with exportReport function using blob download pattern'
    - 'Fleet grouping using <details>/<summary> for mobile accordion'
    - 'Alert badge with combined color + icon + text for accessibility (never color alone)'

key-files:
  created:
    - apps/frontend/src/hooks/useAssetReports.ts
    - apps/frontend/src/hooks/useDepreciationProjection.ts
    - apps/frontend/src/hooks/useTCOFleet.ts
    - apps/frontend/src/pages/AssetReportsPage.tsx
    - apps/frontend/src/pages/AssetReportsPage.css
    - apps/frontend/src/components/assets/DepreciationProjectionChart.tsx
    - apps/frontend/src/components/assets/DepreciationProjectionChart.css
    - apps/frontend/src/components/assets/TCOFleetView.tsx
    - apps/frontend/src/components/assets/TCOFleetView.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx

key-decisions:
  - 'Tab panels use display:none/block inline style (no CSS animation) per UI-SPEC'
  - 'Alert badges use color + icon + aria-label (never color alone) to meet WCAG contrast requirements'
  - 'Export uses blob download pattern with temporary <a> element'
  - 'DepreciationProjectionChart uses ComposedChart (Area + Line) from recharts for visual hierarchy'
  - 'TCOFleetView groups by assetType with <details open> for mobile accordion'

patterns-established:
  - 'exportReport: blob download via fetch + URL.createObjectURL + temporary <a> element'
  - 'Horizon selector: segmented control with border-radius, active state primary-600'

requirements-completed: [DEPR-04, CCPA-04]

duration: 18min
completed: 2026-03-23
---

# Phase 23 Plan 03: Frontend Asset Reports Page Summary

**Asset Reports page with 3 tabs (Inventario KPIs + table + export, Depreciacao Recharts projection chart, TCO fleet table with repair-vs-replace alerts), wired to 3 API hooks and sidebar navigation**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-03-23T12:15:00Z
- **Completed:** 2026-03-23T12:33:00Z
- **Tasks:** 3 (Task 4 is a checkpoint — not executed)
- **Files modified:** 11

## Accomplishments

- Three fetch hooks (useAssetReports, useDepreciationProjection, useTCOFleet) following existing hook patterns with loading/error states
- AssetReportsPage with 3 tabs, KPI cards, classification table, export toolbar, skeleton loading, empty states, and CostCenterWizardModal integration
- DepreciationProjectionChart using Recharts ComposedChart with Area (projected depreciation) + Line (remaining book value), custom BRL tooltip
- TCOFleetView with desktop table + mobile card view, alert badges (OK/Monitorar/Substituir/Sem dados) using color + icon + aria-label pattern
- Sidebar PATRIMONIO group updated with Relatorios link, App.tsx route /asset-reports registered

## Task Commits

1. **Task 1: Create data-fetching hooks** - `88539337` (feat)
2. **Task 2: Create AssetReportsPage** - `de122b04` (feat)
3. **Task 3: Implement charts, fleet view, wire routing** - `039c56e2` (feat)

## Files Created/Modified

- `apps/frontend/src/hooks/useAssetReports.ts` - Inventory fetch + PDF/xlsx/CSV export hook
- `apps/frontend/src/hooks/useDepreciationProjection.ts` - Projection fetch with horizonMonths param
- `apps/frontend/src/hooks/useTCOFleet.ts` - TCO fleet fetch with farmId/assetType filters
- `apps/frontend/src/pages/AssetReportsPage.tsx` - Main 3-tab reports page
- `apps/frontend/src/pages/AssetReportsPage.css` - Page styles with skeleton animations, responsive grid
- `apps/frontend/src/components/assets/DepreciationProjectionChart.tsx` - Recharts chart with 2 series
- `apps/frontend/src/components/assets/DepreciationProjectionChart.css` - Chart container styles
- `apps/frontend/src/components/assets/TCOFleetView.tsx` - Fleet table + mobile cards with alert badges
- `apps/frontend/src/components/assets/TCOFleetView.css` - Fleet view styles with badge variants
- `apps/frontend/src/components/layout/Sidebar.tsx` - Added FileBarChart Relatorios entry in PATRIMONIO
- `apps/frontend/src/App.tsx` - Added /asset-reports route with lazy AssetReportsPage

## Decisions Made

- Tab panels use `display:none/block` (no animation) as specified in UI-SPEC — avoids motion issues
- Alert badges always combine color + icon + aria-label to meet WCAG "never color as sole indicator" rule
- Export function fetches token from localStorage directly (same pattern as api.ts) to handle binary blob downloads
- DepreciationProjectionChart uses `ComposedChart` to combine Area (depreciation bars) with dashed Line (remaining value)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `AssetMaintenanceTab.tsx` and `MaintenanceProvisionModal.tsx` (unrelated to this plan). Pre-existing test failure in `CreateAnimalModal.spec.tsx` (`scrollTo` mock issue). Both are out of scope per deviation rules.

## Known Stubs

None — all components are fully implemented with data wired to API hooks.

## Next Phase Readiness

- /asset-reports route navigable from sidebar
- All 3 tabs functional with proper loading/empty/error states
- CostCenterWizardModal accessible from page header
- Task 4 checkpoint requires human visual verification before plan is marked complete

---

_Phase: 23-relatorios-dashboard-patrimonial_
_Completed: 2026-03-23_
