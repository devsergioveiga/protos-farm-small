---
phase: 21
slug: controle-operacional
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Jest 29 (backend), Vitest (frontend)                                                                                                    |
| **Config file**        | `apps/backend/jest.config.js`                                                                                                           |
| **Quick run command**  | `cd apps/backend && pnpm test -- --testPathPattern="fuel-records\|meter-readings\|asset-documents\|operational-cost" --passWithNoTests` |
| **Full suite command** | `cd apps/backend && pnpm test`                                                                                                          |
| **Estimated runtime**  | ~30 seconds                                                                                                                             |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && pnpm test -- --testPathPattern="fuel-records|meter-readings|asset-documents|operational-cost" --passWithNoTests`
- **After every plan wave:** Run `cd apps/backend && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                   | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | --------------------------------------------------- | ----------- | ---------- |
| 21-01-01 | 01   | 1    | OPER-04     | unit      | `pnpm test -- --testPathPattern="operational-cost"` | ❌ W0       | ⬜ pending |
| 21-01-02 | 01   | 1    | OPER-04     | unit      | `pnpm test -- --testPathPattern="operational-cost"` | ❌ W0       | ⬜ pending |
| 21-02-01 | 02   | 1    | OPER-02     | unit      | `pnpm test -- --testPathPattern="asset-documents"`  | ✅          | ⬜ pending |
| 21-02-02 | 02   | 1    | OPER-01     | unit      | `pnpm test -- --testPathPattern="fuel-records"`     | ✅          | ⬜ pending |
| 21-03-01 | 03   | 2    | OPER-03     | manual    | N/A (mobile)                                        | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/assets/asset-operational-cost.routes.spec.ts` — stubs for OPER-04 aggregation endpoint
- [ ] Verify existing specs cover: fuel-records (OPER-01), asset-documents (OPER-02), meter-readings (OPER-03)

_Existing infrastructure covers OPER-01, OPER-02, OPER-03. Only OPER-04 spec is missing._

---

## Manual-Only Verifications

| Behavior                                         | Requirement | Why Manual                                         | Test Instructions                                                                                                      |
| ------------------------------------------------ | ----------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mobile meter reading screen with haptic feedback | OPER-03     | Expo/React Native screen requires device/simulator | 1. Open mobile app 2. Navigate to meter reading 3. Submit reading 4. Verify haptic feedback and anti-regression error  |
| Document expiry alerts rendering on AssetsPage   | OPER-02     | Visual layout verification                         | 1. Open AssetsPage 2. Verify expiry alert panel renders above asset list 3. Verify 4 urgency buckets display correctly |
| Cost breakdown chart in AssetCostTab             | OPER-04     | Visual layout verification                         | 1. Open AssetDrawer for a machinery asset 2. Click "Custo" tab 3. Verify cost breakdown renders with recharts          |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
