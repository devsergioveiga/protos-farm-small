---
phase: 31
slug: obriga-es-acess-rias-e-esocial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                               |
| ---------------------- | ------------------------------------------------------------------- | -------------- | --------------------------- | -------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                              |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`     |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="modules/(tax-guides | esocial-events | income-statements)" --bail` |
| **Full suite command** | `cd apps/backend && npx jest --testPathPattern="modules/(tax-guides | esocial-events | income-statements           | esocial-xml)" --forceExit` |
| **Estimated runtime**  | ~45 seconds                                                         |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                     | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | --------------------------------------------------------------------- | ----------- | ---------- |
| 31-01-01 | 01   | 1    | ESOCIAL-01  | unit      | `npx jest tax-guides.service.spec`                                    | ❌ W0       | ⬜ pending |
| 31-01-02 | 01   | 1    | ESOCIAL-01  | unit      | `npx jest tax-guides.service.spec --testNamePattern="SEFIP"`          | ❌ W0       | ⬜ pending |
| 31-01-03 | 01   | 1    | ESOCIAL-01  | unit      | `npx jest tax-guides.service.spec --testNamePattern="DARF"`           | ❌ W0       | ⬜ pending |
| 31-02-01 | 02   | 1    | ESOCIAL-02  | unit      | `npx jest esocial-events.service.spec`                                | ❌ W0       | ⬜ pending |
| 31-02-02 | 02   | 1    | ESOCIAL-02  | unit      | `npx jest esocial-xml.service.spec`                                   | ❌ W0       | ⬜ pending |
| 31-03-01 | 03   | 2    | ESOCIAL-01  | visual    | `cd apps/frontend && npx vitest --testPathPattern="TaxGuides"`        | ❌ W0       | ⬜ pending |
| 31-03-02 | 03   | 2    | ESOCIAL-02  | visual    | `cd apps/frontend && npx vitest --testPathPattern="EsocialEvents"`    | ❌ W0       | ⬜ pending |
| 31-04-01 | 04   | 2    | ESOCIAL-03  | unit      | `npx jest income-statements.service.spec`                             | ❌ W0       | ⬜ pending |
| 31-04-02 | 04   | 2    | ESOCIAL-03  | visual    | `cd apps/frontend && npx vitest --testPathPattern="IncomeStatements"` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/tax-guides/tax-guides.service.spec.ts` — stubs for ESOCIAL-01
- [ ] `apps/backend/src/modules/esocial-events/esocial-events.service.spec.ts` — stubs for ESOCIAL-02
- [ ] `apps/backend/src/modules/esocial-xml/esocial-xml.service.spec.ts` — stubs for ESOCIAL-02 XML generation
- [ ] `apps/backend/src/modules/income-statements/income-statements.service.spec.ts` — stubs for ESOCIAL-03

_Existing infrastructure covers frontend — vitest already configured._

---

## Manual-Only Verifications

| Behavior                                    | Requirement | Why Manual                       | Test Instructions                                                |
| ------------------------------------------- | ----------- | -------------------------------- | ---------------------------------------------------------------- |
| SEFIP .RE file importable in SEFIP software | ESOCIAL-01  | Requires external CAIXA software | Generate .RE file, import in SEFIP, verify no parse errors       |
| eSocial XML validates against official XSD  | ESOCIAL-02  | XSD validation correctness       | Download official S-1.3 XSD, validate generated XML with xmllint |
| Income statement PDF matches RFB model      | ESOCIAL-03  | Visual layout fidelity           | Compare generated PDF sections against official RFB template     |
| Email delivery of income statements         | ESOCIAL-03  | Requires SMTP server             | Send test email, verify attachment and content                   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
