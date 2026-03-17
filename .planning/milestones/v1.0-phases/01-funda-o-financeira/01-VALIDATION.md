---
phase: 1
slug: funda-o-financeira
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                       |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern bank-accounts`          |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test` |
| **Estimated runtime**  | ~30 seconds                                                                           |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern bank-accounts`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type        | Automated Command                                                            | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------------- | ---------------------------------------------------------------------------- | ----------- | ---------- |
| TBD     | TBD  | TBD  | FN-01       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern bank-accounts` | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | FN-03       | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern bank-accounts` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/bank-accounts/bank-accounts.routes.spec.ts` — stubs for FN-01, FN-03
- [ ] Money type unit tests in `packages/shared/src/types/__tests__/money.spec.ts`

_Existing test infrastructure (jest, vitest) covers framework needs._

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual         | Test Instructions                                 |
| ---------------------------- | ----------- | ------------------ | ------------------------------------------------- |
| PDF export renders correctly | FN-03       | PDF visual quality | Download PDF, verify header/totals/formatting     |
| Dashboard cards layout       | FN-03       | Visual layout      | Open dashboard, verify cards with totalização bar |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
