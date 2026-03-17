---
phase: 8
slug: requisi-o-e-aprova-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                                                       |
| **Config file**        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`                                                              |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-requests\|approval-rules\|notifications\|delegations` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`                                        |
| **Estimated runtime**  | ~45 seconds                                                                                                                  |

---

## Sampling Rate

- **After every task commit:** Run quick run command for affected module
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type        | Automated Command                                                                | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------------- | -------------------------------------------------------------------------------- | ----------- | ---------- |
| TBD     | TBD  | TBD  | REQC-01     | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-requests` | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | REQC-02     | unit             | `pnpm --filter @protos-farm/backend test -- --testPathPattern=purchase-requests` | ❌ W0       | ⬜ pending |
| TBD     | TBD  | TBD  | REQC-03     | unit+integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=approval-rules`    | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/purchase-requests/purchase-requests.routes.spec.ts` — stubs for REQC-01, REQC-02
- [ ] `apps/backend/src/modules/approval-rules/approval-rules.routes.spec.ts` — stubs for REQC-03
- [ ] `apps/backend/src/modules/notifications/notifications.routes.spec.ts` — stubs for notification endpoints

_Existing test infrastructure (jest, vitest) already installed — no framework setup needed._

---

## Manual-Only Verifications

| Behavior                             | Requirement | Why Manual                         | Test Instructions                                  |
| ------------------------------------ | ----------- | ---------------------------------- | -------------------------------------------------- |
| Push notification delivery on mobile | REQC-03     | Requires physical device / Expo Go | Send approval, verify push arrives on test device  |
| Offline RC creation + sync           | REQC-02     | Requires airplane mode toggle      | Create RC offline, restore connection, verify sync |
| Drag & drop file attachment          | REQC-01     | Browser interaction                | Drop file on attachment zone, verify upload        |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
