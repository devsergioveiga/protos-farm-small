---
phase: 31-obriga-es-acess-rias-e-esocial
verified: 2026-03-26T14:30:00Z
status: gaps_found
score: 9/17 must-haves verified
re_verification: false
gaps:
  - truth: "System generates valid XML for all 15 eSocial event types per D-07"
    status: failed
    reason: "esocial-builders/ directory does not exist on feature/EPIC-16-rh-folha. Commits abe3a487 and 1f1dcd2c were made in worktree-agent-a4056358 but never merged."
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-builders/"
        issue: "Directory missing — not present in working tree"
      - path: "apps/backend/src/modules/esocial-events/esocial-validators.ts"
        issue: "File missing — not present in working tree"
      - path: "apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts"
        issue: "File missing — not present in working tree"
      - path: "apps/backend/src/modules/esocial-events/xsd-constraints.ts"
        issue: "File missing — not present in working tree"
    missing:
      - "Merge worktree-agent-a4056358 into feature/EPIC-16-rh-folha (contains plan 03 code commits e01c9cce, abe3a487, 26d639c8, 1f1dcd2c, e9a711d5)"

  - truth: "XML uses xmlbuilder2 with correct S-1.3 namespaces — never string concatenation"
    status: failed
    reason: "All XML builder files are missing from working tree (same root cause: unmerged worktree branch)"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-builders/s2200-builder.ts"
        issue: "Missing from working tree"
      - path: "apps/backend/src/modules/esocial-events/esocial-builders/s1200-builder.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358 to bring in all 15 XML builders"

  - truth: "Pre-generation validation catches missing PIS/PASEP, CBO, salary before XML build"
    status: failed
    reason: "esocial-validators.ts is missing from working tree"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-validators.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358"

  - truth: "Generated XML is validated against S-1.3 XSD constraints before download is allowed (per D-06)"
    status: failed
    reason: "esocial-xsd-validator.ts and xsd-constraints.ts are missing from working tree"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts"
        issue: "Missing from working tree"
      - path: "apps/backend/src/modules/esocial-events/xsd-constraints.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358"

  - truth: "Events stored in EsocialEvent model with PENDENTE status after generation"
    status: failed
    reason: "esocial-events.service.ts does not exist on the current branch"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-events.service.ts"
        issue: "Missing from working tree"
      - path: "apps/backend/src/modules/esocial-events/esocial-events.routes.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358"

  - truth: "Status transitions follow state machine: PENDENTE->EXPORTADO->ACEITO|REJEITADO, REJEITADO->PENDENTE (per D-10)"
    status: failed
    reason: "esocial-events.service.ts missing (state machine lives there)"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-events.service.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358"

  - truth: "Reprocessing creates new version (v2, v3) preserving history (per D-11)"
    status: failed
    reason: "esocial-events.service.ts missing"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-events.service.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358"

  - truth: "Dashboard endpoint returns counts by status and group for a given month (per D-09)"
    status: failed
    reason: "esocial-events.service.ts and routes missing"
    artifacts:
      - path: "apps/backend/src/modules/esocial-events/esocial-events.routes.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-a4056358"

  - truth: "Contador can generate income statement PDFs for a year-base from aggregated PayrollRunItem data (per D-13)"
    status: failed
    reason: "income-statements.service.ts and income-statements.routes.ts are missing from working tree. Commits 730e1b2e and 281d5cfe were made in worktree-agent-aeeb7987 but never merged."
    artifacts:
      - path: "apps/backend/src/modules/income-statements/income-statements.service.ts"
        issue: "Missing from working tree"
      - path: "apps/backend/src/modules/income-statements/income-statements.routes.ts"
        issue: "Missing from working tree"
      - path: "apps/backend/src/modules/income-statements/income-statements.spec.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-aeeb7987 into feature/EPIC-16-rh-folha (contains plan 04 code commits 43bf8409, 730e1b2e, 281d5cfe, b64a3d2a)"

  - truth: "Income statement PDF follows official RFB model with rendimentos tributaveis, deducoes, IRRF retido, isentos (per D-13)"
    status: failed
    reason: "income-statements.service.ts missing (PDF generation lives there)"
    artifacts:
      - path: "apps/backend/src/modules/income-statements/income-statements.service.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-aeeb7987"

  - truth: "Contador can send income statements by email in batch (per D-14)"
    status: failed
    reason: "income-statements.service.ts missing"
    artifacts:
      - path: "apps/backend/src/modules/income-statements/income-statements.service.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-aeeb7987"

  - truth: "RAIS banner + consistency report verifies eSocial event coverage (per D-15)"
    status: failed
    reason: "income-statements routes not registered in app.ts — /api/income-statements/rais-consistency endpoint does not exist on current branch"
    artifacts:
      - path: "apps/backend/src/app.ts"
        issue: "incomeStatementsRouter not imported or registered"
      - path: "apps/backend/src/modules/income-statements/income-statements.routes.ts"
        issue: "Missing from working tree"
    missing:
      - "Merge worktree-agent-aeeb7987"
      - "Register incomeStatementsRouter in app.ts"

  - truth: "esocialEventsRouter registered in app.ts"
    status: failed
    reason: "app.ts has no import or registration for esocialEventsRouter — only taxGuidesRouter is registered"
    artifacts:
      - path: "apps/backend/src/app.ts"
        issue: "esocialEventsRouter missing — grep returns empty"
    missing:
      - "Merge worktree-agent-a4056358 (plan 03 commit 1f1dcd2c registers the router in app.ts)"

human_verification:
  - test: "Full flow — generate eSocial events, download XML, mark as ACEITO"
    expected: "After merge of worktree branches: events created with PENDENTE status, XML download transitions to EXPORTADO, ACEITO/REJEITADO status update works"
    why_human: "Requires running dev server with DB access and actual eSocial XML inspection"
  - test: "Income statement PDF generation"
    expected: "PDF follows RFB model layout with rendimentos tributaveis, deducoes, IRRF retido sections"
    why_human: "PDF layout requires visual inspection"
  - test: "RAIS consistency report shows missing events"
    expected: "Banner appears when employees lack S-2200 admission events; consistency report lists missing events"
    why_human: "Requires test data with known gaps"
---

# Phase 31: Obrigacoes Acessorias e eSocial Verification Report

**Phase Goal:** Tax guides (FGTS/INSS/IRRF/FUNRURAL), eSocial XML event generation with XSD validation and state machine, Income Statements with PDF and RAIS consistency.
**Verified:** 2026-03-26T14:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Root Cause Summary

Plans 03 and 04 were executed in **git worktrees** (agent-a4056358 and agent-aeeb7987 respectively) but their code commits were **never merged into `feature/EPIC-16-rh-folha`**. The documentation commits (SUMMARY.md, ROADMAP updates, STATE updates) were merged, but the 22 source code files from plan 03 and 7 source code files from plan 04 remain only on orphaned worktree branches.

The current working tree on `feature/EPIC-16-rh-folha` contains:
- Plan 01: Complete (schema, types)
- Plan 02: Complete (tax-guides service, routes, tests, frontend page)
- Plan 03: MISSING (all eSocial XML builders, validators, XSD validator, service, routes)
- Plan 04: MISSING (income-statements service, routes, spec; esocialEventsRouter registration in app.ts)
- Plan 05: Partially complete (cron, notifications, sidebar, routes registered — but the frontend pages they route to lack backend API support for eSocial and income-statements)

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TaxGuide, EsocialEvent, IncomeStatement models exist in Prisma schema | VERIFIED | schema.prisma lines 8738, 8761, 8788 |
| 2 | xmlbuilder2 installed in backend | VERIFIED | apps/backend/package.json has "xmlbuilder2": "^4.0.3" |
| 3 | Backend and frontend type definitions available for all three modules | VERIFIED | All 6 type files exist and export required interfaces |
| 4 | Organization model has funruralBasis field with FunruralBasis enum | VERIFIED | schema.prisma line 300 |
| 5 | Contador can generate FGTS/INSS/IRRF/FUNRURAL guides with correct amounts | VERIFIED | 19 tests passing in tax-guides.spec.ts |
| 6 | Each guide creates a Conta a Pagar with originType TAX_GUIDE | VERIFIED | tax-guides.service.ts line 554: originType: 'TAX_GUIDE' |
| 7 | Guide files downloadable — SEFIP .RE for FGTS, DARF PDF for INSS/IRRF, GPS PDF for FUNRURAL | VERIFIED | Tests 17-18 pass; buildSefipRE and buildDarfPdf in service |
| 8 | Alert levels yellow at 10 days, red at 5 days | VERIFIED | Tests 13-15 pass; alertLevel computed in listGuides |
| 9 | FUNRURAL rate from PayrollLegalTable effective-date lookup | VERIFIED | Test 5 passes; service line 489: payrollLegalTable.findFirst |
| 10 | Tax guide due date alert cron with Redis lock | VERIFIED | tax-guide-alerts.cron.ts exists with NX Redis lock |
| 11 | TAX_GUIDE_DUE notification type registered | VERIFIED | notifications.types.ts line 22 |
| 12 | Sidebar OBRIGACOES group with 3 sub-items | VERIFIED | Sidebar.tsx lines 284-288 |
| 13 | All 3 pages accessible via routes | VERIFIED | App.tsx lines 271-273 with lazy-loaded routes |
| 14 | System generates valid XML for all 15 eSocial event types | FAILED | esocial-builders/ directory MISSING from working tree |
| 15 | Events stored with state machine PENDENTE->EXPORTADO->ACEITO/REJEITADO | FAILED | esocial-events.service.ts MISSING from working tree |
| 16 | Income statement PDFs generated from PayrollRunItem aggregation | FAILED | income-statements.service.ts MISSING from working tree |
| 17 | RAIS consistency report and income statement email send | FAILED | income-statements.routes.ts MISSING; not registered in app.ts |

**Score: 13/17 truths verified**

---

## Required Artifacts

### Plan 01 Artifacts — All Verified

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/prisma/schema.prisma` | VERIFIED | Contains TaxGuide, EsocialEvent, IncomeStatement models + 5 enums |
| `apps/backend/src/modules/tax-guides/tax-guides.types.ts` | VERIFIED | Exports TaxGuideOutput, TAX_GUIDE_DUE_DAYS, TAX_GUIDE_RECEITA_CODES |
| `apps/backend/src/modules/esocial-events/esocial-events.types.ts` | VERIFIED | Exports EsocialEventOutput, VALID_ESOCIAL_TRANSITIONS, ESOCIAL_EVENT_TYPES |
| `apps/backend/src/modules/income-statements/income-statements.types.ts` | VERIFIED | Exports IncomeStatementOutput, RaisConsistencyOutput |
| `apps/frontend/src/types/tax-guide.ts` | VERIFIED | Exports TaxGuide, TAX_GUIDE_TYPE_LABELS |
| `apps/frontend/src/types/esocial-event.ts` | VERIFIED | Exports EsocialEvent, ESOCIAL_EVENT_TYPE_LABELS |
| `apps/frontend/src/types/income-statement.ts` | VERIFIED | Exports IncomeStatement, RaisConsistency |

### Plan 02 Artifacts — All Verified

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/src/modules/tax-guides/tax-guides.service.ts` | VERIFIED | 691 lines, contains TaxGuidesService class, 19 tests passing |
| `apps/backend/src/modules/tax-guides/tax-guides.routes.ts` | VERIFIED | 89 lines, POST generate + GET list + GET download |
| `apps/backend/src/modules/tax-guides/tax-guides.spec.ts` | VERIFIED | 518 lines (>100 min), 19 tests all pass |
| `apps/frontend/src/hooks/useTaxGuides.ts` | VERIFIED | Exports useTaxGuides, calls api.getBlob for download |
| `apps/frontend/src/pages/TaxGuidesPage.tsx` | VERIFIED | Uses useTaxGuides, AlertTriangle/AlertCircle, "Gerar Guias" |

### Plan 03 Artifacts — ALL MISSING from working tree

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/src/modules/esocial-events/esocial-builders/s2200-builder.ts` | MISSING | Directory does not exist on feature/EPIC-16-rh-folha |
| `apps/backend/src/modules/esocial-events/esocial-builders/s1200-builder.ts` | MISSING | Same — entire esocial-builders/ dir absent |
| `apps/backend/src/modules/esocial-events/esocial-validators.ts` | MISSING | File not present |
| `apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts` | MISSING | File not present |
| `apps/backend/src/modules/esocial-events/xsd-constraints.ts` | MISSING | File not present |
| `apps/backend/src/modules/esocial-events/esocial-events.service.ts` | MISSING | File not present |
| `apps/backend/src/modules/esocial-events/esocial-events.routes.ts` | MISSING | File not present |
| `apps/backend/src/modules/esocial-events/esocial-events.spec.ts` | MISSING | File not present |

### Plan 04 Artifacts — Backend MISSING, Frontend Present

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/frontend/src/hooks/useEsocialEvents.ts` | VERIFIED | 134 lines, created by plan 05 (workaround) |
| `apps/frontend/src/pages/EsocialEventsPage.tsx` | VERIFIED | 266 lines, created by plan 05 (workaround) |
| `apps/backend/src/modules/income-statements/income-statements.service.ts` | MISSING | Only types.ts exists in income-statements dir |
| `apps/backend/src/modules/income-statements/income-statements.routes.ts` | MISSING | File not present |
| `apps/backend/src/modules/income-statements/income-statements.spec.ts` | MISSING | File not present |
| `apps/frontend/src/hooks/useIncomeStatements.ts` | VERIFIED | 120 lines, created by plan 05 |
| `apps/frontend/src/pages/IncomeStatementsPage.tsx` | VERIFIED | 207 lines, created by plan 05 |

### Plan 05 Artifacts — All Verified

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/src/shared/cron/tax-guide-alerts.cron.ts` | VERIFIED | Queries taxGuide.findMany, Redis NX lock |
| `apps/backend/src/modules/notifications/notifications.types.ts` | VERIFIED | Contains TAX_GUIDE_DUE at line 22 |
| `apps/frontend/src/components/layout/Sidebar.tsx` | VERIFIED | OBRIGACOES group with 3 nav items at lines 284-288 |
| `apps/frontend/src/routes.tsx` (App.tsx) | VERIFIED | 3 lazy routes at lines 271-273 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| tax-guides.service.ts | PayrollRunItem aggregation | prisma.payrollRunItem | WIRED | Line 554 pattern confirmed by test 2 |
| tax-guides.service.ts | payables | originType: 'TAX_GUIDE' | WIRED | Line 554 confirmed, test 6 passes |
| TaxGuidesPage.tsx | useTaxGuides.ts | import + hook call | WIRED | Line 10 import, line 232 usage |
| tax-guide-alerts.cron.ts | TaxGuide model | taxGuide.findMany | WIRED | Line 35 confirmed |
| esocial-events.service.ts | esocial-builders/ | getBuilder dispatch | NOT WIRED | Both files missing |
| esocial-events.service.ts | esocial-xsd-validator.ts | validateXmlAgainstXsd | NOT WIRED | Both files missing |
| income-statements.service.ts | PayrollRunItem aggregation | groupBy/aggregate | NOT WIRED | Service missing |
| income-statements.service.ts | pdfkit | PDF generation | NOT WIRED | Service missing |
| app.ts | esocialEventsRouter | import + app.use | NOT WIRED | Not in app.ts |
| app.ts | incomeStatementsRouter | import + app.use | NOT WIRED | Not in app.ts |
| EsocialEventsPage.tsx | /api/esocial-events | fetch calls | ORPHANED | Frontend calls endpoints that don't exist |
| IncomeStatementsPage.tsx | /api/income-statements | fetch calls | ORPHANED | Frontend calls endpoints that don't exist |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| TaxGuidesPage.tsx | guides (TaxGuide[]) | useTaxGuides -> GET /org/:id/tax-guides -> tax-guides.service.ts | Yes — aggregates real PayrollRunItem data | FLOWING |
| EsocialEventsPage.tsx | events (EsocialEvent[]) | useEsocialEvents -> GET /api/esocial-events | No — endpoint does not exist (service missing) | DISCONNECTED |
| IncomeStatementsPage.tsx | statements (IncomeStatement[]) | useIncomeStatements -> GET /api/income-statements | No — endpoint does not exist (service missing) | DISCONNECTED |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tax-guides tests pass | cd apps/backend && npx jest --testPathPattern=tax-guides | 19 passed | PASS |
| esocial-builders directory exists | ls apps/backend/src/modules/esocial-events/esocial-builders/ | DIRECTORY_MISSING | FAIL |
| income-statements service exists | ls apps/backend/src/modules/income-statements/income-statements.service.ts | FILE_NOT_FOUND | FAIL |
| esocialEventsRouter in app.ts | grep esocialEventsRouter apps/backend/src/app.ts | empty output | FAIL |
| incomeStatementsRouter in app.ts | grep incomeStatementsRouter apps/backend/src/app.ts | empty output | FAIL |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ESOCIAL-01 | 31-01, 31-02, 31-05 | Geração de guias FGTS/INSS/IRRF/FUNRURAL com calendario, alertas, historico, integração Contas a Pagar | SATISFIED | 19 tests pass, tax-guides module complete, cron + sidebar wired |
| ESOCIAL-02 | 31-01, 31-03, 31-04, 31-05 | Geração e transmissão de eventos eSocial (15 tipos) em XML S-1.3 com validação, dashboard, reprocessamento | BLOCKED | esocial-events service/routes/builders MISSING from feature/EPIC-16-rh-folha; commits exist only in worktree-agent-a4056358 |
| ESOCIAL-03 | 31-01, 31-04, 31-05 | Informe de rendimentos em PDF (modelo RFB), envio email, consistência RAIS por ano-base | BLOCKED | income-statements service/routes MISSING; commits exist only in worktree-agent-aeeb7987 |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| apps/frontend/src/hooks/useEsocialEvents.ts | Calls /api/esocial-events endpoints that do not exist on current branch | Blocker | EsocialEventsPage will receive 404 on every API call |
| apps/frontend/src/hooks/useIncomeStatements.ts | Calls /api/income-statements endpoints that do not exist on current branch | Blocker | IncomeStatementsPage will receive 404 on every API call |

---

## Human Verification Required

### 1. eSocial XML Output Quality

**Test:** After merging worktree branches, generate an S-2200 event for a recently admitted employee.
**Expected:** Valid XML with correct S-1.3 namespace, all required fields (PIS/PASEP, CBO, salary), well-formed structure passing XSD constraints.
**Why human:** XML structural validation requires manual inspection or running against actual eSocial validator.

### 2. Income Statement PDF Layout

**Test:** After merging worktree branches, generate an income statement PDF for an employee with payroll history.
**Expected:** PDF matches official RFB model with sections: Rendimentos Tributaveis, Rendimentos Isentos, Deducoes, IRRF Retido na Fonte, DIRF abolition notice.
**Why human:** PDF layout quality requires visual inspection.

### 3. RAIS Consistency Detection

**Test:** After merging worktree branches, navigate to IncomeStatementsPage and click "Verificar Consistencia" for a year where some employees lack S-2200 eSocial events.
**Expected:** Banner shows RAIS is replaced by eSocial; consistency report lists employees missing admission/remuneration events.
**Why human:** Requires test data with specific gaps to validate detection accuracy.

### 4. TaxGuidesPage Download

**Test:** Generate guides for a reference month with closed payroll, download FGTS guide and an INSS guide.
**Expected:** FGTS downloads as .RE file with valid SEFIP fixed-width format; INSS downloads as PDF with DARF layout and correct Receita code 1120.
**Why human:** File format quality (SEFIP spec compliance, DARF layout accuracy) requires manual inspection.

---

## Gaps Summary

**Two worktree branches were created for plan execution but never merged into `feature/EPIC-16-rh-folha`:**

**Gap 1 — Plans 03 code (ESOCIAL-02 backend):** worktree-agent-a4056358 holds 22 files including all 15 eSocial XML builders, pre-generation validators, XSD validator, state machine service, REST routes, and auto-trigger hooks. Commits: e01c9cce, abe3a487, 26d639c8, 1f1dcd2c, e9a711d5. Merge to unblock: `git merge worktree-agent-a4056358`.

**Gap 2 — Plan 04 backend code (ESOCIAL-03 backend):** worktree-agent-aeeb7987 holds income-statements.service.ts, income-statements.routes.ts, income-statements.spec.ts, the incomeStatementsRouter app.ts registration, and RAIS consistency endpoint. Commits: 43bf8409, 730e1b2e, 281d5cfe, b64a3d2a. Merge to unblock: `git merge worktree-agent-aeeb7987`.

**Impact:** ESOCIAL-01 (tax guides) is fully satisfied. ESOCIAL-02 and ESOCIAL-03 are blocked because their backend implementations live in unmerged branches. The frontend pages (EsocialEventsPage, IncomeStatementsPage) exist on the current branch and will function once their backend counterparts are merged, but currently return 404 on every API call.

**Plan 01 (foundation) and Plan 05 (integration wiring) are complete.** Plans 02 (tax guides) is complete. The remediation needed is two git merges, not new implementation work.

---

_Verified: 2026-03-26T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
