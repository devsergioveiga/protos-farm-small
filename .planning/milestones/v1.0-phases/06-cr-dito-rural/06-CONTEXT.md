# Phase 6: Crédito Rural - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Gerente pode cadastrar operações de crédito rural (PRONAF/PRONAMP/Funcafé/CPR/crédito livre) com cronograma automático de parcelas (SAC/Price/Bullet com carência), saldo devedor atualizado, e as parcelas alimentam o fluxo de caixa projetado da Phase 5. Inclui amortização extraordinária, alertas de vencimento e card no dashboard financeiro.

</domain>

<decisions>
## Implementation Decisions

### Modelo de contrato e parcelas

- **RuralCreditContract** como entidade própria (modelo Prisma separado) que GERA Payables automaticamente
- Cada parcela vira um **Payable real** com category=FINANCING + PayableInstallment — aparece na listagem de CP, aging, CNAB, fluxo de caixa automaticamente
- Baixa de parcela segue o fluxo padrão de CP existente
- Preview obrigatório: botão **"Simular"** no modal de cadastro mostra tabela com todas as parcelas (número, data, principal, juros, total, saldo devedor) antes de confirmar
- **Amortização extraordinária** com recálculo: botão permite pagar valor adicional, recalcula parcelas restantes (gerente escolhe reduzir valor ou prazo)
- **Discriminação principal vs juros** visível tanto na tela do contrato quanto na parcela do CP
- Campo **"Número do contrato"** (texto livre) para referência do código do banco
- **Sempre editável**: parcelas futuras recalculadas, parcelas pagas mantidas no histórico
- **Fazenda + conta bancária obrigatórios** — parcelas herdam a conta bancária do contrato
- **Data de liberação com transação**: registra crédito na conta bancária como FinancialTransaction de entrada, atualiza BankAccountBalance
- Campo **"Observações"** textarea para anotações livres (garantia, condições, contato)
- **Status automático**: ATIVO → QUITADO (todas parcelas pagas, automático), ATIVO → INADIMPLENTE (parcela vencida > N dias, automático), CANCELADO (manual)
- **IOF e TAC**: campos manuais opcionais (Decimal) — gerente informa o que o banco cobrou
- **Cancelamento**: cancela parcelas PENDING automaticamente, mantém parcelas já pagas (histórico). Saldo devedor vai a zero
- **Garantia**: campo texto livre para descrição (ex: "Penhor de safra 2025/2026 - soja 500ha")

### Carência

- **Juros capitalizam** durante carência — juros calculados e adicionados ao saldo devedor (padrão crédito rural brasileiro)
- Primeira parcela após carência inclui saldo corrigido com juros capitalizados

### Linhas de crédito e taxas

- **Enum fixo**: PRONAF, PRONAMP, FUNCAFE, CPR, CREDITO_LIVRE — cobre 99% dos casos
- **Taxa fixa** no contrato (% a.a.) — valor definido na assinatura do contrato, não atualiza
- **Vencimentos configuráveis**: gerente define dia do vencimento + mês da primeira parcela. Pode alinhar com pós-colheita. Parcelas mensais a partir daí. Carência desloca a primeira parcela
- **CPR como financeiro puro** nesta fase — entrega física de produto fica para módulo de comercialização futura

### UI do contrato

- **Página própria** na sidebar: "Crédito Rural" no grupo FINANCEIRO, rota `/rural-credit`
- **Lista de contratos com cards**: cada card mostra linha de crédito, banco, valor total, saldo devedor, próxima parcela (data + valor), status badge
- **Página dedicada para detalhe**: rota `/rural-credit/:id` com header do contrato + tabs (Cronograma, Amortizações, Histórico)
- **Cadastro/edição em modal** (padrão do projeto conforme CLAUDE.md)
- **Alertas**: badge no item "Crédito Rural" da sidebar (como CP faz com vencidos) + card de alerta no dashboard financeiro
- **Antecedência configurável por contrato**: campo `alertDaysBefore` com default 15 dias

### Integração com fluxo de caixa

- **Nenhum tratamento especial** no cashflow — parcelas são Payables com category=FINANCING, já incluídas na projeção e classificadas como DFC Financiamento automaticamente
- **Liberação via FinancialTransaction** — entrada na conta bancária, cashflow já captura via BankAccountBalance
- **Card dedicado no dashboard** financeiro: total contratado, saldo devedor total, próxima parcela

### Saldo devedor

- **Atualizado na baixa** de cada parcela — trigger atualiza saldo devedor do contrato (subtrai principal, registra juros pagos)
- Tela do contrato mostra evolução: principal amortizado, juros pagos, saldo devedor atual

### Claude's Discretion

- Algoritmo exato de cálculo SAC/Price/Bullet com carência capitalizada
- Design das tabelas de cronograma e amortizações
- Layout responsivo dos cards de contrato
- Implementação do gráfico de evolução de saldo devedor (se aplicável)
- Quantos dias de atraso configuram INADIMPLENTE (sugestão: 30 dias)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Módulos financeiros existentes (padrões de integração)

- `apps/backend/src/modules/payables/` — Payable + PayableInstallment, generateInstallments pattern, baixa com juros/multa, aging
- `apps/backend/src/modules/payables/payables.service.ts` — createPayable, settlePayableInstallment, padrão de geração de parcelas
- `apps/backend/src/modules/bank-accounts/` — BankAccountBalance, FinancialTransaction, padrão de registro de transações
- `apps/backend/src/modules/cashflow/cashflow.service.ts` — Como cashflow consulta PayableInstallments (linhas 100-123)
- `apps/backend/src/modules/cashflow/cashflow.types.ts` — PAYABLE_DFC_MAP com FINANCING → FINANCIAMENTO
- `apps/backend/src/modules/financial-dashboard/` — Dashboard cards, padrão de alertas

### Schema Prisma

- `apps/backend/prisma/schema.prisma` — PayableCategory enum (já tem FINANCING), PayableInstallment model, Payable model

### Frontend padrões

- `apps/frontend/src/pages/PayablesPage.tsx` — Padrão de listagem financeira com tabs, modais, aging
- `apps/frontend/src/components/layout/Sidebar.tsx` — Grupo FINANCEIRO, padrão de badge de alertas
- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — Dashboard cards, padrão de alertas

### Shared

- `packages/shared/src/utils/money.ts` — Money factory function para aritmética decimal segura

### Design System

- `docs/design-system/04-componentes.md` — Formulários em modal, cards, tabelas
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, erros humanos

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `Money()` factory function — aritmética decimal.js para todos os cálculos financeiros
- `generateInstallments()` em payables.service.ts — padrão de geração de parcelas com UTC dates
- `settlePayableInstallment()` — padrão de baixa com juros/multa/desconto e atualização de BankAccountBalance
- `withRlsContext()` — RLS multitenancy em todas as queries
- `logAudit()` — padrão de auditoria
- `usePayables` hook — padrão de hooks financeiros com paginação e filtros
- `PayablesPage` — padrão de tabs + modals + aging para listagem financeira

### Established Patterns

- Backend: módulos colocalizados (`modules/{domínio}/controller+service+routes+types+spec`)
- RBAC: `financial:create/read/update/delete` PermissionModule — crédito rural pode reutilizar
- Payable category FINANCING já existe no enum
- BankAccountBalance atualizado atomicamente via Prisma transaction
- FinancialTransaction para registro de movimentações
- Frontend: modal para criação/edição, páginas dedicadas para listagem, breadcrumb em toda página

### Integration Points

- `PayableCategory.FINANCING` — parcelas de crédito rural usam esta categoria
- `PayableInstallment` — parcelas alimentam cashflow automaticamente
- `FinancialTransaction` — liberação do crédito gera entrada na conta
- `BankAccountBalance` — saldo atualizado na liberação e na baixa de parcelas
- `Sidebar.tsx` grupo FINANCEIRO — novo item "Crédito Rural"
- `FinancialDashboardPage` — novo card de saldo devedor total
- `App.tsx` — nova rota lazy `/rural-credit` e `/rural-credit/:id`

</code_context>

<specifics>
## Specific Ideas

- Amortização SAC: parcelas de principal constantes, juros decrescentes. Price: parcelas totais constantes (PMT). Bullet: principal integral no vencimento, juros periódicos
- Carência capitalizada é padrão do crédito rural brasileiro (MCR do BCB)
- O botão "Simular" antes de salvar evita erros — gerente vê exatamente o cronograma antes de confirmar
- Cards de contrato devem mostrar status badge com cores: ATIVO (verde), QUITADO (cinza), INADIMPLENTE (vermelho), CANCELADO (cinza escuro)
- Na página de detalhe, tab "Cronograma" mostra tabela com: parcela, data, principal, juros, total, saldo devedor, status (paga/pendente/vencida)

</specifics>

<deferred>
## Deferred Ideas

- CPR com entrega física de produto — módulo de comercialização futura
- Tabela de taxas vigentes do Plano Safra por ano-safra — manutenção anual complexa
- Cálculo automático de IOF — requer tabelas de alíquotas fiscais atualizadas
- Templates de vencimento por cultura agrícola (soja fev-mar, café jun-jul)

</deferred>

---

_Phase: 06-cr-dito-rural_
_Context gathered: 2026-03-17_
