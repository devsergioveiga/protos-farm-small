---
phase: 26-par-metros-de-folha-e-motor-de-c-lculo
verified: 2026-03-24T08:05:00Z
status: human_needed
score: 18/18 must-haves verified
human_verification:
  - test: 'Visual review of PayrollParametersPage — Rubricas tab'
    expected: 'System rubricas show lock icon and no edit/deactivate buttons; custom rubricas show Editar + Desativar; deactivate opens ConfirmModal with correct pt-BR copy; success feedback visible after create/edit/deactivate actions'
    why_human: 'Task 3 in Plan 04 is a blocking human-verify checkpoint that was not signed off. The successMessage state returned by usePayrollRubricas is not consumed by PayrollParametersPage, so no user-visible feedback appears after mutations. Automated checks cannot verify visual UX or toast/message display.'
  - test: 'Visual review of PayrollParametersPage — Tabelas Legais tab'
    expected: 'INSS shows 4 brackets with 2026 official values; IRRF shows 5 brackets with deduction column; monetary values in JetBrains Mono; Vigente badge on current tables; history collapsible works; Atualizar Tabela modal opens with dynamic bracket rows'
    why_human: 'Visual correctness of table data, badge rendering, and collapsible animation cannot be verified programmatically.'
  - test: 'Responsive layout on mobile width'
    expected: 'Table in Rubricas tab transforms to stacked cards at <640px breakpoint'
    why_human: 'Responsive transformation requires browser rendering.'
---

# Phase 26: Parâmetros de Folha e Motor de Cálculo — Verification Report

**Phase Goal:** Engine de cálculo brasileiro customizado: rubricas configuráveis, tabelas INSS/IRRF progressivas, FUNRURAL rural, moradia/alimentação — motor que alimenta todo o processamento de folha

**Verified:** 2026-03-24T08:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                        | Status     | Evidence                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PayrollRubrica, PayrollLegalTable, PayrollTableBracket, PayrollTableScalar models exist in Prisma schema with correct fields and constraints | ✓ VERIFIED | 8 matches (4 models + 4 enums) in schema.prisma                                                                                                                       |
| 2   | Migration creates all 4 tables with indexes, unique constraints, and foreign keys                                                            | ✓ VERIFIED | migration.sql has 4 CREATE TABLE statements                                                                                                                           |
| 3   | Seed script inserts 2026 INSS, IRRF, SALARY_FAMILY, MINIMUM_WAGE, and FUNRURAL tables with correct official values                           | ✓ VERIFIED | seed-payroll-2026.ts contains INSS, DEPENDENT_DEDUCTION=189.59, FEDERAL_MINIMUM=1621, FUNRURAL pre/post April                                                         |
| 4   | TypeScript types for rubricas and legal tables are exported for downstream consumers                                                         | ✓ VERIFIED | payroll-rubricas.types.ts exports CreateRubricaInput/RubricaOutput; payroll-tables.types.ts exports CreateLegalTableInput/LegalTableOutput/BracketOutput/ScalarOutput |
| 5   | calculateINSS returns correct progressive contribution for any salary against 2026 INSS brackets                                             | ✓ VERIFIED | 38 tests passing, ceiling=8475.55, 4-bracket progressive accumulation                                                                                                 |
| 6   | calculateIRRF applies two-step process: progressive table then 2026 redutor, with INSS and dependents deducted from base                     | ✓ VERIFIED | IRRFInput + IRRFResult types with grossTax/redutor/finalTax; tests pass                                                                                               |
| 7   | calculateFGTS returns 8% of gross salary (no ceiling)                                                                                        | ✓ VERIFIED | 38 tests passing                                                                                                                                                      |
| 8   | calculateSalaryFamily returns correct benefit when income is under the limit                                                                 | ✓ VERIFIED | VALUE_PER_CHILD=67.54, INCOME_LIMIT=1980.38; tests pass                                                                                                               |
| 9   | calculateRuralNightPremium uses 21h-5h range, 25% rate, 60-minute rural hour                                                                 | ✓ VERIFIED | RuralNightInput with premiumRate; tests pass                                                                                                                          |
| 10  | calculateRuralUtilityDeductions caps housing at 20% and food at 25% of regional minimum wage                                                 | ✓ VERIFIED | RuralUtilityResult with housingCapped/foodCapped; tests pass                                                                                                          |
| 11  | evaluateFormula safely evaluates custom rubrica expressions with context variables                                                           | ✓ VERIFIED | expr-eval Parser imported; evaluateFormula exported; FormulaEvaluationError on failure                                                                                |
| 12  | Contador can CRUD rubricas via REST API with validation (system rubricas cannot be edited or deleted)                                        | ✓ VERIFIED | payrollRubricasService.update/deactivate throw 403 for isSystem; 14 route tests passing                                                                               |
| 13  | Contador can create and list legal tables with effectiveFrom date, brackets, and scalar values                                               | ✓ VERIFIED | payrollTablesService.create validates day=1, creates with nested brackets/scalars; 13 route tests passing                                                             |
| 14  | System fetches the correct effective table for a given competence date (effectiveFrom <= date, most recent)                                  | ✓ VERIFIED | getEffective uses effectiveFrom: { lte: competenceDate } + orderBy: effectiveFrom desc; org-specific fallback to global                                               |
| 15  | System seeds default system rubricas on first request if none exist for the organization                                                     | ✓ VERIFIED | seedSystemRubricas called on GET list if hasRubricas returns false; 18 default rubricas                                                                               |
| 16  | Contador can see list of rubricas organized by type with system rubricas visually distinguished                                              | ✓ VERIFIED | PROVENTO/DESCONTO/SISTEMA badges + neutral-100 bg on system rows; lock icon with aria-label                                                                           |
| 17  | Contador can create/edit custom rubricas and cannot edit system rubricas                                                                     | ✓ VERIFIED | Editar button only on custom rubricas; PayrollRubricaModal with fieldset/legend/role="alert"                                                                          |
| 18  | Contador can see legal tables with effective dates and bracket values; can add new table version                                             | ✓ VERIFIED | All 5 table types grouped; Vigente/Agendada badges; PayrollLegalTableModal with bracket editor                                                                        |

**Score:** 18/18 truths verified (automated checks)

### Required Artifacts

| Artifact                                                                                  | Expected                                                             | Status     | Details                                                              |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                                       | 4 models + 4 enums                                                   | ✓ VERIFIED | 8/8 matches confirmed                                                |
| `apps/backend/prisma/migrations/20260503100000_add_payroll_rubricas_tables/migration.sql` | 4 CREATE TABLE statements                                            | ✓ VERIFIED | 4 CREATE TABLE confirmed                                             |
| `apps/backend/prisma/seed-payroll-2026.ts`                                                | 2026 legal table seed data                                           | ✓ VERIFIED | All official values present                                          |
| `apps/backend/src/modules/payroll-rubricas/payroll-rubricas.types.ts`                     | CreateRubricaInput, RubricaOutput                                    | ✓ VERIFIED | All 4 interfaces present                                             |
| `apps/backend/src/modules/payroll-tables/payroll-tables.types.ts`                         | CreateLegalTableInput, LegalTableOutput, BracketOutput, ScalarOutput | ✓ VERIFIED | All 5 interfaces present                                             |
| `apps/backend/src/modules/payroll-engine/payroll-engine.types.ts`                         | INSSBracket, IRRFInput, IRRFResult, RubricaContext                   | ✓ VERIFIED | All 13 type interfaces present                                       |
| `apps/backend/src/modules/payroll-engine/payroll-engine.service.ts`                       | 7 pure calculation functions                                         | ✓ VERIFIED | 7 exports confirmed; no Prisma access; Decimal.js throughout         |
| `apps/backend/src/modules/payroll-engine/payroll-engine.spec.ts`                          | 25+ tests, min 200 lines                                             | ✓ VERIFIED | 418 lines; 38 tests; all passing                                     |
| `apps/backend/src/modules/payroll-rubricas/payroll-rubricas.service.ts`                   | payrollRubricasService with system protection                        | ✓ VERIFIED | seedSystemRubricas, 403 on isSystem                                  |
| `apps/backend/src/modules/payroll-rubricas/payroll-rubricas.routes.ts`                    | payrollRubricasRouter with RBAC                                      | ✓ VERIFIED | payroll-params:read/write permissions                                |
| `apps/backend/src/modules/payroll-rubricas/payroll-rubricas.routes.spec.ts`               | min 80 lines / 8+ tests                                              | ✓ VERIFIED | 316 lines; 14 tests passing                                          |
| `apps/backend/src/modules/payroll-tables/payroll-tables.service.ts`                       | payrollTablesService with getEffective                               | ✓ VERIFIED | effectiveFrom lte; orderBy desc; org + global fallback               |
| `apps/backend/src/modules/payroll-tables/payroll-tables.routes.ts`                        | payrollTablesRouter with RBAC                                        | ✓ VERIFIED | /org/:orgId/payroll-tables; payroll-params:read/write                |
| `apps/backend/src/modules/payroll-tables/payroll-tables.routes.spec.ts`                   | min 60 lines / 7+ tests                                              | ✓ VERIFIED | 275 lines; 13 tests passing                                          |
| `apps/frontend/src/types/payroll.ts`                                                      | PayrollRubrica, PayrollLegalTable                                    | ✓ VERIFIED | All 8 interfaces/types present                                       |
| `apps/frontend/src/hooks/usePayrollRubricas.ts`                                           | usePayrollRubricas hook                                              | ✓ VERIFIED | fetchRubricas, createRubrica, updateRubrica, deactivateRubrica       |
| `apps/frontend/src/hooks/usePayrollTables.ts`                                             | usePayrollTables hook                                                | ✓ VERIFIED | fetchTables, createTable                                             |
| `apps/frontend/src/pages/PayrollParametersPage.tsx`                                       | Tab page with Rubricas + Tabelas Legais                              | ✓ VERIFIED | Both tabs present; ConfirmModal; skeleton loading                    |
| `apps/frontend/src/components/payroll/PayrollRubricaModal.tsx`                            | Create/edit modal                                                    | ✓ VERIFIED | fieldset/legend; role="alert"; --font-mono on formula                |
| `apps/frontend/src/components/payroll/PayrollLegalTableModal.tsx`                         | Legal table version modal                                            | ✓ VERIFIED | aria-label brackets; role="alert"; Confirmar Tabela; Adicionar faixa |

### Key Link Verification

| From                        | To                               | Via                                    | Status  | Details                                                                                                 |
| --------------------------- | -------------------------------- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| schema.prisma               | migration.sql                    | prisma migrate                         | ✓ WIRED | migration.sql has payroll_rubricas, payroll_legal_tables, payroll_table_brackets, payroll_table_scalars |
| payroll-engine.service.ts   | decimal.js                       | import Decimal                         | ✓ WIRED | `import Decimal from 'decimal.js'`; `new Decimal` throughout                                            |
| payroll-engine.service.ts   | payroll-engine.types.ts          | import type                            | ✓ WIRED | All 13 types imported and used                                                                          |
| app.ts                      | payroll-rubricas.routes.ts       | app.use('/api', payrollRubricasRouter) | ✓ WIRED | Import + use confirmed                                                                                  |
| app.ts                      | payroll-tables.routes.ts         | app.use('/api', payrollTablesRouter)   | ✓ WIRED | Import + use confirmed                                                                                  |
| payroll-rubricas.service.ts | prisma.payrollRubrica            | Prisma client                          | ✓ WIRED | prisma.payrollRubrica.findFirst confirmed                                                               |
| payroll-tables.service.ts   | prisma.payrollLegalTable         | Prisma client                          | ✓ WIRED | effectiveFrom lte confirmed                                                                             |
| PayrollParametersPage.tsx   | usePayrollRubricas.ts            | import                                 | ✓ WIRED | Hook imported and all 4 mutations used                                                                  |
| PayrollParametersPage.tsx   | usePayrollTables.ts              | import                                 | ✓ WIRED | Hook imported; fetchTables + createTable used                                                           |
| usePayrollRubricas.ts       | /api/org/:orgId/payroll-rubricas | fetch                                  | ✓ WIRED | All 4 API calls confirmed                                                                               |
| App.tsx                     | PayrollParametersPage.tsx        | Route path                             | ✓ WIRED | `/payroll-parameters` route registered                                                                  |

### Data-Flow Trace (Level 4)

| Artifact                  | Data Variable | Source                                     | Produces Real Data                                     | Status    |
| ------------------------- | ------------- | ------------------------------------------ | ------------------------------------------------------ | --------- |
| PayrollParametersPage.tsx | rubricas      | usePayrollRubricas → GET /payroll-rubricas | Yes — Prisma payrollRubrica.findMany with RLS          | ✓ FLOWING |
| PayrollParametersPage.tsx | tables        | usePayrollTables → GET /payroll-tables     | Yes — Prisma payrollLegalTable.findMany (org + global) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior                                    | Result                       | Status |
| ------------------------------------------- | ---------------------------- | ------ |
| 65 payroll tests (engine + routes) pass     | 65 passed, 0 failed (2.456s) | ✓ PASS |
| Frontend TypeScript compiles without errors | npx tsc --noEmit exits 0     | ✓ PASS |
| payrollRubricasRouter registered in app.ts  | import + app.use confirmed   | ✓ PASS |
| payrollTablesRouter registered in app.ts    | import + app.use confirmed   | ✓ PASS |
| /payroll-parameters route in App.tsx        | Route confirmed              | ✓ PASS |
| "Parâmetros de Folha" sidebar link          | Sidebar.tsx confirmed        | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan          | Description                                                                                                                                                    | Status      | Evidence                                                                                           |
| ----------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| FOLHA-01    | Plans 01, 02, 03, 04 | Contador pode configurar rubricas de proventos e descontos com fórmulas customizáveis e tabelas legais atualizáveis (INSS, IRRF, salário-família com vigência) | ✓ SATISFIED | 4 Prisma models; 7 pure calc functions; CRUD REST API; PayrollParametersPage with modals; 65 tests |

### Anti-Patterns Found

| File                                            | Line        | Pattern                                                                        | Severity   | Impact                                                                                                                      |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/hooks/usePayrollRubricas.ts` | 66, 86, 106 | successMessage state populated but never consumed by PayrollParametersPage.tsx | ⚠️ Warning | User receives no visible success feedback after create/edit/deactivate mutations; errors are shown but successes are silent |

### Human Verification Required

**Task 3 from Plan 04 is a blocking human-verify checkpoint that was never signed off.** All automated checks pass, but the following must be verified in a running environment.

#### 1. Rubricas Tab — Full CRUD Flow

**Test:** Start backend + frontend, navigate to RH > Parâmetros de Folha, Rubricas tab
**Expected:**

- System rubricas (INSS, IRRF, FGTS, etc.) have "Sistema" badge + lock icon + no edit/deactivate buttons
- Custom rubricas have "Editar" + "Desativar" buttons
- "Nova Rubrica" modal opens with name, code, tipo radio, calculo radio, taxa/formula conditional fields
- Creating a rubrica succeeds and appears in list (note: no success toast visible — this is the warning above)
- Deactivate shows ConfirmModal with correct copy "Desativar rubrica?"
  **Why human:** Visual badge rendering, modal field conditional display, interactive flow

#### 2. Tabelas Legais Tab — Display and Update

**Test:** Click "Tabelas Legais" tab
**Expected:**

- INSS shows 4 brackets: 7.5%/9%/12%/14%, ceiling R$ 8.475,55
- IRRF shows 5 brackets with deduction column; dependent deduction R$ 189,59
- Monetary values use JetBrains Mono font, right-aligned
- "Vigente" badge on 2026-01-01 effective tables; "Agendada" on future tables
- "Ver histórico" collapsible works with 200ms animation
- "Atualizar Tabela" opens modal with dynamic bracket rows; "Adicionar faixa" button works
  **Why human:** Visual rendering, font inspection, animation, data correctness from live API

#### 3. Success Feedback Gap

**Test:** Create a new custom rubrica via modal
**Expected:** User should see confirmation that rubrica was created (toast, inline message, or similar)
**Actual:** successMessage state in usePayrollRubricas is populated but never rendered in PayrollParametersPage.tsx — user sees no feedback on success
**Why human:** Confirm whether this is acceptable or needs a fix before phase is considered done. Errors are shown correctly (rubricasError is rendered).

#### 4. Responsive Layout

**Test:** Open /payroll-parameters and resize browser to mobile width (< 640px)
**Expected:** Rubricas table transforms to stacked cards
**Why human:** Requires browser rendering

### Gaps Summary

No functional gaps were found. All 18 automated truths are verified:

- 4 Prisma models and 4 enums present in schema with migration
- 2026 seed data with correct official values
- 7 pure calculation functions with 38 tests passing official Brazilian tax values
- Full CRUD REST API (14 + 13 route integration tests) wired in app.ts
- RBAC payroll-params permission with read/write for MANAGER and read for FINANCIAL
- Frontend page with hooks, modals, routing, and sidebar entry

One warning (not a blocker): `successMessage` returned by `usePayrollRubricas` hook is not rendered in `PayrollParametersPage.tsx`, leaving users without success feedback. Errors are handled correctly. This is cosmetic and does not affect data correctness or goal achievement.

Phase 04 has an explicit blocking human-verify checkpoint (Task 3) that was not completed, which is why status is `human_needed` rather than `passed`.

---

_Verified: 2026-03-24T08:05:00Z_
_Verifier: Claude (gsd-verifier)_
