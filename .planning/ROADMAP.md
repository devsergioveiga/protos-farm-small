# Roadmap: Protos Farm — Fase 3: Módulos Administrativos

## Milestones

- ✅ **v1.0 Financeiro Base** — Phases 1-6 (shipped 2026-03-17)
- ✅ **v1.1 Gestão de Compras** — Phases 7-15 (all complete)
- ✅ **v1.2 Gestão de Patrimônio** — Phases 16-24 (all complete)
- ✅ **v1.3 RH e Folha de Pagamento Rural** — Phases 25-34 (shipped 2026-03-27)

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

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-6 | v1.0 | 30/30 | Complete | 2026-03-17 |
| 7-15 | v1.1 | 37/37 | Complete | 2026-03-19 |
| 16-24 | v1.2 | 41/41 | Complete | 2026-03-23 |
| 25-34 | v1.3 | 45/45 | Complete | 2026-03-27 |

---
*Last updated: 2026-03-27 after v1.3 milestone completion*
