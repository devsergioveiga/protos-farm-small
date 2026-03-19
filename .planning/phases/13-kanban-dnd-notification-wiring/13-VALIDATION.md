---
phase: 13
slug: kanban-dnd-notification-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| **Framework**          | Jest 29.7 (backend) / Vitest 3.0 (frontend)                   |
| **Config file**        | `apps/backend/jest.config.*` / `apps/frontend/vite.config.ts` |
| **Quick run command**  | `cd apps/backend && pnpm test -- --testPathPattern=<module>`  |
| **Full suite command** | `cd apps/backend && pnpm test && cd ../frontend && pnpm test` |
| **Estimated runtime**  | ~45 seconds                                                   |

---

## Sampling Rate

- **After every task commit:** Run the spec for the modified module only
- **After every plan wave:** Run `cd apps/backend && pnpm test` + `cd apps/frontend && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type             | Automated Command                                                            | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------------------- | ---------------------------------------------------------------------------- | ----------- | ---------- |
| 13-01-01 | 01   | 1    | DASH-01     | unit (hook spec)      | `cd apps/frontend && pnpm test -- usePurchasingKanban`                       | ❌ W0       | ⬜ pending |
| 13-01-02 | 01   | 1    | DASH-01     | unit (hook spec)      | `cd apps/frontend && pnpm test -- usePurchasingKanban`                       | ❌ W0       | ⬜ pending |
| 13-01-03 | 01   | 1    | DASH-01     | unit (component spec) | `cd apps/frontend && pnpm test -- KanbanBoard`                               | ❌ W0       | ⬜ pending |
| 13-02-01 | 02   | 2    | DASH-03     | unit (routes spec)    | `cd apps/backend && pnpm test -- --testPathPattern=purchase-requests.routes` | ✅ exists   | ⬜ pending |
| 13-02-02 | 02   | 2    | DASH-03     | unit (routes spec)    | `cd apps/backend && pnpm test -- --testPathPattern=purchase-orders.routes`   | ✅ exists   | ⬜ pending |
| 13-02-03 | 02   | 2    | DASH-03     | unit (routes spec)    | `cd apps/backend && pnpm test -- --testPathPattern=goods-receipts.routes`    | ✅ exists   | ⬜ pending |
| 13-02-04 | 02   | 2    | DASH-03     | unit (routes spec)    | `cd apps/backend && pnpm test -- --testPathPattern=goods-returns.routes`     | ✅ exists   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/frontend/src/hooks/usePurchasingKanban.spec.ts` — stubs for DASH-01 DnD navigation behavior
- [ ] `apps/frontend/src/components/kanban/KanbanBoard.spec.tsx` — stubs for confirmation copy and navigation

_Backend spec files already exist for all notification dispatch tests._

---

## Manual-Only Verifications

| Behavior                    | Requirement | Why Manual                                     | Test Instructions                                                                      |
| --------------------------- | ----------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Kanban drag visual feedback | DASH-01     | @dnd-kit visual behavior cannot be unit tested | Drag card from EM_COTACAO to OC_EMITIDA, verify drop zone highlights and modal appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
