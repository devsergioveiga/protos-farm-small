---
phase: 11-devolu-o-or-amento-e-saving
verified: 2026-03-18T12:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 11: Devolucao, Orcamento e Saving Analysis Verification Report

**Phase Goal:** Gerente pode registrar devoluções com reversão automática de estoque e crédito financeiro, controlar orçamento de compras por categoria, e visualizar análise de saving do período
**Verified:** 2026-03-18
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                     | Status   | Evidence                                                                                    |
| --- | ----------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| 1   | Gerente pode registrar devolucao total ou parcial vinculada a um recebimento confirmado   | VERIFIED | `createGoodsReturn` validates CONFIRMADO status; GoodsReturnModal with receipt picker       |
| 2   | Devolucao com reversao automatica de estoque na aprovacao                                 | VERIFIED | `tx.stockOutput.create` with type RETURN inside APROVADA transition (line 333)              |
| 3   | Credito/estorno financeiro: CREDITO cria Payable negativo, ESTORNO reduz Payable original | VERIFIED | `tx.payable.create` with isCredit=true for CREDITO; installment recalc for ESTORNO          |
| 4   | Gerente pode controlar orcamento de compras por categoria com alerta nao-bloqueante       | VERIFIED | `checkBudgetExceeded` injected into RC approval and OC EMITIDA; sets `budgetExceeded` flag  |
| 5   | Execucao orcamentaria (requisitado/comprado/pago) calculada em tempo real                 | VERIFIED | `getBudgetExecution` aggregates RC items (APROVADA), OC items, Payables (PAID) in real time |
| 6   | Gerente pode ver saving por cotacao, historico de preco e indicadores de ciclo            | VERIFIED | `getSavingByQuotation`, `getPriceHistory`, `getCycleIndicators` all implemented             |
| 7   | Top 10 produtos por gasto e top 5 fornecedores por volume visivel no dashboard            | VERIFIED | `getTopProducts`/`getTopSuppliers` in service; TopItemsChart in SavingAnalysisPage          |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                    | Expected                                                             | Status   | Details                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                                         | GoodsReturn, GoodsReturnItem, PurchaseBudget models + enum additions | VERIFIED | All 3 models found; RETURN enum; goodsReturnId; isCredit; budgetExceeded (2x)                            |
| `apps/backend/prisma/migrations/20260411100000_add_goods_returns_budgets/`  | Migration applied                                                    | VERIFIED | Directory exists with migration.sql                                                                      |
| `apps/backend/src/modules/goods-returns/goods-returns.types.ts`             | State machine, enums, input/output types                             | VERIFIED | GR_RETURN_STATUSES, canGrReturnTransition, CreateGoodsReturnInput, GoodsReturnOutput present (7 matches) |
| `apps/backend/src/modules/purchase-budgets/purchase-budgets.types.ts`       | Budget input/output types, period types                              | VERIFIED | BUDGET_PERIOD_TYPES, BudgetExecutionRow, BudgetCheckResult present (5 matches)                           |
| `apps/backend/src/modules/saving-analysis/saving-analysis.types.ts`         | Query param and output types for analytics                           | VERIFIED | SavingSummary, CycleIndicators, AnalyticsDashboard present (5 matches)                                   |
| `apps/backend/src/modules/stock-outputs/stock-outputs.types.ts`             | STOCK_OUTPUT_TYPES includes RETURN                                   | VERIFIED | RETURN present (2 matches including label)                                                               |
| `apps/backend/src/modules/goods-returns/goods-returns.service.ts`           | CRUD + state machine + financial side effects                        | VERIFIED | 570 lines; createGoodsReturn, transitionGoodsReturn, 3 financial treatments, DEV-YYYY/NNNN numbering     |
| `apps/backend/src/modules/goods-returns/goods-returns.routes.ts`            | Express router with 6 endpoints                                      | VERIFIED | 6 routes (GET list, POST, GET /:id, PATCH transition, POST photo, DELETE)                                |
| `apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts`       | Integration tests (18 tests)                                         | VERIFIED | 18 tests covering CRUD, state machine, CREDITO/ESTORNO/TROCA, partial return                             |
| `apps/backend/src/modules/purchase-budgets/purchase-budgets.service.ts`     | CRUD + execution aggregation + checkBudgetExceeded                   | VERIFIED | 494 lines; all 5 exported functions present                                                              |
| `apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.ts`      | Express router with 7 endpoints                                      | VERIFIED | /execution and /deviations registered before /:id                                                        |
| `apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.spec.ts` | Integration tests (20 tests)                                         | VERIFIED | 20 tests including non-blocking budget check on RC/OC                                                    |
| `apps/backend/src/modules/saving-analysis/saving-analysis.service.ts`       | 6 read-only analytics functions                                      | VERIFIED | 438 lines; all 6 functions present; saving excludes <2 proposals                                         |
| `apps/backend/src/modules/saving-analysis/saving-analysis.routes.ts`        | 6 GET-only endpoints                                                 | VERIFIED | /dashboard, /saving, /price-history/:productId, /indicators, /top-products, /top-suppliers               |
| `apps/backend/src/modules/saving-analysis/saving-analysis.routes.spec.ts`   | Integration tests (23 tests)                                         | VERIFIED | 23 mock-based tests covering all endpoints                                                               |
| `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts`   | checkBudgetExceeded injected on APPROVE                              | VERIFIED | 2 grep matches for checkBudgetExceeded; 1 for budgetExceeded                                             |
| `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts`       | checkBudgetExceeded injected on EMITIDA                              | VERIFIED | 2 grep matches for checkBudgetExceeded; 1 for budgetExceeded                                             |
| `apps/frontend/src/pages/DevolucoesPage.tsx`                                | List page with filters + inline detail                               | VERIFIED | 4 useGoodsReturns usages; status transitions; filter bar; expandable detail                              |
| `apps/frontend/src/components/goods-returns/GoodsReturnModal.tsx`           | Modal with receipt picker, item table, financial actions             | VERIFIED | createGoodsReturn call; TROCA/CREDITO/ESTORNO radio (16 matches); returnQty input                        |
| `apps/frontend/src/hooks/useGoodsReturns.ts`                                | API hooks for goods returns                                          | VERIFIED | 5 matches (useGoodsReturns, createGoodsReturn, transitionGoodsReturn, uploadReturnPhoto)                 |
| `apps/frontend/src/pages/OrcamentoComprasPage.tsx`                          | Budget execution table with progress bars                            | VERIFIED | Execucao + Desvios tabs; percentUsed/progress (18 matches); useBudgetExecution wired                     |
| `apps/frontend/src/pages/SavingAnalysisPage.tsx`                            | KPI cards + Recharts charts + top tables                             | VERIFIED | 669 lines (not placeholder); lazy PriceHistoryChart + TopItemsChart; useSavingDashboard                  |
| `apps/frontend/src/components/saving-analysis/PriceHistoryChart.tsx`        | Recharts LineChart component                                         | VERIFIED | EXISTS; imports from 'recharts'                                                                          |
| `apps/frontend/src/components/saving-analysis/TopItemsChart.tsx`            | Recharts BarChart component                                          | VERIFIED | EXISTS; imports from 'recharts'                                                                          |
| `apps/frontend/src/hooks/usePurchaseBudgets.ts`                             | API hooks for budgets                                                | VERIFIED | useBudgetExecution, createPurchaseBudget present                                                         |
| `apps/frontend/src/hooks/useSavingAnalysis.ts`                              | API hooks for saving analytics                                       | VERIFIED | useSavingDashboard, usePriceHistory, useCycleIndicators present (3 matches)                              |

### Key Link Verification

| From                          | To                                                        | Via                                        | Status | Details                                                                               |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------- |
| `goods-returns.service.ts`    | `tx.goodsReturn.*`                                        | withRlsContext transaction                 | WIRED  | APROVADA transition uses tx.stockOutput.create + tx.payable.create in same tx         |
| `goods-returns.service.ts`    | `tx.stockOutput.create`                                   | APROVADA transition triggers RETURN output | WIRED  | Line 333: `tx.stockOutput.create` with type RETURN                                    |
| `goods-returns.service.ts`    | `tx.payable.create`                                       | CREDITO action creates negative payable    | WIRED  | isCredit=true on created payable; creditPayableId stored on return                    |
| `goods-returns.routes.ts`     | `app.ts`                                                  | Router registration                        | WIRED  | `import { goodsReturnsRouter }` + `app.use('/api', goodsReturnsRouter)`               |
| `purchase-budgets.service.ts` | `purchase-requests.service.ts`                            | checkBudgetExceeded injected in approve    | WIRED  | 2 matches in purchase-requests.service.ts; budgetExceeded flag set                    |
| `purchase-budgets.service.ts` | `purchase-orders.service.ts`                              | checkBudgetExceeded injected in EMITIDA    | WIRED  | 2 matches in purchase-orders.service.ts; budgetExceeded flag set                      |
| `purchaseBudgetsRouter`       | `app.ts`                                                  | Router registration                        | WIRED  | import + app.use verified                                                             |
| `savingAnalysisRouter`        | `app.ts`                                                  | Router registration                        | WIRED  | import + app.use verified                                                             |
| `saving-analysis.service.ts`  | `prisma.quotation.findMany`                               | Saving calculation from proposals          | WIRED  | proposedSuppliers.length < 2 guard; winnerMap from QuotationItemSelection             |
| `saving-analysis.service.ts`  | `prisma.purchaseOrder`                                    | Cycle indicators and price history         | WIRED  | price history via purchaseRequestItemId join                                          |
| `DevolucoesPage.tsx`          | `/api/org/goods-returns`                                  | useGoodsReturns hook                       | WIRED  | 4 uses of useGoodsReturns in page                                                     |
| `GoodsReturnModal.tsx`        | `/api/org/goods-returns`                                  | POST via createGoodsReturn import          | WIRED  | `import { createGoodsReturn } from '@/hooks/useGoodsReturns'`; called in handleSubmit |
| `Sidebar.tsx`                 | `/goods-returns`, `/purchase-budgets`, `/saving-analysis` | 3 COMPRAS group entries                    | WIRED  | All 3 routes present in Sidebar with icons                                            |
| `App.tsx`                     | DevolucoesPage, OrcamentoComprasPage, SavingAnalysisPage  | Lazy route registration                    | WIRED  | All 3 lazy imports and Route elements present                                         |
| `OrcamentoComprasPage.tsx`    | `/api/org/purchase-budgets`                               | usePurchaseBudgets hook                    | WIRED  | useBudgetExecution + usePurchaseBudgets used in page (3 matches)                      |
| `SavingAnalysisPage.tsx`      | `/api/org/saving-analysis`                                | useSavingAnalysis hook                     | WIRED  | useSavingDashboard + useSavingByQuotation + usePriceHistory (3 matches)               |
| `SavingAnalysisPage.tsx`      | `recharts`                                                | Lazy PriceHistoryChart + TopItemsChart     | WIRED  | Both chart components exist with recharts imports; lazy-loaded in page                |

### Requirements Coverage

| Requirement | Source Plans        | Description                                                                                                                                       | Status    | Evidence                                                                                                                      |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| DEVO-01     | 11-01, 11-02, 11-05 | Devolucao total/parcial com motivo, fotos, acao esperada, saida automatica de estoque, NF, notificacao, resolucao                                 | SATISFIED | Full state machine; RETURN StockOutput on APROVADA; CREDITO/ESTORNO/TROCA; photo upload; DEV-YYYY/NNNN; 18 tests passing      |
| FINC-02     | 11-01, 11-03, 11-06 | Orcamento de compras por categoria e periodo, acompanhamento orcado/requisitado/comprado/pago, alerta nao-bloqueante, dashboard execucao, desvios | SATISFIED | PurchaseBudget CRUD; real-time aggregation; budgetExceeded flag non-blocking; progress bars; deviations tab; 20 tests passing |
| FINC-03     | 11-01, 11-04, 11-06 | Saving por cotacao, saving acumulado, historico preco, indicadores (% formal/emergencial, prazo medio), top 10 produtos, top 5 fornecedores       | SATISFIED | All 6 analytics functions; Recharts charts; KPI cards; 23 tests passing                                                       |

All 3 requirements fully covered. No orphaned requirements detected in REQUIREMENTS.md for Phase 11.

### Anti-Patterns Found

| File                       | Line          | Pattern     | Severity | Impact                                                  |
| -------------------------- | ------------- | ----------- | -------- | ------------------------------------------------------- |
| `DevolucoesPage.tsx`       | 482           | placeholder | Info     | Input placeholder text — correct HTML usage, not a stub |
| `OrcamentoComprasPage.tsx` | 266           | placeholder | Info     | Input placeholder text — correct HTML usage, not a stub |
| `GoodsReturnModal.tsx`     | 305, 540, 571 | placeholder | Info     | Input placeholder text — correct HTML usage, not a stub |

All "placeholder" matches are HTML `placeholder` attributes on form inputs — expected and correct. No TODO/FIXME, no empty implementations, no stubs detected.

### Human Verification Required

#### 1. APROVADA Transition — Stock Reversal and Financial Treatment End-to-End

**Test:** Create a goods receipt with 2 items in CONFIRMADO status. Create a goods return for 1 item with expectedAction=CREDITO. Transition the return to APROVADA.
**Expected:** StockOutput of type RETURN is created reducing stock balance; a Payable with isCredit=true and negative totalAmount is created; creditPayableId is set on the return record.
**Why human:** Integration test uses mocks — actual DB transaction across stockOutput + payable + stockBalance tables requires running app against real DB.

#### 2. Budget Exceeded Flag — Non-Blocking Warning on RC Approval

**Test:** Create a PurchaseBudget for INSUMO_AGRICOLA category with budgetedAmount=100. Create and approve a PurchaseRequest with estimated total=500 in the same category.
**Expected:** RC approval succeeds (HTTP 200); RC.budgetExceeded=true is returned in the response; no error thrown.
**Why human:** The non-blocking behavior is a critical UX contract — needs manual verification that approval still completes and that frontend displays the budget warning appropriately.

#### 3. SavingAnalysisPage — Recharts Chart Rendering

**Test:** Navigate to /saving-analysis, select a date range with data, select a product in the price history section.
**Expected:** LineChart renders with X-axis dates and Y-axis prices; tooltip shows price, OC number, and supplier name; TopItemsChart horizontal bars render for top products and suppliers.
**Why human:** Recharts rendering requires browser; lazy-loaded chart components cannot be verified programmatically.

#### 4. OrcamentoComprasPage — Progress Bar Colors

**Test:** Create budgets with execution at <80%, 80-100%, and >100%. View the Execucao tab.
**Expected:** Progress bars show green, yellow, and red fills respectively per the CLAUDE.md color tokens.
**Why human:** Color rendering requires visual inspection in browser.

### Gaps Summary

No gaps found. All 7 observable truths are fully verified, all artifacts exist and are substantive (not stubs), and all key links are wired. The 4 human verification items above are visual/runtime behaviors that pass automated checks.

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
