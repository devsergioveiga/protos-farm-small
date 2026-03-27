---
phase: 31-obriga-es-acess-rias-e-esocial
verified: 2026-03-26T17:00:00Z
status: human_needed
score: 17/17 must-haves verified
re_verification: true
previous_status: gaps_found
previous_score: 15/17
gaps_closed:
  - "esocial-builders/ directory now exists with 14 builders + index.ts on feature/EPIC-16-rh-folha"
  - "esocial-validators.ts now exists (241 lines)"
  - "esocial-xsd-validator.ts now exists (85 lines)"
  - "xsd-constraints.ts now exists (178 lines)"
  - "esocial-events.service.ts now exists (695 lines, state machine + dashboard + reprocess)"
  - "esocial-events.routes.ts now exists (215 lines, 8 endpoints)"
  - "esocial-events.service.spec.ts + esocial-events.spec.ts: 62 tests passing"
  - "income-statements.service.ts now exists (684 lines, PDF + email + RAIS)"
  - "income-statements.routes.ts now exists (133 lines)"
  - "income-statements.spec.ts now exists (409 lines, 12 tests passing)"
  - "esocialEventsRouter imported and registered in app.ts at line 323"
  - "incomeStatementsRouter imported and registered in app.ts at line 296"
  - "/v1/ prefix removed from all 7 API call sites in useEsocialEvents.ts"
  - "/v1/ prefix removed from all 5 API call sites in useIncomeStatements.ts"
gaps_remaining: []
regressions: []
human_verification:
  - test: "Full flow — generate eSocial events, download XML, mark as ACEITO"
    expected: "Events created with PENDENTE status; XML download transitions to EXPORTADO; ACEITO/REJEITADO status update works"
    why_human: "Requires running dev server with DB access and actual eSocial XML inspection"
  - test: "Income statement PDF generation"
    expected: "PDF follows RFB model layout with sections: Rendimentos Tributaveis, Rendimentos Isentos, Deducoes, IRRF Retido na Fonte"
    why_human: "PDF layout quality requires visual inspection"
  - test: "RAIS consistency report shows missing events"
    expected: "Banner appears when employees lack S-2200 admission events; consistency report lists employees missing admission/remuneration events"
    why_human: "Requires test data with specific gaps to validate detection accuracy"
  - test: "TaxGuidesPage download"
    expected: "FGTS downloads as .RE file with valid SEFIP fixed-width format; INSS downloads as PDF with DARF layout and correct Receita code 1120"
    why_human: "File format quality (SEFIP spec compliance, DARF layout accuracy) requires manual inspection"
---

# Phase 31: Obrigacoes Acessorias e eSocial Verification Report

**Phase Goal:** Tax guides (FGTS/INSS/IRRF/FUNRURAL), eSocial XML event generation with XSD validation and state machine, Income Statements with PDF and RAIS consistency.
**Verified:** 2026-03-26T17:00:00Z
**Status:** human_needed
**Re-verification:** Yes — third pass, after /v1/ API path prefix fix

## Re-verification Summary

Previous gaps (2 blocker anti-patterns) are now closed. Both `useEsocialEvents.ts` and `useIncomeStatements.ts` no longer carry the `/v1/` prefix. All 17 must-haves pass automated checks. Remaining items are human-only (PDF layout quality, XML compliance, file format inspection).

**Gaps closed this pass:**
- `useEsocialEvents.ts`: all 7 API calls now use `/org/${orgId}/esocial-events` (no `/v1/`)
- `useIncomeStatements.ts`: all 5 API calls now use `/org/${orgId}/income-statements` (no `/v1/`)

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TaxGuide, EsocialEvent, IncomeStatement models exist in Prisma schema | VERIFIED | schema.prisma contains all 3 models + 5 enums |
| 2 | xmlbuilder2 installed in backend | VERIFIED | apps/backend/package.json has "xmlbuilder2": "^4.0.3" |
| 3 | Backend and frontend type definitions available for all three modules | VERIFIED | All 6 type files exist and export required interfaces |
| 4 | Organization model has funruralBasis field with FunruralBasis enum | VERIFIED | schema.prisma line 300 |
| 5 | Contador can generate FGTS/INSS/IRRF/FUNRURAL guides with correct amounts | VERIFIED | 19 tests passing in tax-guides.spec.ts |
| 6 | Each guide creates a Conta a Pagar with originType TAX_GUIDE | VERIFIED | tax-guides.service.ts: originType: 'TAX_GUIDE' confirmed by test 6 |
| 7 | Guide files downloadable — SEFIP .RE for FGTS, DARF PDF for INSS/IRRF, GPS PDF for FUNRURAL | VERIFIED | Tests 17-18 pass; buildSefipRE and buildDarfPdf in service |
| 8 | Alert levels yellow at 10 days, red at 5 days | VERIFIED | Tests 13-15 pass; alertLevel computed in listGuides |
| 9 | FUNRURAL rate from PayrollLegalTable effective-date lookup | VERIFIED | Test 5 passes; service line 489: payrollLegalTable.findFirst |
| 10 | Tax guide due date alert cron with Redis lock | VERIFIED | tax-guide-alerts.cron.ts exists with NX Redis lock |
| 11 | TAX_GUIDE_DUE notification type registered | VERIFIED | notifications.types.ts line 22 |
| 12 | Sidebar OBRIGACOES group with 3 sub-items | VERIFIED | Sidebar.tsx lines 284-288 |
| 13 | All 3 pages accessible via routes | VERIFIED | App.tsx lines 271-273 with lazy-loaded routes |
| 14 | System generates valid XML for all 14 planned eSocial event types with xmlbuilder2 | VERIFIED | esocial-builders/index.ts dispatches to 14 builders; 62 tests pass (service.spec.ts + spec.ts) |
| 15 | Events stored with state machine PENDENTE->EXPORTADO->ACEITO/REJEITADO->PENDENTE (reprocess) | VERIFIED | esocial-events.service.ts lines 477-643: state machine, reprocess with version+1 |
| 16 | EsocialEventsPage can load and interact with backend | VERIFIED | useEsocialEvents.ts — all 7 calls now use /org/${orgId}/esocial-events, no /v1/ prefix; EsocialEventsPage.tsx uses the hook |
| 17 | IncomeStatementsPage can load, generate PDFs, send email, check RAIS | VERIFIED | useIncomeStatements.ts — all 5 calls now use /org/${orgId}/income-statements, no /v1/ prefix; IncomeStatementsPage.tsx uses the hook |

**Score: 17/17 truths verified**

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
| `apps/backend/src/modules/tax-guides/tax-guides.service.ts` | VERIFIED | 691 lines, TaxGuidesService class, 19 tests passing |
| `apps/backend/src/modules/tax-guides/tax-guides.routes.ts` | VERIFIED | 89 lines, POST generate + GET list + GET download |
| `apps/backend/src/modules/tax-guides/tax-guides.spec.ts` | VERIFIED | 518 lines, 19 tests all pass |
| `apps/frontend/src/hooks/useTaxGuides.ts` | VERIFIED | Exports useTaxGuides, calls api.getBlob for download |
| `apps/frontend/src/pages/TaxGuidesPage.tsx` | VERIFIED | Uses useTaxGuides, AlertTriangle/AlertCircle, "Gerar Guias" |

### Plan 03 Artifacts — All Verified

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/src/modules/esocial-events/esocial-builders/` | VERIFIED | 14 builder files + index.ts (1,520 lines total) |
| `apps/backend/src/modules/esocial-events/esocial-builders/s2200-builder.ts` | VERIFIED | 165 lines, uses xmlbuilder2 create(), eSocial S-1.3 namespace |
| `apps/backend/src/modules/esocial-events/esocial-builders/s1200-builder.ts` | VERIFIED | 123 lines, substantive XML generation |
| `apps/backend/src/modules/esocial-events/esocial-validators.ts` | VERIFIED | 241 lines, validateS2200Input checks PIS/PASEP, CBO, salary, birthDate |
| `apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts` | VERIFIED | 85 lines, validateXmlAgainstXsd uses XSD_CONSTRAINTS |
| `apps/backend/src/modules/esocial-events/xsd-constraints.ts` | VERIFIED | 178 lines, XSD_CONSTRAINTS map per event type |
| `apps/backend/src/modules/esocial-events/esocial-events.service.ts` | VERIFIED | 695 lines, full lifecycle including state machine and reprocessing |
| `apps/backend/src/modules/esocial-events/esocial-events.routes.ts` | VERIFIED | 215 lines, 8 endpoints: generate, generate-batch, dashboard, list, download, download-batch, status, reprocess |
| `apps/backend/src/modules/esocial-events/esocial-events.spec.ts` | VERIFIED | Combined with service.spec.ts: 62 tests passing |

### Plan 04 Artifacts — All Verified

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/src/modules/income-statements/income-statements.service.ts` | VERIFIED | 684 lines, PDF generation via pdfkit (line 102), email send (line 472), RAIS (line 581) |
| `apps/backend/src/modules/income-statements/income-statements.routes.ts` | VERIFIED | 133 lines, 5 endpoints including /rais-consistency before /:id |
| `apps/backend/src/modules/income-statements/income-statements.spec.ts` | VERIFIED | 409 lines, 12 tests passing |
| `apps/frontend/src/hooks/useEsocialEvents.ts` | VERIFIED | 134 lines, all 7 API calls use /org/${orgId}/esocial-events — no /v1/ prefix |
| `apps/frontend/src/pages/EsocialEventsPage.tsx` | VERIFIED | 266 lines, imports and uses useEsocialEvents; hook now resolves to correct backend path |
| `apps/frontend/src/hooks/useIncomeStatements.ts` | VERIFIED | 120 lines, all 5 API calls use /org/${orgId}/income-statements — no /v1/ prefix |
| `apps/frontend/src/pages/IncomeStatementsPage.tsx` | VERIFIED | 207 lines, imports and uses useIncomeStatements; hook now resolves to correct backend path |

### Plan 05 Artifacts — All Verified

| Artifact | Status | Evidence |
|----------|--------|----------|
| `apps/backend/src/shared/cron/tax-guide-alerts.cron.ts` | VERIFIED | Queries taxGuide.findMany, Redis NX lock |
| `apps/backend/src/modules/notifications/notifications.types.ts` | VERIFIED | Contains TAX_GUIDE_DUE at line 22 |
| `apps/frontend/src/components/layout/Sidebar.tsx` | VERIFIED | OBRIGACOES group with 3 nav items |
| `apps/frontend/src/routes.tsx` (App.tsx) | VERIFIED | 3 lazy routes at lines 271-273 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| tax-guides.service.ts | PayrollRunItem aggregation | prisma.payrollRunItem | WIRED | Confirmed by test 2 |
| tax-guides.service.ts | payables | originType: 'TAX_GUIDE' | WIRED | Confirmed, test 6 passes |
| TaxGuidesPage.tsx | useTaxGuides.ts | import + hook call | WIRED | Correct /org/ path, no /v1/ |
| tax-guide-alerts.cron.ts | TaxGuide model | taxGuide.findMany | WIRED | Line 35 confirmed |
| esocial-events.service.ts | esocial-builders/ | getBuilder dispatch | WIRED | Line 7 import, builder map in index.ts |
| esocial-events.service.ts | esocial-xsd-validator.ts | validateXmlAgainstXsd | WIRED | Line 7 import confirmed |
| income-statements.service.ts | pdfkit | PDFDocument import | WIRED | Line 102: dynamic import pdfkit |
| income-statements.service.ts | PayrollRunItem aggregation | prisma.payrollRunItem | WIRED | Confirmed by spec tests |
| app.ts | esocialEventsRouter | import line 149 + app.use line 323 | WIRED | Both present |
| app.ts | incomeStatementsRouter | import line 150 + app.use line 296 | WIRED | Both present |
| EsocialEventsPage.tsx | /api/org/:orgId/esocial-events | useEsocialEvents -> api.* | WIRED | All 7 calls use /org/${orgId}/esocial-events — no /v1/ |
| IncomeStatementsPage.tsx | /api/org/:orgId/income-statements | useIncomeStatements -> api.* | WIRED | All 5 calls use /org/${orgId}/income-statements — no /v1/ |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| TaxGuidesPage.tsx | guides (TaxGuide[]) | useTaxGuides -> GET /api/org/:orgId/tax-guides -> tax-guides.service.ts | Yes — aggregates real PayrollRunItem data | FLOWING |
| EsocialEventsPage.tsx | events (EsocialEvent[]) | useEsocialEvents -> GET /api/org/:orgId/esocial-events | Yes — path corrected, resolves to backend route serving DB data | FLOWING |
| IncomeStatementsPage.tsx | statements (IncomeStatement[]) | useIncomeStatements -> GET /api/org/:orgId/income-statements | Yes — path corrected, resolves to backend route serving DB data | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tax-guides tests pass | cd apps/backend && npx jest --testPathPattern=tax-guides | 19 passed | PASS |
| esocial-events tests pass | cd apps/backend && npx jest --testPathPattern=esocial-events | 62 passed (2 suites) | PASS |
| income-statements tests pass | cd apps/backend && npx jest --testPathPattern=income-statements | 12 passed | PASS |
| esocial-builders directory exists | ls esocial-builders/ | 15 files (14 builders + index.ts) | PASS |
| income-statements service exists | ls income-statements.service.ts | 684 lines | PASS |
| esocialEventsRouter in app.ts | grep esocialEventsRouter app.ts | lines 149 + 323 | PASS |
| incomeStatementsRouter in app.ts | grep incomeStatementsRouter app.ts | lines 150 + 296 | PASS |
| useEsocialEvents path correctness | grep "/v1/" useEsocialEvents.ts | no output — /v1/ prefix gone | PASS |
| useIncomeStatements path correctness | grep "/v1/" useIncomeStatements.ts | no output — /v1/ prefix gone | PASS |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ESOCIAL-01 | 31-01, 31-02, 31-05 | Guias FGTS/INSS/IRRF/FUNRURAL com calendario, alertas, historico, integração Contas a Pagar | SATISFIED | 19 tests pass, tax-guides module complete, cron + sidebar wired, useTaxGuides paths correct |
| ESOCIAL-02 | 31-01, 31-03, 31-04, 31-05 | Geração de eventos eSocial (14 tipos) em XML S-1.3 com validação, dashboard, reprocessamento | SATISFIED | Backend fully implemented + 62 tests passing; frontend hook useEsocialEvents.ts paths corrected — EsocialEventsPage now reaches backend |
| ESOCIAL-03 | 31-01, 31-04, 31-05 | Informe de rendimentos em PDF (modelo RFB), envio email, consistência RAIS por ano-base | SATISFIED | Backend fully implemented + 12 tests passing; frontend hook useIncomeStatements.ts paths corrected — IncomeStatementsPage now reaches backend |

All three requirement IDs (ESOCIAL-01, ESOCIAL-02, ESOCIAL-03) are marked Complete in REQUIREMENTS.md (lines 104-106) and are fully accounted for by the plans in this phase.

---

## Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| (none) | — | No blockers or warnings detected | — | — |

**Note on S-2190:** The `ESOCIAL_EVENT_TYPES` constant includes `S_2190: 'S-2190'` but no builder exists and none was in the plan's `files_modified`. The phase goal's "15 event types" appears to be rounded — the plan specifies 14 builders. S-2190 (Trabalhador Sem Vínculo) is a warning-level omission, not a blocker given it was never planned.

---

## Human Verification Required

### 1. eSocial XML Output Quality

**Test:** Generate an S-2200 event for a recently admitted employee.
**Expected:** Valid XML with correct S-1.3 namespace (http://www.esocial.gov.br/schema/evt/evtAdmissao/v_S_01_03_00), all required fields populated, passing XSD constraint checks.
**Why human:** XML structural compliance with actual eSocial validator requires manual inspection.

### 2. Income Statement PDF Layout

**Test:** Generate an income statement PDF for an employee with payroll history.
**Expected:** PDF matches official RFB model with sections: Rendimentos Tributaveis, Rendimentos Isentos, Deducoes, IRRF Retido na Fonte, DIRF notice.
**Why human:** PDF layout quality requires visual inspection.

### 3. RAIS Consistency Detection

**Test:** Use "Verificar Consistencia" for a year where some employees lack S-2200 eSocial events.
**Expected:** Report lists employees missing admission/remuneration events; isConsistent flag reflects actual gap.
**Why human:** Requires test data with specific gaps to validate detection accuracy.

### 4. TaxGuidesPage Download

**Test:** Generate guides for a reference month with closed payroll, then download FGTS and INSS guides.
**Expected:** FGTS downloads as .RE file with valid SEFIP fixed-width format; INSS downloads as PDF with DARF layout and Receita code 1120.
**Why human:** File format compliance (SEFIP spec, DARF layout) requires manual inspection.

---

## Summary

All 17 must-haves are now verified. The two previously failing truths (truths 16 and 17) are now VERIFIED after the `/v1/` prefix was removed from both frontend hooks.

- Backend: fully implemented (93 passing tests: 19 tax-guides + 62 esocial-events + 12 income-statements)
- Frontend: all 3 pages wired to correct API paths
- Requirements: all 3 IDs (ESOCIAL-01, ESOCIAL-02, ESOCIAL-03) satisfied

Remaining items are human-only quality checks (PDF layout, XML compliance, file format inspection) that cannot be verified programmatically.

---

_Verified: 2026-03-26T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
