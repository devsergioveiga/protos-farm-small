# Phase 5: Conciliação e Fluxo de Caixa - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Gerente pode importar extrato bancário (OFX/CSV) e conciliar com lançamentos do sistema usando score de confiança, e visualizar projeção de fluxo de caixa de 12 meses com cenários e alerta de saldo negativo futuro.

Duas funcionalidades distintas em páginas separadas: Conciliação Bancária (`/reconciliation`) e Fluxo de Caixa (`/cashflow`).

</domain>

<decisions>
## Implementation Decisions

### Import e Parsing OFX/CSV

- Seleção de conta: **auto-detect pelo OFX** (BANKID+ACCTID), com **fallback para dropdown** se não conseguir identificar
- Duplicatas em re-import: **detecta e pula** — compara por data+valor+descrição, importa apenas novos. Permite re-import parcial
- CSV: **auto-detect de colunas + confirmação** — sistema sugere mapeamento, gerente confirma ou ajusta no preview
- Preview: **tabela com checkbox** — todas linhas selecionadas por padrão, gerente desmarca as que não quer importar
- Histórico de imports: **sim, tabela de imports** com metadata (data, arquivo original, quem importou, quantas linhas)
- Formato OFX: suportar **ambos OFX 1.x (SGML) e 2.x (XML)**
- Limite: **até 5.000 linhas** por arquivo
- Parsing: **backend** — upload via multipart, parsing no servidor. Suporta encoding ISO-8859-1 nativo
- Encoding CSV: suportar **ISO-8859-1 com vírgula como separador decimal** (padrão de bancos brasileiros)

### Matching e Conciliação

- Score de confiança: **3 níveis** — EXATO (≥ 95%): valor idêntico + data ±1 dia. PROVÁVEL (70-94%): valor próximo + data ±5 dias. SEM MATCH (< 70%)
- Tolerância FUNRURAL: **sem tolerância especial** — valor líquido recebido no extrato deve bater exato com o lançamento no sistema (descontos já devem estar registrados como lançamentos separados)
- UI de conciliação: **lista única com ações inline** — cada linha do extrato mostra match sugerido ao lado, com botões Aceitar/Recusar/Vincular. Agrupado por grau de confiança
- Vínculo manual: busca em **CP + CR + Transferências** por valor/descrição/data
- Itens sem match: **ficam pendentes** na conta com status PENDENTE. Gerente pode voltar e conciliar depois. Filtro por status
- Flag conciliado: **sim** — campo booleano `reconciled` em Payable/Receivable. Útil para relatórios e filtros
- Conciliação parcial: **N:N** — uma linha do extrato pode conciliar com vários lançamentos e vice-versa. Soma dos valores deve bater
- Relatório: **CSV + PDF** — resumo com totais conciliados, pendentes e descasados

### Projeção de Fluxo de Caixa

- Gráfico: **linha com área** — linha do saldo projetado com área preenchida. 3 linhas para cenários (otimista/realista/pessimista). Zona vermelha abaixo de zero. Recharts
- Cenários: **percentual sobre realista** — Realista = CP/CR agendados + cheques + parcelas. Otimista = +10% receitas, -5% despesas. Pessimista = -10% receitas, +15% despesas
- Alerta saldo negativo: **banner na página + card no dashboard** — banner de alerta na página de fluxo de caixa quando há data com saldo < 0. Card de alerta no dashboard financeiro
- Recorrências: **sim, projeta recorrências** — inclui parcelas futuras de CP/CR recorrentes na projeção
- Classificação DFC: **sim** — agrupar entradas/saídas por Operacional, Investimento, Financiamento
- Filtro por fazenda: **mesmo padrão do dashboard** — dropdown com "Todas as fazendas" padrão
- Export: **PDF + Excel** — PDF para apresentação, Excel para análise
- Gráfico interativo: **sim, tooltip com detalhes** — hover mostra saldo, entradas previstas, saídas previstas, cheques pendentes
- Projeção inclui: cheques A_COMPENSAR na data prevista + parcelas de CP/CR em aberto nas datas de vencimento

### Layout e Navegação

- Páginas: **separadas** — `/reconciliation` e `/cashflow` como rotas distintas
- Sidebar: **no grupo FINANCEIRO existente** — junto com Contas, CP, CR, Transferências, Cartões, Cheques
- Estado inicial conciliação: **histórico de imports** — lista de imports anteriores + botão "Novo Import". Clicar em import abre conciliação daquela sessão
- Alerta dashboard: **novo card de alerta** — "Saldo negativo previsto em [data]" no painel de alertas do dashboard, ao lado dos alertas existentes

### Permissões e Auditoria

- Permissão: **específica** — nova permissão `reconciliation:manage` separada do financeiro geral
- Auditoria: segue padrão existente com `logAudit`

### Performance

- Projeção: **sob demanda** — calcula ao abrir a página. Sempre atualizado, sem cache

### Edge Cases

- Estornos: **lançamento negativo** — estorno aparece como valor negativo no import. Match automático com lançamento original se possível
- Re-import de período sobreposto: detecta duplicatas e importa apenas novos

### Mobile

- **Apenas visualização** — ver fluxo de caixa e status de conciliação no app. Import/conciliação só no desktop

### Claude's Discretion

- Parser OFX 1.x (SGML): escolher entre biblioteca existente ou parser custom
- Algoritmo de scoring para matching
- Design exato das tabelas e cards de conciliação
- Implementação do gráfico de projeção com Recharts
- Layout responsivo das páginas

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Módulos financeiros existentes

- `apps/backend/src/modules/bank-accounts/` — CRUD de contas bancárias, BankAccountBalance
- `apps/backend/src/modules/payables/` — CP com categorias, parcelas, recorrência
- `apps/backend/src/modules/receivables/` — CR com categorias e parcelas
- `apps/backend/src/modules/transfers/` — Transferências com ledger entries espelhadas
- `apps/backend/src/modules/checks/` — Cheques com state machine e compensação
- `apps/backend/src/modules/credit-cards/` — Cartões, despesas, faturas, bill closure → CP
- `apps/backend/src/modules/financial-dashboard/` — Dashboard com KPIs, alertas, saldo contábil

### Frontend financeiro

- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — Dashboard com alertas existentes
- `apps/frontend/src/components/layout/Sidebar.tsx` — Grupo FINANCEIRO no sidebar
- `apps/frontend/src/hooks/useFinancialDashboard.ts` — Hook do dashboard

### Padrões de referência

- `apps/backend/src/modules/cnab/` — Pattern de import de arquivo com parser (CNAB retorno)
- `apps/backend/src/modules/payables/payables.types.ts` — PayableCategory enum, campo reconciled a ser adicionado

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Recharts` — já instalado e usado no dashboard financeiro para gráficos de barras e pizza
- `pdfkit` — usado em receituário agronômico e outros exports PDF
- `exceljs` — usado em exports Excel em vários módulos
- `multer` — já configurado para upload em CNAB retorno, pattern reutilizável
- `useFinancialDashboard` hook — pattern de data fetching com filtro de fazenda
- Padrão de módulo backend: `types.ts` + `service.ts` + `routes.ts` + `routes.spec.ts`

### Established Patterns

- Upload multipart com multer (CNAB retorno)
- Auditoria com `logAudit` em todas operações financeiras
- Permissões granulares via RBAC (`hasPermission`)
- Money type (decimal.js) para toda aritmética financeira
- Filtro de fazenda como dropdown local (não FarmContext global) no dashboard

### Integration Points

- `App.tsx` — lazy import + Route registration
- `Sidebar.tsx` — itens no grupo FINANCEIRO
- `FinancialDashboardPage.tsx` — novo card de alerta de saldo negativo
- `financial-dashboard.service.ts` — endpoint para alerta de saldo negativo projetado
- Prisma schema — novos modelos BankStatementImport, BankStatementLine, Reconciliation

</code_context>

<specifics>
## Specific Ideas

- Conciliação N:N: a soma dos valores vinculados deve bater com o valor da linha do extrato
- Classificação DFC segue padrão contábil: Operacional (vendas, compras, salários), Investimento (máquinas, terras), Financiamento (empréstimos, financiamentos)
- Cenários de projeção com percentuais fixos: otimista (+10% receita, -5% despesa), pessimista (-10% receita, +15% despesa)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 05-concilia-o-e-fluxo-de-caixa_
_Context gathered: 2026-03-16_
