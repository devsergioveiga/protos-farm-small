---
phase: 9
slug: cota-o-e-pedido-de-compra
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                          |
| **Config file**        | apps/backend/jest.config.js, apps/frontend/vitest.config.ts                     |
| **Quick run command**  | `pnpm --filter backend test -- --testPathPattern="quotations\|purchase-orders"` |
| **Full suite command** | `pnpm --filter backend test`                                                    |
| **Estimated runtime**  | ~30 seconds                                                                     |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend test -- --testPathPattern="quotations\|purchase-orders"`
- **After every plan wave:** Run `pnpm --filter backend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                               | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------------------------------------- | ----------- | ---------- |
| 09-01-01 | 01   | 1    | COTA-01     | unit      | `pnpm --filter backend test -- quotations`      | ❌ W0       | ⬜ pending |
| 09-02-01 | 02   | 1    | COTA-02     | unit      | `pnpm --filter backend test -- quotations`      | ❌ W0       | ⬜ pending |
| 09-03-01 | 03   | 2    | COTA-03     | unit      | `pnpm --filter backend test -- quotations`      | ❌ W0       | ⬜ pending |
| 09-04-01 | 04   | 2    | PEDI-01     | unit      | `pnpm --filter backend test -- purchase-orders` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/quotations/quotations.routes.spec.ts` — stubs for COTA-01, COTA-02, COTA-03
- [ ] `apps/backend/src/modules/purchase-orders/purchase-orders.routes.spec.ts` — stubs for PEDI-01

_Existing jest infrastructure covers all framework needs._

---

## Manual-Only Verifications

| Behavior            | Requirement | Why Manual         | Test Instructions                                                                             |
| ------------------- | ----------- | ------------------ | --------------------------------------------------------------------------------------------- |
| PDF layout quality  | PEDI-01     | Visual rendering   | Generate OC PDF, verify layout includes org header, supplier, items table, totals, conditions |
| Email send          | PEDI-01     | SMTP integration   | Click "Enviar por Email", verify modal opens with pre-filled supplier email                   |
| Mapa comparativo UX | COTA-02     | Visual interaction | Open comparative map, verify highlight colors, split selection, totals update                 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
