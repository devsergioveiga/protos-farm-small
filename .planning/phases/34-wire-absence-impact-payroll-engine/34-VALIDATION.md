---
phase: 34
slug: wire-absence-impact-payroll-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `apps/backend/jest.config.ts` |
| **Quick run command** | `pnpm --filter @protos-farm/backend test -- --testPathPattern="payroll-calculation"` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test -- --testPathPattern="payroll-(calculation\|runs)"` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern="payroll-calculation"`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern="payroll-(calculation|runs)"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | FERIAS-02 | unit | `pnpm --filter @protos-farm/backend test -- --testPathPattern="payroll-calculation"` | yes | pending |
| 34-02-01 | 02 | 2 | FERIAS-02 | typecheck | `cd apps/backend && npx tsc --noEmit 2>&1 \| head -30` | yes | pending |
| 34-02-02 | 02 | 2 | FERIAS-02 | integration | `cd apps/backend && npx jest --no-coverage 2>&1 \| tail -10` | yes | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payslip PDF shows absence deduction breakdown | FERIAS-02 | PDF visual layout | Generate payslip for employee with INSS absence >15 days, verify deduction line item appears in Descontos section |
| Base FGTS integral in PDF footer | FERIAS-02 | PDF visual layout | Generate payslip with fgtsFullMonth=true, verify "Base FGTS" shows full salary |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
