# Phase 3: Dashboard Financeiro - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard consolidado de saúde financeira: 4 KPIs (saldo total, CP 30d, CR 30d, resultado do mês), gráfico de evolução receitas vs despesas + pizza top categorias, cards ranqueados de top 5 despesas e receitas, comparativo com ano anterior, e alertas (vencidos, saldo negativo projetado, faturas cartão). Read-only — consome dados de contas bancárias, CP e CR já implementados.

</domain>

<decisions>
## Implementation Decisions

### Layout e KPIs

- **4 cards KPI no topo**: Saldo total | CP próximos 30d | CR próximos 30d | Resultado do mês
- Cada card mostra **% variação vs mesmo mês ano anterior** (seta verde ↑ / vermelha ↓ + percentual)
- Se não houver dados do ano anterior, mostrar **"—"** onde seria o comparativo

### Gráficos

- **Gráfico de barras**: receitas vs despesas por mês (Recharts já instalado no projeto)
- **Gráfico de pizza**: top 5 categorias de despesa com percentual
- Ambos respondem ao filtro de fazenda e período

### Top 5 Despesas e Receitas

- **Cards ranqueados** com ranking visual (1º, 2º...) e barra de progresso relativa
- Top 5 despesas por categoria | Top 5 clientes por receita
- Lado a lado em desktop, empilhados em mobile

### Comparativo Ano Anterior

- **% variação nos cards KPI** — seta + percentual no próprio card
- Sem gráfico sobreposto (mantém visual limpo)
- Dados insuficientes: mostrar "—" (traço), nunca esconder o espaço

### Filtros e Período

- Período padrão: **mês atual** (abre com mês corrente selecionado)
- Filtro por fazenda: **dropdown com "Todas as fazendas"** como padrão (consolida quando "Todas")
- Não usar FarmContext global — filtro local no dashboard para flexibilidade

### Rota e Navegação

- Dashboard é a **home do módulo financeiro** — primeira página ao acessar o grupo FINANCEIRO
- Rota: `/financial-dashboard` (ou path que fizer sentido como landing page)
- Sidebar: adicionar item "Dashboard" como primeiro item do grupo FINANCEIRO (antes de Contas bancárias)

### Claude's Discretion

- Alertas: quais alertas mostrar e formato (vencidos, saldo negativo projetado, faturas cartão)
- Design exato dos cards KPI (tamanho, ícones, cores)
- Responsividade dos gráficos em mobile
- Período seletor: dropdown (Mês atual / Mês anterior / Último trimestre) vs date picker

</decisions>

<canonical_refs>

## Canonical References

No external specs — requirements fully captured in decisions above and in REQUIREMENTS.md FN-15.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Recharts` (recharts 3.7.0): já instalado e usado em outros dashboards — BarChart, PieChart disponíveis
- `Money` type: toBRL() para formatação de valores nos KPIs
- `BankAccountsPage` cards pattern: reutilizar estilo de cards com totalização
- `PayablesPage` aging table: referência para tabelas de resumo
- `useBankAccountDashboard` hook: padrão para hook de dashboard (fetch + state)
- Export pattern (pdfkit/exceljs): se export do dashboard for necessário

### Established Patterns

- Dashboard org existente (`DashboardPage`): referência de layout para dashboards
- Frontend pages com CSS modules: `{Page}.tsx` + `{Page}.css`
- Skeleton loading para cards e gráficos

### Integration Points

- Backend: novo endpoint `GET /api/org/financial-dashboard` que agrega dados de bank-accounts, payables, receivables
- Frontend: `apps/frontend/src/App.tsx` — nova rota lazy
- Sidebar: adicionar "Dashboard" como primeiro item do grupo FINANCEIRO

</code_context>

<specifics>
## Specific Ideas

- Dashboard deve sempre distinguir "saldo bancário real" de "saldo contábil" — nunca misturar (sucesso criterion 5 do ROADMAP)
- Resultado do mês = receitas realizadas (CR baixados) - despesas realizadas (CP baixados) — prévia de DRE
- Endividamento total = soma dos saldos devedores de crédito rural (quando Phase 6 existir, por agora pode ser omitido ou mostrar 0)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 03-dashboard-financeiro_
_Context gathered: 2026-03-16_
