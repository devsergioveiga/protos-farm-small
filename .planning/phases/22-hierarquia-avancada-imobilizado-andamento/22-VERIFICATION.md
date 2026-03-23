---
phase: 22-hierarquia-avancada-imobilizado-andamento
verified: 2026-03-22T22:40:00Z
status: human_needed
score: 14/14 must-haves verified
human_verification:
  - test: "Open an ATIVO asset in AssetDrawer, click Registrar Reforma, verify CAPITALIZAR/DESPESA radio cards appear and conditional newUsefulLifeMonths field is only enabled with CAPITALIZAR selected"
    expected: "Modal opens, radio cards are visually distinct, usefulLifeMonths field disabled when DESPESA is selected, form submits to /org/:orgId/assets/:assetId/renovations"
    why_human: "Radio card visual states (selected border, hover background, disabled opacity) and form field conditional enable state require browser rendering to verify"
  - test: "Find or create an asset with children (or parent). Verify 'Hierarquia' tab appears in AssetDrawer. Verify tree shows parent (if any), current asset highlighted, and children with BRL values and 3-level indentation."
    expected: "Tree renders with level-appropriate padding, values formatted in BRL, 'Total filhos' footer displays sum, clicking a tree node navigates to that asset"
    why_human: "CSS indentation levels, BRL formatting, highlighted current node, and navigation behavior must be verified visually in browser"
  - test: "Find or create an EM_ANDAMENTO asset. Open it in AssetDrawer. Verify 'Andamento' tab appears. Add a contribution and verify budget progress bar changes color (healthy -> alert -> exceeded states)."
    expected: "Progress bar fills green when ratio < alertPct, turns amber (warning) when near budget, turns red (exceeded) when over budget. Budget alert banners appear with correct role=alert semantics."
    why_human: "Progress bar color transitions and banner appearance at threshold boundaries require browser interaction with real data to verify"
  - test: "Click 'Ativar Ativo' in the Andamento tab. Verify ConfirmModal opens with warning variant and displays capitalization total. Confirm and verify asset status changes to ATIVO and WIP tab disappears."
    expected: "ConfirmModal (not window.confirm) shows with variant=warning. After confirming, asset transitions to ATIVO, depreciationConfigMissing banner shown if no DepreciationConfig exists."
    why_human: "Modal variant appearance, status transition, and depreciationConfigMissing info banner require end-to-end browser verification"
---

# Phase 22: Hierarquia Avancada + Imobilizado em Andamento — Verification Report

**Phase Goal:** Hierarquia avancada de ativos (pai-filho ate 3 niveis) com totalizacao, reforma/capitalizacao de ativos existentes, e controle de imobilizado em andamento (WIP) com aportes e ativacao.
**Verified:** 2026-03-22T22:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Asset hierarchy enforces 3-level depth limit on create and update | VERIFIED | `checkHierarchyDepth` in assets.service.ts; 5/7 hierarchy tests verify depth at depths 1, 2, and rejected depth 4 |
| 2  | Circular parent references are rejected | VERIFIED | `getDescendantIds` called on PATCH in assets.service.ts; hierarchy test "rejects circular reference on update" passes |
| 3  | Parent asset totalizes active children values excluding ALIENADO and deleted | VERIFIED | `sumChildValues` in assets.service.ts excludes status=ALIENADO and deletedAt; test "excludes ALIENADO children" passes |
| 4  | GET asset returns childAssets with acquisitionValue for totalization | VERIFIED | `ASSET_INCLUDE_FULL` includes nested childAssets with `acquisitionValue: true` 3 levels deep; `totalChildValue` appended in getAsset |
| 5  | Gerente pode registrar reforma com decisao CAPITALIZAR que incrementa acquisitionValue | VERIFIED | asset-renovations.service.ts uses `acquisitionValue: { increment: new Decimal(...) }` inside transaction; test "creates renovation with CAPITALIZAR -> 201" passes |
| 6  | Gerente pode registrar reforma com decisao DESPESA que nao altera acquisitionValue | VERIFIED | CAPITALIZAR branch only executes on `input.accountingDecision === 'CAPITALIZAR'`; test "creates renovation with DESPESA -> 201" passes |
| 7  | CAPITALIZAR com newUsefulLifeMonths atualiza DepreciationConfig | VERIFIED | `depreciationConfig.updateMany` called when `input.newUsefulLifeMonths` is set on CAPITALIZAR path in renovation service |
| 8  | Reforma rejeitada para ativos EM_ANDAMENTO ou ALIENADO | VERIFIED | Status guards at lines 24-28 of renovation service; tests "rejects renovation on ALIENADO" and "rejects renovation on EM_ANDAMENTO" pass |
| 9  | WIP contribution acumula amount no ativo em andamento | VERIFIED | `assetWipContribution.create` in asset-wip.service.ts; test "creates contribution to EM_ANDAMENTO asset -> 201" passes |
| 10 | Budget alert dispara quando totalContributed >= wipBudgetAlertPct% do wipBudget | VERIFIED | Budget alert logic at lines 53-55 of asset-wip.service.ts with default 90%; tests for budgetAlert and budgetExceeded pass |
| 11 | Activate WIP seta status=ATIVO, acquisitionValue=totalContributed, acquisitionDate=today | VERIFIED | `activateWipAsset` sets `status: 'ATIVO'` and `acquisitionValue: totalContributed` in asset update; test "activates EM_ANDAMENTO asset" passes |
| 12 | Activate retorna depreciationConfigMissing flag quando nao ha DepreciationConfig | VERIFIED | `depreciationConfigMissing: !depConfig` in activation response; test "returns depreciationConfigMissing=true" passes |
| 13 | Hierarchy tab shows parent-child tree with totalized value | VERIFIED (auto) | AssetHierarchyTab.tsx (193 lines) renders tree using `childAssets`, `acquisitionValue`, `toLocaleString` BRL formatting, `<button>` elements with aria-labels, and total footer |
| 14 | WIP tab lists contributions, shows budget progress, uses ConfirmModal for activation | VERIFIED (auto) | AssetWipContributionsTab.tsx (366 lines): `role="progressbar"` with aria-valuenow, `role="alert"` banners, ConfirmModal import/usage, `depreciationConfigMissing` handling confirmed |

**Score:** 14/14 truths verified (automated). 4 items need human visual verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/prisma/migrations/20260428100000_.../migration.sql` | New tables + wipBudget columns | VERIFIED | Creates asset_renovations, asset_wip_stages, asset_wip_contributions tables, wipBudget/wipBudgetAlertPct columns on assets |
| `apps/backend/src/modules/assets/assets.service.ts` | checkHierarchyDepth, getDescendantIds, sumChildValues | VERIFIED | All 3 functions present; ASSET_INCLUDE_FULL has 3-level nested childAssets with acquisitionValue |
| `apps/backend/src/modules/assets/assets.types.ts` | wipBudget in CreateAssetInput | VERIFIED | Lines 51-52 contain `wipBudget?` and `wipBudgetAlertPct?` |
| `apps/backend/src/modules/asset-renovations/asset-renovations.service.ts` | createRenovation, listRenovations, CAPITALIZAR path | VERIFIED | All functions present, increment operator used, depreciationConfig.updateMany present |
| `apps/backend/src/modules/asset-renovations/asset-renovations.routes.ts` | POST + GET endpoints, exports assetRenovationsRouter | VERIFIED | Module exists with correct exports |
| `apps/backend/src/modules/asset-renovations/asset-renovations.routes.spec.ts` | 6 tests (CAPITALIZAR, DESPESA, guards, list) | VERIFIED | All 6 tests pass |
| `apps/backend/src/modules/asset-wip/asset-wip.service.ts` | addContribution, getWipSummary, activateWipAsset, createStage, listStages | VERIFIED | All functions present with correct logic |
| `apps/backend/src/modules/asset-wip/asset-wip.routes.ts` | 6 endpoints, exports assetWipRouter | VERIFIED | Full implementation (not the stub from Plan 01) |
| `apps/backend/src/modules/asset-wip/asset-wip.routes.spec.ts` | 10 tests | VERIFIED | All 10 tests pass |
| `apps/backend/src/app.ts` | assetRenovationsRouter + assetWipRouter registered | VERIFIED | Lines 126-127 import, lines 260-261 register both routers |
| `apps/frontend/src/hooks/useAssetRenovation.ts` | export function useAssetRenovation | VERIFIED | Fetches GET and POSTs to `/org/${orgId}/assets/${assetId}/renovations` |
| `apps/frontend/src/hooks/useAssetWip.ts` | export function useAssetWip | VERIFIED | Fetches from asset-wip/summary, contributions, activate endpoints |
| `apps/frontend/src/components/assets/AssetHierarchyTab.tsx` | Tree view, min 50 lines | VERIFIED | 193 lines, uses childAssets, BRL formatting, button elements with aria-label |
| `apps/frontend/src/components/assets/AssetHierarchyTab.css` | BEM .asset-hierarchy-tab classes | VERIFIED | File exists |
| `apps/frontend/src/components/assets/AssetRenovationModal.tsx` | CAPITALIZAR/DESPESA radio form, min 80 lines | VERIFIED | 332 lines, fieldset/legend, radio cards, conditional newUsefulLifeMonths, no window.confirm |
| `apps/frontend/src/components/assets/AssetRenovationModal.css` | BEM .renovation-modal classes | VERIFIED | File exists |
| `apps/frontend/src/components/assets/AssetWipContributionsTab.tsx` | Budget progress, stages, contributions, activation, min 100 lines | VERIFIED | 366 lines, progressbar role, ConfirmModal, depreciationConfigMissing, role=alert banners |
| `apps/frontend/src/components/assets/AssetWipContributionsTab.css` | BEM .wip-tab classes | VERIFIED | File exists |
| `apps/frontend/src/components/assets/AssetWipContributionModal.tsx` | Contribution form | VERIFIED | File exists |
| `apps/frontend/src/components/assets/AssetWipContributionModal.css` | Modal CSS | VERIFIED | File exists |
| `apps/frontend/src/components/assets/AssetDrawer.tsx` | Conditional hierarquia + andamento tabs | VERIFIED | TabId includes 'hierarquia' and 'andamento', getVisibleTabs logic conditional on asset state, tabpanels rendered |
| `apps/frontend/src/components/assets/AssetGeneralTab.tsx` | Registrar Reforma button on ATIVO/INATIVO | VERIFIED | Button conditioned on `canRenovate = status === 'ATIVO' \|\| status === 'INATIVO'`, AssetRenovationModal integrated |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| assets.service.ts | prisma schema parentAssetId chain | checkHierarchyDepth traverses parentAssetId | WIRED | `parentAssetId` in findFirst queries inside checkHierarchyDepth at lines 99-136 |
| assets.service.ts | childAssets with acquisitionValue | ASSET_INCLUDE_FULL nested select | WIRED | 3-level nested childAssets select each includes `acquisitionValue: true` |
| asset-renovations.service.ts | prisma.asset.update increment | CAPITALIZAR path increments acquisitionValue | WIRED | `acquisitionValue: { increment: new Decimal(...).toNumber() }` at line 49-50 |
| asset-wip.service.ts | prisma.asset.update ATIVO | activateWipAsset sets status ATIVO | WIRED | `status: 'ATIVO'` in update data at line 144 |
| app.ts | asset-renovations.routes.ts | app.use('/api', assetRenovationsRouter) | WIRED | Line 260 in app.ts |
| app.ts | asset-wip.routes.ts | app.use('/api', assetWipRouter) | WIRED | Line 261 in app.ts |
| AssetHierarchyTab.tsx | useAssetDetail childAssets | childAssets prop from asset detail response | WIRED | Component receives `asset` prop with `childAssets` array, renders recursively |
| AssetRenovationModal.tsx | /org/:orgId/assets/:assetId/renovations | POST fetch in useAssetRenovation hook | WIRED | Hook calls `api.post(.../renovations, input)` at line 52 |
| AssetWipContributionsTab.tsx | /org/:orgId/asset-wip/:assetId/summary | GET fetch in useAssetWip hook | WIRED | Hook calls `api.get(.../asset-wip/${assetId}/summary)` at line 75 |
| AssetDrawer.tsx | AssetHierarchyTab, AssetWipContributionsTab | Conditional tab rendering | WIRED | getVisibleTabs checks asset.parentAsset/childAssets/status; tabpanels at lines 539-574 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HIER-01 | 22-01 (backend), 22-03 (frontend) | Ativo composto pai-filho ate 3 niveis, pai totaliza valores filhos | SATISFIED | checkHierarchyDepth + sumChildValues + totalChildValue in getAsset; AssetHierarchyTab; 7 tests pass |
| HIER-02 | 22-02 (backend), 22-03 (frontend) | Reforma com decisao CAPITALIZAR/DESPESA, soma ao valor contabil + reavalia vida util | SATISFIED | asset-renovations module with increment + depreciationConfig.updateMany; AssetRenovationModal; 6 tests pass |
| HIER-03 | 22-02 (backend), 22-03 (frontend) | Imobilizado em andamento com aportes, alerta orcamento, ativacao que inicia depreciacao | SATISFIED | asset-wip module with budget alerts + activateWipAsset returning depreciationConfigMissing; AssetWipContributionsTab; 10 tests pass |

No orphaned requirements — all 3 Phase 22 requirements are claimed by plans and verified with evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| AssetRenovationModal.tsx | 65 | `return null` (modal closed guard) | Info | Standard React early-exit for closed modal, not a stub |
| AssetWipContributionsTab.tsx | 76 | `return null` (summary not loaded) | Info | Standard loading guard, not a stub |
| AssetWipContributionModal.tsx | 71 | `return null` (modal closed guard) | Info | Standard React early-exit for closed modal, not a stub |

No blockers or warnings. TypeScript errors present in frontend are all in pre-existing files (AssetMaintenanceTab.tsx, maintenance module) — not introduced by Phase 22.

### Human Verification Required

#### 1. Renovation Modal Visual Interaction

**Test:** Open an ATIVO asset in AssetDrawer, click "Registrar Reforma" button in Geral tab.
**Expected:** Modal opens with CAPITALIZAR/DESPESA radio cards that are visually distinct (border changes on selection), "Vida util apos reforma (meses)" field is disabled/opaque when DESPESA is selected and enabled when CAPITALIZAR is selected.
**Why human:** Radio card CSS state transitions (selected border color, hover backgrounds, disabled opacity) and conditional field enable state require browser rendering.

#### 2. Hierarchy Tree Visual Rendering

**Test:** Open an asset with children (or parent) in AssetDrawer. Verify "Hierarquia" tab appears and shows tree.
**Expected:** Parent node at level 0 (no indent), current asset highlighted (semibold, primary background), children indented 24px per level. Each node shows asset name, assetTag in mono font, acquisitionValue in BRL, status badge. Footer shows "Total filhos: R$ X.XXX,XX".
**Why human:** CSS indentation levels, BRL number formatting, highlighted current node, 48px touch targets, and click-to-navigate behavior must be verified visually.

#### 3. WIP Budget Progress Bar Color States

**Test:** Open an EM_ANDAMENTO asset, verify "Andamento" tab appears. Register contributions to push total past alert threshold then past budget.
**Expected:** Progress bar is green below alert threshold, amber (warning) when near budget (>= alertPct%), red (exceeded) when total > budget. Alert banners with warning/error styling appear.
**Why human:** CSS custom property color application for three states and banner appearance at threshold boundaries require real data interaction in browser.

#### 4. WIP Activation End-to-End Flow

**Test:** Click "Ativar Ativo" in the Andamento tab.
**Expected:** ConfirmModal opens (variant=warning, not browser confirm dialog) with capitalization total displayed. After confirming: success toast, asset status changes to ATIVO, Andamento tab disappears, drawer refreshes. If no DepreciationConfig exists, info banner prompts user to configure depreciation.
**Why human:** ConfirmModal variant appearance, post-activation drawer state refresh, and conditional depreciationConfigMissing banner require end-to-end browser verification.

### Gaps Summary

No gaps found. All 14 observable truths verified, all artifacts exist and are substantive, all key links are wired. The 4 items flagged for human verification are visual/UX behaviors that cannot be verified programmatically — automated checks all pass.

Test results summary:
- 7 HIER-01 hierarchy tests in assets.routes.spec.ts: all pass
- 6 HIER-02 renovation tests in asset-renovations.routes.spec.ts: all pass
- 10 HIER-03 WIP tests in asset-wip.routes.spec.ts: all pass
- Total: 23 Phase 22 backend tests passing (48 total in combined run)

---

_Verified: 2026-03-22T22:40:00Z_
_Verifier: Claude (gsd-verifier)_
