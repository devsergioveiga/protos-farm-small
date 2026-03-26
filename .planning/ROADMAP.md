# Roadmap: Protos Farm — Fase 3: Módulos Administrativos

## Milestones

- ✅ **v1.0 Financeiro Base** — Phases 1-6 (shipped 2026-03-17)
- ✅ **v1.1 Gestão de Compras** — Phases 7-15 (all complete)
- ✅ **v1.2 Gestão de Patrimônio** — Phases 16-24 (all complete)
- 🚧 **v1.3 RH e Folha de Pagamento Rural** — Phases 25-32 (in progress)

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

### 🚧 v1.3 RH e Folha de Pagamento Rural (Active)

**Milestone Goal:** Implementar o ciclo completo de gestão de pessoas em fazendas — cadastro e contratos, controle de ponto e jornada rural, folha de pagamento com particularidades do trabalhador rural (Lei 5.889/73, NR-31), férias, 13º, rescisão, eSocial, segurança do trabalho e integração bidirecional com os módulos financeiro e contábil.

- [x] **Phase 25: Cadastro de Colaboradores e Contratos** — Fundação do módulo RH: entidade colaborador com todos os dados trabalhistas, contratuais e pessoais exigidos pela legislação e pelo eSocial (completed 2026-03-24)
- [x] **Phase 26: Parâmetros de Folha e Motor de Cálculo** — Engine de cálculo brasileiro customizado: rubricas configuráveis, tabelas INSS/IRRF progressivas, FUNRURAL rural, moradia/alimentação — motor que alimenta todo o processamento de folha (completed 2026-03-24)
- [x] **Phase 27: Controle de Ponto e Jornada** — Pipeline de horas: registro mobile/web, apontamento por atividade/operação com rateio por CC, cálculo de HE/noturno rural, banco de horas, aprovação do espelho (completed 2026-03-24)
- [x] **Phase 28: Processamento da Folha Mensal** — Core value: folha em lote com holerite PDF, adiantamento salarial, 13º salário — o ciclo mensal completo do processamento de folha (completed 2026-03-25)
- [x] **Phase 29: Férias, Afastamentos, Rescisão e Provisões** — Ciclo de vida trabalhista: férias com fracionamento, afastamentos/CAT, rescisão com TRCT, provisão mensal de férias e 13º com lançamento contábil (completed 2026-03-25)
- [ ] **Phase 30: Segurança do Trabalho Rural (NR-31)** — Conformidade legal NR-31: EPIs com ficha de entrega, treinamentos obrigatórios com matriz de validade, ASO/PCMSO com alertas de vencimento
- [ ] **Phase 31: Obrigações Acessórias e eSocial** — Compliance fiscal e trabalhista: guias de recolhimento (FGTS/INSS/IRRF/FUNRURAL), eventos eSocial em XML com transmissão digital, RAIS e informe de rendimentos
- [ ] **Phase 32: Integração Financeira, Contábil e Dashboard RH** — Fechamento do ciclo: folha→Contas a Pagar com rateio por CC, lançamentos contábeis por regime de competência, dashboard de custo de pessoal e KPIs de RH

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

1. ✅ Comprador pode criar solicitação de cotação a partir de RC aprovada, selecionando fornecedores (com sugestão dos top 3 por categoria) e definindo prazo de resposta
2. ✅ Comprador pode registrar cotações recebidas e visualizar mapa comparativo com destaque de menor preço por item e cálculo de total com frete e impostos
3. ✅ Gerente pode aprovar a cotação vencedora com justificativa obrigatória quando não for o menor preço
4. ✅ Comprador pode emitir OC com número sequencial (OC-AAAA/NNNN), exportar PDF e enviar por email ao fornecedor
5. ✅ OC emitida reflete snapshot de preços da cotação aprovada (edição bloqueada após emissão)
   **Plans**: Pre-GSD (implemented before roadmap tracking) — 40+ quotation tests, 40+ PO tests

### Phase 10: Recebimento de Mercadorias

**Goal**: Conferente pode registrar o recebimento em 6 cenários distintos — com confirmação criando automaticamente entrada no estoque e conta a pagar de forma atômica e sem dupla entrada
**Depends on**: Phase 9
**Requirements**: RECE-01, RECE-02, RECE-03, FINC-01
**Success Criteria** (what must be TRUE):

1. ✅ Conferente pode registrar recebimento nos 6 cenários (NF+mercadoria simultânea, NF antecipada, mercadoria antecipada, parcial, NF fracionada, emergencial sem pedido)
2. ✅ Conferente pode conferir itens fisicamente, registrar divergências com foto e escolher ação (devolver/aceitar com desconto/registrar pendência)
3. ✅ Ao confirmar recebimento+NF, o sistema cria automaticamente entrada no estoque e conta a pagar com fornecedor, valor, vencimento e centro de custo corretos
4. ✅ CP gerado referencia a cadeia completa (pedido→cotação→requisição) com drill-down navegável
5. ✅ Recebimentos parciais geram CPs separados por entrega, sem duplicar o total do pedido
   **Plans**: Pre-GSD (implemented before roadmap tracking) — 27 backend tests

### Phase 11: Devolução, Orçamento e Saving

**Goal**: Gerente pode registrar devoluções com reversão automática de estoque e crédito financeiro, controlar orçamento de compras por categoria, e visualizar análise de saving do período
**Depends on**: Phase 10
**Requirements**: DEVO-01, FINC-02, FINC-03
**Success Criteria** (what must be TRUE):

1. ✅ Gerente de estoque pode registrar devolução total ou parcial com motivo, fotos e ação esperada (troca/crédito/estorno), com saída automática do estoque e notificação ao fornecedor
2. ✅ Gerente financeiro pode definir orçamento de compras por categoria e período, acompanhando orçado vs requisitado vs comprado vs pago
3. ✅ O sistema alerta ao aprovar requisição ou pedido que ultrapasse o orçamento definido
4. ✅ Gerente pode ver saving por cotação (diferença maior preço vs vencedor) e saving acumulado por período
5. ✅ Gerente pode ver histórico de preço por produto e indicadores de ciclo (% compras com cotação formal, % emergenciais, prazo médio)
   **Plans**: Pre-GSD (implemented before roadmap tracking) — 221 backend tests (89 returns + 69 budgets + 63 saving)

### Phase 12: Kanban, Dashboard e Notificações

**Goal**: Comprador e gerente têm visibilidade total do fluxo de compras via kanban e dashboard executivo, com notificações em cada etapa relevante do processo
**Depends on**: Phase 11
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):

1. Comprador pode ver o kanban com colunas por etapa do ciclo (RC Pendente → Aprovada → Em Cotação → OC Emitida → Aguardando Entrega → Recebido → Pago), com drag & drop que executa ações reais
2. Gerente pode ver dashboard executivo com volume total, prazo médio do ciclo, % entrega no prazo, saving acumulado, e comparativo com período anterior
3. Participantes recebem notificações push/email/badge nas etapas relevantes (aprovação, rejeição, entrega confirmada, lembrete SLA)
4. Gerente pode configurar preferências de notificação por canal (push, email, badge)
   **Plans:** 5/5 plans complete

Plans:

- [ ] 12-01-PLAN.md — Backend foundation: schema (NotificationPreference), migration, notification types expansion, kanban endpoint
- [ ] 12-02-PLAN.md — Backend dashboard endpoint + notification preferences CRUD + digest cron
- [ ] 12-03-PLAN.md — Frontend kanban board with dnd-kit (DnD, ConfirmModal, filters)
- [ ] 12-04-PLAN.md — Frontend purchasing dashboard (KPIs, Recharts charts, alerts, drill-down)
- [ ] 12-05-PLAN.md — Frontend preferences page + NotificationBell expansion + Sidebar + route wiring

### Phase 13: Kanban DnD Fixes + Notification Wiring

**Goal**: Fix 2 broken Kanban DnD transition calls and wire 4 notification types that are defined but never dispatched — restoring full Kanban interactivity and completing the notification pipeline
**Depends on**: Phase 12
**Requirements**: DASH-01, DASH-03
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):

1. Kanban DnD EM_COTACAO→OC_EMITIDA redirects to quotation approval flow instead of calling createEmergencyPO
2. Kanban DnD OC_EMITIDA→AGUARDANDO_ENTREGA calls correct PATCH /transition endpoint and succeeds
3. BUDGET_EXCEEDED notification fires when budget is exceeded during approval
4. RETURN_REGISTERED and RETURN_RESOLVED notifications fire from goods-returns service with registered types
5. PO_GOODS_RECEIVED notification fires when goods receipt is confirmed
   **Plans:** 3/3 plans complete

Plans:

- [ ] 13-00-PLAN.md — Wave 0: Create frontend spec files with failing tests for DnD behaviors (Nyquist compliance)
- [ ] 13-01-PLAN.md — Frontend DnD fixes: EM_COTACAO navigation redirect + OC_EMITIDA PATCH /transition
- [ ] 13-02-PLAN.md — Backend notification wiring: BUDGET_EXCEEDED, PO_GOODS_RECEIVED, RETURN_REGISTERED, RETURN_RESOLVED

### Phase 14: Stock Reversal + Supplier Rating Completion

**Goal**: Complete stock reversal on goods return conclusion and wire supplier rating alert in quotation flow plus performance report — closing remaining data integrity and UX gaps
**Depends on**: Phase 13
**Requirements**: DEVO-01, FORN-03
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):

1. When goods return transitions to CONCLUIDA, StockBalance is decremented and a StockOutput of type RETURN is created
2. QuotationModal shows visual alert when selected supplier has average rating < 3
3. Supplier performance report endpoint returns rating history filtered by period
4. Frontend displays supplier performance report with rating trends
   **Plans:** 2/2 plans complete

Plans:

- [ ] 14-01-PLAN.md — Backend: stock reversal fix (APROVADA->CONCLUIDA side-effects) + performance endpoint
- [ ] 14-02-PLAN.md — Frontend: QuotationModal rating badge + SupplierPerformanceModal with charts

### Phase 15: Frontend API Path Fixes

**Goal**: Fix frontend API path mismatches that cause 404s in Kanban DnD transitions and notification preferences — restoring full drag-and-drop interactivity and preference management
**Depends on**: Phase 13
**Requirements**: DASH-01, DASH-03
**Gap Closure:** Closes integration gaps from re-audit (2026-03-19)
**Success Criteria** (what must be TRUE):

1. Kanban DnD RC_PENDENTE→RC_APROVADA calls correct backend endpoint and succeeds
2. Kanban DnD RC_APROVADA→EM_COTACAO calls correct backend endpoint and succeeds
3. Kanban DnD OC_EMITIDA→AGUARDANDO_ENTREGA calls correct backend endpoint and succeeds
4. Notification preferences GET/PUT calls include orgId segment and return 200
5. DAILY_DIGEST notification type is recognized and labeled in the frontend bell
   **Plans:** 1/1 plans complete

Plans:

- [ ] 15-01-PLAN.md — Fix 3 DnD paths in usePurchasingKanban, inject orgId in useNotificationPreferences, add DAILY_DIGEST to useNotifications

---

### Phase 16: Cadastro de Ativos

**Goal**: Gerente pode cadastrar qualquer tipo de ativo da fazenda — máquina, veículo, benfeitoria, terra ou implemento — com classificação CPC correta definida desde o schema, tornando a entidade ativo disponível como raiz de todo o módulo patrimonial
**Depends on**: Phase 15 (v1.1 completo — base financeira e módulo de estoque existentes)
**Requirements**: ATIV-01, ATIV-02, ATIV-03, ATIV-04, ATIV-05, ATIV-06, ATIV-07
**Success Criteria** (what must be TRUE):

1. Gerente pode cadastrar máquina, veículo, benfeitoria, terra ou implemento com classificação CPC (CPC 27 depreciável, CPC 27 não-depreciável, CPC 29 valor justo) definida no momento do cadastro
2. Gerente pode importar ativos em massa via CSV/Excel com mapeamento de colunas e relatório de erros pós-importação
3. Gerente pode ver inventário completo de ativos com filtros por tipo, fazenda, status e faixa de valor, com exportação CSV/Excel/PDF
4. Gerente pode acessar a ficha completa do ativo com histórico de manutenções, documentos e timeline de eventos desde o cadastro
5. Ativo de benfeitoria aparece com marcação georreferenciada no mapa da fazenda usando coordenada ou polígono informado no cadastro

**Plans:** 7/7 plans complete

Plans:

- [x] 16-00-PLAN.md — Wave 0: Prisma schema, migration, backend types, RBAC permissions
- [x] 16-01-PLAN.md — Backend CRUD service, routes, sequential tag, tests
- [x] 16-02-PLAN.md — Backend bulk import, export CSV/PDF, fuel records, meter readings
- [x] 16-03-PLAN.md — Frontend AssetsPage, AssetModal, types, hooks, sidebar wiring
- [x] 16-04-PLAN.md — Frontend AssetDrawer with tabs (fuel, readings, documents, timeline)
- [x] 16-05-PLAN.md — Frontend AssetImportModal (5-step bulk import wizard)
- [ ] 16-06-PLAN.md — Gap closure: backend assets/map endpoint + FarmMapPage asset layer + AssetsPage map view toggle

### Phase 17: Engine de Depreciação

**Goal**: Contador pode configurar o método de depreciação por ativo e o sistema executa o cálculo mensal automaticamente com precisão decimal e idempotência garantida — tornando o valor contábil líquido de cada ativo sempre correto e auditável
**Depends on**: Phase 16
**Requirements**: DEPR-01, DEPR-02, CCPA-01, CCPA-02
**Success Criteria** (what must be TRUE):

1. Contador pode configurar método de depreciação por ativo (linear, horas-uso, produção, acelerada) com taxa fiscal vs gerencial, vida útil e valor residual
2. Sistema executa cálculo mensal de depreciação com pro rata die no primeiro e último mês, parando ao atingir o valor residual, sem duplicar lançamentos em caso de reexecução
3. Cada ativo tem sua depreciação apropriada ao centro de custo configurado, com conciliação automática garantindo que a soma dos CCs igual ao total depreciado
4. Contador pode ver relatório mensal de depreciação por ativo com valor antes/depois e lançamento por centro de custo
5. Ativo com status EM_ANDAMENTO é excluído do lote de depreciação — depreciação só inicia após ativação

**Plans:** 4/4 plans complete

Plans:

- [ ] 17-01-PLAN.md — Prisma schema (4 models, 2 enums, migration) + depreciation engine arithmetic + unit tests
- [ ] 17-02-PLAN.md — Backend config CRUD + batch processor + cron + routes + integration tests
- [ ] 17-03-PLAN.md — Frontend DepreciationPage + ConfigModal + ReportTable + RunBadge + AssetDrawer tab + sidebar

### Phase 18: Manutenção e Ordens de Serviço

**Goal**: Gerente pode criar planos de manutenção preventiva e gerenciar o ciclo completo de ordens de serviço — com consumo automático de peças do estoque, classificação contábil obrigatória no encerramento e custo de manutenção rastreado por centro de custo
**Depends on**: Phase 16
**Requirements**: MANU-01, MANU-02, MANU-03, MANU-04, MANU-05, MANU-06, MANU-07, MANU-08, CCPA-03
**Success Criteria** (what must be TRUE):

1. Gerente pode criar plano de manutenção preventiva com gatilhos por horímetro, km ou tempo, e o sistema calcula a próxima execução e alerta com antecedência configurável
2. Gerente pode abrir OS, registrar peças consumidas (com baixa automática no estoque), horas de mão de obra, custo externo e fotos, e encerrar a OS — sendo obrigado a classificar como despesa, capitalização ou diferimento
3. Operador pode solicitar manutenção pelo celular com foto e geolocalização, funcionando offline, com notificação push ao responsável ao sincronizar
4. Gerente pode controlar estoque de peças de reposição com ponto de reposição e vinculação de peças compatíveis por máquina
5. Gerente pode ver dashboard de manutenção com disponibilidade mecânica, MTBF, MTTR, custo acumulado e kanban de OS abertas

**Plans:** 10/10 plans complete
**Gap Closure:** Closes 4 gaps from verification (cron wiring, integration tests)

Plans:

- [ ] 18-00-PLAN.md — Wave 0: Prisma schema (7 models, 4 enums, migration), types, RBAC, test stubs
- [ ] 18-01-PLAN.md — Maintenance plans backend: CRUD, next-due calculation, daily alert cron, tests
- [ ] 18-02-PLAN.md — Work orders backend: CRUD, close with accounting treatment, stock deduction, CC, dashboard, tests
- [ ] 18-03-PLAN.md — Spare parts compatibility + maintenance provisions backend: CRUD, reconciliation, monthly cron, tests
- [ ] 18-04-PLAN.md — Frontend: types, hooks, MaintenancePlansPage, WorkOrdersPage, modals, sidebar, routes
- [ ] 18-05-PLAN.md — Frontend: dashboard, kanban, close wizard, provision modal, AssetMaintenanceTab
- [ ] 18-06-PLAN.md — Mobile: maintenance request screen with offline queue, photo, geolocation
- [ ] 18-07-PLAN.md — Gap closure: wire maintenance crons to main.ts startup
- [ ] 18-08-PLAN.md — Gap closure: work orders integration tests (35 stubs to real tests)
- [ ] 18-09-PLAN.md — Gap closure: maintenance provisions integration tests (19 stubs to real tests)

### Phase 19: Integração Financeira — Aquisição

**Goal**: Gerente pode registrar a compra de um ativo — à vista, financiada ou via NF-e — com geração automática de conta a pagar pelo módulo financeiro existente, sem contaminar o fluxo de recebimento de mercadorias
**Depends on**: Phase 16, Phase 17
**Requirements**: AQUI-01, AQUI-02, AQUI-03, AQUI-04, AQUI-07
**Success Criteria** (what must be TRUE):

1. Ao cadastrar ativo com valor de aquisição, sistema gera CP automaticamente com fornecedor, valor, vencimento e centro de custo — sem criar entrada no estoque
2. Gerente pode registrar compra financiada com dados do financiamento e visualizar parcelas geradas automaticamente no módulo CP
3. Gerente pode fazer upload de NF-e (XML) e o sistema preenche automaticamente fornecedor, valor e dados fiscais do ativo
4. Gerente pode registrar NF com múltiplos ativos, cada um gerando seu registro patrimonial com rateio proporcional das despesas acessórias
5. Cada aquisição tem centro de custo e classificação contábil definidos para apropriação correta da depreciação futura

**Plans:** 3/3 plans complete

Plans:

- [ ] 19-01-PLAN.md — Backend: migration (PayableCategory enum), types, NF-e parser, service, routes, integration tests
- [ ] 19-02-PLAN.md — Frontend: AssetModal "Dados Financeiros" section, InstallmentPreviewTable, useAssetAcquisition hook
- [ ] 19-03-PLAN.md — Frontend: AssetNfeImportModal 3-step wizard, wiring from AssetModal and AssetsPage

### Phase 20: Alienação e Baixa de Ativos

**Goal**: Gerente pode encerrar o ciclo de vida de um ativo por venda, descarte, sinistro ou transferência — com cálculo automático de ganho/perda contábil, geração de CR e cancelamento atômico das entradas de depreciação pendentes
**Depends on**: Phase 17, Phase 19
**Requirements**: DISP-01, DISP-02, DISP-03, DISP-04, DISP-05, DISP-06
**Success Criteria** (what must be TRUE):

1. Gerente pode registrar venda de ativo e visualizar o ganho ou perda contábil calculado automaticamente (valor de venda vs valor contábil líquido), com CR gerado no módulo financeiro
2. Gerente pode registrar baixa por descarte, sinistro ou obsolescência com motivo e laudo, com lançamento de perda e encerramento do ativo
3. Gerente pode registrar venda parcelada de ativo com parcelas geradas no módulo CR
4. Gerente pode transferir ativo entre fazendas da mesma organização com histórico e reavaliação opcional de centro de custo
5. Contador pode conciliar patrimônio físico vs contábil com inventário (contagem física vs registro) e gerar ajustes
6. Gerente pode ver dashboard financeiro patrimonial com valor total de ativos, depreciação acumulada, aquisições/baixas do período e indicadores de rentabilidade

**Plans:** 5/5 plans complete

Plans:
- [ ] 20-00-PLAN.md — Wave 0: Prisma schema (4 models, 2 enums), migration, type files, depreciation batch exclusion fix
- [ ] 20-01-PLAN.md — Backend: asset disposals (sale + write-off + installment) with atomic CR generation
- [ ] 20-02-PLAN.md — Backend: farm transfers + inventory reconciliation modules
- [ ] 20-03-PLAN.md — Backend: patrimony dashboard endpoint on financial-dashboard module
- [ ] 20-04-PLAN.md — Frontend: DisposalModal, TransferModal, InventoryPage, PatrimonyDashboardPage, sidebar wiring

### Phase 21: Controle Operacional

**Goal**: Gerente e operador podem registrar e consultar o histórico operacional de cada ativo — combustível, documentos, horímetro e custo operacional — formando a base de dados para o cálculo de TCO
**Depends on**: Phase 16
**Requirements**: OPER-01, OPER-02, OPER-03, OPER-04
**Success Criteria** (what must be TRUE):

1. Gerente pode registrar abastecimentos por ativo com custo/litro e custo/hora, e ver benchmarking de eficiência contra a média da frota
2. Gerente pode controlar documentos com vencimento (CRLV, seguro, revisão) com alertas automáticos antecipados e calendário de vencimentos
3. Operador pode atualizar horímetro/odômetro pelo celular com validação anti-regressão
4. Sistema exibe custo operacional por ativo composto por aquisição, depreciação, manutenção, combustível e seguro para análise de viabilidade

**Plans:** 3/3 plans complete

Plans:

- [ ] 21-01-PLAN.md — Backend operational cost endpoint + frontend document expiry alerts view
- [ ] 21-02-PLAN.md — Frontend AssetCostTab + useAssetOperationalCost + AssetDrawer custo tab wiring
- [ ] 21-03-PLAN.md — Mobile meter-reading screen + More tab quick action wiring

### Phase 22: Hierarquia Avançada e Imobilizado em Andamento

**Goal**: Gerente pode modelar relacionamentos complexos entre ativos — ativo composto pai-filho, reforma com decisão de capitalização, e obra em andamento com aportes parciais — cobrindo os cenários patrimoniais menos frequentes mas de alto valor
**Depends on**: Phase 16, Phase 17
**Requirements**: HIER-01, HIER-02, HIER-03
**Success Criteria** (what must be TRUE):

1. Gerente pode criar ativo composto com hierarquia pai-filho até 3 níveis, onde o ativo pai totaliza os valores dos filhos e cada filho tem depreciação independente
2. Gerente pode registrar reforma ou ampliação de ativo existente com decisão explícita de capitalizar (soma ao valor contábil e reavaliar vida útil) ou tratar como despesa imediata (vai para DRE)
3. Gerente pode registrar imobilizado em andamento acumulando aportes parciais com cronograma de etapas, alerta de orçamento e ativação ao concluir a obra — iniciando a depreciação somente após a ativação

**Plans:** 3/3 plans complete

Plans:
- [x] 22-01-PLAN.md — Schema migration + HIER-01 hierarchy depth guard + parent totalization
- [x] 22-02-PLAN.md — HIER-02 renovation module + HIER-03 WIP module backend
- [x] 22-03-PLAN.md — Frontend: hierarchy tab, renovation modal, WIP contributions tab

### Phase 23: Relatórios e Dashboard Patrimonial

**Goal**: Contador e gerente têm acesso a relatórios completos do patrimônio — inventário, depreciação, TCO, custo por centro de custo — e ao wizard de criação de centro de custo, consumindo dados produzidos por todas as fases anteriores
**Depends on**: Phase 17, Phase 18, Phase 20, Phase 21
**Requirements**: DEPR-04, CCPA-04
**Success Criteria** (what must be TRUE):

1. Contador pode gerar relatório patrimonial com valor bruto, depreciação acumulada e valor líquido por classe de ativo, exportável em PDF/Excel/CSV
2. Contador pode ver relatório de depreciação acumulada por período e projeção para os próximos 12/36/60 meses
3. Sistema exibe dashboard de TCO por ativo e por frota, com alerta de "reparar vs substituir" quando custo acumulado de manutenção ultrapassa 60-70% do custo de reposição
4. Sistema oferece wizard de decisão para orientar o gerente na criação de centro de custo por tipo de ativo, com exemplos e templates por tipo de fazenda

**Plans:** 3/3 plans complete

Plans:
- [x] 23-01-PLAN.md — Backend asset-reports module: inventory, depreciation projection, TCO fleet, export
- [x] 23-02-PLAN.md — Frontend CostCenterWizardModal: 4-step wizard with templates by asset type
- [x] 23-03-PLAN.md — Frontend AssetReportsPage: 3 tabs, charts, fleet view, routing, sidebar

### Phase 24: Ativos Biológicos, Leasing e Features Avançadas

**Goal**: Contador pode registrar valor justo de ativos biológicos (CPC 29) e leasing (CPC 06), e o gerente pode registrar troca de ativo com compensação financeira — cobrindo os cenários contábeis mais complexos do patrimônio rural
**Depends on**: Phase 17, Phase 19
**Requirements**: DEPR-03, AQUI-05, AQUI-06
**Success Criteria** (what must be TRUE):

1. Contador pode registrar valor justo de ativos biológicos (rebanho por categoria e culturas perenes por estágio) com variação de valor justo registrada no resultado do período como item não-caixa
2. Planta portadora (café, laranja) é classificada como CPC 27 depreciável — não CPC 29 — e entra no lote de depreciação normal
3. Gerente pode registrar leasing e arrendamento mercantil (CPC 06) com ROU asset criado automaticamente, parcelas geradas no módulo CP e controle da opção de compra ao final do contrato
4. Gerente pode registrar troca de ativo (trade-in) com compensação financeira automática — valor do ativo antigo abatido do novo — gerando baixa e aquisição no mesmo lançamento

**Plans:** 3/3 plans complete

Plans:
- [x] 24-01-PLAN.md — Biological assets CPC 29 fair value: backend module + frontend page
- [x] 24-02-PLAN.md — Asset leasing CPC 06: ROU asset + CP installments + frontend page
- [x] 24-03-PLAN.md — Asset trade-in: atomic swap + financial compensation + frontend modal

---

### Phase 25: Cadastro de Colaboradores e Contratos

**Goal**: Gerente pode cadastrar colaboradores com todos os dados trabalhistas e documentais exigidos pela legislação, registrar contratos por tipo (CLT, safra, intermitente, experiência, aprendiz), gerenciar cargos e escalas, importar em massa, e consultar a ficha completa do colaborador — tornando a entidade colaborador disponível como fundação de todo o módulo RH
**Depends on**: Phase 24 (v1.2 completo — base financeira, compras e patrimônio existentes)
**Requirements**: COLAB-01, COLAB-02, COLAB-03, COLAB-04, COLAB-05
**Success Criteria** (what must be TRUE):

1. Gerente pode cadastrar colaborador com CPF, PIS/PASEP, CTPS, dados bancários, dependentes com CPF (para IRRF e salário-família), upload de documentos digitalizados e associação a fazendas com status ativo/afastado/férias/desligado
2. Gerente pode registrar contrato de trabalho por tipo (CLT indeterminado, determinado, safra, intermitente, experiência, aprendiz) com dados de admissão, cargo/CBO, salário, jornada, sindicato, aditivos com histórico e alertas automáticos de vencimento de contratos de experiência e safra
3. Gerente pode cadastrar cargos com CBO, faixas salariais com níveis (piso/teto), escalas de trabalho configuráveis (5x2, 6x1, 12x36, turno ordenha), adicionais por cargo, quadro de lotação e histórico de movimentações (promoção, reajuste, transferência) com reajuste coletivo em lote
4. Gerente pode importar colaboradores existentes via CSV/Excel com template, validação de CPF e PIS, preview dos dados e relatório pós-importação com saldos iniciais de férias e banco de horas
5. Gerente pode visualizar ficha completa do colaborador em tela única com dados pessoais, contrato atual e histórico, evolução salarial em gráfico, holerites dos últimos 12 meses, saldo de férias, histórico de afastamentos, EPIs entregues, treinamentos e operações de campo vinculadas

**Plans**: 4 plans

Plans:
- [x] 25-01-PLAN.md — Prisma schema (13 models), migrations, isValidPIS, employees backend CRUD with status machine
- [x] 25-02-PLAN.md — Contracts, positions, work schedules, movements modules + contract expiry cron
- [x] 25-03-PLAN.md — Frontend types, hooks, EmployeesPage, PositionsPage, WorkSchedulesPage, all modals, sidebar
- [x] 25-04-PLAN.md — Bulk import backend + EmployeeDetailPage with tabs and chart + visual verification
**UI hint**: yes

### Phase 26: Parâmetros de Folha e Motor de Cálculo

**Goal**: Contador pode configurar o plano de rubricas (proventos e descontos) com fórmulas customizáveis e manter tabelas legais vigentes, enquanto o sistema possui um motor de cálculo brasileiro completo — INSS progressivo, IRRF com dependentes, FUNRURAL rural, moradia/alimentação — que garante cálculo correto antes de qualquer folha ser processada
**Depends on**: Phase 25
**Requirements**: FOLHA-01
**Success Criteria** (what must be TRUE):

1. Contador pode configurar rubricas de proventos (salário, HE 50%/100%, noturno 25%, insalubridade, periculosidade, salário-família, comissão) e descontos (INSS, IRRF, VT 6%, moradia até 25%, alimentação até 20%, adiantamento, faltas, pensão) com fórmulas customizáveis
2. Contador pode atualizar tabelas legais com vigência (INSS progressiva, IRRF com faixas e deduções por dependente, salário mínimo, salário-família) sem necessidade de deploy — novas alíquotas entram em vigor na data configurada
3. Sistema calcula INSS pelo método progressivo por faixa (não flat-rate), IRRF após dedução do INSS e dos dependentes, FGTS 8% sobre salário bruto e FUNRURAL com modo configurável (% receita bruta da fazenda ou % folha)
4. Sistema aplica regras específicas do trabalhador rural: adicional noturno 21h-5h a 25% (não 22h-5h a 20%), hora noturna rural reduzida (52m30s), moradia até 25% do salário e alimentação até 20% descontados apenas sobre o piso regional

**Plans**: 4 plans

Plans:
- [x] 26-01-PLAN.md — Prisma schema (4 models, 4 enums), migration, seed 2026 legal tables, TypeScript types
- [x] 26-02-PLAN.md — Payroll engine TDD (INSS progressive, IRRF two-step, FGTS, rural rules, formula eval)
- [x] 26-03-PLAN.md — Backend REST endpoints (rubricas CRUD + legal tables CRUD + RBAC)
- [x] 26-04-PLAN.md — Frontend PayrollParametersPage (rubricas tab + legal tables tab + modals)
**UI hint**: yes

### Phase 27: Controle de Ponto e Jornada

**Goal**: Colaborador pode registrar ponto via mobile ou web, gerente pode vincular horas a atividades e operações de campo, o sistema calcula automaticamente horas extras, adicional noturno rural e banco de horas, e o gerente pode revisar e aprovar o espelho de ponto mensal antes do processamento da folha
**Depends on**: Phase 25, Phase 26
**Requirements**: PONTO-01, PONTO-02, PONTO-03, PONTO-04
**Success Criteria** (what must be TRUE):

1. Colaborador pode registrar ponto (entrada, intervalos, saída) via app mobile com geolocalização validada contra o perímetro da fazenda (PostGIS), funcionando offline com sincronização automática, e gerente pode registrar ponto manualmente para equipes sem celular com justificativa auditável
2. Gerente pode vincular horas trabalhadas a atividades/operações (plantio, colheita, trato, manutenção) por talhão ou pasto com modo rápido por equipe, e o custo/hora é calculado automaticamente e lançado no centro de custo da atividade correspondente
3. Sistema calcula automaticamente horas extras (50% dias normais, 100% domingos/feriados com DSR), banco de horas com alerta de vencimento em 6 meses, adicional noturno rural (21h-5h, 25%, hora reduzida 52m30s) e alerta de interjornada menor que 11 horas
4. Gerente pode revisar espelho de ponto mensal com identificação visual de inconsistências, corrigir registros com justificativa, conduzir fluxo de aprovação (gerente → RH), e o colaborador pode aceitar o espelho via app — com prazo de fechamento configurável e exportação em PDF

**Plans**: 6 plans

Plans:
- [x] 27-01-PLAN.md — Prisma schema (5 models, 3 enums), migration, date-holidays install, TypeScript types
- [x] 27-02-PLAN.md — Time calculations engine (TDD): overtime, rural night premium, interjornada, holidays
- [x] 27-03-PLAN.md — Backend REST API: time-entries (incl. team bulk linking), overtime-bank, timesheets with PDF export
- [x] 27-04-PLAN.md — Frontend web: AttendancePage with team linking, hooks, types
- [x] 27-05-PLAN.md — Mobile: time-punch screen with geofencing, offline storage, sync
- [x] 27-06-PLAN.md — Frontend web: TimesheetPage with approval flow, corrections, PDF export
**UI hint**: yes

### Phase 28: Processamento da Folha Mensal

**Goal**: Contador pode processar folha mensal em lote com cálculo automático completo por colaborador, gerar holerites em PDF para entrega por email e app, registrar e descontar adiantamentos salariais, e processar o 13º salário nas duas parcelas — com fechamento imutável e integração com ficha do colaborador
**Depends on**: Phase 26, Phase 27
**Requirements**: FOLHA-02, FOLHA-03, FOLHA-04, FOLHA-05
**Success Criteria** (what must be TRUE):

1. Contador pode processar folha mensal em lote para todos os colaboradores ativos, com cálculo automático de salário proporcional, horas extras com DSR, noturno rural, INSS/IRRF/FGTS, moradia/alimentação e encargos patronais (INSS 20%, RAT, FGTS 8%) — com bloqueio se espelho de ponto não estiver aprovado
2. Contador pode revisar preview da folha antes de confirmar, recalcular individualmente um colaborador, e fechar a folha tornando-a imutável — com possibilidade de estorno completo que reverte todos os lançamentos associados
3. Gerente pode registrar adiantamento salarial com limite configurável em percentual do salário, processar adiantamentos em lote no dia 15 com 40% do salário, gerar recibo PDF e o desconto aparece automaticamente na folha do mês
4. Colaborador pode receber holerite detalhado com proventos, descontos, bases INSS/IRRF/FGTS e totais em PDF individual via email ou app mobile, com histórico dos últimos 12 meses acessível na ficha
5. Contador pode processar 13º salário (1ª parcela até 30/nov sem descontos, 2ª parcela até 20/dez com INSS e IRRF) com cálculo proporcional por meses trabalhados incluindo médias de HE e noturno, recibo PDF e integração financeira

**Plans**: 6 plans

Plans:
- [x] 28-01-PLAN.md — Prisma schema (PayrollRun/PayrollRunItem/SalaryAdvance) + payroll calculation service
- [x] 28-02-PLAN.md — Salary advances module (service + routes + receipt PDF + tests)
- [x] 28-03-PLAN.md — PayrollRun orchestrator (process/close/revert) + payslip PDF + email + routes
- [x] 28-04-PLAN.md — Frontend types/hooks + PayrollRunsPage + wizard + detail modal + status badges
- [x] 28-05-PLAN.md — SalaryAdvanceModal + PayslipTab on employee ficha + sidebar/routes
- [x] 28-06-PLAN.md — Visual and functional verification checkpoint
**UI hint**: yes

### Phase 29: Férias, Afastamentos, Rescisão e Provisões

**Goal**: Gerente pode programar e calcular férias com fracionamento, registrar afastamentos com impacto automático na folha, o contador pode processar rescisão com TRCT completo e guias, e o sistema calcula mensalmente a provisão de férias e 13º com lançamento contábil no passivo — cobrindo o ciclo completo de eventos trabalhistas ao longo da relação de emprego
**Depends on**: Phase 28
**Requirements**: FERIAS-01, FERIAS-02, FERIAS-03, FERIAS-04
**Success Criteria** (what must be TRUE):

1. Gerente pode controlar períodos aquisitivos, programar férias (mínimo 5 dias, até 3 frações) em calendário visual que exibe conflitos com datas de safra, calcular pagamento com salário + 1/3 + médias menos INSS e IRRF, gerar recibo PDF e receber alerta 60 dias antes do vencimento do período de dobro
2. Gerente pode registrar afastamentos por tipo (atestado até 15 dias pela empresa / após INSS, acidente com CAT, maternidade 120 dias, paternidade, casamento, falecimento) com impacto automático na folha e controle de retorno com ASO obrigatório após acidentes
3. Contador pode processar rescisão por tipo (sem justa causa, justa causa, pedido de demissão, fim de safra, acordo mútuo) com cálculo automático de saldo de salário, aviso prévio proporcional (30 + 3 dias/ano Lei 12.506/2011 máx 90), 13º prop., férias vencidas+prop.+1/3, multa FGTS 40%/20%, gerar TRCT em PDF e guias GRRF com alerta de prazo de 10 dias
4. Sistema calcula mensalmente provisão de férias e 13º por colaborador (1/12 do salário + 1/3 + encargos) usando histórico salarial, faz lançamento contábil automático de despesa na DRE e passivo no BP, reverte ao efetuar o pagamento, e exibe relatório de posição com rateio por centro de custo conforme apontamento de horas

**Plans**: 5 plans

Plans:
- [x] 29-01-PLAN.md — Prisma schema (5 models, 7 enums, migration) + vacation-schedules + employee-absences backend
- [x] 29-02-PLAN.md — Employee-terminations backend (calculation + TRCT/GRRF PDF + CRUD)
- [x] 29-03-PLAN.md — Payroll-provisions backend (monthly calculation + reversal + cost center report)
- [x] 29-04-PLAN.md — Frontend types, hooks, VacationSchedulesPage, EmployeeAbsencesPage, sidebar + App.tsx
- [x] 29-05-PLAN.md — Frontend EmployeeTerminationsPage, PayrollProvisionsPage + visual checkpoint
**UI hint**: yes

### Phase 30: Segurança do Trabalho Rural (NR-31)

**Goal**: Gerente e técnico de segurança podem controlar a entrega de EPIs, registrar e acompanhar treinamentos obrigatórios NR-31 com matriz de conformidade, e gerenciar ASOs e PCMSO com alertas de vencimento — garantindo que nenhum colaborador opere sem EPI, treinamento válido ou ASO em dia
**Depends on**: Phase 25
**Requirements**: SEGUR-01, SEGUR-02, SEGUR-03
**Success Criteria** (what must be TRUE):

1. Gerente pode cadastrar EPIs com número CA e validade, registrar entrega por colaborador com data e tipo consumindo do estoque de produtos existente, receber alertas de CA vencido ou necessidade de troca, e gerar ficha de EPI em PDF com relatório de conformidade por função
2. Técnico pode registrar treinamentos NR-31 obrigatórios (integração, agrotóxicos, máquinas, animais, primeiros socorros, incêndio) com data, carga horária, instrutor e lista de presença, configurar validade por tipo, receber alerta 30 dias antes da reciclagem e gerar certificado PDF e matriz de conformidade
3. Gerente pode registrar ASOs por tipo (admissional, periódico, retorno, mudança de função, demissional) com médico CRM, resultado e exames, e o sistema alerta 30 dias antes do vencimento, bloqueia admissão sem ASO admissional e exige ASO demissional para processar rescisão

**Plans**: 7 plans

Plans:
- [x] 30-01-PLAN.md — Schema migration (8 tables, 5 enums) + types files + app.ts wiring
- [ ] 30-02-PLAN.md — EPI backend: epi-products CRUD + epi-deliveries with stock integration + PDF
- [ ] 30-03-PLAN.md — Training backend: training-types with NR-31 seed + training-records + certificate PDF
- [ ] 30-04-PLAN.md — ASO backend: medical-exams + safety-compliance dashboard aggregation + reports
- [ ] 30-05-PLAN.md — Frontend: types, hooks, ComplianceStatusBadge, sidebar, router, EPI pages
- [ ] 30-06-PLAN.md — Frontend: TrainingTypesPage, TrainingRecordsPage, MedicalExamsPage
- [ ] 30-07-PLAN.md — Frontend: SafetyDashboardPage with KPIs and 4 tabs + visual verification
**UI hint**: yes

### Phase 31: Obrigações Acessórias e eSocial

**Goal**: Contador pode gerar guias de recolhimento de FGTS, INSS, IRRF e FUNRURAL com vencimentos e alertas corretos, gerar e transmitir todos os eventos eSocial em XML conforme leiaute S-1.3 com certificado digital ICP-Brasil, e emitir RAIS e informes de rendimentos — cobrindo todas as obrigações acessórias trabalhistas e previdenciárias exigidas por lei
**Depends on**: Phase 28, Phase 29, Phase 30
**Requirements**: ESOCIAL-01, ESOCIAL-02, ESOCIAL-03
**Success Criteria** (what must be TRUE):

1. Contador pode gerar guias de recolhimento (FGTS via GFIP/DCTFWeb, INSS via DARF, IRRF via DARF, FUNRURAL via GPS/DARF) com calendário de vencimentos, alertas antecipados e integração automática com Contas a Pagar — sem entrada manual de valores
2. Contador pode gerar eventos eSocial nos grupos corretos (tabela S-1000/S-1005/S-1010/S-1020, não periódicos S-2200/S-2206/S-2230/S-2299, periódicos S-1200/S-1299, SST S-2210/S-2220/S-2240) em XML assinado digitalmente com certificado ICP-Brasil, transmitir ao Web Service do governo e acompanhar protocolo, recibo e retorno em dashboard de status com reprocessamento de rejeitados
3. Contador pode gerar informe de rendimentos por colaborador em PDF (total de renda, IRRF retido, INSS) com envio por email ou app, e consultar histórico por ano-base com validação de dados antes da emissão

**Plans**: 4 plans

Plans:
- [ ] 25-01-PLAN.md — Prisma schema (13 models), migrations, isValidPIS, employees backend CRUD with status machine
- [ ] 25-02-PLAN.md — Contracts, positions, work schedules, movements modules + contract expiry cron
- [ ] 25-03-PLAN.md — Frontend types, hooks, EmployeesPage, PositionsPage, WorkSchedulesPage, all modals, sidebar
- [ ] 25-04-PLAN.md — Bulk import backend + EmployeeDetailPage with tabs and chart + visual verification
**UI hint**: yes

### Phase 32: Integração Financeira, Contábil e Dashboard RH

**Goal**: Ao fechar a folha, o sistema lança automaticamente todas as contas a pagar correspondentes com vencimentos legais corretos e rateio por centro de custo, registra os lançamentos contábeis por regime de competência, e o gerente pode visualizar no dashboard RH os KPIs de custo de pessoal por fazenda, atividade e cultura — fechando o ciclo entre quem trabalhou, o que produziu e quanto custou
**Depends on**: Phase 28, Phase 29, Phase 31
**Requirements**: INTEGR-01, INTEGR-02, INTEGR-03
**Success Criteria** (what must be TRUE):

1. Ao confirmar o fechamento da folha, o sistema gera automaticamente CPs para salários líquidos (vencimento dia 5 útil), FGTS (dia 7), INSS/IRRF (dia 20), VT, pensão alimentícia e FUNRURAL — com rateio por centro de custo conforme apontamento de horas, tela de revisão pré-confirmação e capacidade de estorno completo com rollback dos CPs
2. Ao fechar a folha, o sistema lança automaticamente os créditos contábeis por regime de competência — salários como despesa, encargos como despesa, provisões como despesa+passivo, guias como passivo a recolher — com rateio por centro de custo e baixa do passivo ao efetuar o pagamento
3. Gerente pode visualizar dashboard RH com total de colaboradores por status e tipo de contrato, custo total da folha (bruto/líquido/encargos), custo médio por colaborador, custo de mão de obra por hectare, evolução mensal 12 meses, composição da folha em pizza, custo por atividade/cultura, turnover, previsão de encerramentos de safra em 30/60/90 dias e alertas consolidados com filtros por fazenda e departamento

**Plans**: 4 plans

Plans:
- [ ] 25-01-PLAN.md — Prisma schema (13 models), migrations, isValidPIS, employees backend CRUD with status machine
- [ ] 25-02-PLAN.md — Contracts, positions, work schedules, movements modules + contract expiry cron
- [ ] 25-03-PLAN.md — Frontend types, hooks, EmployeesPage, PositionsPage, WorkSchedulesPage, all modals, sidebar
- [ ] 25-04-PLAN.md — Bulk import backend + EmployeeDetailPage with tabs and chart + visual verification
**UI hint**: yes

## Progress

| Phase                                               | Milestone | Plans Complete | Status      | Completed  |
| --------------------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Fundação Financeira                              | v1.0      | 3/3            | Complete    | 2026-03-16 |
| 2. Núcleo AP/AR                                     | v1.0      | 7/7            | Complete    | 2026-03-16 |
| 3. Dashboard Financeiro                             | v1.0      | 2/2            | Complete    | 2026-03-16 |
| 4. Instrumentos de Pagamento                        | v1.0      | 7/7            | Complete    | 2026-03-17 |
| 5. Conciliação e Fluxo de Caixa                     | v1.0      | 6/6            | Complete    | 2026-03-17 |
| 6. Crédito Rural                                    | v1.0      | 5/5            | Complete    | 2026-03-17 |
| 7. Cadastro de Fornecedores                         | v1.1      | 4/4            | Complete    | 2026-03-17 |
| 8. Requisição e Aprovação                           | v1.1      | 6/6            | Complete    | 2026-03-17 |
| 9. Cotação e Pedido de Compra                       | v1.1      | pre-GSD        | Complete    | 2026-03-19 |
| 10. Recebimento de Mercadorias                      | v1.1      | pre-GSD        | Complete    | 2026-03-19 |
| 11. Devolução, Orçamento e Saving                   | v1.1      | pre-GSD        | Complete    | pre-GSD    |
| 12. Kanban, Dashboard e Notificações                | v1.1      | 5/5            | Complete    | 2026-03-18 |
| 13. Kanban DnD Fixes + Notification Wiring          | v1.1      | 3/3            | Complete    | 2026-03-19 |
| 14. Stock Reversal + Supplier Rating Completion     | v1.1      | 2/2            | Complete    | 2026-03-19 |
| 15. Frontend API Path Fixes                         | v1.1      | 1/1            | Complete    | 2026-03-19 |
| 16. Cadastro de Ativos                              | v1.2      | 7/7            | Complete    | 2026-03-20 |
| 17. Engine de Depreciação                           | v1.2      | 4/4            | Complete    | 2026-03-20 |
| 18. Manutenção e Ordens de Serviço                  | v1.2      | 10/10          | Complete    | 2026-03-22 |
| 19. Integração Financeira — Aquisição               | v1.2      | 3/3            | Complete    | 2026-03-22 |
| 20. Alienação e Baixa de Ativos                     | v1.2      | 5/5            | Complete    | 2026-03-22 |
| 21. Controle Operacional                            | v1.2      | 3/3            | Complete    | 2026-03-22 |
| 22. Hierarquia Avançada e Imobilizado em Andamento  | v1.2      | 3/3            | Complete    | 2026-03-23 |
| 23. Relatórios e Dashboard Patrimonial              | v1.2      | 3/3            | Complete    | 2026-03-23 |
| 24. Ativos Biológicos, Leasing e Features Avançadas | v1.2      | 3/3            | Complete    | 2026-03-23 |
| 25. Cadastro de Colaboradores e Contratos           | v1.3      | 4/4 | Complete    | 2026-03-24 |
| 26. Parâmetros de Folha e Motor de Cálculo          | v1.3      | 4/4 | Complete    | 2026-03-24 |
| 27. Controle de Ponto e Jornada                     | v1.3      | 6/6 | Complete    | 2026-03-24 |
| 28. Processamento da Folha Mensal                   | v1.3      | 6/6 | Complete    | 2026-03-25 |
| 29. Férias, Afastamentos, Rescisão e Provisões      | v1.3      | 5/5 | Complete    | 2026-03-25 |
| 30. Segurança do Trabalho Rural (NR-31)             | v1.3      | 1/7 | In Progress|  |
| 31. Obrigações Acessórias e eSocial                 | v1.3      | 0/TBD          | Not started | -          |
| 32. Integração Financeira, Contábil e Dashboard RH  | v1.3      | 0/TBD          | Not started | -          |
