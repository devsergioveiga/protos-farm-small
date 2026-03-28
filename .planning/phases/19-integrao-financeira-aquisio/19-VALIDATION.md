---
phase: 19
slug: integrao-financeira-aquisio
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Framework**          | Jest + @swc/jest (backend), Vitest + @testing-library/react (frontend)            |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vite.config.ts`                     |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test`                                         |
| **Estimated runtime**  | ~30 seconds                                                                       |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/shared test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                                        | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------------------------------------- | ----------- | ---------- |
| 19-01-01 | 01   | 1    | AQUI-01     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions.routes` | ❌ W0       | ⬜ pending |
| 19-01-02 | 01   | 1    | AQUI-01     | integration | same                                                                                     | ❌ W0       | ⬜ pending |
| 19-01-03 | 01   | 1    | AQUI-01     | integration | same                                                                                     | ❌ W0       | ⬜ pending |
| 19-02-01 | 02   | 1    | AQUI-02     | integration | same                                                                                     | ❌ W0       | ⬜ pending |
| 19-02-02 | 02   | 1    | AQUI-02     | unit        | `pnpm --filter @protos-farm/shared test -- --testPathPattern installments`               | ✅ exists   | ⬜ pending |
| 19-03-01 | 03   | 2    | AQUI-03     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern nfe-parser`                | ❌ W0       | ⬜ pending |
| 19-03-02 | 03   | 2    | AQUI-03     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions.routes` | ❌ W0       | ⬜ pending |
| 19-04-01 | 04   | 2    | AQUI-04     | integration | same                                                                                     | ❌ W0       | ⬜ pending |
| 19-04-02 | 04   | 2    | AQUI-04     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern nfe-parser`                | ❌ W0       | ⬜ pending |
| 19-07-01 | 01   | 1    | AQUI-07     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions.routes` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.spec.ts` — stubs for AQUI-01, AQUI-02, AQUI-04, AQUI-07
- [ ] `apps/backend/src/modules/asset-acquisitions/nfe-parser.spec.ts` — stubs for AQUI-03 unit (tag extraction) and AQUI-04 rateio arithmetic
- [ ] Migration: `PayableCategory` enum + `ASSET_ACQUISITION` value — must run before any service test

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual                            | Test Instructions                                                |
| ---------------------------- | ----------- | ------------------------------------- | ---------------------------------------------------------------- |
| NF-e XML upload + preview UI | AQUI-03     | Frontend file upload + visual preview | Upload sample NF-e XML, verify parsed fields displayed correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
