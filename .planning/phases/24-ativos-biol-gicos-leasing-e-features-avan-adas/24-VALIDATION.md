---
phase: 24
slug: ativos-biol-gicos-leasing-e-features-avan-adas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend) / vitest (frontend) |
| **Config file** | apps/backend/jest.config.ts / apps/frontend/vitest.config.ts |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="biological-assets\|asset-leasings\|asset-trade-ins" --no-coverage -q` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the affected module
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | DEPR-03 | unit | `npx jest biological-assets` | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | DEPR-03 | unit | `npx jest biological-assets` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 1 | AQUI-05 | unit | `npx jest asset-leasings` | ❌ W0 | ⬜ pending |
| 24-02-02 | 02 | 1 | AQUI-05 | unit | `npx jest asset-leasings` | ❌ W0 | ⬜ pending |
| 24-03-01 | 03 | 1 | AQUI-06 | unit | `npx jest asset-trade-ins` | ❌ W0 | ⬜ pending |
| 24-03-02 | 03 | 1 | AQUI-06 | unit | `npx jest asset-trade-ins` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/biological-assets/biological-assets.routes.spec.ts` — stubs for DEPR-03
- [ ] `apps/backend/src/modules/asset-leasings/asset-leasings.routes.spec.ts` — stubs for AQUI-05
- [ ] `apps/backend/src/modules/asset-trade-ins/asset-trade-ins.routes.spec.ts` — stubs for AQUI-06

*Existing jest infrastructure covers all framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frontend forms for biological asset fair value | DEPR-03 | UI interaction | Fill fair value form, verify variation line in period result |
| Frontend leasing wizard with ROU creation | AQUI-05 | UI workflow | Create leasing, verify ROU asset and CP installments appear |
| Frontend trade-in modal with compensation | AQUI-06 | UI workflow | Execute trade-in, verify old asset disposed and new acquired |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
