# Phase 40: DFC, Dashboard Executivo - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

DfcCalculatorService puro (sem Prisma) com método direto (reusando PAYABLE_DFC_MAP/RECEIVABLE_DFC_MAP de v1.0 sobre transações liquidadas) e método indireto (CPC 03 R2 partindo do lucro líquido DRE com ajustes não-caixa e variação capital de giro). Ativação do invariante #2 na cross-validation (DFC↔BP). Dashboard contábil executivo com cards de resultado, gráficos receita/despesa 12m, composição custos, indicadores BP e alertas contábeis. Frontend com 2 páginas novas: /dfc (tabs direto/indireto) e /accounting-dashboard.

</domain>

<decisions>
## Implementation Decisions

### DFC Método Direto
- **D-01:** Página /dfc com **tabs Direto/Indireto**. Cada tab mostra as 3 seções (Operacional, Investimento, Financiamento) + saldo inicial/final + variação líquida.
- **D-02:** Fonte de dados direto: **transações liquidadas** (CP/CR pagos no período). Reusar PAYABLE_DFC_MAP e RECEIVABLE_DFC_MAP de `modules/cashflow/cashflow.types.ts` para classificação. Não usar JournalEntry.
- **D-03:** Período e comparativo: **mesmo padrão DRE** — seletor exercício fiscal + mês. 3 colunas: Mês atual | Acumulado exercício | Mesmo período ano anterior.

### DFC Método Indireto
- **D-04:** Conjunto de ajustes **padrão CPC 03 R2**: Lucro Líquido (DRE) + Depreciação + Provisões (férias/13º) + Variação Valor Justo CPC 29 + Delta Capital de Giro (ΔCR, ΔEstoques, ΔCP, ΔObrig. Trabalhistas/Tributárias). Seções Investimento e Financiamento idênticas ao direto.

### Dashboard Contábil Executivo
- **D-05:** Layout **Cards + Gráficos**: topo 4 cards (Resultado Acumulado, Receita Total, Despesa Total, Margem Operacional com delta % vs período anterior). Meio: gráfico linha receita vs despesa 12 meses + donut composição custos por natureza. Baixo: indicadores BP + alertas.
- **D-06:** Página **nova separada** em /accounting-dashboard. FinancialDashboardPage existente continua focado no operacional financeiro (saldos, CP/CR).
- **D-07:** **3 alertas contábeis** clicáveis: períodos não fechados (→ FiscalYearsPage), lançamentos pendentes na fila auto-posting (→ JournalEntriesPage), contas sem mapeamento SPED (→ ChartOfAccountsPage).
- **D-08:** **4 indicadores BP** no dashboard: Liquidez Corrente, Endividamento Geral, ROE, PL/ha. Subset dos 6 do BpCalculatorService — sem redundância com página BP.

### Validação DFC↔BP
- **D-09:** Ativar invariante #2 na cross-validation com **tolerância ±0.01** (mesma dos outros invariantes). Compara: variação líquida de caixa DFC vs (saldo final - saldo inicial) contas caixa/bancos (1.1.01.xx) no BP. Card verde/vermelho com botão "Investigar" abre DFC.

### Navegação Frontend
- **D-10:** DFC e Dashboard Contábil no **grupo CONTABILIDADE** do sidebar: Plano de Contas, Lançamentos, Fechamento, Balancete, DRE, Balanço Patrimonial, **DFC**, Validação Cruzada, **Dashboard Contábil**.
- **D-11:** Rotas: **/dfc** e **/accounting-dashboard**.

### Claude's Discretion
- Estrutura interna do DfcCalculatorService (classe pura vs funções)
- Queries para buscar CP/CR liquidados no período (Prisma vs raw SQL)
- Cálculo dos deltas de capital de giro (quais contas incluir em cada grupo)
- Detalhes visuais: biblioteca de gráficos (recharts já usado no projeto), cores, tooltips
- Ordem e agrupamento das linhas dentro de cada seção DFC
- Layout responsivo do dashboard (grid breakpoints)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DFC-01 (direto 3 seções), DFC-02 (indireto CPC 03 R2), DFC-03 (validação DFC↔BP), DASH-01 (dashboard executivo)

### Prior Phase Context
- `.planning/phases/39-dre-balan-o-patrimonial-e-valida-o-cruzada/39-CONTEXT.md` — DRE/BP calculator decisions, cross-validation invariants, sparkline pattern
- `.planning/phases/37-regras-e-lan-amentos-autom-ticos/37-CONTEXT.md` — auto-posting, JournalEntry model
- `.planning/phases/38-fechamento-mensal-e-concilia-o-cont-bil/38-CONTEXT.md` — fechamento mensal, period status

### Existing Modules (Backend)
- `apps/backend/src/modules/cashflow/cashflow.types.ts` — DfcCategory type, PAYABLE_DFC_MAP, RECEIVABLE_DFC_MAP (REUSE for DFC direto)
- `apps/backend/src/modules/cashflow/cashflow.service.ts` — getProjection with DfcSummary (reference for data flow)
- `apps/backend/src/modules/financial-statements/cross-validation.calculator.ts` — invariant #2 PENDING (activate here)
- `apps/backend/src/modules/financial-statements/financial-statements.service.ts` — getDre, getBp, getCrossValidation orchestrator
- `apps/backend/src/modules/financial-statements/dre.calculator.ts` — calculateDre (lucro líquido for indireto)
- `apps/backend/src/modules/financial-statements/bp.calculator.ts` — calculateBp (indicators, cash accounts for validation)
- `apps/backend/src/modules/ledger/ledger.service.ts` — getTrialBalance (AccountBalance data)

### Schema
- `apps/backend/prisma/schema.prisma` — AccountBalance, ChartOfAccount (code, accountType, isFairValueAdj), Payable (paidAt, category), Receivable (settledAt, type)

### Existing Frontend Pages
- `apps/frontend/src/pages/DrePage.tsx` — pattern for financial statement page with fiscal year/month selector
- `apps/frontend/src/pages/BalanceSheetPage.tsx` — indicator cards with sparklines
- `apps/frontend/src/pages/CrossValidationPage.tsx` — invariant cards grid
- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — dashboard layout pattern (cards + charts + alerts)
- `apps/frontend/src/pages/CashflowPage.tsx` — DfcTable component, CashflowChart

### Design System
- `docs/design-system/04-componentes.md` — Cards, tabelas, toggles, badges, charts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PAYABLE_DFC_MAP` / `RECEIVABLE_DFC_MAP` — classification maps for DFC direto, already working in v1.0
- `DfcSummary` type — operacional/investimento/financiamento with inflows/outflows/net
- `BpCalculatorService` — indicators (liquidez, endividamento, ROE, PL/ha) with sparkline data
- `DreCalculatorService` — lucro líquido output needed for DFC indireto
- `cross-validation.calculator.ts` — invariant framework, just needs DFC data wired in
- `FinancialDashboardPage` — layout pattern with cards, charts (recharts), alerts section
- Fiscal year/month selector pattern from DrePage/BalanceSheetPage

### Established Patterns
- Pure calculator functions (no Prisma) — DRE and BP follow this, DFC must too
- Service layer orchestrates: load DB data → call pure calculator → return
- AccountBalance as primary data source for GL-based calculations
- Tabs pattern (TrialBalancePage) for multiple views of same data
- recharts for charts (already used in CashflowChart, FinancialDashboardPage)

### Integration Points
- `financial-statements.service.ts` — add getDfc method alongside getDre/getBp
- `cross-validation.calculator.ts` — wire DFC net cash flow into invariant #2
- `App.tsx` routes — add /dfc and /accounting-dashboard
- Sidebar config — add DFC and Dashboard Contábil to CONTABILIDADE group

</code_context>

<specifics>
## Specific Ideas

- DFC direto deve bater com o fluxo de caixa existente em /cashflow (mesmos dados, apresentação diferente)
- DFC indireto parte do lucro líquido da DRE — garantir que o cálculo é consistente
- Dashboard contábil é para gerente/proprietário (visão executiva), não contador (que usa DRE/BP/balancete diretamente)
- Alertas clicáveis levam à página correspondente para ação imediata

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-dfc-dashboard-executivo*
*Context gathered: 2026-03-28*
