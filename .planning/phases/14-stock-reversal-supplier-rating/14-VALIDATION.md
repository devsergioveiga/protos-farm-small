---
phase: 14
slug: stock-reversal-supplier-rating
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | Jest (backend) + Vitest (frontend)                                                        |
| **Config file**        | jest.config.js (backend), vitest.config.ts (frontend)                                     |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern="goods-returns\|suppliers"` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test`                                                 |
| **Estimated runtime**  | ~30 seconds                                                                               |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern="goods-returns|suppliers"`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                                   | File Exists                     | Status     |
| -------- | ---- | ---- | ----------- | --------- | ----------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| 14-01-01 | 01   | 1    | DEVO-01     | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=goods-returns.routes` | ✅ goods-returns.routes.spec.ts | ⬜ pending |
| 14-01-02 | 01   | 1    | DEVO-01     | unit      | same                                                                                | ✅ goods-returns.routes.spec.ts | ⬜ pending |
| 14-01-03 | 01   | 1    | FORN-03     | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=suppliers.routes`     | ✅ suppliers.routes.spec.ts     | ⬜ pending |
| 14-02-01 | 02   | 2    | FORN-03     | manual    | Visual verification in QuotationModal                                               | N/A                             | ⬜ pending |
| 14-03-01 | 03   | 2    | FORN-03     | manual    | Visual verification of SupplierPerformanceTab                                       | N/A                             | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                          | Requirement | Why Manual                  | Test Instructions                                                                                                                                                               |
| ------------------------------------------------- | ----------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rating badge displays correctly in QuotationModal | FORN-03     | Visual styling verification | Open QuotationModal, select supplier with rating < 2, verify red badge; select supplier with rating 2-3, verify yellow badge; select supplier with rating >= 3, verify no badge |
| SupplierPerformanceTab chart renders with data    | FORN-03     | Chart visual verification   | Open SuppliersPage, select supplier with ratings, click Performance tab, verify LineChart and criteria bars render correctly                                                    |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
