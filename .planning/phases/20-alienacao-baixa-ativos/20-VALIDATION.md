---
phase: 20
slug: alienacao-baixa-ativos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Jest + @swc/jest                                                                                                       |
| **Config file**        | `apps/backend/jest.config.ts`                                                                                          |
| **Quick run command**  | `pnpm --filter backend test -- --testPathPattern="asset-disposal\|asset-farm-transfer\|asset-inventory" --no-coverage` |
| **Full suite command** | `pnpm --filter backend test -- --no-coverage`                                                                          |
| **Estimated runtime**  | ~30 seconds (quick), ~120 seconds (full)                                                                               |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend test -- --testPathPattern="asset-disposal|asset-farm-transfer|asset-inventory" --no-coverage`
- **After every plan wave:** Run `pnpm --filter backend test -- --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                                             | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | --------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 20-01-01 | 01   | 1    | DISP-01     | unit      | `pnpm --filter backend test -- --testPathPattern="asset-disposals.routes" --no-coverage`      | ❌ W0       | ⬜ pending |
| 20-01-02 | 01   | 1    | DISP-01     | unit      | same                                                                                          | ❌ W0       | ⬜ pending |
| 20-01-03 | 01   | 1    | DISP-02     | unit      | `pnpm --filter backend test -- --testPathPattern="asset-disposals.routes" --no-coverage`      | ❌ W0       | ⬜ pending |
| 20-01-04 | 01   | 1    | DISP-02     | unit      | same                                                                                          | ❌ W0       | ⬜ pending |
| 20-01-05 | 01   | 1    | DISP-03     | unit      | same                                                                                          | ❌ W0       | ⬜ pending |
| 20-02-01 | 02   | 1    | DISP-04     | unit      | `pnpm --filter backend test -- --testPathPattern="asset-farm-transfers.routes" --no-coverage` | ❌ W0       | ⬜ pending |
| 20-02-02 | 02   | 1    | DISP-04     | unit      | same                                                                                          | ❌ W0       | ⬜ pending |
| 20-03-01 | 03   | 1    | DISP-05     | unit      | `pnpm --filter backend test -- --testPathPattern="asset-inventory.routes" --no-coverage`      | ❌ W0       | ⬜ pending |
| 20-04-01 | 04   | 2    | DISP-06     | unit      | `pnpm --filter backend test -- --testPathPattern="financial-dashboard.routes" --no-coverage`  | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/asset-disposals/asset-disposals.routes.spec.ts` — stubs for DISP-01, DISP-02, DISP-03
- [ ] `apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.routes.spec.ts` — stubs for DISP-04
- [ ] `apps/backend/src/modules/asset-inventory/asset-inventory.routes.spec.ts` — stubs for DISP-05
- [ ] Migration file: `apps/backend/prisma/migrations/20260427100000_add_asset_disposal_models/migration.sql`
- [ ] Prisma schema additions: `AssetDisposal`, `AssetFarmTransfer`, `AssetInventory`, `AssetInventoryItem` models + `AssetDisposalType` enum + `Asset.disposalDate` field + `ReceivableCategory.ASSET_SALE` value

_Existing infrastructure covers frontend validation (Vitest) — phase frontend tasks will use existing test setup._

---

## Manual-Only Verifications

| Behavior                  | Requirement | Why Manual    | Test Instructions                                             |
| ------------------------- | ----------- | ------------- | ------------------------------------------------------------- |
| Dashboard chart rendering | DISP-06     | Visual layout | Open /assets/dashboard, verify charts render with sample data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
