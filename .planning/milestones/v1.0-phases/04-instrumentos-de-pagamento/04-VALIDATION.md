---
phase: 4
slug: instrumentos-de-pagamento
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Framework**          | jest (backend), vitest (frontend)                                                                |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                                  |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern="transfers\|credit-cards\|checks"` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`            |
| **Estimated runtime**  | ~45 seconds                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID                     | Plan | Wave | Requirement                | Test Type        | Automated Command                         | File Exists | Status     |
| --------------------------- | ---- | ---- | -------------------------- | ---------------- | ----------------------------------------- | ----------- | ---------- |
| _Populated during planning_ |      |      | FN-04, FN-02, FN-05, FN-09 | unit+integration | `pnpm --filter @protos-farm/backend test` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                                     | Requirement | Why Manual                               | Test Instructions                                              |
| ------------------------------------------------------------ | ----------- | ---------------------------------------- | -------------------------------------------------------------- |
| Transfer creates mirrored entries in both account statements | FN-04       | Visual verification of statement entries | Create transfer, check both accounts' statements               |
| Card invoice closure generates CP correctly                  | FN-05       | End-to-end flow verification             | Add expenses, close invoice, verify CP appears in payables     |
| Check state transitions update correctly                     | FN-09       | State machine visual flow                | Create check, transition through states, verify UI updates     |
| Dashboard shows real vs contábil balance                     | FN-09       | Visual distinction UX                    | Create check A_COMPENSAR, verify dashboard shows both balances |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
