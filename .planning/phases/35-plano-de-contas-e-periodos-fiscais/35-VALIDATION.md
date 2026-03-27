---
phase: 35
slug: plano-de-contas-e-periodos-fiscais
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `apps/backend/jest.config.js` |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="chart-of-accounts\|fiscal-periods\|accounting-periods" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds (phase tests) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | COA-01 | integration | `npx jest chart-of-accounts` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 1 | COA-02 | integration | `npx jest chart-of-accounts` | ❌ W0 | ⬜ pending |
| 35-02-02 | 02 | 1 | COA-03 | integration | `npx jest chart-of-accounts` | ❌ W0 | ⬜ pending |
| 35-03-01 | 03 | 1 | COA-04 | integration | `npx jest fiscal-periods` | ❌ W0 | ⬜ pending |
| 35-04-01 | 04 | 2 | COA-01 | unit | `npx jest rateio` | ❌ W0 | ⬜ pending |
| 35-05-01 | 05 | 3 | COA-01 | render | `cd apps/frontend && npx vitest run` | ❌ W0 | ⬜ pending |
| 35-05-02 | 05 | 3 | COA-05 | render | `cd apps/frontend && npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/chart-of-accounts/__tests__/chart-of-accounts.spec.ts` — stubs for COA-01, COA-02, COA-03
- [ ] `apps/backend/src/modules/fiscal-periods/__tests__/fiscal-periods.spec.ts` — stubs for COA-04
- [ ] `packages/shared/src/utils/accounting/__tests__/rateio.spec.ts` — stubs for rateio utility

*Existing jest/vitest infrastructure covers all framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tree expand/collapse UI | COA-01 | Visual interaction | Open COA page, expand 3 levels, verify indent and icons |
| SPED mapping report PDF | COA-03 | PDF visual layout | Export mapping report, verify account codes are correct |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
