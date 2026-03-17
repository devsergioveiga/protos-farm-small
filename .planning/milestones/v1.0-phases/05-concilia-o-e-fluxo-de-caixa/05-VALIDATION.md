---
phase: 05
slug: concilia-o-e-fluxo-de-caixa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| **Framework**          | jest 29.x + @swc/jest                                                   |
| **Config file**        | `apps/backend/jest.config.js`                                           |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern={module}` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test`                               |
| **Estimated runtime**  | ~90 seconds                                                             |

---

## Sampling Rate

- **After every task commit:** Run quick command for the module being changed
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds (single module)

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type  | Automated Command                                       | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | ------------------------------------------------------- | ----------- | ---------- |
| 05-01-T1 | 01   | 1    | FN-06       | unit       | `prisma validate && prisma generate`                    | ✅          | ⬜ pending |
| 05-01-T2 | 01   | 1    | FN-06       | unit+route | `pnpm test -- --testPathPattern=reconciliation`         | ❌ W0       | ⬜ pending |
| 05-02-T1 | 02   | 2    | FN-06       | unit+route | `pnpm test -- --testPathPattern=reconciliation`         | ❌ W0       | ⬜ pending |
| 05-03-T1 | 03   | 2    | FN-13       | unit+route | `pnpm test -- --testPathPattern=cashflow`               | ❌ W0       | ⬜ pending |
| 05-04-T1 | 04   | 3    | FN-06       | tsc        | `pnpm --filter @protos-farm/frontend exec tsc --noEmit` | ✅          | ⬜ pending |
| 05-05-T1 | 05   | 3    | FN-13       | tsc        | `pnpm --filter @protos-farm/frontend exec tsc --noEmit` | ✅          | ⬜ pending |
| 05-06-T1 | 06   | 4    | FN-13       | unit+route | `pnpm test -- --testPathPattern=financial-dashboard`    | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `reconciliation.routes.spec.ts` — stubs for import + reconciliation endpoints (used by both 05-01-T2 and 05-02-T1)
- [ ] `cashflow.routes.spec.ts` — stubs for cashflow projection endpoints

_These will be created as TDD tasks within their respective plans._

---

## Manual-Only Verifications

| Behavior                              | Requirement | Why Manual                       | Test Instructions                              |
| ------------------------------------- | ----------- | -------------------------------- | ---------------------------------------------- |
| OFX file parsing with real bank files | FN-06       | Real bank file format variations | Upload sample OFX from BB, Itaú                |
| CSV encoding ISO-8859-1               | FN-06       | Encoding detection edge cases    | Upload CSV with accented characters            |
| Recharts projection chart render      | FN-13       | Visual chart output              | Navigate to /cashflow, verify 3 scenario lines |
| Tooltip interaction on chart          | FN-13       | Mouse hover behavior             | Hover over month, verify tooltip content       |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
