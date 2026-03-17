---
phase: 2
slug: n-cleo-ap-ar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                       |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                              |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern="payables\|receivables\|cnab"` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`        |
| **Estimated runtime**  | ~45 seconds                                                                                  |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern="payables|receivables|cnab"`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type        | Automated Command                                                          | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------------- | -------------------------------------------------------------------------- | ----------- | ---------- |
| TBD     | TBD  | TBD  | FN-07       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=payables`    | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | FN-08       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=payables`    | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | FN-10       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=payables`    | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | FN-11       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=receivables` | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | FN-12       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=receivables` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/payables/payables.routes.spec.ts` — stubs for FN-07, FN-08, FN-10
- [ ] `apps/backend/src/modules/receivables/receivables.routes.spec.ts` — stubs for FN-11, FN-12
- [ ] `apps/backend/src/modules/cnab/cnab.spec.ts` — stubs for CNAB generation/parsing

_Existing test infrastructure (jest, vitest) covers framework needs._

---

## Manual-Only Verifications

| Behavior                                   | Requirement | Why Manual             | Test Instructions                              |
| ------------------------------------------ | ----------- | ---------------------- | ---------------------------------------------- |
| CNAB file validates in bank system         | FN-08       | Bank-side validation   | Generate CNAB, inspect byte positions manually |
| Calendar dots render on correct days       | FN-10       | Visual calendar layout | Open calendar, check dots match due dates      |
| Aging table drill-down navigates correctly | FN-10       | UI interaction flow    | Click aging bucket, verify filtered list       |
| Badge count in sidebar updates             | FN-10       | Cross-component state  | Create overdue CP, check sidebar badge         |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
