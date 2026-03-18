# Roadmap: Protos Farm — Fase 3: Módulos Administrativos

## Milestones

- ✅ **v1.0 Financeiro Base** — Phases 1-6 (shipped 2026-03-17)
- 🚧 **v1.1 Gestão de Compras** — Phases 7-12 (in progress)

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

### 🚧 v1.1 Gestão de Compras (In Progress)

**Milestone Goal:** Implementar o ciclo completo de procurement — da requisição de compra até o recebimento e geração automática de contas a pagar.

- [x] **Phase 7: Cadastro de Fornecedores** — Fundação do módulo: entidade raiz de todo o ciclo P2P (completed 2026-03-17)
- [x] **Phase 8: Requisição e Aprovação** — Entrada do ciclo: RC com fluxo de aprovação configurável por alçada (completed 2026-03-17)
- [ ] **Phase 9: Cotação e Pedido de Compra** — Seleção de fornecedor e emissão formal da OC com PDF
- [ ] **Phase 10: Recebimento de Mercadorias** — Hub de integração: entrada no estoque + geração automática de CP
- [ ] **Phase 11: Devolução, Orçamento e Saving** — Reversão de estoque/financeiro e controle orçamentário
- [ ] **Phase 12: Kanban, Dashboard e Notificações** — Visibilidade operacional e execução do fluxo completo

## Phase Details

### Phase 7: Cadastro de Fornecedores

**Goal**: Usuários podem cadastrar, buscar e avaliar fornecedores com dados fiscais válidos — tornando a entidade fornecedor disponível como raiz de todo o ciclo de compras
**Depends on**: Phase 6 (v1.0 completo — base financeira e módulo de produtos existentes)
**Requirements**: FORN-01, FORN-02, FORN-03
**Success Criteria** (what must be TRUE):

1. Gerente pode cadastrar fornecedor com CNPJ/CPF validado, dados fiscais, condição de pagamento padrão e status ativo/inativo/bloqueado
2. Gerente pode importar fornecedores via CSV/Excel e buscar por nome, CNPJ, categoria ou cidade
3. Gerente pode avaliar um fornecedor (prazo, qualidade, preço, atendimento) e ver o ranking automático por média ponderada
4. O sistema alerta ao iniciar cotação com fornecedor com rating abaixo de 3
5. Gerente pode exportar a listagem de fornecedores em CSV ou PDF
   **Plans:** 4/4 plans complete

Plans:

- [ ] 07-01-PLAN.md — Backend foundation: schema, types, RBAC, CRUD service+routes+tests
- [ ] 07-02-PLAN.md — Backend import/export/rating: file parser, CSV/PDF export, rating endpoints
- [ ] 07-03-PLAN.md — Frontend page + CRUD modal: types, hooks, SuppliersPage, SupplierModal, sidebar
- [ ] 07-04-PLAN.md — Frontend import/rating modals: SupplierImportModal, SupplierRatingModal, Top 3

### Phase 8: Requisição e Aprovação

**Goal**: Usuários podem criar requisições de compra e aprová-las por alçada de valor/tipo — com o fluxo de aprovação armazenando histórico auditável e disparando notificações
**Depends on**: Phase 7
**Requirements**: REQC-01, REQC-02, REQC-03
**Success Criteria** (what must be TRUE):

1. Usuário pode criar RC com tipo, itens do catálogo ou descrição livre, urgência, centro de custo e fazenda, recebendo número sequencial automático
2. Operador de campo pode criar RC simplificada via mobile com foto, funcionando offline com sincronização posterior
3. Gerente pode configurar alçadas de aprovação por valor e tipo, aprovar/rejeitar/devolver RCs pendentes e delegar temporariamente
4. Solicitante recebe notificação ao ter RC aprovada ou rejeitada, com histórico disponível para auditoria
5. Aprovador pode aprovar RC pelo mobile sem precisar acessar o desktop
   **Plans:** 6/6 plans complete

Plans:

- [ ] 08-01-PLAN.md — Backend foundation: Prisma schema (7 models), migration, types, state machine
- [ ] 08-02-PLAN.md — Backend RC CRUD: service, routes, sequential numbering, attachment upload, tests
- [ ] 08-03-PLAN.md — Backend approval rules + workflow transitions + notifications + tests
- [ ] 08-04-PLAN.md — Frontend RC page + modal: types, hooks, PurchaseRequestsPage, PurchaseRequestModal, sidebar
- [ ] 08-05-PLAN.md — Frontend detail modal + approval rules page + notification bell
- [ ] 08-06-PLAN.md — Mobile RC creation (offline) + my requests + pending approvals + push notifications

### Phase 9: Cotação e Pedido de Compra

**Goal**: Comprador pode solicitar cotações a múltiplos fornecedores, comparar propostas no mapa comparativo e emitir pedido de compra formal com PDF — com preços congelados no momento da emissão
**Depends on**: Phase 8
**Requirements**: COTA-01, COTA-02, COTA-03, PEDI-01
**Success Criteria** (what must be TRUE):

1. Comprador pode criar solicitação de cotação a partir de RC aprovada, selecionando fornecedores (com sugestão dos top 3 por categoria) e definindo prazo de resposta
2. Comprador pode registrar cotações recebidas e visualizar mapa comparativo com destaque de menor preço por item e cálculo de total com frete e impostos
3. Gerente pode aprovar a cotação vencedora com justificativa obrigatória quando não for o menor preço
4. Comprador pode emitir OC com número sequencial (OC-AAAA/NNNN), exportar PDF e enviar por email ao fornecedor
5. OC emitida reflete snapshot de preços da cotação aprovada (edição bloqueada após emissão)
   **Plans**: TBD

### Phase 10: Recebimento de Mercadorias

**Goal**: Conferente pode registrar o recebimento em 6 cenários distintos — com confirmação criando automaticamente entrada no estoque e conta a pagar de forma atômica e sem dupla entrada
**Depends on**: Phase 9
**Requirements**: RECE-01, RECE-02, RECE-03, FINC-01
**Success Criteria** (what must be TRUE):

1. Conferente pode registrar recebimento nos 6 cenários (NF+mercadoria simultânea, NF antecipada, mercadoria antecipada, parcial, NF fracionada, emergencial sem pedido)
2. Conferente pode conferir itens fisicamente, registrar divergências com foto e escolher ação (devolver/aceitar com desconto/registrar pendência)
3. Ao confirmar recebimento+NF, o sistema cria automaticamente entrada no estoque e conta a pagar com fornecedor, valor, vencimento e centro de custo corretos
4. CP gerado referencia a cadeia completa (pedido→cotação→requisição) com drill-down navegável
5. Recebimentos parciais geram CPs separados por entrega, sem duplicar o total do pedido
   **Plans**: TBD

### Phase 11: Devolução, Orçamento e Saving

**Goal**: Gerente pode registrar devoluções com reversão automática de estoque e crédito financeiro, controlar orçamento de compras por categoria, e visualizar análise de saving do período
**Depends on**: Phase 10
**Requirements**: DEVO-01, FINC-02, FINC-03
**Success Criteria** (what must be TRUE):

1. Gerente de estoque pode registrar devolução total ou parcial com motivo, fotos e ação esperada (troca/crédito/estorno), com saída automática do estoque e notificação ao fornecedor
2. Gerente financeiro pode definir orçamento de compras por categoria e período, acompanhando orçado vs requisitado vs comprado vs pago
3. O sistema alerta ao aprovar requisição ou pedido que ultrapasse o orçamento definido
4. Gerente pode ver saving por cotação (diferença maior preço vs vencedor) e saving acumulado por período
5. Gerente pode ver histórico de preço por produto e indicadores de ciclo (% compras com cotação formal, % emergenciais, prazo médio)
   **Plans**: TBD

### Phase 12: Kanban, Dashboard e Notificações

**Goal**: Comprador e gerente têm visibilidade total do fluxo de compras via kanban e dashboard executivo, com notificações em cada etapa relevante do processo
**Depends on**: Phase 11
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):

1. Comprador pode ver o kanban com colunas por etapa do ciclo (RC Pendente → Aprovada → Em Cotação → OC Emitida → Aguardando Entrega → Recebido → Pago), com drag & drop que executa ações reais
2. Gerente pode ver dashboard executivo com volume total, prazo médio do ciclo, % entrega no prazo, saving acumulado, e comparativo com período anterior
3. Participantes recebem notificações push/email/badge nas etapas relevantes (aprovação, rejeição, entrega confirmada, lembrete SLA)
4. Gerente pode configurar preferências de notificação por canal (push, email, badge)
   **Plans:** 2/5 plans executed

Plans:

- [ ] 12-01-PLAN.md — Backend foundation: schema (NotificationPreference), migration, notification types expansion, kanban endpoint
- [ ] 12-02-PLAN.md — Backend dashboard endpoint + notification preferences CRUD + digest cron
- [ ] 12-03-PLAN.md — Frontend kanban board with dnd-kit (DnD, ConfirmModal, filters)
- [ ] 12-04-PLAN.md — Frontend purchasing dashboard (KPIs, Recharts charts, alerts, drill-down)
- [ ] 12-05-PLAN.md — Frontend preferences page + NotificationBell expansion + Sidebar + route wiring

## Progress

| Phase                                | Milestone | Plans Complete | Status      | Completed  |
| ------------------------------------ | --------- | -------------- | ----------- | ---------- |
| 1. Fundação Financeira               | v1.0      | 3/3            | Complete    | 2026-03-16 |
| 2. Núcleo AP/AR                      | v1.0      | 7/7            | Complete    | 2026-03-16 |
| 3. Dashboard Financeiro              | v1.0      | 2/2            | Complete    | 2026-03-16 |
| 4. Instrumentos de Pagamento         | v1.0      | 7/7            | Complete    | 2026-03-17 |
| 5. Conciliação e Fluxo de Caixa      | v1.0      | 6/6            | Complete    | 2026-03-17 |
| 6. Crédito Rural                     | v1.0      | 5/5            | Complete    | 2026-03-17 |
| 7. Cadastro de Fornecedores          | 4/4       | Complete       | 2026-03-17  | -          |
| 8. Requisição e Aprovação            | 6/6       | Complete       | 2026-03-17  | -          |
| 9. Cotação e Pedido de Compra        | v1.1      | 0/TBD          | Not started | -          |
| 10. Recebimento de Mercadorias       | v1.1      | 0/TBD          | Not started | -          |
| 11. Devolução, Orçamento e Saving    | v1.1      | 0/TBD          | Not started | -          |
| 12. Kanban, Dashboard e Notificações | 2/5 | In Progress|  | -          |
