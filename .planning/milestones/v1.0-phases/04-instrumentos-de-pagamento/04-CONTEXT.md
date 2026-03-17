# Phase 4: Instrumentos de Pagamento - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Transferências entre contas bancárias (incluindo aplicação/resgate de investimento) com tarifa opcional e lançamentos espelhados, cartões de crédito corporativos com despesas parceladas e fechamento manual de fatura gerando CP automaticamente, e cheques pré-datados (emitidos e recebidos) como entidade de primeira classe com máquina de estados e distinção saldo real vs contábil. Atualização do dashboard financeiro para refletir saldo contábil e alertas de cartão/cheque.

</domain>

<decisions>
## Implementation Decisions

### Transferências entre contas

- Tarifa como **campo opcional** na transferência — se preenchida, gera transação extra de débito na conta origem
- Tipo de transferência: enum (INTERNA, TED, APLICACAO, RESGATE) — aplicação/resgate são transferências entre conta corrente e conta investimento
- Transferência é entre **contas bancárias**, não entre fazendas — fazenda vem indiretamente da conta
- Visualização: **página dedicada** `/transfers` com histórico + aparece nos extratos das duas contas (ENTRADA na destino, SAÍDA na origem)

### Cartão corporativo e fatura

- Despesas parceladas: **registros separados** — despesa de R$1200 em 3x gera 3 registros de R$400, cada um na fatura do mês correspondente
- Fechamento de fatura: **manual com botão** — gerente clica "Fechar fatura" para gerar CP vinculado ao cartão. Permite revisar antes
- Rota e sidebar: item **"Cartões"** no grupo FINANCEIRO, rota `/credit-cards`
- CP gerado pelo fechamento de fatura usa categoria própria **CARTAO_CREDITO** — facilita filtro e relatórios
- Cadastro do cartão: bandeira, limite, dia de fechamento, dia de vencimento, conta de débito vinculada, portador

### Cheques pré-datados

- **Mesma entidade** com tipo: EMITIDO | RECEBIDO — máquina de estados compartilhada
- Estados: EMITIDO → A_COMPENSAR → COMPENSADO / DEVOLVIDO / CANCELADO
- Saldo real **só muda na compensação** — saldo contábil muda na emissão/recebimento
- Folha de cheques: **campo simples de número** (string livre, sem controle de sequência)
- Alertas: **badge no sidebar** + lista na página de cheques (mesmo padrão dos alertas de CP vencido)
- Rota: `/checks` no grupo FINANCEIRO

### Dashboard e saldo contábil

- KPI card "Saldo Total" mostra **saldo real (destaque) + saldo contábil abaixo** em cinza com label explícito. Tooltip explica diferença
- Fórmula: **saldo contábil = saldo real - cheques A_COMPENSAR emitidos + cheques A_COMPENSAR recebidos**
- Alertas expandidos: adicionar alertas de **fatura aberta** e **cheques próximos de compensar** no painel de alertas existente do dashboard

### Claude's Discretion

- Design exato da página de transferências (tabela, cards, filtros)
- Layout da página de cartões (lista de cartões + detalhamento de fatura)
- Design da página de cheques (lista com badges de status, filtros)
- Implementação do cálculo de saldo contábil no backend (novo campo ou computed)
- Responsividade das novas páginas em mobile

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Modelos financeiros existentes

- `apps/backend/src/modules/bank-accounts/bank-accounts.service.ts` — Padrão de BankAccountBalance update atômico
- `apps/backend/src/modules/bank-accounts/bank-accounts.types.ts` — Tipos de conta, FinancialTransaction pattern
- `apps/backend/src/modules/payables/payables.service.ts` — Padrão de criação de CP com parcelas, baixa, estorno
- `apps/backend/src/modules/payables/payables.types.ts` — Categorias de CP existentes (CARTAO_CREDITO será nova)

### Dashboard financeiro

- `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts` — Endpoint de agregação a atualizar com saldo contábil e alertas de cartão/cheque
- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — Página a atualizar com saldo contábil e novos alertas

### Sidebar e rotas

- `apps/frontend/src/components/layout/Sidebar.tsx` — Grupo FINANCEIRO existente para adicionar Cartões, Cheques, Transferências
- `apps/frontend/src/App.tsx` — Registro de rotas lazy

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Money` type (packages/shared): decimal.js wrapper para aritmética monetária
- `BankAccountBalance` aggregate: update atômico de saldo — reutilizar para transferências e compensação de cheques
- `FinancialTransaction` ledger: registrar lançamentos espelhados de transferência
- `PayablesPage` modal pattern: referência para modais de cartão, cheque e transferência
- `useOverdueCount` hook: padrão para badge de alertas no sidebar — reutilizar para cheques a compensar
- Recharts: já integrado para gráficos do dashboard

### Established Patterns

- Módulos backend colocalizados: `modules/{domain}/` com routes/service/types/spec
- Frontend: Page + Modal + CSS module + hook dedicado
- CRUD sempre em modal, nunca em página dedicada
- RLS por organização em todas as queries
- Sidebar com grupos e badges de contagem

### Integration Points

- `apps/backend/src/app.ts`: registrar transfersRouter, creditCardsRouter, checksRouter
- `apps/frontend/src/App.tsx`: rotas `/transfers`, `/credit-cards`, `/checks`
- Sidebar: adicionar 3 itens ao grupo FINANCEIRO (Transferências, Cartões, Cheques)
- Financial Dashboard endpoint: expandir com saldo contábil e alertas de cartão/cheque
- PayableCategory enum: adicionar CARTAO_CREDITO

</code_context>

<specifics>
## Specific Ideas

- Transferência espelhada: uma operação gera duas FinancialTransactions (débito na origem + crédito na destino) na mesma transação Prisma
- Fatura do cartão agrupa despesas pelo período entre fechamentos — ex: dia 15 do mês anterior ao dia 14 do mês atual
- Cheque devolvido deve gerar alerta e permitir re-apresentação (volta para A_COMPENSAR)
- Dashboard: tooltip no card de saldo deve explicar "Saldo bancário real não inclui cheques pendentes de compensação. Saldo contábil projeta o impacto dos cheques emitidos e recebidos ainda não compensados."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 04-instrumentos-de-pagamento_
_Context gathered: 2026-03-16_
