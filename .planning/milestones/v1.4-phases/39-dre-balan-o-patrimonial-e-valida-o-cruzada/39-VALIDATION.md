---
phase: 39
slug: dre-balan-o-patrimonial-e-valida-o-cruzada
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                               |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                                      |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="dre\|balance-sheet\|cross-validation" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage && cd ../../apps/frontend && npx vitest run`              |
| **Estimated runtime**  | ~30 seconds                                                                                          |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                           | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------- | ----------- | ---------- |
| 39-01-01 | 01   | 1    | DRE-01      | unit      | `npx jest dre.calculator.spec`              | ❌ W0       | ⬜ pending |
| 39-01-02 | 01   | 1    | DRE-02      | unit      | `npx jest dre.calculator.spec`              | ❌ W0       | ⬜ pending |
| 39-01-03 | 01   | 1    | DRE-03      | unit      | `npx jest dre.calculator.spec`              | ❌ W0       | ⬜ pending |
| 39-02-01 | 02   | 1    | BP-01       | unit      | `npx jest bp.calculator.spec`               | ❌ W0       | ⬜ pending |
| 39-02-02 | 02   | 1    | BP-02       | unit      | `npx jest bp.calculator.spec`               | ❌ W0       | ⬜ pending |
| 39-03-01 | 03   | 2    | VINC-01     | unit      | `npx jest cross-validation.calculator.spec` | ❌ W0       | ⬜ pending |
| 39-04-01 | 04   | 2    | DRE-01      | frontend  | `npx vitest run DrePage`                    | ❌ W0       | ⬜ pending |
| 39-04-02 | 04   | 2    | BP-01       | frontend  | `npx vitest run BalanceSheetPage`           | ❌ W0       | ⬜ pending |
| 39-04-03 | 04   | 2    | VINC-01     | frontend  | `npx vitest run CrossValidationPage`        | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/dre/dre.calculator.spec.ts` — stubs for DRE-01, DRE-02, DRE-03
- [ ] `apps/backend/src/modules/balance-sheet/bp.calculator.spec.ts` — stubs for BP-01, BP-02
- [ ] `apps/backend/src/modules/cross-validation/cross-validation.calculator.spec.ts` — stubs for VINC-01

_Existing jest/vitest infrastructure covers framework needs._

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual             | Test Instructions                                                      |
| ---------------------------- | ----------- | ---------------------- | ---------------------------------------------------------------------- |
| Sparkline trend rendering    | BP-02       | Visual chart rendering | Open /balance-sheet, verify 6 indicator cards show mini sparklines     |
| Ranking bar chart rendering  | DRE-03      | Visual chart rendering | Open /dre in Consolidado mode, verify horizontal bar chart below table |
| Toggle V/H column visibility | DRE-02      | UI interaction         | Click "Análise V/H" toggle, verify columns appear/disappear            |
| Placeholder DFC card styling | VINC-01     | Visual styling         | Open /cross-validation, verify gray disabled card for DFC↔BP           |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
