# Requirements: Protos Farm — v1.2 Gestao de Patrimonio

**Defined:** 2026-03-19
**Core Value:** O proprietario/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visao consolidada por fazenda e conta bancaria.

## v1.2 Requirements

Requirements for asset lifecycle management. Each maps to roadmap phases.

### Cadastro de Ativos

- [ ] **ATIV-01**: Gerente pode cadastrar maquinas, veiculos e implementos com dados de aquisicao (NF, fornecedor, valor), operacionais (horimetro, odometro, potencia, combustivel), status e fotos
- [ ] **ATIV-02**: Gerente pode cadastrar benfeitorias e ativos imoveis com geolocalizacao (ponto, linha ou poligono), material de construcao, area e capacidade, visualizando no mapa da fazenda
- [ ] **ATIV-03**: Proprietario pode cadastrar terras e imoveis rurais como ativo nao depreciavel (CPC 27) com documentacao cartoraria, despesas de aquisicao e historico de avaliacoes/reavaliacao
- [ ] **ATIV-04**: Gerente pode cadastrar implementos e equipamentos menores (grades, ordenhadeiras, balancas) com vinculacao a maquina principal quando aplicavel
- [ ] **ATIV-05**: Gerente pode importar ativos em massa via CSV/Excel com mapeamento flexivel de colunas, preview e relatorio pos-importacao
- [ ] **ATIV-06**: Gerente pode visualizar inventario completo com filtros (tipo, categoria, fazenda, status, faixa de valor), busca, totalizacao, exportacao CSV/Excel/PDF e visao em mapa
- [ ] **ATIV-07**: Gerente pode ver ficha completa do ativo com grafico de depreciacao, historico de manutencoes, TCO, indicadores (disponibilidade, custo/hora), timeline de eventos e documentos

### Hierarquia e Imobilizado em Andamento

- [ ] **HIER-01**: Gerente pode cadastrar ativo composto (hierarquia pai-filho ate 3 niveis) onde o pai totaliza valores dos filhos e cada filho tem depreciacao independente
- [ ] **HIER-02**: Gerente pode registrar reforma ou ampliacao de ativo existente com decisao de capitalizar (soma ao valor contabil + reavalia vida util) ou despesa (vai para DRE)
- [ ] **HIER-03**: Gerente pode registrar imobilizado em andamento (obras) acumulando aportes parciais com cronograma de etapas, alerta de orcamento e ativacao ao concluir (inicia depreciacao)

### Depreciacao e Valoracao

- [ ] **DEPR-01**: Contador pode configurar metodo de depreciacao por ativo ou categoria (linear, horas-uso, producao, acelerada) com taxas pre-configuradas RFB e suporte a taxa fiscal vs gerencial
- [ ] **DEPR-02**: Sistema calcula depreciacao mensal automaticamente (job ou gatilho manual) com pro rata die, parada em valor residual, relatorio mensal e possibilidade de estorno/recalculo
- [ ] **DEPR-03**: Contador pode registrar valor justo de ativos biologicos (CPC 29/IAS 41) — rebanho por categoria com preco de mercado e culturas perenes por estagio — com variacao registrada no resultado
- [ ] **DEPR-04**: Contador pode gerar relatorios patrimoniais (inventario geral, depreciacao acumulada, movimentacao, ativos biologicos, TCO) com filtros e exportacao PDF/Excel/CSV

### Centro de Custo Patrimonial

- [ ] **CCPA-01**: Contador pode vincular cada ativo a centro de custo (fixo, rateio % ou dinamico por horas-maquina do periodo) para depreciacao e manutencao serem apropriadas corretamente
- [ ] **CCPA-02**: Processamento mensal de depreciacao gera lancamentos detalhados por centro de custo com conciliacao automatica (soma CCs = total depreciacao)
- [x] **CCPA-03**: Custos de manutencao (OS) sao apropriados por centro de custo com possibilidade de rateio manual ou heranca do CC do ativo
- [ ] **CCPA-04**: Sistema oferece guia de decisao (wizard) para orientar criacao de centro de custo por ativo com exemplos e templates por tipo de fazenda

### Manutencao e Ordens de Servico

- [ ] **MANU-01**: Gerente pode criar planos de manutencao preventiva com gatilhos configuraveis (horimetro, km, tempo), calculo automatico da proxima execucao e alerta antecipado
- [ ] **MANU-02**: Gerente pode abrir, acompanhar e encerrar ordens de servico (OS) com registro de pecas (baixa automatica no estoque), horas de mao de obra, custo externo e fotos
- [ ] **MANU-03**: Operador pode solicitar manutencao pelo celular com foto, geolocalizacao automatica e notificacao push ao responsavel, funcionando offline
- [ ] **MANU-04**: Gerente pode controlar estoque de pecas de reposicao com ponto de reposicao, vinculacao de pecas compativeis por maquina e inventario periodico
- [x] **MANU-05**: Gerente pode ver dashboard de manutencao com disponibilidade mecanica, MTBF, MTTR, custo acumulado, OS abertas (kanban) e alertas de manutencoes vencidas
- [x] **MANU-06**: Ao encerrar OS de alto valor, sistema apresenta assistente de classificacao contabil (despesa imediata, capitalizacao ou diferimento) com criterios-guia
- [x] **MANU-07**: Contador pode diferenciar e apropriar despesas antecipadas (diferimento) de manutencoes grandes que restauram condicao original sem aumentar vida util
- [x] **MANU-08**: Contador pode configurar provisao mensal de manutencao por ativo ou frota com lancamento automatico e conciliacao com gastos reais

### Controle Operacional e Documentacao

- [ ] **OPER-01**: Gerente pode registrar abastecimentos (combustivel) por ativo com custo/litro, custo/hora e benchmarking de eficiencia contra media da frota
- [ ] **OPER-02**: Gerente pode controlar documentos com vencimento (CRLV, seguro, revisao) com alertas automaticos antecipados e calendario de vencimentos
- [ ] **OPER-03**: Operador pode atualizar horimetro/odometro de forma rapida pelo mobile com validacao anti-regressao
- [ ] **OPER-04**: Sistema calcula custo/hora e custo operacional por ativo (aquisicao + depreciacao + manutencao + combustivel + seguro) para analise de viabilidade

### Integracao Financeira — Aquisicao

- [ ] **AQUI-01**: Ao cadastrar ativo com valor de aquisicao, sistema gera CP automaticamente no modulo financeiro com fornecedor, valor, vencimento e centro de custo
- [ ] **AQUI-02**: Gerente pode registrar compra financiada de ativo com dados do financiamento e parcelas geradas automaticamente no CP (reuso do installmentGenerator)
- [ ] **AQUI-03**: Gerente pode importar dados do ativo a partir de NF-e (XML) com preenchimento automatico de fornecedor, valor, itens e dados fiscais
- [ ] **AQUI-04**: Gerente pode registrar compra com multiplos ativos na mesma NF, cada um gerando registro patrimonial e rateio proporcional das despesas acessorias
- [ ] **AQUI-05**: Gerente pode registrar leasing e arrendamento mercantil (CPC 06) com parcelas no CP e controle de opcao de compra ao final do contrato
- [ ] **AQUI-06**: Gerente pode registrar troca de ativo (trade-in) com compensacao financeira automatica (valor do ativo antigo abatido do novo)
- [ ] **AQUI-07**: Cada aquisicao tem centro de custo e classificacao contabil definidos para apropriacao correta de depreciacao futura

### Integracao Financeira — Venda, Baixa e Saida

- [ ] **DISP-01**: Gerente pode registrar venda de ativo com calculo automatico de ganho/perda contabil (valor venda vs valor contabil) e geracao de CR
- [ ] **DISP-02**: Gerente pode registrar baixa por sinistro, descarte ou obsolescencia com motivo, laudo, valor residual e lancamento de perda
- [ ] **DISP-03**: Gerente pode registrar venda parcelada de ativo com parcelas no CR
- [ ] **DISP-04**: Gerente pode transferir ativo entre fazendas da mesma organizacao com historico e reavaliacao opcional
- [ ] **DISP-05**: Contador pode conciliar patrimonio fisico vs contabil com inventario (contagem fisica vs registro) e gerar ajustes
- [ ] **DISP-06**: Gerente pode ver dashboard financeiro patrimonial com valor total de ativos, depreciacao acumulada, aquisicoes/baixas do periodo e indicadores

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Integracao Avancada

- **INTG-01**: Integracao com telematics/IoT para leitura automatica de horimetro e localizacao GPS
- **INTG-02**: CIAP (credito ICMS sobre ativo) — requer modulo fiscal como prerequisito
- **INTG-03**: NF-e importacao via SEFAZ (consulta automatica) — requer integracao fiscal
- **INTG-04**: Manutencao preditiva baseada em historico de falhas (requer 2-3 anos de dados)

## Out of Scope

| Feature                               | Reason                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| Emissao de NF-e                       | Modulo fiscal separado, complexidade regulatoria                    |
| Integracao IoT/telematics             | Complexidade vs beneficio nao justificada no escopo atual           |
| Manutencao preditiva                  | Requer historico de falhas que ainda nao existe                     |
| CIAP (credito ICMS)                   | Pre-requisito: modulo fiscal                                        |
| Gestao de projetos (Gantt) para obras | Excessivo para o escopo — cronograma de etapas simples e suficiente |

## Traceability

| Requirement | Phase    | Status  |
| ----------- | -------- | ------- |
| ATIV-01     | Phase 16 | Pending |
| ATIV-02     | Phase 16 | Pending |
| ATIV-03     | Phase 16 | Pending |
| ATIV-04     | Phase 16 | Pending |
| ATIV-05     | Phase 16 | Pending |
| ATIV-06     | Phase 16 | Pending |
| ATIV-07     | Phase 16 | Pending |
| DEPR-01     | Phase 17 | Pending |
| DEPR-02     | Phase 17 | Pending |
| CCPA-01     | Phase 17 | Pending |
| CCPA-02     | Phase 17 | Pending |
| MANU-01     | Phase 18 | Pending |
| MANU-02     | Phase 18 | Pending |
| MANU-03     | Phase 18 | Pending |
| MANU-04     | Phase 18 | Pending |
| MANU-05     | Phase 18 | Complete |
| MANU-06     | Phase 18 | Complete |
| MANU-07     | Phase 18 | Complete |
| MANU-08     | Phase 18 | Complete |
| CCPA-03     | Phase 18 | Complete |
| AQUI-01     | Phase 19 | Pending |
| AQUI-02     | Phase 19 | Pending |
| AQUI-03     | Phase 19 | Pending |
| AQUI-04     | Phase 19 | Pending |
| AQUI-07     | Phase 19 | Pending |
| DISP-01     | Phase 20 | Pending |
| DISP-02     | Phase 20 | Pending |
| DISP-03     | Phase 20 | Pending |
| DISP-04     | Phase 20 | Pending |
| DISP-05     | Phase 20 | Pending |
| DISP-06     | Phase 20 | Pending |
| OPER-01     | Phase 21 | Pending |
| OPER-02     | Phase 21 | Pending |
| OPER-03     | Phase 21 | Pending |
| OPER-04     | Phase 21 | Pending |
| HIER-01     | Phase 22 | Pending |
| HIER-02     | Phase 22 | Pending |
| HIER-03     | Phase 22 | Pending |
| DEPR-04     | Phase 23 | Pending |
| CCPA-04     | Phase 23 | Pending |
| DEPR-03     | Phase 24 | Pending |
| AQUI-05     | Phase 24 | Pending |
| AQUI-06     | Phase 24 | Pending |

**Coverage:**

- v1.2 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---

_Requirements defined: 2026-03-19_
_Last updated: 2026-03-19 after roadmap creation_
