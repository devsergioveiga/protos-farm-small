# Requirements: Protos Farm — v1.3 RH e Folha de Pagamento Rural

**Defined:** 2026-03-23
**Core Value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.

## v1.3 Requirements

Requirements for HR and Rural Payroll module. Each maps to roadmap phases.

### Cadastro de Colaboradores e Contratos

- [x] **COLAB-01**: Gerente pode cadastrar colaborador com dados pessoais completos (CPF, RG, PIS/PASEP, CTPS), dados bancários, dependentes (CPF obrigatório, para IRRF e salário-família), dados de saúde, upload de documentos digitalizados, associação a fazendas e status (ativo/afastado/férias/desligado)
- [x] **COLAB-02**: Gerente pode registrar contrato de trabalho com tipo (CLT indeterminado, determinado, safra, intermitente, experiência, aprendiz), dados contratuais (admissão, cargo/CBO, salário, jornada, sindicato), aditivos com histórico, alertas de vencimento (experiência, safra) e geração de PDF
- [x] **COLAB-03**: Gerente pode cadastrar cargos com CBO, faixas salariais (piso/teto + níveis), escalas de trabalho configuráveis (5x2, 6x1, 12x36, turno ordenha), adicionais por cargo, quadro de lotação, histórico de movimentações (promoção, reajuste, transferência) com timeline e reajuste coletivo em lote
- [x] **COLAB-04**: Gerente pode importar colaboradores existentes em massa via CSV/Excel com template, mapeamento flexível, validação (CPF, PIS), preview, relatório pós-importação e saldos iniciais de férias/banco de horas
- [x] **COLAB-05**: Gerente pode visualizar ficha completa do colaborador em tela única com dados pessoais, contrato atual e histórico, evolução salarial (gráfico), holerites 12 meses, saldo de férias/banco de horas, histórico de afastamentos, EPIs entregues, treinamentos e operações de campo vinculadas

### Controle de Ponto e Jornada

- [x] **PONTO-01**: Colaborador pode registrar ponto (entrada, intervalos, saída) via app mobile com geolocalização e timestamp, funcionamento offline com sync, ou via web para administrativos, ou por apontamento do gerente para equipes sem celular, com tolerância configurável e alerta ao gerente se ponto não registrado
- [x] **PONTO-02**: Gerente pode vincular horas trabalhadas a atividades/operações (plantio, colheita, trato, manutenção) por talhão ou pasto, com modo rápido por equipe, totalização diária vs jornada, custo/hora automático e integração com custo de produção por centro de custo
- [x] **PONTO-03**: Sistema calcula automaticamente horas extras (50% dias normais, 100% domingos/feriados), banco de horas com saldo e alerta de vencimento (6 meses), adicional noturno rural (21h-5h, 25%, hora reduzida 52m30s), calendário de feriados (nacional/estadual/municipal), alerta de interjornada <11h e DSR sobre extras
- [x] **PONTO-04**: Gerente pode revisar e aprovar espelho de ponto mensal com identificação visual de inconsistências, correção com justificativa, fluxo de aprovação (gerente → RH → folha), aceite do colaborador, exportação PDF e prazo de fechamento configurável

### Cálculo e Processamento de Folha

- [x] **FOLHA-01**: Contador pode configurar rubricas de proventos (salário, HE 50%/100%, noturno 25%, insalubridade, periculosidade, salário-família, comissão) e descontos (INSS progressiva, IRRF progressiva, VT 6%, moradia até 25%, alimentação até 20%, adiantamento, faltas, pensão), com fórmulas customizáveis e tabelas legais atualizáveis (INSS, IRRF, salário-família com vigência)
- [ ] **FOLHA-02**: Contador pode processar folha mensal em lote com cálculo automático por colaborador (salário proporcional, HE com DSR, noturno, insalubridade, INSS/IRRF/FGTS, moradia/alimentação), encargos patronais (INSS 20%, RAT, FGTS 8%), preview antes de confirmar, recálculo individual, bloqueio se ponto não aprovado e fechamento imutável com possibilidade de estorno
- [x] **FOLHA-03**: Gerente pode registrar adiantamentos salariais com limite configurável (% do salário), adiantamento em lote (dia 15, 40%), desconto automático na folha, recibo PDF e integração com Contas a Pagar
- [ ] **FOLHA-04**: Colaborador pode receber holerite detalhado (proventos, descontos, totais, bases INSS/IRRF/FGTS) em PDF individual ou lote, via email ou app mobile, com histórico acessível na ficha e formato compatível eSocial
- [ ] **FOLHA-05**: Contador pode processar 13º salário em duas parcelas (1ª até 30/nov sem descontos, 2ª até 20/dez com INSS/IRRF), proporcional por meses trabalhados, incluindo médias de HE/noturno, com recibo PDF, encargos patronais e integração financeira/contábil

### Férias, Afastamentos e Rescisão

- [ ] **FERIAS-01**: Gerente pode controlar períodos aquisitivos, programar férias (mín 5 dias, até 3 frações), calcular pagamento (salário + 1/3 + médias – INSS – IRRF), abono pecuniário, alertas de vencimento (60 dias antes do dobro), recibo PDF, pagamento 2 dias antes e calendário visual evitando conflitos com safra
- [ ] **FERIAS-02**: Gerente pode registrar afastamentos (atestado até 15 dias empresa / após INSS, acidente CAT, maternidade 120 dias, paternidade, casamento, falecimento), com impacto automático na folha, estabilidade provisória pós-acidente e controle de retorno com ASO
- [ ] **FERIAS-03**: Contador pode processar rescisão por tipo (sem justa causa, justa causa, pedido, fim safra, acordo mútuo) com cálculo automático (saldo salário, aviso prévio proporcional, 13º prop., férias vencidas+prop.+1/3, multa FGTS 40%/20%), TRCT em PDF, guias GRRF e seguro-desemprego, alerta de prazo 10 dias e integração financeira/contábil
- [ ] **FERIAS-04**: Sistema calcula mensalmente provisão de férias e 13º por colaborador (1/12 salário + 1/3 + encargos), com lançamento contábil automático (despesa DRE + passivo BP), reversão ao pagar, relatório de posição e rateio por centro de custo conforme apontamento de horas

### Obrigações Acessórias e eSocial

- [ ] **ESOCIAL-01**: Contador pode gerar guias de recolhimento (FGTS via GFIP/DCTFWeb, INSS via DARF, IRRF via DARF, contribuição sindical, FUNRURAL via GPS/DARF com alíquota configurável receita bruta vs folha), com calendário de vencimentos, alertas antecipados, histórico e integração com Contas a Pagar
- [ ] **ESOCIAL-02**: Contador pode gerar e transmitir eventos eSocial (tabela: S-1000/S-1005/S-1010/S-1020; não periódicos: S-2190/S-2200/S-2206/S-2230/S-2299; periódicos: S-1200/S-1210/S-1299; SST: S-2210/S-2220/S-2240) em XML conforme leiaute S-1.3, com validação, transmissão via Web Service com certificado digital, controle de protocolo/recibo/retorno, dashboard de status e reprocessamento de rejeitados
- [ ] **ESOCIAL-03**: Contador pode gerar RAIS anual (ou verificar substituição por eSocial), informe de rendimentos por colaborador em PDF (total renda, IRRF retido, INSS), envio por email ou app, com validação de dados e histórico por ano-base

### Segurança do Trabalho Rural (NR-31)

- [ ] **SEGUR-01**: Gerente pode controlar EPIs (cadastro com CA e validade, ficha de entrega por colaborador com data/tipo/assinatura, alertas de vencimento CA e troca, alertas de EPIs obrigatórios por função, controle de estoque, ficha impressa PDF e relatório de conformidade)
- [ ] **SEGUR-02**: Técnico pode gerenciar treinamentos obrigatórios NR-31 (integração, agrotóxicos, máquinas, animais, primeiros socorros, incêndio) com registro (data, carga horária, instrutor, lista presença), validade configurável, alerta de reciclagem 30 dias antes, certificado PDF, matriz de conformidade e alerta ao escalar colaborador sem treinamento válido
- [ ] **SEGUR-03**: Gerente pode controlar ASOs (admissional, periódico, retorno, mudança função, demissional) com registro (médico CRM, resultado apto/inapto, exames), periodicidade configurável, alerta vencimento 30 dias, upload ASO digitalizado, integração com admissão (obrigatório) e rescisão (obrigatório) e relatório de conformidade

### Integração Financeira e Contábil

- [ ] **INTEGR-01**: Ao fechar folha, sistema gera automaticamente lançamentos no Contas a Pagar (salários líquidos, INSS, FGTS, IRRF, contribuição sindical, pensão, VT, FUNRURAL) com vencimentos corretos (salários 5º dia útil, FGTS dia 7, INSS/IRRF dia 20), rateio por centro de custo conforme apontamento, tela de revisão pré-confirmação, estorno/rollback e reconciliação total folha vs total CPs
- [ ] **INTEGR-02**: Ao fechar folha, sistema gera lançamentos contábeis (salários/ordenados despesa, encargos despesa, provisão férias/13º despesa+passivo, INSS/FGTS/IRRF a recolher passivo, salários a pagar passivo) com rateio por centro de custo, regime de competência, baixa de passivo ao pagar, tela de revisão e drill-down DRE por rubrica/departamento/fazenda
- [ ] **INTEGR-03**: Gerente pode visualizar dashboard RH com indicadores (total colaboradores por status/tipo contrato, custo total folha bruto/líquido/encargos, custo médio por colaborador, custo MO por hectare), evolução mensal 12 meses, composição folha (pizza), custo por atividade/cultura, turnover, previsão encerramentos safra 30/60/90 dias, alertas consolidados e filtros por fazenda/departamento/contrato

## v2 Requirements (Deferred)

### Funcionalidades Avançadas

- **ADV-01**: Pagamento por produção (pagamento por tarefa/peça) com integração dados colheita — complexidade alta, risco trabalhista
- **ADV-02**: Integração WhatsApp Business API para envio de holerites — requer aprovação Meta e custos mensais
- **ADV-03**: Relógio de ponto biométrico (hardware) — depende de infraestrutura física por fazenda
- **ADV-04**: Homologação sindical digital de rescisões — dispensada desde Reforma Trabalhista 2017 para maioria dos casos
- **ADV-05**: Background location tracking contínuo durante jornada — requer permissões especiais iOS/Android e EAS custom build

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plano de contas contábil completo | Módulo contabilidade é milestone separado (v1.4) — cost center suficiente para v1.3 |
| Cálculo de folha em tempo real durante registro de ponto | Cria expectativas falsas com dados incompletos; calcular apenas no fechamento |
| Transmissão eSocial síncrona (sem fila) | Portal tem rate limits e janelas de manutenção; fila assíncrona obrigatória |
| DIRF (Declaração do Imposto sobre a Renda Retido na Fonte) | Abolida em 2025, dados fluem via eSocial + EFD-Reinf |
| Pagamento por produção (peça/tarefa) | Complexidade de DSR (OJ 235 TST) e integração com dados colheita — futuro |
| Mobile: funcionalidades completas de folha no app | Web-only para processamento; mobile apenas para ponto e consulta de holerite |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLAB-01 | Phase 25 | Complete |
| COLAB-02 | Phase 25 | Complete |
| COLAB-03 | Phase 25 | Complete |
| COLAB-04 | Phase 25 | Complete |
| COLAB-05 | Phase 25 | Complete |
| FOLHA-01 | Phase 26 | Complete |
| PONTO-01 | Phase 27 | Complete |
| PONTO-02 | Phase 27 | Complete |
| PONTO-03 | Phase 27 | Complete |
| PONTO-04 | Phase 27 | Complete |
| FOLHA-02 | Phase 28 | Pending |
| FOLHA-03 | Phase 28 | Complete |
| FOLHA-04 | Phase 28 | Pending |
| FOLHA-05 | Phase 28 | Pending |
| FERIAS-01 | Phase 29 | Pending |
| FERIAS-02 | Phase 29 | Pending |
| FERIAS-03 | Phase 29 | Pending |
| FERIAS-04 | Phase 29 | Pending |
| SEGUR-01 | Phase 30 | Pending |
| SEGUR-02 | Phase 30 | Pending |
| SEGUR-03 | Phase 30 | Pending |
| ESOCIAL-01 | Phase 31 | Pending |
| ESOCIAL-02 | Phase 31 | Pending |
| ESOCIAL-03 | Phase 31 | Pending |
| INTEGR-01 | Phase 32 | Pending |
| INTEGR-02 | Phase 32 | Pending |
| INTEGR-03 | Phase 32 | Pending |

**Coverage:**
- v1.3 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
