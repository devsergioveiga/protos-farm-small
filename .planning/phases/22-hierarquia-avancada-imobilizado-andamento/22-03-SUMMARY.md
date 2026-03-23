---
phase: 22-hierarquia-avancada-imobilizado-andamento
plan: "03"
subsystem: ui
tags: [react, typescript, assets, hierarchy, wip, renovation, frontend]

requires:
  - phase: 22-01
    provides: "Backend endpoints for asset hierarchy, renovations, and WIP management"
  - phase: 22-02
    provides: "Backend WIP routes, activation, stages, and budget alert logic"
provides:
  - "AssetHierarchyTab: tree view of parent-child hierarchy with BRL totalization"
  - "AssetRenovationModal: CAPITALIZAR/DESPESA radio card form"
  - "AssetWipContributionsTab: budget progress bar, stages, contributions list, activation"
  - "AssetWipContributionModal: form for registering WIP contributions"
  - "useAssetRenovation hook: create/fetch renovation records"
  - "useAssetWip hook: fetch WIP summary, add contributions, activate"
  - "AssetDrawer: conditional hierarquia and andamento tabs"
  - "AssetGeneralTab: Registrar Reforma button for ATIVO/INATIVO assets"
affects: [phase-22, assets, patrimony]

tech-stack:
  added: []
  patterns:
    - "Conditional tab visibility in AssetDrawer based on asset state"
    - "label-wrapping-hidden-input radio card pattern (from Phase 19)"
    - "ConfirmModal variant=warning for medium-criticality irreversible actions"
    - "BEM CSS naming following AssetCostTab convention"

key-files:
  created:
    - apps/frontend/src/hooks/useAssetRenovation.ts
    - apps/frontend/src/hooks/useAssetWip.ts
    - apps/frontend/src/components/assets/AssetHierarchyTab.tsx
    - apps/frontend/src/components/assets/AssetHierarchyTab.css
    - apps/frontend/src/components/assets/AssetRenovationModal.tsx
    - apps/frontend/src/components/assets/AssetRenovationModal.css
    - apps/frontend/src/components/assets/AssetWipContributionsTab.tsx
    - apps/frontend/src/components/assets/AssetWipContributionsTab.css
    - apps/frontend/src/components/assets/AssetWipContributionModal.tsx
    - apps/frontend/src/components/assets/AssetWipContributionModal.css
  modified:
    - apps/frontend/src/components/assets/AssetDrawer.tsx
    - apps/frontend/src/components/assets/AssetGeneralTab.tsx
    - apps/frontend/src/components/assets/AssetDrawer.css
    - apps/frontend/src/pages/AssetsPage.tsx

key-decisions:
  - "AssetHierarchyTab shows current asset highlighted, parent above (level 0), children indented (level 1/2)"
  - "totalChildValue calculated client-side from acquisitionValue of direct children (not from API field)"
  - "AssetGeneralTab action button uses secondary variant (not primary) per single-primary-CTA rule"
  - "AssetDrawer.TabId exported so AssetsPage can use it directly (avoids duplicate type)"
  - "WIP activation uses ConfirmModal variant=warning — medium criticality, irreversible"
  - "depreciationConfigMissing shown as info banner with link to switch to depreciacao tab"

requirements-completed: [HIER-01, HIER-02, HIER-03]

duration: 9min
completed: 2026-03-22
---

# Phase 22 Plan 03: Frontend Components for Hierarchy, Renovation, and WIP Summary

**Four new React components (AssetHierarchyTab, AssetRenovationModal, AssetWipContributionsTab, AssetWipContributionModal) plus two hooks integrated into AssetDrawer with conditional tab visibility based on asset state.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-22T23:56:36Z
- **Completed:** 2026-03-22T00:05:27Z
- **Tasks:** 2 of 2 auto-tasks complete (Task 3 is checkpoint:human-verify)
- **Files modified:** 14

## Accomplishments

- AssetHierarchyTab renders parent-child tree with status chips, BRL values, and 3-level indentation
- AssetRenovationModal provides CAPITALIZAR/DESPESA radio cards with conditional newUsefulLifeMonths field
- AssetWipContributionsTab shows budget progress bar (3 color states), stages list, contributions table/cards, and activation with ConfirmModal
- AssetDrawer conditionally shows "Hierarquia" tab (when asset has parent or children) and "Andamento" tab (when status = EM_ANDAMENTO)

## Task Commits

1. **Task 1: Hooks + AssetHierarchyTab + AssetRenovationModal** - `f9037156` (feat)
2. **Task 2: WIP hooks + AssetWipContributionsTab + AssetDrawer integration** - `27a5a35b` (feat)

## Files Created/Modified

- `apps/frontend/src/hooks/useAssetRenovation.ts` - Create/fetch renovation records
- `apps/frontend/src/hooks/useAssetWip.ts` - WIP summary, contributions, activation
- `apps/frontend/src/components/assets/AssetHierarchyTab.tsx` - Tree view with totalization
- `apps/frontend/src/components/assets/AssetHierarchyTab.css` - BEM styling for tree nodes
- `apps/frontend/src/components/assets/AssetRenovationModal.tsx` - CAPITALIZAR/DESPESA form
- `apps/frontend/src/components/assets/AssetRenovationModal.css` - Modal styling with radio cards
- `apps/frontend/src/components/assets/AssetWipContributionsTab.tsx` - Budget progress, stages, activation
- `apps/frontend/src/components/assets/AssetWipContributionsTab.css` - Progress bar color states, mobile cards
- `apps/frontend/src/components/assets/AssetWipContributionModal.tsx` - Contribution registration form
- `apps/frontend/src/components/assets/AssetWipContributionModal.css` - Modal styling
- `apps/frontend/src/components/assets/AssetDrawer.tsx` - Conditional tabs, new tab panels
- `apps/frontend/src/components/assets/AssetGeneralTab.tsx` - Registrar Reforma button
- `apps/frontend/src/components/assets/AssetDrawer.css` - Action button styles for GeneralTab
- `apps/frontend/src/pages/AssetsPage.tsx` - Use exported TabId from AssetDrawer

## Decisions Made

- Used client-side accumulation for `totalChildValue` (sum of `acquisitionValue` strings) rather than waiting for a `totalChildValue` field from API — works with existing asset detail response
- Exported `TabId` from AssetDrawer.tsx so AssetsPage.tsx can consume it directly without duplicating the union type — this fixed a pre-existing TypeScript error in AssetsPage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error in AssetsPage.tsx**
- **Found during:** Task 2 (AssetDrawer integration)
- **Issue:** AssetsPage.tsx had a hard-coded TabId union type that was missing `custo` — caused TS2322 error when `onTabChange` received the full `TabId` from AssetDrawer
- **Fix:** Exported `TabId` from AssetDrawer, imported it in AssetsPage as `AssetDrawerTabId`
- **Files modified:** apps/frontend/src/pages/AssetsPage.tsx, apps/frontend/src/components/assets/AssetDrawer.tsx
- **Committed in:** 27a5a35b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing type mismatch)
**Impact on plan:** Fix necessary for correct TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the pre-existing TypeScript error documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 3 Phase 22 frontend requirements (HIER-01, HIER-02, HIER-03) implemented
- Human verification of visual rendering needed (Task 3 checkpoint)
- After verification: Phase 22 complete

---
*Phase: 22-hierarquia-avancada-imobilizado-andamento*
*Completed: 2026-03-22*
