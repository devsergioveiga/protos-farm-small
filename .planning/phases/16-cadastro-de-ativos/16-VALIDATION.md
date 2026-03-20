---
phase: 16
slug: cadastro-de-ativos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **Framework**          | Jest + @swc/jest (backend), Vitest + @testing-library/react (frontend)                     |
| **Config file**        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`                            |
| **Quick run command**  | `cd apps/backend && pnpm test -- --testPathPattern "assets\|fuel-records\|meter-readings"` |
| **Full suite command** | `cd apps/backend && pnpm test`                                                             |
| **Estimated runtime**  | ~30 seconds                                                                                |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && pnpm test -- --testPathPattern "assets|fuel-records|meter-readings"`
- **After every plan wave:** Run `cd apps/backend && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type         | Automated Command                                      | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------------- | ------------------------------------------------------ | ----------- | ---------- |
| 16-01-01 | 01   | 1    | ATIV-01     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-01-02 | 01   | 1    | ATIV-01     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-01-03 | 01   | 1    | ATIV-01     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-01-04 | 01   | 1    | ATIV-01     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-01-05 | 01   | 1    | ATIV-02     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-01-06 | 01   | 1    | ATIV-04     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-02-01 | 02   | 1    | ATIV-06     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-02-02 | 02   | 1    | ATIV-06     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-02-03 | 02   | 1    | ATIV-06     | unit/integration  | `pnpm test -- --testPathPattern assets.routes`         | ❌ W0       | ⬜ pending |
| 16-03-01 | 03   | 2    | OPER-01     | unit/integration  | `pnpm test -- --testPathPattern fuel-records.routes`   | ❌ W0       | ⬜ pending |
| 16-03-02 | 03   | 2    | OPER-01     | unit/integration  | `pnpm test -- --testPathPattern fuel-records.routes`   | ❌ W0       | ⬜ pending |
| 16-04-01 | 04   | 2    | OPER-03     | unit/integration  | `pnpm test -- --testPathPattern meter-readings.routes` | ❌ W0       | ⬜ pending |
| 16-04-02 | 04   | 2    | OPER-03     | unit/integration  | `pnpm test -- --testPathPattern meter-readings.routes` | ❌ W0       | ⬜ pending |
| 16-05-01 | 05   | 3    | ATIV-01     | visual/functional | `cd apps/frontend && pnpm test`                        | ❌ W0       | ⬜ pending |
| 16-05-02 | 05   | 3    | ATIV-06     | visual/functional | `cd apps/frontend && pnpm test`                        | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/assets/assets.routes.spec.ts` — stubs for ATIV-01, ATIV-02, ATIV-04, ATIV-06
- [ ] `apps/backend/src/modules/fuel-records/fuel-records.routes.spec.ts` — stubs for OPER-01
- [ ] `apps/backend/src/modules/meter-readings/meter-readings.routes.spec.ts` — stubs for OPER-03

_Existing infrastructure covers framework setup — only test file stubs needed._

---

## Manual-Only Verifications

| Behavior                                  | Requirement | Why Manual             | Test Instructions                                         |
| ----------------------------------------- | ----------- | ---------------------- | --------------------------------------------------------- |
| Photo upload renders correctly in ficha   | ATIV-01     | Visual rendering       | Upload photo → verify thumbnail in detail tab             |
| Map picker for benfeitoria coordinates    | ATIV-02     | Map interaction        | Open asset modal → select BENFEITORIA → verify map picker |
| CSV/Excel import wizard column mapping UX | ATIV-06     | Multi-step wizard flow | Upload file → map columns → preview → confirm             |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
