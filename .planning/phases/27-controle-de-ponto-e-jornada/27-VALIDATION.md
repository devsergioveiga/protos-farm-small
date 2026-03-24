---
phase: 27
slug: controle-de-ponto-e-jornada
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern=time`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | PONTO-01 | unit | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time-entries` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | PONTO-01 | unit | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time-entries` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | PONTO-02 | unit | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time-allocation` | ❌ W0 | ⬜ pending |
| 27-02-02 | 02 | 1 | PONTO-03 | unit | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time-calculations` | ❌ W0 | ⬜ pending |
| 27-03-01 | 03 | 2 | PONTO-04 | unit | `pnpm --filter @protos-farm/backend test -- --testPathPattern=timesheets` | ❌ W0 | ⬜ pending |
| 27-04-01 | 04 | 2 | PONTO-01 | integration | `pnpm --filter @protos-farm/frontend test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/time-entries/__tests__/time-entries.service.spec.ts` — stubs for PONTO-01
- [ ] `apps/backend/src/modules/time-calculations/__tests__/time-calculations.service.spec.ts` — stubs for PONTO-03
- [ ] `apps/backend/src/modules/timesheets/__tests__/timesheets.service.spec.ts` — stubs for PONTO-04
- [ ] `date-holidays@^3.26.11` — install in backend for Brazilian holiday detection

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile geolocation punch | PONTO-01 | Requires device GPS + PostGIS validation | Punch via Expo app within/outside farm boundary |
| Offline sync after reconnect | PONTO-01 | Requires network state simulation on device | Toggle airplane mode, punch, reconnect |
| PDF export of timesheet | PONTO-04 | Visual layout verification | Export PDF, verify layout matches template |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
