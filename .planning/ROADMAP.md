# Roadmap: Protos Farm — Financeiro Base

## Overview

O módulo financeiro base é construído em seis fases ordenadas por dependência de dados. A fundação (contas bancárias, tipo Money, producerId) deve existir antes de qualquer transação financeira ser gravada. O núcleo AP/AR é a operação diária do gerente. O dashboard entrega valor imediato assim que há dados. Os instrumentos de pagamento (transferências, cartões, cheques) estendem o núcleo. Conciliação e fluxo de caixa exigem histórico real de transações. Crédito rural é o diferenciador mais complexo e fica por último.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundação Financeira** - Contas bancárias, saldo real-time, extrato, tipo Money e producerId estabelecidos (completed 2026-03-16)
- [x] **Phase 2: Núcleo AP/AR** - Contas a pagar e receber com ciclo completo, baixa, aging e alertas (completed 2026-03-16)
- [ ] **Phase 3: Dashboard Financeiro** - Visão consolidada de saldo, CP/CR e resultado do mês
- [ ] **Phase 4: Instrumentos de Pagamento** - Transferências entre contas, cartões corporativos e cheques pré-datados
- [ ] **Phase 5: Conciliação e Fluxo de Caixa** - Import OFX/CSV com matching por score e projeção 12 meses
- [ ] **Phase 6: Crédito Rural** - Operações PRONAF/PRONAMP/Funcafé com cronograma SAC/Price/Bullet

## Phase Details

### Phase 1: Fundação Financeira

**Goal**: Gerente pode cadastrar contas bancárias vinculadas a fazenda e produtor rural, consultar saldo real-time e extrato — com a fundação técnica (tipo Money, producerId) que garante conformidade fiscal e aritmética correta para todo o módulo
**Depends on**: Nothing (first phase)
**Requirements**: FN-01, FN-03
**Success Criteria** (what must be TRUE):

1. Gerente consegue cadastrar conta bancária informando tipo (corrente/poupança/investimento/crédito rural), banco FEBRABAN, fazenda, produtor rural e saldo inicial — e todos os campos são salvos corretamente
2. Gerente consegue visualizar saldo atual de cada conta atualizado imediatamente após qualquer movimentação
3. Gerente consegue ver extrato de uma conta com filtro por período e exportar em PDF ou Excel
4. Dashboard de contas mostra todas as contas lado a lado com saldo atual e saldo projetado (7/15/30/60/90 dias)
5. Nenhum valor monetário no sistema usa aritmética de ponto flutuante nativo — todos os cálculos passam pelo tipo Money (decimal.js)

**Plans:** 3/3 plans complete

Plans:

- [ ] 01-01-PLAN.md — Money type, FEBRABAN bank list, Prisma schema e migration
- [ ] 01-02-PLAN.md — Backend module: CRUD, statement, export, dashboard endpoints
- [ ] 01-03-PLAN.md — Frontend: page com cards, modal, sidebar, statement view

### Phase 2: Núcleo AP/AR

**Goal**: Gerente pode registrar contas a pagar e a receber com parcelamento, rateio por centro de custo e FUNRURAL, dar baixa de pagamentos e recebimentos, e visualizar aging por faixas de vencimento com alertas configuráveis
**Depends on**: Phase 1
**Requirements**: FN-07, FN-08, FN-10, FN-11, FN-12
**Success Criteria** (what must be TRUE):

1. Gerente consegue lançar conta a pagar com fornecedor, categoria, forma de pagamento, conta bancária, parcelamento automático e rateio por múltiplos centros de custo — e os valores parcelas fecham sem erro de arredondamento
2. Gerente consegue dar baixa de pagamento com valor efetivo diferente do original (juros, multa ou desconto) e estornar pagamento já registrado
3. Gerente consegue gerar arquivo CNAB 240/400 de borderô de pagamentos e importar retorno bancário para baixa automática
4. Gerente consegue lançar conta a receber com cliente, categoria rural (venda grãos/gado/leite/arrendamento) e campo FUNRURAL preenchível
5. Gerente vê aging de CP por faixas 7/15/30/60/90/>90/vencidas e recebe alertas configuráveis antes do vencimento

**Plans:** 7/7 plans complete

Plans:

- [ ] 02-01-PLAN.md — Schema migration (AP/AR models + CNAB fields) e utilitarios compartilhados (installments, rateio)
- [ ] 02-02-PLAN.md — Payables backend: CRUD, parcelamento, rateio, settlement, batch, estorno, recorrencia
- [ ] 02-03-PLAN.md — Receivables backend: CRUD, FUNRURAL, settlement, renegociacao, aging
- [ ] 02-04-PLAN.md — CNAB module (BB + Sicoob adapters) e payables aging/calendario/alertas
- [ ] 02-05-PLAN.md — PayablesPage frontend: lista, aging, calendario, modais (CP, baixa, bordero, CNAB retorno)
- [ ] 02-06-PLAN.md — ReceivablesPage frontend: lista, aging, modais (CR, recebimento, renegociacao)
- [ ] 02-07-PLAN.md — Sidebar integration, rotas lazy, badge overdue e human-verify

### Phase 3: Dashboard Financeiro

**Goal**: Proprietário e gerente têm uma tela consolidada que mostra posição financeira completa da fazenda — saldo total, CP e CR próximos, resultado do mês e endividamento — assim que Phases 1 e 2 têm dados reais
**Depends on**: Phase 2
**Requirements**: FN-15
**Success Criteria** (what must be TRUE):

1. Proprietário vê saldo total consolidado de todas as contas bancárias na tela inicial do módulo financeiro
2. Dashboard mostra CP a vencer em 7 e 30 dias e CR esperado nos mesmos períodos — com valores corretos cross-checked contra as listas de CP/CR
3. Dashboard exibe resultado do mês (receitas realizadas menos despesas realizadas) e endividamento total atual
4. Comparativo com mesmo período do ano anterior é visível quando há dados históricos suficientes
5. Dashboard sempre distingue "saldo bancário real" de "saldo contábil" — nunca mistura os dois valores num único número

**Plans:** 2 plans

Plans:

- [ ] 03-01-PLAN.md — Backend: endpoint agregador GET /api/org/financial-dashboard (types, service, routes, spec)
- [ ] 03-02-PLAN.md — Frontend: FinancialDashboardPage com KPIs, graficos, top 5, alertas, sidebar e human-verify

### Phase 4: Instrumentos de Pagamento

**Goal**: Gerente pode registrar transferências entre contas (incluindo aplicações e resgates), controlar cartões corporativos com fatura que vira CP automaticamente, e rastrear cheques pré-datados com entidade própria e máquina de estados
**Depends on**: Phase 2
**Requirements**: FN-04, FN-02, FN-05, FN-09
**Success Criteria** (what must be TRUE):

1. Gerente consegue registrar transferência entre contas com tarifa e ver lançamentos espelhados nas duas contas envolvidas imediatamente
2. Gerente consegue cadastrar cartão corporativo com limite, dia de fechamento e conta de débito vinculada — e ver despesas lançadas contra o cartão organizadas por período de fatura
3. Fechamento de fatura do cartão gera automaticamente uma conta a pagar no módulo CP vinculada ao cartão
4. Gerente consegue registrar cheque pré-datado (emitido ou recebido) com data prevista de compensação e ver status (EMITIDO / A_COMPENSAR / COMPENSADO / DEVOLVIDO / CANCELADO) atualizado conforme ações
5. Saldo bancário real e saldo contábil divergem corretamente quando há cheques A_COMPENSAR — e o dashboard mostra ambos com labels distintos
   **Plans**: TBD

### Phase 5: Conciliação e Fluxo de Caixa

**Goal**: Gerente pode importar extrato bancário (OFX/CSV) e conciliar com lançamentos do sistema usando score de confiança, e visualizar projeção de fluxo de caixa de 12 meses com cenários e alerta de saldo negativo futuro
**Depends on**: Phase 4
**Requirements**: FN-06, FN-13
**Success Criteria** (what must be TRUE):

1. Gerente consegue importar arquivo OFX ou CSV do banco (incluindo arquivos em ISO-8859-1 com vírgula como separador decimal) e ver preview dos lançamentos antes de confirmar
2. Sistema apresenta cada linha do extrato com grau de confiança do match (exato / provável / sem match) usando critérios de valor, proximidade de data e tolerância FUNRURAL — e gerente pode aceitar, recusar ou vincular manualmente
3. Gerente visualiza fluxo de caixa projetado para os próximos 12 meses (não apenas 90 dias) com cenários otimista, realista e pessimista
4. Alerta de saldo negativo dispara nas datas futuras projetadas onde o saldo cairia abaixo de zero — não apenas na data atual
5. Projeção inclui cheques A_COMPENSAR na data prevista de compensação e parcelas de CP/CR em aberto nas suas datas de vencimento
   **Plans**: TBD

### Phase 6: Crédito Rural

**Goal**: Gerente pode cadastrar operações de crédito rural (PRONAF/PRONAMP/Funcafé/CPR) com cronograma automático de parcelas (SAC/Price/Bullet com carência), e as parcelas alimentam o fluxo de caixa projetado da Phase 5
**Depends on**: Phase 5
**Requirements**: FN-14
**Success Criteria** (what must be TRUE):

1. Gerente consegue cadastrar contrato de crédito rural informando linha (PRONAF/PRONAMP/Funcafé/CPR/livre), valor, taxa do Plano Safra, sistema de amortização e período de carência — e o cronograma de parcelas é gerado automaticamente com valores corretos
2. Parcelas geradas pelo contrato aparecem como contas a pagar no módulo CP com datas alinhadas ao calendário agrícola
3. Saldo devedor atualizado é visível após cada amortização, com discriminação de principal e juros pagos
4. Projeção de fluxo de caixa da Phase 5 inclui as parcelas futuras do crédito rural nas datas corretas
5. Gerente recebe alertas de vencimento de parcelas de crédito rural com antecedência configurável
   **Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase                           | Plans Complete | Status      | Completed  |
| ------------------------------- | -------------- | ----------- | ---------- |
| 1. Fundação Financeira          | 3/3            | Complete    | 2026-03-16 |
| 2. Núcleo AP/AR                 | 7/7            | Complete    | 2026-03-16 |
| 3. Dashboard Financeiro         | 0/2            | Not started | -          |
| 4. Instrumentos de Pagamento    | 0/TBD          | Not started | -          |
| 5. Conciliação e Fluxo de Caixa | 0/TBD          | Not started | -          |
| 6. Crédito Rural                | 0/TBD          | Not started | -          |
