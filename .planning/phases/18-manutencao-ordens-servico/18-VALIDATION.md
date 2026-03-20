---
phase: 18
slug: manutencao-ordens-servico
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend) / vitest (frontend)                                                            |
| **Config file**        | `apps/backend/jest.config.ts` / `apps/frontend/vitest.config.ts`                                   |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=maintenance\|work-order\|spare-part` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`              |
| **Estimated runtime**  | ~45 seconds                                                                                        |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern=maintenance\|work-order\|spare-part`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                                    | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ------------------------------------------------------------------------------------ | ----------- | ---------- |
| 18-01-01 | 01   | 1    | MANU-01     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=maintenance-plans`     | ❌ W0       | ⬜ pending |
| 18-01-02 | 01   | 1    | MANU-02     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=work-orders`           | ❌ W0       | ⬜ pending |
| 18-02-01 | 02   | 1    | MANU-04     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=spare-part`            | ❌ W0       | ⬜ pending |
| 18-02-02 | 02   | 1    | MANU-05     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=work-order`            | ❌ W0       | ⬜ pending |
| 18-03-01 | 03   | 2    | MANU-06     | integration | `pnpm --filter @protos-farm/frontend test -- --testPathPattern=MaintenanceDashboard` | ❌ W0       | ⬜ pending |
| 18-03-02 | 03   | 2    | MANU-07     | integration | `pnpm --filter @protos-farm/frontend test -- --testPathPattern=WorkOrder`            | ❌ W0       | ⬜ pending |
| 18-04-01 | 04   | 2    | MANU-03     | unit        | mobile offline tests                                                                 | ❌ W0       | ⬜ pending |
| 18-05-01 | 05   | 3    | MANU-08     | integration | `pnpm --filter @protos-farm/frontend test -- --testPathPattern=Maintenance`          | ❌ W0       | ⬜ pending |
| 18-05-02 | 05   | 3    | CCPA-03     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=work-order`            | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/maintenance-plans/__tests__/maintenance-plans.service.spec.ts` — stubs for MANU-01
- [ ] `apps/backend/src/modules/work-orders/__tests__/work-orders.service.spec.ts` — stubs for MANU-02, MANU-05
- [ ] `apps/backend/src/modules/spare-parts/__tests__/spare-parts.service.spec.ts` — stubs for MANU-04

_Existing infrastructure covers test framework and fixtures._

---

## Manual-Only Verifications

| Behavior                           | Requirement | Why Manual                        | Test Instructions                                                                                               |
| ---------------------------------- | ----------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mobile offline photo + geolocation | MANU-03     | Requires physical device with GPS | 1. Enable airplane mode 2. Open maintenance request 3. Take photo 4. Submit 5. Re-enable network 6. Verify sync |
| Push notification delivery         | MANU-03     | Requires Expo push service        | 1. Submit maintenance request from mobile 2. Verify notification on manager device                              |
| Dashboard visual layout (kanban)   | MANU-08     | Visual/interaction testing        | 1. Open dashboard 2. Verify kanban columns 3. Drag OS between columns 4. Verify metrics display                 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
