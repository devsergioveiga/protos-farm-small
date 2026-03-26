---
phase: 17-engine-de-deprecia-o
verified: 2026-03-20T07:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Abrir /depreciation no navegador e verificar que a pagina carrega com breadcrumb 'Patrimonio > Depreciacao'"
    expected: "DepreciationPage renderiza com header, seletores de periodo/track, botao 'Executar Depreciacao', dropdown de export, e DepreciationRunBadge"
    why_human: 'Renderizacao visual e comportamento de navegacao nao sao verificaveis por grep'
  - test: "Clicar 'Executar Depreciacao' e verificar ConfirmModal com variant='warning' aparece"
    expected: 'Modal exibe mensagem em pt-BR coloquial com confirmacao antes de executar o batch'
    why_human: 'Comportamento interativo e texto do modal so podem ser verificados em runtime'
  - test: "Abrir drawer de um ativo depreciavel, clicar aba 'Depreciacao', verificar empty state"
    expected: "Empty state exibe icone Settings (48px) + 'Ativo sem configuracao de depreciacao' + botao 'Configurar depreciacao'"
    why_human: 'Renderizacao do drawer e estado condicional dependem de dados em runtime'
  - test: "Clicar 'Configurar depreciacao', verificar que DepreciationConfigModal abre com taxa RFB pre-preenchida para o tipo do ativo"
    expected: "Modal com role='dialog', campos condicionais corretos (ex: STRAIGHT_LINE mostra 'Vida util'), taxa RFB do tipo do ativo preenchida automaticamente"
    why_human: 'Pre-preenchimento de campos e visibilidade condicional dependem de logica em runtime'
  - test: "Na DepreciationPage, clicar dropdown de export e escolher 'Exportar CSV'"
    expected: 'Browser dispara download de arquivo CSV com headers corretos'
    why_human: 'Download via Blob URL so pode ser verificado em runtime no browser'
  - test: 'Verificar responsividade em viewport <768px'
    expected: 'Tabela de relatorio transforma em cards empilhados, header empilha verticalmente, botao export fica oculto'
    why_human: 'Comportamento responsivo requer verificacao visual no browser'
---

# Phase 17: Engine de Depreciacao — Verification Report

**Phase Goal:** Contador pode configurar o metodo de depreciacao por ativo e o sistema executa o calculo mensal automaticamente com precisao decimal e idempotencia garantida — tornando o valor contabil liquido de cada ativo sempre correto e auditavel
**Verified:** 2026-03-20T07:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                                                          | Status   | Evidence                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Contador pode configurar metodo de depreciacao por ativo (linear, horas-uso, producao, acelerada) com taxa fiscal vs gerencial | VERIFIED | `depreciation.service.ts` exports `createConfig`/`updateConfig`; `DepreciationConfigModal.tsx` 386 lines with all 4 methods                                                                     |
| 2   | Sistema executa calculo mensal com pro rata die, para em valor residual, sem duplicar lancamentos em re-execucao               | VERIFIED | `depreciation-engine.service.ts` exports `computeDepreciation`, `getProRataDays` (UTC-safe); batch catches P2002; 56/56 tests pass                                                              |
| 3   | Cada ativo tem depreciacao apropriada ao centro de custo com conciliacao automatica (soma CCs = total depreciado)              | VERIFIED | `depreciation-batch.service.ts` creates `DepreciationEntryCCItem`; reconciliation assertion before commit; single fixed-CC mode (dynamic horas-maquina deferred to Phase 23 per scope decision) |
| 4   | Contador pode ver relatorio mensal com valor antes/depois e lancamento por centro de custo                                     | VERIFIED | `getReport` supports optional `assetId` filter; `DepreciationReportTable.tsx` 326 lines with all 8 columns including CC                                                                         |
| 5   | Ativo com status EM_ANDAMENTO e excluido do lote — depreciacao so inicia apos ativacao                                         | VERIFIED | `depreciation-batch.service.ts` line 61: `status: { not: 'EM_ANDAMENTO' }`                                                                                                                      |

**Score:** 5/5 truths verified

### Required Artifacts (from must_haves across all plans)

| Artifact                                                                              | Min Lines | Actual | Status   | Details                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | --------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                                   | —         | 6800+  | VERIFIED | 4 models + 2 enums added; unique constraint `(assetId, periodYear, periodMonth, track)`; reverse relations on Asset, Organization, CostCenter             |
| `apps/backend/prisma/migrations/20260420100000_add_depreciation_models/migration.sql` | —         | exists | VERIFIED | Migration file present                                                                                                                                    |
| `apps/backend/src/modules/depreciation/depreciation.types.ts`                         | —         | 90     | VERIFIED | Exports `DepreciationError`, `EngineInput`, `EngineOutput`, `DEFAULT_RFB_RATES`, `DepreciationReportQuery` with optional `assetId`                        |
| `apps/backend/src/modules/depreciation/depreciation-engine.service.ts`                | —         | 150+   | VERIFIED | Exports `daysInMonth`, `getProRataDays`, `computeDepreciation`; no Prisma import (pure arithmetic)                                                        |
| `apps/backend/src/modules/depreciation/depreciation-engine.spec.ts`                   | 80        | 281    | VERIFIED | 21 tests passing (replaced Wave 0 stubs)                                                                                                                  |
| `apps/backend/src/modules/depreciation/depreciation.service.ts`                       | —         | 200+   | VERIFIED | Exports `createConfig`, `getConfig`, `updateConfig`, `deleteConfig`, `getReport` (with assetId filter), `exportReport`, `getLastRun`                      |
| `apps/backend/src/modules/depreciation/depreciation-batch.service.ts`                 | —         | 300+   | VERIFIED | Exports `runDepreciationBatch`, `reverseEntry`; imports `computeDepreciation`; P2002 catch at line 199; `organization.findMany` for multi-org at line 238 |
| `apps/backend/src/modules/depreciation/depreciation-batch.spec.ts`                    | 80        | 678    | VERIFIED | 14 tests passing                                                                                                                                          |
| `apps/backend/src/modules/depreciation/depreciation.routes.ts`                        | —         | 280+   | VERIFIED | 9 endpoints; `requirePermission('depreciation', ...)` on all routes; `Content-Disposition` header on export                                               |
| `apps/backend/src/modules/depreciation/depreciation.routes.spec.ts`                   | 150       | 471    | VERIFIED | 21 tests passing                                                                                                                                          |
| `apps/backend/src/shared/cron/depreciation.cron.ts`                                   | —         | 60+    | VERIFIED | `cron.schedule('0 2 1 * *')`; Redis lock; `organization.findMany` (enumerates all orgs); no empty `organizationId`                                        |
| `apps/frontend/src/types/depreciation.ts`                                             | —         | 80+    | VERIFIED | Exports `DepreciationMethod`, `DepreciationConfig`, `DepreciationEntry`, `DepreciationRun`, `DEFAULT_RFB_RATES`                                           |
| `apps/frontend/src/hooks/useDepreciationConfig.ts`                                    | —         | exists | VERIFIED | Exports hook with `getConfig`, `createConfig`, `updateConfig`, `remove`                                                                                   |
| `apps/frontend/src/hooks/useDepreciationRun.ts`                                       | —         | exists | VERIFIED | Exports hook with `triggerRun`, `getLastRun`                                                                                                              |
| `apps/frontend/src/hooks/useDepreciationReport.ts`                                    | —         | exists | VERIFIED | `assetId` parameter at line 21; `report/export` URL at line 76; `URL.createObjectURL` at line 82                                                          |
| `apps/frontend/src/pages/DepreciationPage.tsx`                                        | 80        | 374    | VERIFIED | Imports all 3 hooks + `ConfirmModal`; exports dropdown (`exportReport`); `Executar Deprecia` button at line 296                                           |
| `apps/frontend/src/components/depreciation/DepreciationConfigModal.tsx`               | 80        | 386    | VERIFIED | `role="dialog"`, `aria-labelledby`, `DEFAULT_RFB_RATES` usage, `display` conditional fields                                                               |
| `apps/frontend/src/components/depreciation/DepreciationReportTable.tsx`               | 60        | 326    | VERIFIED | `scope="col"` on all `<th>`; `TrendingDown` empty state icon; JetBrains Mono via CSS class                                                                |
| `apps/frontend/src/components/depreciation/DepreciationRunBadge.tsx`                  | —         | exists | VERIFIED | `role="status"` + `aria-live="polite"` on all 5 states                                                                                                    |

### Key Link Verification

| From                             | To                                                  | Via                          | Status | Details                                                                                                        |
| -------------------------------- | --------------------------------------------------- | ---------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `depreciation-engine.service.ts` | `decimal.js`                                        | `import Decimal`             | WIRED  | Line 1: `import Decimal from 'decimal.js'`                                                                     |
| `depreciation-engine.spec.ts`    | `depreciation-engine.service.ts`                    | `import computeDepreciation` | WIRED  | Tests import from engine service                                                                               |
| `depreciation-batch.service.ts`  | `depreciation-engine.service.ts`                    | `import computeDepreciation` | WIRED  | Line 3 confirmed                                                                                               |
| `depreciation-batch.service.ts`  | `prisma.depreciationEntry`                          | P2002 catch                  | WIRED  | Line 199: `code === 'P2002'`                                                                                   |
| `depreciation.routes.ts`         | `app.ts`                                            | `depreciationRouter`         | WIRED  | `app.ts` line 235: `app.use('/api', depreciationRouter)`; routes have full path `/org/:orgId/depreciation/...` |
| `depreciation.cron.ts`           | `main.ts`                                           | `startDepreciationCron()`    | WIRED  | `main.ts` line 15 confirmed                                                                                    |
| `DepreciationPage.tsx`           | `/api/org/{orgId}/depreciation/report`              | `useDepreciationReport`      | WIRED  | Hook imported and used for table data                                                                          |
| `DepreciationPage.tsx`           | `/api/org/{orgId}/depreciation/report/export`       | `exportReport`               | WIRED  | `exportReport` called at line 150 of DepreciationPage                                                          |
| `DepreciationPage.tsx`           | `/api/org/{orgId}/depreciation/run`                 | `useDepreciationRun`         | WIRED  | `triggerRun` used in run confirmation flow                                                                     |
| `DepreciationConfigModal.tsx`    | `/api/org/{orgId}/depreciation/config`              | `useDepreciationConfig`      | WIRED  | Modal uses `useDepreciationConfig` hook for create/update                                                      |
| `AssetDrawer.tsx`                | `/api/org/{orgId}/depreciation/report?assetId={id}` | `useDepreciationReport`      | WIRED  | `fetchReport` called at lines 115-122 with `asset.id` as 4th arg                                               |
| `AssetDrawer.tsx`                | `DepreciationConfigModal.tsx`                       | depreciacao tab              | WIRED  | `DepreciationConfigModal` imported at line 20; used in both empty state and config state                       |
| `Sidebar.tsx`                    | `/depreciation` route                               | TrendingDown nav item        | WIRED  | Line 195: `{ to: '/depreciation', icon: TrendingDown, label: 'Depreciacao' }`                                  |
| `App.tsx`                        | `DepreciationPage`                                  | React.lazy + route           | WIRED  | `lazy(() => import('@/pages/DepreciationPage'))` + `<Route path="/depreciation">`                              |

### Requirements Coverage

| Requirement | Source Plans        | Description                                                                                           | Status    | Evidence                                                                                                                                                                                                         |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEPR-01     | 17-01, 17-02, 17-03 | Contador configura metodo (linear, horas-uso, producao, acelerada) com taxas RFB, fiscal vs gerencial | SATISFIED | `DepreciationConfig` model; `DepreciationMethod` enum; 4 methods in engine; `DepreciationConfigModal` with RFB defaults                                                                                          |
| DEPR-02     | 17-01, 17-02, 17-03 | Calculo mensal automatico com pro rata die, parada em residual, relatorio, estorno/recalculo          | SATISFIED | `computeDepreciation` with pro-rata; P2002 unique constraint prevents duplicates; reversal endpoint; `DepreciationReportTable`; cron at `0 2 1 * *`                                                              |
| CCPA-01     | 17-02, 17-03        | Vincular ativo a centro de custo (fixo, rateio % ou dinamico por horas-maquina)                       | PARTIAL\* | Fixed single-CC allocation implemented via `Asset.costCenterId`; dynamic horas-maquina deferred to Phase 23 per documented scope decision in 17-02-PLAN.md. REQUIREMENTS.md marks CCPA-01 as complete (checked). |
| CCPA-02     | 17-02               | Lancamentos detalhados por CC com conciliacao automatica (soma CCs = total depreciado)                | SATISFIED | `DepreciationEntryCCItem` model; reconciliation assertion in batch before commit; CC items shown in report                                                                                                       |

\*CCPA-01 partial scope: the requirement description includes "dinamico por horas-maquina" which was explicitly deferred to Phase 23. The fixed CC allocation (the first case in the requirement) is fully implemented. The REQUIREMENTS.md tracks CCPA-01 as satisfied for Phase 17, indicating an accepted scope decision.

### Anti-Patterns Found

No anti-patterns detected in any files created or modified in this phase.

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| —    | —    | —       | —        | —      |

No TODO/FIXME comments, no empty implementations, no `window.confirm()` usage, no placeholder components found across all depreciation files.

### Human Verification Required

#### 1. DepreciationPage Visual Rendering

**Test:** Start `pnpm dev` in `apps/frontend`, navigate to `/depreciation`
**Expected:** Page loads with breadcrumb "Patrimonio > Depreciacao", header with DepreciationRunBadge, period selectors (month/year Portuguese names), track selector, "Executar Depreciacao" primary button (max 1), export dropdown with "Exportar CSV"/"Exportar XLSX", and DepreciationReportTable with empty state (TrendingDown icon + message + CTA)
**Why human:** Visual appearance and component composition can only be confirmed in a running browser

#### 2. Depreciation Run Confirmation Flow

**Test:** Click "Executar Depreciacao"
**Expected:** ConfirmModal opens with `variant="warning"` showing the month/year/track being processed in pt-BR coloquial language; on confirm, button shows loading state; on success, toast shows "Depreciacao de {mes}/{ano} executada"
**Why human:** Modal interaction, loading states, and toast behavior require runtime verification

#### 3. AssetDrawer "Depreciacao" Tab

**Test:** Navigate to `/assets`, open a depreciable asset drawer, click "Depreciacao" tab
**Expected:** Empty state with Settings icon (48px) + "Ativo sem configuracao de depreciacao" + "Configurar depreciacao" CTA button (if no config); OR config summary card + "Editar configuracao" button + last 12 entries mini-table (if configured)
**Why human:** Tab rendering, conditional state, and per-asset data fetch need runtime context

#### 4. DepreciationConfigModal RFB Defaults

**Test:** In AssetDrawer "Depreciacao" tab, click "Configurar depreciacao"
**Expected:** Modal opens with `role="dialog"`; taxa fiscal pre-filled with RFB rate for that asset's type (ex: MAQUINA = 10%, VEICULO = 20%); selecting "Acelerada" shows "Fator de aceleracao" field; selecting "Linear" shows "Vida util (meses)" field; other conditional fields hidden via `display:none`
**Why human:** Pre-fill logic, conditional field visibility, and form behavior need browser runtime

#### 5. Export Download

**Test:** Click export dropdown, choose "Exportar CSV"
**Expected:** Browser triggers file download with name `depreciation-report-YYYY-MM.csv`; file contains headers matching the configured columns
**Why human:** Blob URL download behavior only works in a real browser context

#### 6. Mobile Responsiveness

**Test:** Resize browser viewport to <768px on DepreciationPage
**Expected:** Report table transforms to stacked cards with asset name and depreciation amount prominent; page header stacks vertically; export dropdown is hidden
**Why human:** Responsive CSS behavior requires visual confirmation at different viewport sizes

### Gaps Summary

No gaps found. All 9 automated must-haves are verified. The only open items require human visual verification in a running browser.

**CCPA-01 scope note:** The requirement includes "dinamico por horas-maquina" allocation but Phase 17 implements fixed single-CC only. This is an accepted, documented scope decision (noted in 17-02-PLAN.md must_haves and in REQUIREMENTS.md as complete). Dynamic allocation is deferred to Phase 23. This does not constitute a gap for Phase 17.

---

## Test Results Summary

| Spec File                     | Tests  | Status       |
| ----------------------------- | ------ | ------------ |
| `depreciation-engine.spec.ts` | 21     | Pass         |
| `depreciation-batch.spec.ts`  | 14     | Pass         |
| `depreciation.routes.spec.ts` | 21     | Pass         |
| **Total**                     | **56** | **All pass** |

## Commits Verified

| Commit   | Plan  | Description                                             |
| -------- | ----- | ------------------------------------------------------- |
| 60306e8c | 17-00 | Wave 0 TDD stubs (49 it.todo stubs across 3 spec files) |
| 65d1fca6 | 17-01 | Prisma schema — 4 models, 2 enums, migration            |
| 7dc70e3a | 17-01 | Depreciation engine + types + 21 unit tests             |
| 9937a1fb | 17-02 | Config CRUD + batch processor + reversal + batch tests  |
| 62557809 | 17-02 | Routes + integration tests + RBAC permissions           |
| 32c7b896 | 17-02 | Cron + main.ts wiring + null-safety fixes               |
| 7622489f | 17-03 | Types, hooks, DepreciationPage, components (10 files)   |
| 95b8fbdb | 17-03 | AssetDrawer tab, Sidebar link, App route wiring         |

---

_Verified: 2026-03-20T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
