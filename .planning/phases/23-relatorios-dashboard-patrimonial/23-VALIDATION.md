---
phase: 23
slug: relatorios-dashboard-patrimonial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                       |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=asset-reports`          |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test` |
| **Estimated runtime**  | ~45 seconds                                                                           |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern=asset-reports`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement      | Test Type   | Automated Command                                                             | File Exists | Status     |
| -------- | ---- | ---- | ---------------- | ----------- | ----------------------------------------------------------------------------- | ----------- | ---------- |
| 23-01-01 | 01   | 1    | DEPR-04          | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=asset-reports`  | ❌ W0       | ⬜ pending |
| 23-01-02 | 01   | 1    | DEPR-04          | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=asset-reports`  | ❌ W0       | ⬜ pending |
| 23-02-01 | 02   | 2    | DEPR-04, CCPA-04 | integration | `pnpm --filter @protos-farm/frontend test -- --testPathPattern=asset-reports` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/asset-reports/asset-reports.service.spec.ts` — stubs for DEPR-04
- [ ] `apps/backend/src/modules/asset-reports/asset-reports.routes.spec.ts` — route tests for DEPR-04
- [ ] Existing test infrastructure covers framework needs

_Existing infrastructure covers all phase requirements._

---

## Manual-Only Verifications

| Behavior                          | Requirement | Why Manual                    | Test Instructions                                |
| --------------------------------- | ----------- | ----------------------------- | ------------------------------------------------ |
| PDF export renders correctly      | DEPR-04     | Visual layout verification    | Generate PDF, check headers/columns/totals       |
| Dashboard charts display properly | DEPR-04     | Visual chart rendering        | Load dashboard, verify Recharts renders TCO data |
| Cost center wizard UX flow        | CCPA-04     | Multi-step wizard interaction | Complete wizard, verify center created           |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
