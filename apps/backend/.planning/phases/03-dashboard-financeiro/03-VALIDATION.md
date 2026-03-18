---
phase: 3
slug: dashboard-financeiro
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Framework**          | vitest (frontend), jest (backend)                                                     |
| **Config file**        | `apps/frontend/vitest.config.ts`, `apps/backend/jest.config.ts`                       |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=financial-dashboard`    |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test` |
| **Estimated runtime**  | ~30 seconds                                                                           |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID                     | Plan | Wave | Requirement | Test Type        | Automated Command                         | File Exists | Status     |
| --------------------------- | ---- | ---- | ----------- | ---------------- | ----------------------------------------- | ----------- | ---------- |
| _Populated during planning_ |      |      | FN-15       | unit+integration | `pnpm --filter @protos-farm/backend test` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                              | Requirement | Why Manual                 | Test Instructions                                                                             |
| ----------------------------------------------------- | ----------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| Dashboard visual layout renders correctly             | FN-15       | Visual/layout verification | Open `/financial-dashboard`, verify KPI cards, charts, and tables render with correct spacing |
| Bank balance vs contábil distinction is clear to user | FN-15       | UX clarity                 | Verify labels clearly distinguish "Saldo Bancário" from "Saldo Contábil"                      |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
