# Roadmap: Protos Farm — Fase 3: Módulos Administrativos

## Milestones

- ✅ **v1.0 Financeiro Base** — Phases 1-6 (shipped 2026-03-17)
- ✅ **v1.1 Gestão de Compras** — Phases 7-15 (all complete)
- ✅ **v1.2 Gestão de Patrimônio** — Phases 16-24 (all complete)
- ✅ **v1.3 RH e Folha de Pagamento Rural** — Phases 25-34 (shipped 2026-03-27)
- 🔵 **v1.4 Contabilidade e Demonstrações Financeiras** — Phases 35-41

## Phases

<details>
<summary>✅ v1.0 Financeiro Base (Phases 1-6) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Fundação Financeira (3/3 plans) — completed 2026-03-16
- [x] Phase 2: Núcleo AP/AR (7/7 plans) — completed 2026-03-16
- [x] Phase 3: Dashboard Financeiro (2/2 plans) — completed 2026-03-16
- [x] Phase 4: Instrumentos de Pagamento (7/7 plans) — completed 2026-03-17
- [x] Phase 5: Conciliação e Fluxo de Caixa (6/6 plans) — completed 2026-03-17
- [x] Phase 6: Crédito Rural (5/5 plans) — completed 2026-03-17

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Gestão de Compras (Phases 7-15) — COMPLETE</summary>

- [x] **Phase 7: Cadastro de Fornecedores** — Fundação do módulo: entidade raiz de todo o ciclo P2P (completed 2026-03-17)
- [x] **Phase 8: Requisição e Aprovação** — Entrada do ciclo: RC com fluxo de aprovação configurável por alçada (completed 2026-03-17)
- [x] **Phase 9: Cotação e Pedido de Compra** — Seleção de fornecedor e emissão formal da OC com PDF (completed 2026-03-19)
- [x] **Phase 10: Recebimento de Mercadorias** — Hub de integração: entrada no estoque + geração automática de CP (completed 2026-03-19)
- [x] **Phase 11: Devolução, Orçamento e Saving** — Reversão de estoque/financeiro e controle orçamentário (completed pre-GSD)
- [x] **Phase 12: Kanban, Dashboard e Notificações** — Visibilidade operacional e execução do fluxo completo (completed 2026-03-18)
- [x] **Phase 13: Kanban DnD Fixes + Notification Wiring** — Fix broken DnD transitions and wire notification dispatches (completed 2026-03-19)
- [x] **Phase 14: Stock Reversal + Supplier Rating Completion** — Stock reversal on goods return + rating alert and performance report (completed 2026-03-19)
- [x] **Phase 15: Frontend API Path Fixes** — Fix Kanban DnD orgId path mismatches, notification preferences route, and DAILY_DIGEST type (completed 2026-03-19)

</details>

<details>
<summary>✅ v1.2 Gestão de Patrimônio (Phases 16-24) — COMPLETE</summary>

- [x] **Phase 16: Cadastro de Ativos** — Entidade raiz do patrimônio: todas as fases dependem de um ativo cadastrado e classificado corretamente (completed 2026-03-20)
- [x] **Phase 17: Engine de Depreciação** — Cálculo mensal automático e rastreável, pré-requisito para ganho/perda na alienação (completed 2026-03-20)
- [x] **Phase 18: Manutenção e Ordens de Serviço** — CMMS completo com consumo de peças do estoque existente e classificação contábil obrigatória (completed 2026-03-22)
- [x] **Phase 19: Integração Financeira — Aquisição** — Compra à vista e financiada geram CP automaticamente sem contaminar o fluxo de recebimento de mercadorias (completed 2026-03-22)
- [x] **Phase 20: Alienação e Baixa de Ativos** — Venda, descarte, sinistro e transferência com cálculo automático de ganho/perda e geração de CR (completed 2026-03-22)
- [x] **Phase 21: Controle Operacional** — Combustível, documentos, horímetro e custo operacional por ativo (completed 2026-03-22)
- [x] **Phase 22: Hierarquia Avançada e Imobilizado em Andamento** — Ativo composto pai-filho, reforma/capitalização e obras em andamento (completed 2026-03-23)
- [x] **Phase 23: Relatórios e Dashboard Patrimonial** — Visão consolidada de TCO, depreciação acumulada e indicadores — leitura sobre dados produzidos pelas fases anteriores (completed 2026-03-23)
- [x] **Phase 24: Ativos Biológicos, Leasing e Features Avançadas** — CPC 29 fair value, CPC 06 leasing e troca de ativo com compensação financeira (completed 2026-03-23)

</details>

<details>
<summary>✅ v1.3 RH e Folha de Pagamento Rural (Phases 25-34) — SHIPPED 2026-03-27</summary>

- [x] Phase 25: Cadastro de Colaboradores e Contratos (4/4 plans) — completed 2026-03-24
- [x] Phase 26: Parâmetros de Folha e Motor de Cálculo (4/4 plans) — completed 2026-03-24
- [x] Phase 27: Controle de Ponto e Jornada (6/6 plans) — completed 2026-03-24
- [x] Phase 28: Processamento da Folha Mensal (6/6 plans) — completed 2026-03-25
- [x] Phase 29: Férias, Afastamentos, Rescisão e Provisões (5/5 plans) — completed 2026-03-25
- [x] Phase 30: Segurança do Trabalho Rural NR-31 (7/7 plans) — completed 2026-03-26
- [x] Phase 31: Obrigações Acessórias e eSocial (5/5 plans) — completed 2026-03-26
- [x] Phase 32: Integração Financeira, Contábil e Dashboard RH (5/5 plans) — completed 2026-03-26
- [x] Phase 33: Wire Employee Data to Safety Pages (1/1 plan) — completed 2026-03-26
- [x] Phase 34: Wire Absence Impact to Payroll Engine (2/2 plans) — completed 2026-03-27

Full details: `.planning/milestones/v1.3-ROADMAP.md`

</details>

### v1.4 Contabilidade e Demonstrações Financeiras (Phases 35-41)

> **Goal:** Implementar contabilidade completa com plano de contas rural, lançamentos automáticos/manuais, fechamento mensal e geração de DRE, BP e DFC com vinculação automática entre demonstrações.
>
> **Dependencies:** v1.0 Financeiro (CP/CR, conciliação bancária, fluxo de caixa), v1.2 Patrimônio (depreciação, ativos biológicos CPC 29), v1.3 RH/Folha (folha mensal, provisões, encargos), Estoque (entradas/saídas)

### Phase 35: Plano de Contas e Períodos Fiscais
**Goal:** Fundação contábil: COA hierárquico 5 níveis com template rural CFC/Embrapa, mapeamento SPED L300R, exercícios fiscais (calendário e safra), períodos contábeis com status, AccountBalance cache table, assertPeriodOpen() e assertBalanced() utilities, rateio() utility, frontend árvore expansível
**Requirements:** COA-01, COA-02, COA-03, COA-04, COA-05
**Models:** ChartOfAccount, FiscalYear, AccountingPeriod, AccountBalance
**Depends on:** nenhum (fundação)
**Success criteria:**
1. Contador pode criar/editar/desativar contas em árvore hierárquica até 5 níveis com validação de código único e tipo/natureza
2. Template rural pré-carregado com contas específicas agro (ativo biológico, culturas em formação, FUNRURAL, crédito rural)
3. Mapeamento SPED L300R por conta analítica com relatório de contas não mapeadas
4. Exercício fiscal criado (jan-dez ou safra jul-jun) com períodos mensais abertos automaticamente
5. Centro de custo vinculável a contas para DRE gerencial por cultura/fazenda

**Plans:** 4/4 plans complete
Plans:
- [x] 35-01-PLAN.md — Prisma schema models + shared accounting utilities (assertPeriodOpen, assertBalanced, rateio)
- [x] 35-02-PLAN.md — Chart of Accounts backend CRUD + rural CFC/Embrapa template seed + SPED L300R mapping
- [x] 35-03-PLAN.md — Fiscal periods backend: fiscal year CRUD + period state machine + audit trail
- [x] 35-04-PLAN.md — Frontend: COA expandable tree page + fiscal periods page + sidebar + routes


### Phase 36: Lançamentos Manuais, Razão e Saldo de Abertura
**Goal:** Motor de lançamento manual com partidas dobradas, estorno auditável, wizard de saldo de abertura pré-populado, razão contábil com saldo progressivo, balancete de verificação 3 colunas, livro diário; frontend com formulário multi-linha débito/crédito e templates
**Requirements:** LANC-03, LANC-04, LANC-05, RAZAO-01, RAZAO-02, RAZAO-03
**Models:** JournalEntry, JournalEntryLine
**Depends on:** Phase 35 (COA + períodos)
**Success criteria:**
1. Contador pode criar lançamento manual com N linhas débito/crédito, sistema rejeita se total débitos != total créditos
2. Estorno gera lançamento inverso vinculado ao original com motivo obrigatório e trail de auditoria
3. Wizard de saldo de abertura pré-popula com saldo bancário, CP/CR em aberto, valor líquido dos ativos, provisões
4. Razão por conta mostra saldo progressivo com drill-down para lançamento original
5. Balancete 3 colunas (saldo anterior, movimento, saldo atual) com totais por grupo e validação de equilíbrio

**Plans:** 4/5 plans executed
Plans:
- [x] 36-01-PLAN.md — Prisma migration (JournalEntry + JournalEntryLine) + journal-entries service (create/post/reverse/templates) + routes
- [x] 36-02-PLAN.md — Opening balance wizard backend: preview aggregation from 5 modules + post as OPENING_BALANCE entry
- [x] 36-03-PLAN.md — Ledger, trial balance, daily book services + PDF/CSV/XLSX exports + routes
- [ ] 36-04-PLAN.md — Frontend: JournalEntriesPage + JournalEntryModal + ReversalModal + OpeningBalanceWizard
- [x] 36-05-PLAN.md — Frontend: LedgerPage + TrialBalancePage (with daily book) + sidebar + routing

### Phase 37: Regras e Lançamentos Automáticos
**Goal:** Regras de lançamento por tipo de operação (mapeamento conta débito/crédito), PendingJournalPosting queue com BullMQ, GL hooks para: liquidação CP, recebimento CR, fechamento folha, depreciação, entrada/saída estoque; idempotência via UNIQUE(sourceType, sourceId)
**Requirements:** LANC-01, LANC-02, LANC-06
**Models:** AccountingRule, PendingJournalPosting
**Depends on:** Phase 36 (JournalEntry tables)
**Modifies:** payroll-runs, depreciation-runs, payables, receivables, stock-entries, stock-outputs
**Success criteria:**
1. Tela administrativa permite mapear tipo de operação → conta débito + crédito + template de histórico
2. Liquidação de CP, recebimento de CR, fechamento de folha, depreciação, entrada/saída de estoque geram lançamento GL automático
3. Re-processamento da mesma operação NÃO gera duplicata (constraint sourceType+sourceId)
4. Fila de pendências mostra lançamentos automáticos com status pendente/processado/erro

### Phase 38: Fechamento Mensal e Conciliação Contábil
**Goal:** Checklist de fechamento com consultas automáticas aos módulos, conciliação bancária contábil (razão vs extrato v1.0), bloqueio de período, reabertura controlada com auditoria
**Requirements:** FECH-01, FECH-02, FECH-03
**Depends on:** Phase 37 (auto-entries must be live)
**Success criteria:**
1. Checklist de 6+ etapas consulta automaticamente módulos (ponto, folha, depreciação, lançamentos pendentes, conciliação, balancete)
2. Conciliação bancária contábil compara razão GL vs extrato OFX/CSV importado
3. Período fechado bloqueia qualquer novo lançamento; reabertura exige papel administrador + motivo

### Phase 39: DRE, Balanço Patrimonial e Validação Cruzada
**Goal:** Pure calculator services (DreCalculatorService, BpCalculatorService) sem imports Prisma, DRE layout rural com CPC 29, análise V/H, comparativos, filtro por centro de custo; BP com classificação rural e indicadores; painel de vinculação DRE↔BP com 4 invariantes
**Requirements:** DRE-01, DRE-02, DRE-03, BP-01, BP-02, VINC-01
**Depends on:** Phase 38 (fechamento validates data)
**Success criteria:**
1. DRE gerada com layout rural incluindo seção dedicada CPC 29 (variação valor justo ativo biológico)
2. Análise vertical (% receita líquida) e horizontal (variação vs período anterior) calculadas
3. DRE filtrável por centro de custo (fazenda, cultura) para visão gerencial
4. BP com indicadores (liquidez corrente, endividamento, PL/ha) calculados automaticamente
5. Painel de vinculação com 4 invariantes (DRE↔BP, DFC↔BP, equilíbrio AT=PT+PL, balancete)

### Phase 40: DFC, Dashboard Executivo
**Goal:** DfcCalculatorService direto (reusar classificação v1.0) e indireto (CPC 03 R2), validação cruzada DFC↔BP, dashboard contábil executivo
**Requirements:** DFC-01, DFC-02, DFC-03, DASH-01
**Depends on:** Phase 39 (BP necessário para DFC indireto)
**Success criteria:**
1. DFC direto com 3 seções (operacional, investimento, financiamento) reaproveitando classificação v1.0
2. DFC indireto parte do lucro líquido DRE com ajustes não-caixa e variação capital de giro
3. Validação DFC↔BP (variação caixa DFC = variação caixa/bancos BP) com alerta divergência
4. Dashboard com resultado acumulado, evolução receita/despesa 12m, composição custos, indicadores BP

### Phase 41: SPED ECD e Relatório Integrado
**Goal:** SpedEcdWriter custom (pipe-delimited), blocos 0/I/J/9, pré-validação PVA, geração async via BullMQ; relatório integrado PDF (DRE+BP+DFC+notas) para crédito rural
**Requirements:** VINC-02, SPED-01, SPED-02
**Depends on:** Phase 40 (all statements must be correct)
**Success criteria:**
1. Arquivo SPED ECD gerado com blocos 0/I/J/9 usando plano referencial L300R rural
2. Pré-validação verifica contas mapeadas, períodos fechados, balancete equilibrado, I050 sem duplicatas
3. Relatório integrado PDF profissional com DRE+BP+DFC+notas explicativas para crédito rural

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-6 | v1.0 | 30/30 | Complete | 2026-03-17 |
| 7-15 | v1.1 | 37/37 | Complete | 2026-03-19 |
| 16-24 | v1.2 | 41/41 | Complete | 2026-03-23 |
| 25-34 | v1.3 | 45/45 | Complete | 2026-03-27 |
| 35-41 | v1.4 | 4/~35 | In Progress | — |

---
*Last updated: 2026-03-27 after Phase 36 planning*
