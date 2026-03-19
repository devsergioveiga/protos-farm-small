---
phase: 15
slug: frontend-api-path-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                  |
| ---------------------- | ------------------------------------------------------ |
| **Framework**          | Vitest 3.0                                             |
| **Config file**        | `apps/frontend/vite.config.ts`                         |
| **Quick run command**  | `cd apps/frontend && pnpm test -- usePurchasingKanban` |
| **Full suite command** | `cd apps/frontend && pnpm test`                        |
| **Estimated runtime**  | ~15 seconds                                            |

---

## Sampling Rate

- **After every task commit:** Run the spec for the modified hook only
- **After every plan wave:** Run `cd apps/frontend && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                             | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------------------- | ----------- | ---------- |
| 15-01-01 | 01   | 1    | DASH-01     | unit      | `cd apps/frontend && pnpm test -- usePurchasingKanban`        | ✅          | ⬜ pending |
| 15-01-02 | 01   | 1    | DASH-01     | unit      | `cd apps/frontend && pnpm test -- usePurchasingKanban`        | ✅          | ⬜ pending |
| 15-01-03 | 01   | 1    | DASH-01     | unit      | `cd apps/frontend && pnpm test -- usePurchasingKanban`        | ✅          | ⬜ pending |
| 15-01-04 | 01   | 1    | DASH-03     | unit      | `cd apps/frontend && pnpm test -- useNotificationPreferences` | ❌ W0       | ⬜ pending |
| 15-01-05 | 01   | 1    | DASH-03     | unit      | `cd apps/frontend && pnpm test -- useNotifications`           | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/frontend/src/hooks/useNotificationPreferences.spec.ts` — stubs for DASH-03 preference path with orgId
- [ ] `apps/frontend/src/hooks/useNotifications.spec.ts` — stubs for DASH-03 DAILY_DIGEST label presence

_Existing `usePurchasingKanban.spec.ts` from Phase 13 covers DASH-01 tasks._

---

## Manual-Only Verifications

_All phase behaviors have automated verification._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
