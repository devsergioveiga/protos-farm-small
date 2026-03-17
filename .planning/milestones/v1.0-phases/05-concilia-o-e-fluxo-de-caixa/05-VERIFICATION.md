---
phase: 05-concilia-o-e-fluxo-de-caixa
verified: 2026-03-17T00:00:00Z
status: passed
score: 27/27 must-haves verified
re_verification: false
human_verification:
  - test: 'Upload real OFX 1.x file and verify parsed transactions, bank account auto-detection, and duplicate detection on re-import'
    expected: 'Preview modal shows parsed transactions; bank account name shown if matched via BANKID+ACCTID; second upload of same file shows skippedLines > 0'
    why_human: 'Requires live file upload and real OFX data; parsing correctness for edge cases (encoding, timezone offsets) cannot be verified statically'
  - test: 'Accept a suggested EXATO match and verify Payable/Receivable reconciled=true in DB'
    expected: "Line status changes to RECONCILED; toast 'Lancamento conciliado com sucesso'; CP/CR record shows reconciled=true"
    why_human: 'Requires live backend DB state inspection'
  - test: 'Open Cashflow page with real data and verify chart renders with 3 scenario lines'
    expected: 'Recharts chart shows Area (Realista), two dashed Lines (Otimista/Pessimista), ReferenceLine at y=0 in red, tooltip on hover'
    why_human: 'Visual rendering of chart and interactive tooltip require browser'
  - test: 'Export PDF and Excel from Cashflow page'
    expected: 'Browser downloads files; PDF contains header, projection table, DFC summary; Excel has 2 sheets'
    why_human: 'File download and content quality require browser and visual inspection'
  - test: 'Negative balance alert card on Financial Dashboard links to /cashflow'
    expected: "If negative balance exists: alert card visible on dashboard; clicking 'Ver projecao' navigates to /cashflow page"
    why_human: 'Requires real cashflow data to trigger the projection; navigation behavior needs browser'
---

# Phase 5: Conciliacao e Fluxo de Caixa — Verification Report

**Phase Goal:** Gerente pode importar extrato bancário (OFX/CSV) e conciliar com lançamentos do sistema usando score de confiança, e visualizar projeção de fluxo de caixa de 12 meses com cenários e alerta de saldo negativo futuro
**Verified:** 2026-03-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                | Status   | Evidence                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | OFX 1.x/2.x and CSV files are parsed correctly                                       | VERIFIED | `ofx-parser.ts` exports `parseOfx`; `csv-parser.ts` exports `parseCsv` and `detectCsvColumns`; both handle `latin1` encoding                        |
| 2   | Duplicate lines are detected by lineHash and skipped on re-import                    | VERIFIED | `reconciliation.service.ts:34` uses `sha256` hash; `createMany` with `skipDuplicates`; 42 passing tests include duplicate case                      |
| 3   | Import records persisted with metadata                                               | VERIFIED | `bankStatementImport.create` at line 186; `BankStatementImport` model in schema                                                                     |
| 4   | Bank account auto-detected from OFX BANKID+ACCTID                                    | VERIFIED | `previewFile` queries `BankAccount` by bankCode+accountNumber from OFX metadata                                                                     |
| 5   | `reconciliation:manage` permission registered for OWNER and MANAGER                  | VERIFIED | `permissions.ts` line 15: union includes `'reconciliation'`; lines 88 and 104: OWNER and MANAGER get `reconciliation:manage`                        |
| 6   | Each statement line scored against open CP/CR/Transfer with EXATO/PROVAVEL/SEM_MATCH | VERIFIED | `scoreMatch` (line 307) and `toConfidence` (line 343) implement scoring; queries `payableInstallment.findMany` and `receivableInstallment.findMany` |
| 7   | User can accept/reject/manually-link/ignore statement lines                          | VERIFIED | Functions `confirmReconciliation`, `rejectMatch`, `manualLink`, `ignoreStatementLine` all exported and routed                                       |
| 8   | N:N manual link validates sum using Money arithmetic                                 | VERIFIED | `reconciliation.service.ts:621-624` uses `Money` reduce with `.equals()` validation                                                                 |
| 9   | Reconciliation report exported as CSV and PDF                                        | VERIFIED | `getReconciliationReport` returns CSV or PDF buffer; routes use `text/csv` and `application/pdf` Content-Type                                       |
| 10  | 12-month projection built from open CP/CR installments + checks A_COMPENSAR          | VERIFIED | `cashflow.service.ts` queries `payableInstallment.findMany`, `receivableInstallment.findMany`, and `check.findMany` with `A_COMPENSAR`              |
| 11  | Three scenarios computed (Realista/Otimista/Pessimista)                              | VERIFIED | `cashflow.service.ts:374-388`: multipliers 1.10 inflows, 0.95 outflows (Otimista); 0.90 inflows, 1.15 outflows (Pessimista)                         |
| 12  | Negative balance date detected and alerted                                           | VERIFIED | `cashflow.service.ts:387-389`: first month where `realisticNum < 0` sets `negativeBalanceDate`                                                      |
| 13  | DFC classification groups entries by Operacional/Investimento/Financiamento          | VERIFIED | `PAYABLE_DFC_MAP` and `RECEIVABLE_DFC_MAP` in `cashflow.types.ts`; applied per bucket in service                                                    |
| 14  | Projection exported as PDF and Excel                                                 | VERIFIED | `exportProjectionPdf` and `exportProjectionExcel` exported from service; routes `/export/pdf` and `/export/excel` registered                        |
| 15  | Recurring CP/CR projected without writing to DB                                      | VERIFIED | `cashflow.service.ts:178-215`: virtual installments generated from `recurrenceFrequency` and `recurrenceEndDate` without DB writes                  |
| 16  | Frontend: import history table visible; row click opens reconciliation session       | VERIFIED | `ReconciliationPage.tsx` renders `ImportHistoryTable`; `selectedImportId` state switches to `ReconciliationLineList`                                |
| 17  | Import preview modal handles OFX (skip step 1) and CSV (column mapping)              | VERIFIED | `ImportPreviewModal.tsx:131`: OFX skips to step 2; CSV step 1 shows column dropdowns                                                                |
| 18  | Reconciliation line list grouped by EXATO/PROVAVEL/SEM_MATCH with action buttons     | VERIFIED | `ReconciliationLineList.tsx:62-70`: confidence groups; Aceitar/Recusar/Vincular buttons with aria-labels                                            |
| 19  | Manual link modal validates N:N sum                                                  | VERIFIED | `ManualLinkModal.tsx:320`: `role="alert"` on sum mismatch error with formatted amounts                                                              |
| 20  | Cashflow chart shows 3 scenario lines with ReferenceLine at y=0                      | VERIFIED | `CashflowChart.tsx`: `ComposedChart` with `Area` (Realista), two `Line` components, `ReferenceLine y={0} stroke="#C62828"`                          |
| 21  | DFC table with expandable sections and 12 monthly columns                            | VERIFIED | `DfcTable.tsx:247-261`: Operacional/Investimento/Financiamento sections; 12 monthly columns; sticky first column                                    |
| 22  | Negative balance alert banner on CashflowPage                                        | VERIFIED | `CashflowPage.tsx:255`: conditional `role="alert"` with "Saldo negativo previsto" heading                                                           |
| 23  | Farm filter uses local state, not FarmContext global                                 | VERIFIED | `CashflowPage.tsx` uses local `useState` for farmId; farm filter dropdown not bound to FarmContext                                                  |
| 24  | Export PDF/Excel via secondary buttons                                               | VERIFIED | `exportCashflowPdf` and `exportCashflowExcel` in `useCashflow.ts`; buttons in page trigger download via blob URL                                    |
| 25  | Sidebar FINANCEIRO group includes Conciliacao and Fluxo de Caixa                     | VERIFIED | `Sidebar.tsx:185-186`: `/cashflow` (TrendingUp icon) and `/reconciliation` (GitMerge icon) entries                                                  |
| 26  | Lazy routes `/reconciliation` and `/cashflow` registered in App.tsx                  | VERIFIED | `App.tsx:90-91`: lazy imports; `App.tsx:180-181`: routes added inside authenticated layout                                                          |
| 27  | Financial Dashboard shows negative balance alert card linking to /cashflow           | VERIFIED | `FinancialDashboardPage.tsx:187,522,530`: uses `useNegativeBalanceAlert`, renders alert card, `Link to="/cashflow"`                                 |

**Score:** 27/27 truths verified

---

### Required Artifacts

| Artifact                                                                 | Status   | Details                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                      | VERIFIED | Models `BankStatementImport`, `BankStatementLine`, `Reconciliation`; enums `BankStatementLineStatus`, `ReconciliationConfidence`; `reconciled Boolean` on Payable and Receivable                                                   |
| `apps/backend/src/modules/reconciliation/reconciliation.types.ts`        | VERIFIED | Exports `ReconciliationError`, `OfxDocument`, `ImportResult`, `StatementLineWithMatches`, all required interfaces                                                                                                                  |
| `apps/backend/src/modules/reconciliation/ofx-parser.ts`                  | VERIFIED | Exports `parseOfx`, `parseOfxDate`; handles OFX 1.x SGML and 2.x XML                                                                                                                                                               |
| `apps/backend/src/modules/reconciliation/csv-parser.ts`                  | VERIFIED | Exports `parseCsv`, `detectCsvColumns`; handles ISO-8859-1 and comma decimal                                                                                                                                                       |
| `apps/backend/src/modules/reconciliation/reconciliation.service.ts`      | VERIFIED | Exports `previewFile`, `confirmImport`, `listImports`, `scoreMatch`, `toConfidence`, `confirmReconciliation`, `rejectMatch`, `manualLink`, `ignoreStatementLine`, `searchCandidates`, `getReconciliationReport`, `getImportDetail` |
| `apps/backend/src/modules/reconciliation/reconciliation.routes.ts`       | VERIFIED | Exports `reconciliationRouter`; all routes use `reconciliation:manage`; 10+ endpoints registered                                                                                                                                   |
| `apps/backend/src/shared/rbac/permissions.ts`                            | VERIFIED | `'reconciliation'` in PermissionModule union; `'manage'` in PermissionAction; OWNER and MANAGER get `reconciliation:manage`                                                                                                        |
| `apps/backend/src/modules/cashflow/cashflow.types.ts`                    | VERIFIED | Exports `DfcCategory`, `PAYABLE_DFC_MAP`, `RECEIVABLE_DFC_MAP`, `ProjectionPoint`, `CashflowProjection`, `DfcSummary`, `CashflowError`                                                                                             |
| `apps/backend/src/modules/cashflow/cashflow.service.ts`                  | VERIFIED | Exports `getProjection`, `getNegativeBalanceAlert`, `exportProjectionPdf`, `exportProjectionExcel`                                                                                                                                 |
| `apps/backend/src/modules/cashflow/cashflow.routes.ts`                   | VERIFIED | Exports `cashflowRouter`; `/projection`, `/negative-balance-alert`, `/projection/export/pdf`, `/projection/export/excel` registered                                                                                                |
| `apps/frontend/src/hooks/useReconciliation.ts`                           | VERIFIED | Exports `useImportHistory`, `useImportLines`, `useReconciliationActions`; uses `FormData` for file uploads                                                                                                                         |
| `apps/frontend/src/pages/ReconciliationPage.tsx`                         | VERIFIED | "Conciliação Bancária" heading; "Nova Importacao" button; `ImportHistoryTable` rendered; `useSearchParams` for deep-link                                                                                                           |
| `apps/frontend/src/pages/ReconciliationPage.css`                         | VERIFIED | Confidence badge styles (`.confidence-badge--exato/provavel/sem-match`); status badge styles; 4px spacing scale                                                                                                                    |
| `apps/frontend/src/components/reconciliation/ImportHistoryTable.tsx`     | VERIFIED | `FileSearch` icon for empty state; `scope="col"` on headers; status badge; skeleton loading                                                                                                                                        |
| `apps/frontend/src/components/reconciliation/ImportPreviewModal.tsx`     | VERIFIED | `accept=".ofx,.csv"` on input; multi-step state; OFX skips to step 2; CSV shows column dropdowns                                                                                                                                   |
| `apps/frontend/src/components/reconciliation/ReconciliationLineList.tsx` | VERIFIED | EXATO/PROVAVEL/SEM_MATCH groupings; Aceitar/Recusar/Vincular with aria-labels; Ignorar with inline confirmation                                                                                                                    |
| `apps/frontend/src/components/reconciliation/ManualLinkModal.tsx`        | VERIFIED | N:N sum validation; `role="alert"` on mismatch error                                                                                                                                                                               |
| `apps/frontend/src/hooks/useCashflow.ts`                                 | VERIFIED | Exports `useCashflow`, `useNegativeBalanceAlert`, `exportCashflowPdf`, `exportCashflowExcel`                                                                                                                                       |
| `apps/frontend/src/pages/CashflowPage.tsx`                               | VERIFIED | "Fluxo de Caixa" heading; `role="alert"` negative balance banner; farm filter local state; export buttons                                                                                                                          |
| `apps/frontend/src/pages/CashflowPage.css`                               | VERIFIED | Skeleton styles; `.dfc-table` styles; sticky column; alert banner styles                                                                                                                                                           |
| `apps/frontend/src/components/cashflow/CashflowChart.tsx`                | VERIFIED | `ComposedChart`; `Area` (Realista); two `Line` (Otimista/Pessimista); `ReferenceLine y={0}`; `aria-label` on wrapper                                                                                                               |
| `apps/frontend/src/components/cashflow/DfcTable.tsx`                     | VERIFIED | Operacional/Investimento/Financiamento sections; `scope="col"` and `scope="row"`; sticky first column                                                                                                                              |
| `apps/frontend/src/App.tsx`                                              | VERIFIED | Lazy imports and routes for both pages                                                                                                                                                                                             |
| `apps/frontend/src/components/layout/Sidebar.tsx`                        | VERIFIED | Both entries in FINANCEIRO group (GitMerge icon used for Conciliacao instead of planned FileSearch — cosmetic deviation, goal unaffected)                                                                                          |
| `apps/frontend/src/pages/FinancialDashboardPage.tsx`                     | VERIFIED | `useNegativeBalanceAlert` hook; conditional alert card; `Link to="/cashflow"`                                                                                                                                                      |

---

### Key Link Verification

| From                                              | To                                          | Via                            | Status | Details                                                                                |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| `reconciliation.routes.ts`                        | `reconciliation.service.ts`                 | route handlers call service    | WIRED  | All handlers import and call `importBankStatement`, `listImports` etc.                 |
| `reconciliation.service.ts`                       | `ofx-parser.ts`                             | parseOfx import                | WIRED  | `parseOfx` imported and called in `previewFile`                                        |
| `reconciliation.service.ts`                       | `BankStatementImport` Prisma model          | `bankStatementImport.create`   | WIRED  | Line 186 in service; `withRlsContext` wraps all DB calls                               |
| `reconciliation.routes.ts`                        | `reconciliation:manage` permission          | `checkPermission` middleware   | WIRED  | Every route in routes file calls `checkPermission('reconciliation:manage')`            |
| `reconciliation.service.ts`                       | `payableInstallment.findMany`               | scoring query                  | WIRED  | `getImportLinesWithMatches` queries open installments for matching                     |
| `reconciliation.service.ts confirmReconciliation` | `reconciled=true` on Payable/Receivable     | update with `reconciled: true` | WIRED  | Service updates `reconciled=true, reconciledAt` on confirm                             |
| `cashflow.service.ts`                             | `payableInstallment.findMany`               | open installments query        | WIRED  | Line 110; includes parent Payable for category                                         |
| `cashflow.service.ts`                             | `check.findMany A_COMPENSAR`                | checks query                   | WIRED  | Line 149: `status: 'A_COMPENSAR'`                                                      |
| `cashflow.service.ts`                             | `bankAccountBalance.currentBalance`         | aggregate balance query        | WIRED  | Lines 92-97: aggregates via `acc.balance?.currentBalance`                              |
| `ReconciliationPage.tsx`                          | `/api/org/reconciliation/imports`           | `useImportHistory` hook        | WIRED  | Hook fetches `/org/reconciliation/imports`                                             |
| `ImportPreviewModal.tsx`                          | `/api/org/reconciliation/preview`           | `FormData` multipart upload    | WIRED  | `useReconciliationActions` calls `/api/org/reconciliation/preview` with FormData       |
| `ReconciliationLineList.tsx`                      | `/api/org/reconciliation/imports/:id/lines` | `useImportLines` hook          | WIRED  | Hook fetches `imports/${importId}/lines`                                               |
| `CashflowPage.tsx`                                | `/api/org/cashflow/projection`              | `useCashflow` hook             | WIRED  | Hook fetches `/org/cashflow/projection`                                                |
| `CashflowChart.tsx`                               | `Recharts ComposedChart`                    | import from recharts           | WIRED  | `ComposedChart`, `Area`, `Line`, `ReferenceLine` all imported and rendered             |
| `FinancialDashboardPage.tsx`                      | `/api/org/cashflow/negative-balance-alert`  | `useNegativeBalanceAlert` hook | WIRED  | Hook fetches `/org/cashflow/negative-balance-alert`; alert card rendered conditionally |
| `Sidebar.tsx`                                     | `/reconciliation` and `/cashflow` routes    | nav items                      | WIRED  | Both entries present in FINANCEIRO group                                               |

---

### Requirements Coverage

| Requirement | Source Plans               | Description                                                                                                                                                                            | Status    | Evidence                                                                                                                                                                                                                               |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FN-06       | 05-01, 05-02, 05-04, 05-06 | Gerente pode importar extrato bancário (OFX/CSV) e conciliar automaticamente com lançamentos do sistema, com graus de confiança (exato/provável/sem match) e ações manuais             | SATISFIED | Complete backend (parsers, matching engine, all actions) + frontend (ReconciliationPage, ImportPreviewModal, ReconciliationLineList, ManualLinkModal) fully implemented and tested (42 passing tests)                                  |
| FN-13       | 05-03, 05-05, 05-06        | Gerente pode visualizar fluxo de caixa realizado e projetado com cenários (otimista/realista/pessimista), gráfico de evolução com alerta de saldo negativo, classificação DFC e export | SATISFIED | Complete backend (projection engine, 3 scenarios, DFC classification, negative balance detection, PDF/Excel export) + frontend (CashflowChart, DfcTable, alert banner, export buttons) fully implemented and tested (15 passing tests) |

---

### Anti-Patterns Found

No blockers or stubs found. One cosmetic deviation noted:

| File                                              | Detail                                                                                            | Severity | Impact                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `apps/frontend/src/components/layout/Sidebar.tsx` | Plan 06 specified `FileSearch` icon for Conciliacao sidebar entry; implementation uses `GitMerge` | Info     | None — goal achievement unaffected; icon is decorative |

---

### Human Verification Required

The automated checks all pass. The following items require human testing in a running environment:

**1. OFX File Import End-to-End**

**Test:** Upload a real OFX 1.x file (with OFXHEADER, BANKID, ACCTID, STMTTRN blocks) via the "Nova Importacao" button
**Expected:** Preview modal shows correct transaction list; auto-detected bank account name shown (or fallback dropdown); confirm import creates import record; re-upload same file shows `skippedLines > 0`
**Why human:** Real file encoding edge cases, timezone parsing correctness, and DB auto-detection logic cannot be verified statically

**2. Reconciliation Accept Action**

**Test:** Import a statement file, open a reconciliation session, click "Aceitar" on an EXATO match
**Expected:** Line status updates to RECONCILED (green badge); toast "Lancamento conciliado com sucesso"; corresponding CP/CR record in DB has `reconciled=true`
**Why human:** Requires live backend DB inspection to confirm `reconciled` field update

**3. Cashflow Chart Visual Rendering**

**Test:** Navigate to /cashflow with real CP/CR data in the DB
**Expected:** Recharts chart shows three distinct lines/area, red ReferenceLine at y=0, tooltip on hover shows saldo/entradas/saidas/cheques pendentes in JetBrains Mono
**Why human:** Chart rendering and interactive tooltip require browser

**4. PDF and Excel Export**

**Test:** Click "Exportar PDF" and "Exportar Excel" buttons on Cashflow page
**Expected:** Browser triggers file downloads; PDF opens showing org name, projection table, DFC summary; Excel has two sheets ("Projecao" and "DFC")
**Why human:** File download and content quality require browser and file inspection

**5. Negative Balance Alert on Dashboard**

**Test:** Ensure there is at least one CP with a dueDate such that the running balance goes negative; navigate to Financial Dashboard
**Expected:** Alert card appears with "Saldo negativo previsto" and "Ver projecao" link; clicking link navigates to /cashflow
**Why human:** Requires controlling actual financial data to trigger projection; navigation flow needs browser

---

## Summary

Phase 5 goal is fully achieved. All 27 observable truths verified. Both requirements FN-06 and FN-13 are marked complete in REQUIREMENTS.md and are backed by substantive, wired implementations:

- **FN-06 (Conciliacao Bancaria):** Complete backend pipeline — OFX 1.x/2.x and CSV parsers, import service with `sha256` duplicate detection, scoring engine (`scoreMatch`/`toConfidence`) with 100-point scale mapping to EXATO/PROVAVEL/SEM_MATCH, accept/reject/manual-link/ignore actions with Money N:N validation, CSV+PDF report export. Frontend: import history table, multi-step preview modal (OFX skips step 1), confidence-grouped reconciliation line list, manual link modal with sum validation. 42 passing tests.

- **FN-13 (Fluxo de Caixa):** Complete 12-month projection engine — queries open PayableInstallments + ReceivableInstallments + Checks A_COMPENSAR, projects recurring CP/CR without DB writes, builds monthly buckets with Money arithmetic, computes 3 scenarios (1.10/0.95 and 0.90/1.15 multipliers), detects first negative balance month, DFC classification via category maps, PDF and Excel export. Frontend: Recharts ComposedChart with Area + 2 Lines + ReferenceLine at y=0, DFC expandable table with sticky column, negative balance alert banner with `role="alert"`, farm filter local state, dashboard alert card with link to /cashflow. 15 passing tests.

One cosmetic deviation: Sidebar uses `GitMerge` icon instead of the planned `FileSearch` for the Conciliacao entry. This does not affect functionality or goal achievement.

Automated verification is complete. Human verification of UI rendering, file downloads, and live DB state is recommended before marking this phase fully closed.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
