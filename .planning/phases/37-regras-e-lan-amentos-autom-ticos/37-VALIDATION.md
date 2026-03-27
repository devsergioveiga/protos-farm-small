---
phase: 37
slug: regras-e-lan-amentos-autom-ticos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) / vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts` / `apps/frontend/vitest.config.ts` |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern=auto-posting --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern=auto-posting --no-coverage`
- **After every plan wave:** Run `cd apps/backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | LANC-02 | unit | `npx jest --testPathPattern=auto-posting` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | LANC-06 | unit | `npx jest --testPathPattern=auto-posting` | ❌ W0 | ⬜ pending |
| 37-02-01 | 02 | 2 | LANC-01 | integration | `npx jest --testPathPattern=auto-posting` | ❌ W0 | ⬜ pending |
| 37-03-01 | 03 | 2 | LANC-01 | integration | `npx jest --testPathPattern=auto-posting` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/auto-posting/auto-posting.routes.spec.ts` — stubs for LANC-01, LANC-02, LANC-06
- [ ] Test fixtures for AccountingRule, PendingJournalPosting

*Existing infrastructure covers test framework — no new installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab Pendências badges render | LANC-06 | Frontend visual | Navigate to JournalEntriesPage, check badge counts |
| Tab Regras modal preview | LANC-02 | Frontend interaction | Edit a rule, click Preview, verify example entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
