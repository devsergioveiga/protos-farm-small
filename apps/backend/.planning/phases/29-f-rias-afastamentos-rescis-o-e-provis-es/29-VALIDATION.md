---
phase: 29
slug: f-rias-afastamentos-rescis-o-e-provis-es
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts` |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="vacations|absences|terminations|provisions" --no-coverage -q` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage -q` |
| **Estimated runtime** | ~30 seconds |

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
| 29-01-01 | 01 | 1 | FERIAS-01 | unit | `npx jest vacations` | ❌ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | FERIAS-02 | unit | `npx jest absences` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | FERIAS-03 | unit | `npx jest terminations` | ❌ W0 | ⬜ pending |
| 29-01-04 | 01 | 1 | FERIAS-04 | unit | `npx jest provisions` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test files created alongside modules during plan execution
- [ ] Shared fixtures for employee + payroll test data

*Existing infrastructure covers test framework — only module-specific test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vacation calendar visual with safra conflicts | FERIAS-01 | Visual UI verification | Open vacation scheduling, verify calendar renders conflicts |
| TRCT PDF layout and content | FERIAS-03 | PDF visual inspection | Generate TRCT, verify legal format compliance |
| Provision report with CC breakdown | FERIAS-04 | Report visual inspection | Run monthly provision, verify rateio display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
