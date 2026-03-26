---
phase: 22
slug: hierarquia-avancada-imobilizado-andamento
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 + @swc/jest (backend), Vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts` |
| **Quick run command** | `cd apps/backend && pnpm test -- --testPathPattern="asset-renovations\|asset-wip\|assets.routes" --no-coverage` |
| **Full suite command** | `cd apps/backend && pnpm test` |
| **Estimated runtime** | ~30 seconds (quick), ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && pnpm test -- --testPathPattern="asset-renovations\|asset-wip\|assets.routes" --no-coverage`
- **After every plan wave:** Run `cd apps/backend && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | HIER-01 | unit | `pnpm test -- --testPathPattern="assets.routes.spec" -t "hierarchy"` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | HIER-01 | unit | `pnpm test -- --testPathPattern="assets.routes.spec" -t "depth"` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | HIER-01 | unit | `pnpm test -- --testPathPattern="assets.routes.spec" -t "totalValue"` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | HIER-02 | unit | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "capitalizar"` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 1 | HIER-02 | unit | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "despesa"` | ❌ W0 | ⬜ pending |
| 22-02-03 | 02 | 1 | HIER-02 | unit | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "usefulLife"` | ❌ W0 | ⬜ pending |
| 22-02-04 | 02 | 1 | HIER-02 | unit | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "status guard"` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 1 | HIER-03 | unit | `pnpm test -- --testPathPattern="asset-wip.routes.spec" -t "contribution"` | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 1 | HIER-03 | unit | `pnpm test -- --testPathPattern="asset-wip.routes.spec" -t "budget alert"` | ❌ W0 | ⬜ pending |
| 22-03-03 | 03 | 1 | HIER-03 | unit | `pnpm test -- --testPathPattern="asset-wip.routes.spec" -t "activate"` | ❌ W0 | ⬜ pending |
| 22-03-04 | 03 | 1 | HIER-03 | regression | `pnpm test -- --testPathPattern="depreciation-batch.spec" -t "EM_ANDAMENTO"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/asset-renovations/asset-renovations.routes.spec.ts` — stubs for HIER-02
- [ ] `apps/backend/src/modules/asset-wip/asset-wip.routes.spec.ts` — stubs for HIER-03
- [ ] Migration `20260428100000_add_asset_hierarchy_renovation_wip` — AssetRenovation + AssetWipContribution + AssetWipStage models + wipBudget/wipBudgetAlertPct fields on Asset

*Existing infrastructure covers HIER-01 hierarchy tests (extend existing assets.routes.spec.ts).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AssetDrawer hierarchy tab tree navigation | HIER-01 | Visual tree rendering + click navigation | Open drawer for composite asset → verify tree shows parent/children → click child → drawer navigates |
| RenovationModal capitalizar vs despesa flow | HIER-02 | Interactive modal with conditional fields | Open asset → Add Renovation → select CAPITALIZAR → verify usefulLifeMonths field appears |
| WIP contributions tab with budget progress bar | HIER-03 | Visual budget bar + alert states | Create WIP asset with budget → add contributions → verify progress bar + alert at threshold |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
