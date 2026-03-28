# Phase 39: DRE, Balanco Patrimonial e Validacao Cruzada - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Services calculadores puros (DreCalculatorService, BpCalculatorService) sem imports Prisma diretos, que leem AccountBalance para gerar DRE com layout rural fixo (CPC 29), BP com classificacao rural e indicadores financeiros, e painel de validacao cruzada com 4 invariantes. Frontend com 3 paginas separadas (/dre, /balance-sheet, /cross-validation). Inclui: analise V/H com toggle, filtro por centro de custo (dropdown unico), ranking por margem bruta abaixo da DRE, 6 cards de indicadores acima do BP, grid 2x2 de invariantes com semaforo verde/vermelho.

</domain>

<decisions>
## Implementation Decisions

### Layout DRE
- **D-01:** Layout fixo rural hardcoded no service. 10 secoes: Receita Operacional Bruta (agricola/pecuaria/industrializacao), Deducoes (FUNRURAL, devolucoes), Receita Liquida, CPV (por grupo agricola/pecuario — nao por cultura), Lucro Bruto, Despesas Operacionais (admin/comerciais/financeiras/depreciacao), Variacao Valor Justo CPC 29, Resultado Antes IR/CSLL, IR/CSLL, Resultado Liquido.
- **D-02:** Mapeamento de contas as secoes por codigo hierarquico: 3.1.xx = Receita Agricola, 3.2.xx = Pecuaria, 3.3.xx = Industrializacao, 4.1.xx = Deducoes, 5.1.xx = CPV Agricola, 5.2.xx = CPV Pecuario, 6.1.xx = Desp. Admin, 6.2.xx = Desp. Comerciais, 6.3.xx = Desp. Financeiras. Contas com isFairValueAdj=true vao para secao CPC 29.
- **D-03:** CPV detalhado por grupo (agricola/pecuario) nao por cultura individual. Detalhe por cultura fica no filtro por centro de custo.
- **D-04:** Secao CPC 29 mostra total consolidado (uma linha unica "Variacao Valor Justo Ativo Biologico"). Soma todas contas com isFairValueAdj=true. Detalhamento no razao.

### Comparativos e Filtros
- **D-05:** 3 colunas comparativas: Mes atual | Acumulado exercicio | Mesmo periodo ano anterior. Conforme DRE-02.
- **D-06:** Analise V/H via toggle button. OFF por padrao (tabela limpa). ON adiciona colunas: % vertical (sobre receita liquida) e Delta% horizontal (variacao vs periodo anterior).
- **D-07:** Filtro por centro de custo: dropdown unico com opcoes "Consolidado" (default) + lista de CCs (fazenda/cultura). Filtra AccountBalance.costCenterId.
- **D-08:** Ranking de culturas por margem bruta: secao abaixo da tabela DRE. Tabela com Top CCs (Receita, CPV, Margem %) + bar chart horizontal. So aparece quando filtro = Consolidado.

### Balanco Patrimonial e Indicadores
- **D-09:** 6 cards de indicadores no topo da pagina BP: Liquidez Corrente (AC/PC), Liquidez Seca ((AC-Estoques)/PC), Endividamento Geral (PE/AT), Composicao Endividamento (PC/PE), ROE (RL/PL), PL/ha. Cada card com valor + mini-sparkline de tendencia.
- **D-10:** PL/ha calculado usando soma de Farm.totalArea de todas as fazendas da organizacao.
- **D-11:** BP com 2 colunas comparativas: Saldo atual | Saldo periodo anterior. Classificacao rural: AC (caixa/bancos, estoques, creditos rurais CP), ANC (imobilizado rural, ativo biologico CPC 29, culturas formacao, intangivel), PC (fornecedores, obrigacoes trabalhistas/tributarias, financiamentos CP), PNC (credito rural LP, financiamentos LP), PL (capital, reservas, lucros/prejuizos acumulados).

### Painel de Vinculacao
- **D-12:** 4 cards em grid 2x2 com semaforo verde/vermelho. Cada card: icone status, nome do invariante, valores esperado vs encontrado, diferenca.
- **D-13:** 4 invariantes: (1) Resultado Liquido DRE = Delta Lucros Acumulados BP, (2) Variacao caixa DFC = variacao caixa/bancos BP (placeholder cinza "Aguardando DFC — Phase 40"), (3) Ativo Total = Passivo Total + PL, (4) Total debitos = total creditos no balancete.
- **D-14:** Invariante DFC↔BP: card placeholder cinza/desabilitado com texto "Aguardando DFC (Phase 40)". Backend retorna null. Phase 40 ativa este card.
- **D-15:** Invariante falho: card vermelho com diferenca. Botao "Investigar" abre razao/balancete filtrado. Informativo, nao bloqueia fechamento.

### Navegacao Frontend
- **D-16:** 3 paginas separadas: /dre, /balance-sheet, /cross-validation. Sidebar no grupo CONTABILIDADE com links diretos.

### Claude's Discretion
- Estrutura interna do DreCalculatorService e BpCalculatorService (classes puras vs funcoes)
- Queries SQL ou Prisma para agregar AccountBalance por secao
- Detalhes visuais dos sparklines nos cards de indicadores (biblioteca, cores)
- Formato do bar chart no ranking por margem (biblioteca recharts ou similar)
- Verificacao do seed COA rural para sub-contas do grupo 5.x
- Labels e tooltips dos indicadores financeiros

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DRE-01 (layout rural CPC 29), DRE-02 (analise V/H, comparativos), DRE-03 (filtro CC, ranking margem), BP-01 (classificacao rural), BP-02 (indicadores financeiros), VINC-01 (4 invariantes)

### Prior Phase Context
- `.planning/phases/37-regras-e-lan-amentos-autom-ticos/37-CONTEXT.md` — auto-posting decisions, JournalEntry model, AccountingRule
- `.planning/phases/38-fechamento-mensal-e-concilia-o-cont-bil/38-CONTEXT.md` — fechamento mensal, checkPeriodOpen, MonthlyClosing model

### Existing Modules (Backend)
- `apps/backend/src/modules/ledger/ledger.service.ts` — getTrialBalance (base data), getLedger (razao), export PDF/XLSX
- `apps/backend/src/modules/ledger/ledger.types.ts` — TrialBalanceRow, TrialBalanceOutput (accountType, nature, level, isSynthetic, balances)
- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts` — COA CRUD, template seed
- `apps/backend/src/modules/cost-centers/cost-centers.service.ts` — CostCenter CRUD, farm relation
- `apps/backend/src/modules/fiscal-periods/` — FiscalYear, AccountingPeriod, period status

### Schema
- `apps/backend/prisma/schema.prisma` — AccountType (ATIVO/PASSIVO/PL/RECEITA/DESPESA), AccountNature (DEVEDORA/CREDORA), ChartOfAccount (isFairValueAdj, level, code, accountType), AccountBalance (costCenterId, month, fiscalYearId, closingBalance), CostCenter (farmId), Farm (totalArea)

### Existing Frontend Pages
- `apps/frontend/src/pages/TrialBalancePage.tsx` — balancete (pattern for similar financial report page)
- `apps/frontend/src/pages/JournalEntriesPage.tsx` — tabs pattern, sidebar group CONTABILIDADE
- `apps/frontend/src/hooks/useLedger.ts` — existing hooks for ledger/trial balance

### Design System
- `docs/design-system/04-componentes.md` — Cards, tabelas, toggles, badges, charts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getTrialBalance()` in ledger.service.ts: computes per-account balances with movements — DRE/BP calculators can reuse AccountBalance data similarly
- `TrialBalanceRow` type: has accountType, nature, level, isSynthetic, previousBalance, movements, currentBalance
- `AccountBalance` model: monthly balances per account with costCenterId — basis for CC filtering
- `ChartOfAccount.isFairValueAdj` boolean: already exists for CPC 29 tagging
- `ChartOfAccount.accountType` enum: ATIVO/PASSIVO/PL/RECEITA/DESPESA — natural split for DRE vs BP
- `CostCenter` model with farmId relation: dropdown data source
- `Farm.totalArea`: exists for PL/ha calculation
- `exportTrialBalancePdf/Xlsx`: pattern for PDF/XLSX export (pdfkit + ExcelJS)

### Established Patterns
- Services colocalizados em modules/{domain}/ com service+routes+types+spec
- withRlsContext for multi-tenancy on read operations
- Decimal.js for financial precision
- pdfkit for PDF generation, ExcelJS for XLSX
- Frontend: page + hooks + types pattern (TrialBalancePage as reference)

### Integration Points
- Sidebar: grupo CONTABILIDADE already has Plano de Contas, Lancamentos, Razao, Balancete, Periodos Fiscais, Conciliacao, Fechamento Mensal
- App.tsx router: add 3 new routes (/dre, /balance-sheet, /cross-validation)
- Cross-validation page will call DRE + BP + trial balance services
- Phase 40 will activate the DFC↔BP invariant card

</code_context>

<specifics>
## Specific Ideas

- Toggle "Analise V/H" desligado por padrao — tabela limpa, liga para ver colunas extras
- Ranking por margem bruta so aparece em modo Consolidado (sem filtro CC)
- Cards de indicadores com mini-sparkline de tendencia (ultimos 6-12 periodos)
- Card DFC↔BP placeholder cinza com texto "Aguardando DFC (Phase 40)"
- Botao "Investigar" em invariante falho abre razao/balancete filtrado para debug

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 39-dre-balan-o-patrimonial-e-valida-o-cruzada*
*Context gathered: 2026-03-28*
