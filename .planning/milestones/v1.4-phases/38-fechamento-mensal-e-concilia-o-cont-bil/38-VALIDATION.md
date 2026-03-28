---
phase: 38
slug: fechamento-mensal-e-concilia-o-cont-bil
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x                                                                                       |
| **Config file**        | `apps/backend/jest.config.ts`                                                                   |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern monthly-closing --no-coverage`                   |
| **Full suite command** | `cd apps/backend && npx jest --testPathPattern "monthly-closing\|fiscal-periods" --no-coverage` |
| **Estimated runtime**  | ~15 seconds                                                                                     |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type        | Automated Command                            | File Exists | Status     |
| ------- | ---- | ---- | ----------- | ---------------- | -------------------------------------------- | ----------- | ---------- |
| TBD     | 01   | 1    | FECH-01     | unit+integration | `npx jest --testPathPattern monthly-closing` | TBD         | ⬜ pending |
| TBD     | 01   | 1    | FECH-03     | unit+integration | `npx jest --testPathPattern monthly-closing` | TBD         | ⬜ pending |
| TBD     | 02   | 2    | FECH-02     | integration      | `npx jest --testPathPattern monthly-closing` | TBD         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

_Existing infrastructure covers all phase requirements — jest is already configured, test patterns established._

---

## Manual-Only Verifications

| Behavior                | Requirement | Why Manual               | Test Instructions                                                               |
| ----------------------- | ----------- | ------------------------ | ------------------------------------------------------------------------------- |
| Stepper UI navigation   | FECH-01     | Frontend visual flow     | Open /monthly-closing, verify stepper renders 6 steps with correct status icons |
| Period lock enforcement | FECH-03     | Cross-module integration | Close period, attempt to create JournalEntry via API, verify 422 response       |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
