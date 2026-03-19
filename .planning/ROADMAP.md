# Roadmap: Protos Farm — Fase 3: Módulos Administrativos

## Milestones

- ✅ **v1.0 Financeiro Base** — Phases 1-6 (shipped 2026-03-17)
- ✅ **v1.1 Gestão de Compras** — Phases 7-15 (shipped 2026-03-19)
- 🚧 **v1.2 Gestão de Patrimônio** — Phases 16-24 (in progress)

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
<summary>✅ v1.1 Gestão de Compras (Phases 7-15) — SHIPPED 2026-03-19</summary>

- [x] Phase 7: Cadastro de Fornecedores (4/4 plans) — completed 2026-03-17
- [x] Phase 8: Requisição e Aprovação (6/6 plans) — completed 2026-03-17
- [x] Phase 9: Cotação e Pedido de Compra — completed 2026-03-18
- [x] Phase 10: Recebimento de Mercadorias — completed 2026-03-18
- [x] Phase 11: Devolução, Orçamento e Saving — completed 2026-03-18
- [x] Phase 12: Kanban, Dashboard e Notificações (5/5 plans) — completed 2026-03-18
- [x] Phase 13: Kanban DnD Fixes + Notification Wiring (3/3 plans) — completed 2026-03-19
- [x] Phase 14: Stock Reversal + Supplier Rating Completion (2/2 plans) — completed 2026-03-19
- [x] Phase 15: Frontend API Path Fixes (1/1 plans) — completed 2026-03-19

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v1.2 Gestão de Patrimônio (In Progress)

**Milestone Goal:** Implementar o ciclo de vida completo dos ativos da fazenda — cadastro, depreciação, manutenção preventiva/corretiva, controle operacional, documentação e integração bidirecional com o módulo financeiro (compra, venda, financiamento, leasing).

- [ ] **Phase 16: Cadastro de Ativos** — Entidade raiz do patrimônio com classificação CPC, ficha completa, import em massa e controle operacional básico
- [ ] **Phase 17: Engine de Depreciação** — Cálculo mensal automático (linear, pro rata die), idempotente, com atribuição a centro de custo
- [ ] **Phase 18: Manutenção e Ordens de Serviço** — CMMS completo com planos preventivos, OS com classificação contábil obrigatória e consumo de peças do estoque
- [ ] **Phase 19: Integração Financeira — Aquisição** — Compra de ativo gera CP automaticamente, financiada com parcelas, troca e NF com múltiplos ativos
- [ ] **Phase 20: Alienação e Baixa de Ativos** — Venda com ganho/perda → CR, baixa por sinistro/descarte, transferência entre fazendas
- [ ] **Phase 21: Controle Operacional Avançado** — Combustível com benchmarking, custo/hora, disponibilidade, QR code e solicitação mobile de manutenção
- [ ] **Phase 22: Depreciação Avançada e Hierarquia** — Horas-uso, produção, acelerada dual-track, impairment e hierarquia pai-filho até 3 níveis
- [ ] **Phase 23: Imobilizado em Andamento e Relatórios** — Obras com aportes e ativação, relatórios patrimoniais, dashboard TCO e inventário físico
- [ ] **Phase 24: Ativos Biológicos e Leasing** — CPC 29 valor justo, maturidade perenes, dashboard biológico, leasing CPC 06

## Phase Details

### Phase 16: Cadastro de Ativos

**Goal**: Gerente pode cadastrar, buscar e visualizar ativos com classificação CPC correta (máquina, veículo, implemento, benfeitoria, terra) — tornando a entidade ativo disponível como raiz de todo o módulo patrimonial, com controle operacional básico (combustível, horímetro, documentos)
**Depends on**: v1.1 completo (módulos payables, receivables, cost-centers, stock, suppliers existentes)
**Requirements**: ATIV-01, ATIV-02, ATIV-04, ATIV-06, OPER-01, OPER-03
**Success Criteria** (what must be TRUE):

1. Gerente pode cadastrar máquina, veículo, implemento, benfeitoria ou terra com classificação CPC definida no momento do cadastro, dados de aquisição, tag patrimônio sequencial e fotos
2. Gerente pode atribuir ativo a fazenda e centro de custo (fixo, rateio % ou dinâmico) com campos específicos por tipo (HP/RENAVAM, área m², hectares/matrícula)
3. Gerente pode visualizar ficha completa do ativo com abas (drawer lateral) e buscar/filtrar por tipo, fazenda, status e período
4. Gerente pode exportar lista filtrada em CSV e PDF
5. Operador pode registrar leituras de horímetro/odômetro com validação anti-regressão e cadastrar documentos com alerta de vencimento (30/15/7 dias)
6. Gerente pode registrar abastecimentos com custo/litro e ver benchmarking de eficiência vs frota
   **Plans:** 4 plans

Plans:
- [ ] 16-01-PLAN.md — Backend foundation: Prisma schema (Asset, FuelRecord, MeterReading, AssetDocument), migration, types, RBAC, CRUD service+routes+tests
- [ ] 16-02-PLAN.md — Backend operational: fuel records, meter readings, asset documents, CSV/PDF export, tests
- [ ] 16-03-PLAN.md — Frontend listing: types, hooks, AssetsPage, AssetModal, sidebar PATRIMONIO group, route wiring
- [ ] 16-04-PLAN.md — Frontend detail: AssetDrawer with 6 tabs (geral, documentos, combustível, leituras, manutenção, timeline), fuel/reading forms

### Phase 17: Engine de Depreciação

**Goal**: Sistema calcula depreciação linear mensal de forma automática, idempotente e decimal-safe — gerando ledger por ativo com atribuição a centro(s) de custo e excluindo ativos EM_ANDAMENTO
**Depends on**: Phase 16
**Requirements**: DEPR-01, DEPR-02, DEPR-03
**Success Criteria** (what must be TRUE):

1. Gerente pode configurar depreciação linear por ativo (valor residual, vida útil) com pro rata die no mês de aquisição
2. Sistema executa batch mensal (idempotente — reexecução não duplica) gerando uma entrada por ativo por período com split por centro(s) de custo
3. Gerente pode visualizar ledger de depreciação (data, quota, acumulada, valor contábil) e schedule projetado
4. Ativo com status EM_ANDAMENTO é automaticamente excluído do batch — depreciação só inicia após ativação
5. Toda aritmética usa decimal.js — último período faz balanceamento para valor residual exato
   **Plans**: TBD

### Phase 18: Manutenção e Ordens de Serviço

**Goal**: Gerente pode criar planos preventivos com gatilhos configuráveis e gerenciar OS com classificação contábil obrigatória — consumindo peças do estoque existente e alimentando o custo de manutenção do ativo
**Depends on**: Phase 16
**Requirements**: MANU-01, MANU-02, MANU-03, MANU-05, MANU-06
**Success Criteria** (what must be TRUE):

1. Gerente pode criar plano preventivo com gatilho por calendário, horímetro ou volume de produção, vinculado a um ativo
2. Gerente pode criar OS (preventiva/corretiva/reforma) com peças do estoque, equipe e máquina de estados (SOLICITADA→APROVADA→EM_EXECUÇÃO→CONCLUÍDA)
3. Ao concluir OS, classificação contábil é obrigatória (Despesa/Capitalização/Diferimento) — endpoint retorna 400 se ausente
4. Gerente pode visualizar dashboard com OS abertas por prioridade, preventivas próximas (30 dias), MTBF e MTTR
5. Gerente pode configurar provisão mensal de manutenção com reversão quando custo real é registrado
   **Plans**: TBD

### Phase 19: Integração Financeira — Aquisição

**Goal**: Compra de ativo gera CP automaticamente via módulo payables existente — sem contaminar o fluxo GoodsReceipt/StockEntry — com suporte a financiamento parcelado, troca e NF com múltiplos ativos
**Depends on**: Phase 16, Phase 17
**Requirements**: FINP-01, FINP-02, FINP-06
**Success Criteria** (what must be TRUE):

1. Ao registrar compra à vista, sistema cria CP via payables com fornecedor, valor e vencimento corretos
2. Ao registrar compra financiada, sistema cria CP com parcelas usando installmentGenerator (entrada + N parcelas)
3. Gerente pode registrar troca de ativo (baixa do antigo com abatimento + aquisição do novo) e múltiplos ativos na mesma NF
4. Compra de ativo nunca cria StockEntry — fluxo separado do GoodsReceipt com originType ASSET_PURCHASE no CP
   **Plans**: TBD

### Phase 20: Alienação e Baixa de Ativos

**Goal**: Gerente pode vender, descartar ou transferir ativo com cálculo automático de ganho/perda e geração de CR — com depreciação final pro rata e cancelamento de entradas futuras na mesma transação
**Depends on**: Phase 17, Phase 19
**Requirements**: FINP-03, FINP-04, ATIV-07
**Success Criteria** (what must be TRUE):

1. Gerente pode registrar venda com cálculo automático de ganho/perda (preço − valor contábil) e geração de CR, inclusive parcelada
2. Gerente pode registrar baixa por sinistro (perda + opcional CR seguro), descarte ou obsolescência (valor contábil como despesa)
3. Na alienação, sistema executa depreciação final pro rata, cancela entradas futuras e atualiza status em transação atômica
4. Gerente pode transferir ativo entre fazendas com atualização obrigatória de centro de custo e registro no histórico
   **Plans**: TBD

### Phase 21: Controle Operacional Avançado

**Goal**: Operador pode registrar abastecimentos e solicitar manutenção via mobile (QR code) — alimentando métricas de custo/hora, eficiência de combustível e disponibilidade por ativo
**Depends on**: Phase 16, Phase 18
**Requirements**: OPER-02, OPER-04, ATIV-05, MANU-04
**Success Criteria** (what must be TRUE):

1. Operador pode registrar abastecimentos (litros, custo/litro, operador) com cálculo automático de consumo l/hora
2. Sistema flag consumo >20% acima da média da frota para máquinas similares
3. Gerente pode visualizar custo/hora por ativo (depreciação + manutenção + combustível / horas) e índice de disponibilidade
4. Gerente pode gerar QR code por ativo e operador pode escanear no mobile para abrir ficha ou criar solicitação de manutenção com foto e urgência
   **Plans**: TBD

### Phase 22: Depreciação Avançada e Hierarquia

**Goal**: Sistema suporta depreciação por horas-uso, produção e acelerada (dual-track CPC vs Fiscal) — além de hierarquia pai-filho de ativos com custo e depreciação independentes por componente
**Depends on**: Phase 16, Phase 17
**Requirements**: DEPR-04, DEPR-05, DEPR-06, ATIV-03
**Success Criteria** (what must be TRUE):

1. Gerente pode configurar depreciação por horas-uso (quota proporcional às horas do período) e por produção (quota proporcional ao volume)
2. Gerente pode ativar dual-track CPC vs Fiscal (opt-in por organização) com taxas aceleradas RFB mantendo valores contábil e fiscal independentes
3. Gerente pode registrar impairment quando valor contábil excede valor recuperável
4. Gerente pode criar hierarquia pai-filho de até 3 níveis com depreciação independente por componente e TCO agregado no pai
5. Sistema previne referência circular na hierarquia e guarda profundidade no schema
   **Plans**: TBD

### Phase 23: Imobilizado em Andamento e Relatórios

**Goal**: Gerente pode registrar obras em andamento com aportes parciais e ativação — e visualizar relatórios patrimoniais, dashboard TCO e inventário físico reconciliado
**Depends on**: Phase 17, Phase 18, Phase 20, Phase 21
**Requirements**: IMOB-01, IMOB-02, RELP-01, RELP-02, RELP-03
**Success Criteria** (what must be TRUE):

1. Gerente pode registrar projeto de obra com orçamento, vincular CPs como aportes parciais e acompanhar orçamento vs realizado
2. Gerente pode ativar obra concluída (transfere custo acumulado para ativo ativo, inicia depreciação a partir da ativação)
3. Gerente pode gerar relatório patrimonial (bruto/acumulado/líquido por classe e fazenda) e schedule de depreciação (12/36/60 meses) em PDF e Excel
4. Gerente pode visualizar dashboard com valor total patrimônio, depreciação YTD, custo/hora por frota e alerta reparo vs troca (manutenção > 60-70% reposição)
5. Gerente pode realizar inventário físico (scan QR) e conciliar com registros contábeis gerando relatório de divergências
   **Plans**: TBD

### Phase 24: Ativos Biológicos e Leasing

**Goal**: Gerente pode registrar ativos biológicos com classificação CPC 27 vs 29, mensurar valor justo e acompanhar maturidade de perenes — além de registrar operações de leasing (CPC 06) com direito de uso e passivo de arrendamento
**Depends on**: Phase 17, Phase 19
**Requirements**: BIOL-01, BIOL-02, BIOL-03, BIOL-04, FINP-05
**Success Criteria** (what must be TRUE):

1. Gerente pode registrar ativo biológico com classificação explícita: planta portadora (CPC 27, depreciável) vs animal (CPC 29, valor justo)
2. Gerente pode registrar mensuração a valor justo por período (arroba CEPEA, ESALQ) com ganho/perda reconhecido no P&L
3. Gerente pode acompanhar maturidade de lavouras perenes (formação → produção) com custos capitalizados e reclassificação após 1ª colheita
4. Gerente pode visualizar dashboard biológico (valor total rebanho + lavouras, variação no período) e produto colhido transferido para estoque a valor justo
5. Gerente pode registrar leasing (CPC 06) com ativo de direito de uso + passivo de arrendamento e amortização com juros efetivos
   **Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Fundação Financeira | v1.0 | 3/3 | Complete | 2026-03-16 |
| 2. Núcleo AP/AR | v1.0 | 7/7 | Complete | 2026-03-16 |
| 3. Dashboard Financeiro | v1.0 | 2/2 | Complete | 2026-03-16 |
| 4. Instrumentos de Pagamento | v1.0 | 7/7 | Complete | 2026-03-17 |
| 5. Conciliação e Fluxo de Caixa | v1.0 | 6/6 | Complete | 2026-03-17 |
| 6. Crédito Rural | v1.0 | 5/5 | Complete | 2026-03-17 |
| 7. Cadastro de Fornecedores | v1.1 | 4/4 | Complete | 2026-03-17 |
| 8. Requisição e Aprovação | v1.1 | 6/6 | Complete | 2026-03-17 |
| 9. Cotação e Pedido de Compra | v1.1 | Complete | Complete | 2026-03-18 |
| 10. Recebimento de Mercadorias | v1.1 | Complete | Complete | 2026-03-18 |
| 11. Devolução, Orçamento e Saving | v1.1 | Complete | Complete | 2026-03-18 |
| 12. Kanban, Dashboard e Notificações | v1.1 | 5/5 | Complete | 2026-03-18 |
| 13. Kanban DnD Fixes | v1.1 | 3/3 | Complete | 2026-03-19 |
| 14. Stock Reversal + Rating | v1.1 | 2/2 | Complete | 2026-03-19 |
| 15. Frontend API Path Fixes | v1.1 | 1/1 | Complete | 2026-03-19 |
| 16. Cadastro de Ativos | v1.2 | 0/4 | Planned | - |
| 17. Engine de Depreciação | v1.2 | 0/TBD | Not started | - |
| 18. Manutenção e Ordens de Serviço | v1.2 | 0/TBD | Not started | - |
| 19. Integração Financeira — Aquisição | v1.2 | 0/TBD | Not started | - |
| 20. Alienação e Baixa de Ativos | v1.2 | 0/TBD | Not started | - |
| 21. Controle Operacional Avançado | v1.2 | 0/TBD | Not started | - |
| 22. Depreciação Avançada e Hierarquia | v1.2 | 0/TBD | Not started | - |
| 23. Imobilizado em Andamento e Relatórios | v1.2 | 0/TBD | Not started | - |
| 24. Ativos Biológicos e Leasing | v1.2 | 0/TBD | Not started | - |
