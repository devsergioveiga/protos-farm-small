# Feature Research

**Domain:** Brazilian agricultural financial management module (Financeiro Base)
**Researched:** 2026-03-15
**Confidence:** MEDIUM (training data + rich PROJECT.md context; WebSearch unavailable)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any farm financial manager assumes exist. Missing these causes immediate rejection — users will not adopt the system without them.

| Feature                                                                   | Why Expected                                                                  | Complexity | Notes                                                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Cadastro de contas bancárias (nome, banco FEBRABAN, agência, conta, tipo) | Toda fazenda tem 2+ contas. Sem isso não há base para nenhuma movimentação    | LOW        | FEBRABAN lista ~200 bancos; incluir PIX (chaves) e convênio CNAB como campos opcionais              |
| Saldo atual por conta (em tempo real do sistema)                          | Primeira coisa que gerente abre de manhã                                      | LOW        | "Tempo real do sistema" = saldo calculado das movimentações cadastradas, não integração bancária    |
| Lançamento de contas a pagar (fornecedor, valor, vencimento, categoria)   | Qualquer sistema contábil básico tem isso                                     | LOW        | Multi-parcela e recorrência elevam para MEDIUM                                                      |
| Lançamento de contas a receber (cliente, valor, vencimento, categoria)    | Simétrico ao AP; ausência é incompreensível                                   | LOW        | Categorias específicas rurais: venda de grãos, leite, boi, café, cana                               |
| Baixa de pagamento (marcar como pago, data, valor efetivo)                | Sem isso a tela de CP é uma lista estática inútil                             | LOW        | Deve suportar valor diferente do original (juros, desconto, multa)                                  |
| Baixa de recebimento                                                      | Simétrico à baixa de CP                                                       | LOW        | Glosa (desconto sobre NF pelo comprador) é expectativa específica do rural                          |
| Extrato por conta (cronológico, filtros por data)                         | Usuário precisa reconciliar mentalmente antes de confiar                      | MEDIUM     | Export PDF e Excel obrigatório para auditor/contador                                                |
| Categorias / plano de contas simplificado                                 | Sem categorias não há relatório útil                                          | LOW        | Pré-popular com categorias rurais típicas (custeio, colheita, insumos, funcionários, crédito rural) |
| Filtros e buscas em CP/CR                                                 | Fazendas grandes têm 200+ lançamentos/mês                                     | LOW        | Filtrar por: vencimento, fornecedor/cliente, status, fazenda, categoria                             |
| Aging de contas a pagar (vencidas, vencendo em 7/15/30 dias)              | Gerente financeiro precisa saber o que pagar antes de virar                   | MEDIUM     | Faixas: atrasado, hoje, 1-7d, 8-15d, 16-30d, 31-60d, 60d+                                           |
| Aging de contas a receber com inadimplência                               | Receita concentrada em safra; saber quem não pagou é crítico                  | MEDIUM     | Flag de inadimplência + PDD (provisão para devedores duvidosos) mesmo que simples                   |
| Saldo projetado (CP vs CR nos próximos 30/60/90 dias)                     | Sazonalidade forte exige forward view                                         | MEDIUM     | Cruzar CR esperado vs CP a vencer; alertar quando projeção < 0                                      |
| Rateio por fazenda / centro de custo                                      | Múltiplas fazendas por organização — custo sem centro de custo é inutilizável | MEDIUM     | Rateio proporcional ou manual; obrigatório em CP e CR conforme PROJECT.md                           |
| Export de dados (Excel, PDF, CSV)                                         | Contador e banco pedem planilhas                                              | LOW        | Mínimo: export filtrado de CP, CR, extrato por conta                                                |
| Dashboard financeiro resumido                                             | Landing page do módulo; sem isso parece inacabado                             | MEDIUM     | Saldo total, CP vencendo 7d, CR esperado 30d, resultado do mês                                      |

### Differentiators (Competitive Advantage)

Features that Brazilian agricultural ERPs (Agrosoft, Aegro, Siagri, FarmGEO) tipicamente não entregam bem, ou entregam como módulos pagos separados.

| Feature                                                                                        | Value Proposition                                                                                           | Complexity | Notes                                                                                                  |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| Gestão de crédito rural (PRONAF, PRONAMP, Funcafé, CPR de troca) com cronograma de amortização | Crédito rural subsidiado é central para 70%+ dos produtores; nenhum ERP integra bem com a operação agrícola | HIGH       | Suportar SAC, Price e Bullet; vincular ao plano safra; alertar vencimentos de parcelas                 |
| Conciliação bancária com import OFX/CSV/PDF                                                    | Reduz 4-8 horas/mês de trabalho manual por fazenda                                                          | HIGH       | Matching por valor+data com score de confiança; workflow de aprovação de itens não conciliados         |
| Fluxo de caixa com cenários (otimista/realista/pessimista) e sazonalidade agrícola             | Produtor precisa de visão de 12 meses considerando safra; não é calendário gregoriano padrão                | HIGH       | Projeção baseada em CP/CR cadastrados + recorrências; exportar para banco (sustenta pedido de crédito) |
| Gestão de cartão corporativo com integração ao CP (fatura vira lançamento)                     | Cartão de crédito corporativo cresceu muito em fazendas; gestor perde controle de gastos facilmente         | MEDIUM     | Import CSV/OFX da fatura; parcelamento automático; portador e CC obrigatórios                          |
| Transferências entre contas com tarifa e aplicações/resgates                                   | Fazenda com 4+ contas precisa de visão consolidada de caixa; transferência sem registro distorce saldo      | MEDIUM     | Suporte a aplicação financeira (rendimento) e resgate; tarifa bancária como lançamento automático      |
| Integração upstream com estoque: saída de insumos gera pré-lançamento de CP                    | Protos Farm já tem módulo de estoque — link automático elimina dupla entrada                                | MEDIUM     | Rascunho de CP gerado quando StockEntry é criada; usuário confirma/edita antes de aprovar              |
| Gestão de cheques pré-datados (emitidos e recebidos)                                           | Cheque pré-datado ainda é padrão em transações rurais no interior do Brasil                                 | HIGH       | Carteira de cheques com data de compensação; saldo bancário real vs contábil; alerta de compensação    |
| Alertas proativos configuráveis (digest matinal por email/notificação)                         | Gestor financeiro não fica no sistema o dia todo                                                            | MEDIUM     | "Vence hoje: R$ 45k em 3 títulos"; configurável por threshold e frequência                             |
| DFC (Demonstração de Fluxo de Caixa) por classificação contábil                                | Pré-requisito para integração com contabilidade (próximo milestone)                                         | HIGH       | Classificar movimentos em Operacional, Investimento, Financiamento desde agora                         |
| FUNRURAL: cálculo e registro automático da contribuição descontada pelo comprador              | Produtor rural não é optante de Simples; FUNRURAL é descontado na NF e raramente registrado corretamente    | MEDIUM     | Campo "desconto FUNRURAL" no CR de venda rural; relatório anual para DITR                              |

### Anti-Features (Commonly Requested, Often Problematic)

Features que parecem óbvias mas criam complexidade desproporcional ao valor neste milestone.

| Feature                                                             | Why Requested                                                                | Why Problematic                                                                                                                                                                                     | Alternative                                                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Open Finance / integração bancária automática (API Banco Central)   | "Não preciso importar arquivo, busca do banco direto"                        | Requer certificado digital ICP-Brasil, cadastro no BACEN como TPP, compliance LGPD específico, e os bancos rurais menores (Sicoob, Sicredi) têm suporte limitado. Prazo de homologação: 6-12 meses. | Manter import OFX/CSV — cobre 95% dos casos com 5% do esforço. Deixar Open Finance para Fase 5.                                     |
| Emissão de boleto bancário                                          | "Quero cobrar meu comprador por boleto"                                      | Exige convênio bancário individual por banco, homologação de certificados, e contratos com a CIP/FEBRABAN. Cada banco tem API diferente.                                                            | Registrar CR com código de barras importado; integração de emissão fica em Fase 5.                                                  |
| NF-e import / SPED automático                                       | "Já que pago a NF, por que digitar de novo?"                                 | NF-e import é módulo fiscal completo (XML, DANFE, chave de acesso, validação SEFAZ). Scope creep enorme.                                                                                            | Vincular campo "número NF" e "chave de acesso" em CP/CR para rastreio; import real em Fase 5 (módulo fiscal).                       |
| Barter (troca de insumo por produção futura)                        | Comum em cerealistas — "pago defensivo com soja"                             | Tratamento contábil é complexo (CPR física, reconhecimento de receita, hedge implícito). Distorce CP/CR convencionais.                                                                              | Registrar barter como CP (insumo) + CR (produção futura) independentes; link manual. Módulo específico em Fase 5.                   |
| Conciliação de leite (produção vs coleta vs pagamento cooperativa)  | Gestor de leite quer ver diferença entre o que foi coletado e o que foi pago | Requer integração com módulo de produção de leite (EPIC-13) e regras específicas de cooperativa (bonificações, descontos, cotas).                                                                   | CR de leite com campo "borderô cooperativa"; reconciliação específica em milestone futuro.                                          |
| Emissão de CPR (Cédula de Produto Rural)                            | "Quero emitir a CPR diretamente no sistema"                                  | CPR exige assinatura digital ICP-Brasil e registro em cartório. Complexidade jurídica e técnica elevada.                                                                                            | Registrar crédito rural CPR como operação de financiamento (US-FN14) sem emissão; emissão em Fase 5.                                |
| App mobile completo para financeiro                                 | "Quero aprovar pagamentos pelo celular"                                      | Financeiro é operação de escritório com documentos físicos, verificação bancária, assinaturas. Mobile-first cria workflow incompleto.                                                               | Web responsivo que funciona em tablet; PROJECT.md já decidiu: web-only neste milestone.                                             |
| Contabilidade automática (lançamentos contábeis por débito/crédito) | "Gera o SPED automaticamente"                                                | Plano de contas contábil, partidas dobradas, e SPED são módulo separado com 30+ stories (Fase 3 Contabilidade).                                                                                     | Preparar campos DFC (classificação de fluxo) e centro de custo agora para facilitar integração futura; não gerar lançamentos ainda. |
| Previsão de caixa com IA / machine learning                         | "Que a IA preveja a receita da safra"                                        | Dados históricos insuficientes nos primeiros 2 anos; safra depende de fatores não-financeiros (clima, preço de commodity). ML sem dados é pior que planilha.                                        | Cenários manuais (otimista/realista/pessimista) com recorrências configuráveis. Melhor controle e mais confiável.                   |

---

## Feature Dependencies

```
[Cadastro de Contas Bancárias]
    └──required by──> [Extrato por Conta]
    └──required by──> [Transferências entre Contas]
    └──required by──> [Conciliação Bancária]
    └──required by──> [Saldo Projetado]

[Lançamento CP]
    └──required by──> [Baixa de Pagamento]
    └──required by──> [Aging CP]
    └──required by──> [CNAB Remessa]
    └──enhances──> [Gestão de Cheques Emitidos]
    └──enhances──> [Fluxo de Caixa Projetado]

[Lançamento CR]
    └──required by──> [Baixa de Recebimento]
    └──required by──> [Aging CR / Inadimplência]
    └──enhances──> [Fluxo de Caixa Projetado]

[Categorias / Centro de Custo]
    └──required by──> [Dashboard Financeiro]
    └──required by──> [Relatório por Categoria]
    └──required by──> [DFC por Classificação]

[Gestão de Cartão Corporativo]
    └──requires──> [Lançamento CP]  (fatura vira CP)
    └──requires──> [Categorias]

[Conciliação Bancária]
    └──requires──> [Cadastro de Contas]
    └──requires──> [Extrato / Movimentações]
    └──enhances──> [Baixa de Pagamento]  (conciliação pode disparar baixa)

[Gestão de Crédito Rural]
    └──requires──> [Lançamento CP]  (parcelas viram CP)
    └──enhances──> [Fluxo de Caixa Projetado]  (cronograma alimenta projeção)

[Fluxo de Caixa Projetado]
    └──requires──> [Lançamento CP]
    └──requires──> [Lançamento CR]
    └──enhances with──> [Gestão de Crédito Rural]  (parcelas futuras)

[Dashboard Financeiro]
    └──requires──> [Cadastro de Contas]
    └──requires──> [Lançamento CP]
    └──requires──> [Lançamento CR]
    └──requires──> [Saldo por Conta]

[Estoque (EPIC-10)] ──future integration──> [Lançamento CP]
    (StockEntry gera pré-lançamento de CP — preparar interface)

[Contabilidade (Fase 3)] ──future integration──> [DFC por Classificação]
    (campos DFC em CP/CR alimentam razão contábil — preparar desde agora)
```

### Dependency Notes

- **Contas bancárias required by extrato:** Extrato não pode existir sem conta — implementar US-FN01 antes de US-FN03.
- **CP required by gestão de cheques:** Cheque emitido é um CP com tipo especial e data de compensação futura — não é entidade separada.
- **CP+CR required by fluxo de caixa:** Projeção de caixa só tem valor quando há volume suficiente de lançamentos — implementar FN13 depois de FN07+FN11.
- **Categorias required by dashboard:** Dashboard sem categorias é só saldo total — sem insight. Categorias devem ser pré-populadas na seed.
- **Crédito rural enhances fluxo de caixa:** Cronograma SAC/Price alimenta CP futuras automaticamente — integrar no modelo de projeção.
- **CNAB depends on CP:** Remessa CNAB (pagamento em lote) é operação sobre conjunto de CP aprovados — implementar depois de US-FN07+FN08.
- **Conciliação bancária conflicts with saldo manual:** Se o usuário edita saldo manual E importa OFX, pode ter dupla contagem. Bloquear edição de saldo após primeira conciliação.

---

## MVP Definition

### Launch With (v1)

Minimum para que o módulo seja adotável por um gerente financeiro real.

- [ ] US-FN01: Cadastro de contas bancárias — base de tudo; sem isso nenhum outro recurso faz sentido
- [ ] US-FN03: Saldo e extrato por conta — primeira coisa verificada; cria confiança no sistema
- [ ] US-FN07: Lançamento de contas a pagar — fluxo operacional mais crítico; pagamentos não param
- [ ] US-FN08: Baixa de pagamento — sem baixa, CP é lista estática sem utilidade
- [ ] US-FN10: Aging e alertas CP — principal motivo de adoção; substitui planilha de controle
- [ ] US-FN11: Lançamento de contas a receber — receita sem controle = não saber se está lucrando
- [ ] US-FN12: Baixa de recebimento e inadimplência — CR sem baixa tem mesmo problema que CP
- [ ] US-FN15: Dashboard financeiro consolidado — landing page do módulo; primeiro impacto

### Add After Validation (v1.x)

Adicionar quando o núcleo estiver estável e com dados reais (1-2 sprints depois do v1).

- [ ] US-FN02: Cartões de crédito corporativos — alto valor mas complexidade adicional; esperar v1 estável
- [ ] US-FN04: Transferências entre contas — necessário quando usuário tem 2+ contas cadastradas
- [ ] US-FN05: Gestão de fatura de cartão — depende de US-FN02
- [ ] US-FN06: Conciliação bancária automática — alto ROI mas alto risco de matching incorreto; validar com dados reais
- [ ] US-FN09: Gestão de cheques — ainda relevante no interior; depende de volume de demanda real
- [ ] US-FN13: Fluxo de caixa projetado com cenários — valioso mas só com 3+ meses de dados históricos

### Future Consideration (v2+)

Defer até que o módulo base esteja consolidado e validado.

- [ ] US-FN14: Gestão de crédito rural (PRONAF, SAC/Price/Bullet) — alta complexidade; implementar quando CP/CR estável
- [ ] CNAB 240/400 remessa/retorno — integração bancária batch; requer testes com banco real
- [ ] Open Finance — complexidade regulatória; Fase 5
- [ ] Emissão de boletos — requer convênio bancário; Fase 5
- [ ] Módulo fiscal / NF-e — escopo separado; Fase 5

---

## Feature Prioritization Matrix

| Feature                               | User Value | Implementation Cost | Priority |
| ------------------------------------- | ---------- | ------------------- | -------- |
| Cadastro contas bancárias (US-FN01)   | HIGH       | LOW                 | P1       |
| Saldo e extrato (US-FN03)             | HIGH       | LOW                 | P1       |
| Lançamento CP (US-FN07)               | HIGH       | MEDIUM              | P1       |
| Baixa de pagamento (US-FN08)          | HIGH       | MEDIUM              | P1       |
| Aging + alertas CP (US-FN10)          | HIGH       | MEDIUM              | P1       |
| Lançamento CR (US-FN11)               | HIGH       | MEDIUM              | P1       |
| Baixa de recebimento (US-FN12)        | HIGH       | MEDIUM              | P1       |
| Dashboard financeiro (US-FN15)        | HIGH       | MEDIUM              | P1       |
| Cartão corporativo (US-FN02)          | MEDIUM     | MEDIUM              | P2       |
| Transferências entre contas (US-FN04) | MEDIUM     | LOW                 | P2       |
| Gestão de fatura cartão (US-FN05)     | MEDIUM     | HIGH                | P2       |
| Conciliação bancária (US-FN06)        | HIGH       | HIGH                | P2       |
| Gestão de cheques (US-FN09)           | MEDIUM     | HIGH                | P2       |
| Fluxo de caixa projetado (US-FN13)    | HIGH       | HIGH                | P2       |
| Crédito rural (US-FN14)               | HIGH       | HIGH                | P3       |
| CNAB remessa/retorno                  | MEDIUM     | HIGH                | P3       |
| Open Finance                          | HIGH       | VERY HIGH           | P3       |

**Priority key:**

- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Análise baseada em conhecimento de treinamento dos principais ERPs rurais brasileiros (Aegro, Siagri, AgroSoft, GestãoAgro, Agromax). Confidence: MEDIUM.

| Feature                            | Aegro / Siagri (market leaders)     | Sistemas genéricos (ContaAzul, Omie adaptados) | Protos Farm — Nossa abordagem                             |
| ---------------------------------- | ----------------------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Contas a pagar/receber             | Completo, mas UI complexa e legada  | Básico, sem especificidades rurais             | CP/CR com categorias rurais pré-populadas, UI moderna     |
| Conciliação bancária               | OFX manual, sem matching automático | OFX básico ou pago em módulo extra             | Matching por score com workflow de aprovação              |
| Crédito rural                      | Presente no Siagri, básico no Aegro | Ausente — tratado como qualquer empréstimo     | Cronograma SAC/Price/Bullet com vínculo ao plano safra    |
| Cheques pré-datados                | Presente mas pouco mantido          | Ausente ou como CP comum                       | Carteira de cheques com saldo bancário vs contábil        |
| FUNRURAL                           | Cálculo manual externo              | Ausente                                        | Campo nativo no CR rural com relatório anual              |
| Dashboard financeiro               | Genérico, sem visão por fazenda     | Genérico                                       | Consolidado por fazenda + por conta + resultado do mês    |
| Integração com operações agrícolas | Fraca — módulos desconectados       | Inexistente                                    | StockEntry → CP pré-lançamento (preparar interface agora) |
| Fluxo de caixa com sazonalidade    | Presente mas calendário gregoriano  | Ausente ou básico                              | Cenários com visão por safra + alertas de saldo negativo  |

---

## Brazilian Rural Financial Domain Notes

Observações específicas do domínio financeiro rural brasileiro que afetam a modelagem das features:

**Sazonalidade extrema:** Receita de grãos concentrada em fev-maio (soja/milho 1a safra) e jun-ago (milho 2a safra). Café em jun-nov. Laranja é mais distribuída. Fluxo de caixa precisa de visão de 12+ meses, não 30/60/90 dias.

**Múltiplos CPFs por fazenda:** Uma fazenda grande pode ter 2-4 produtores rurais como "donos fiscais" diferentes. Cada um tem contas bancárias e crédito rural próprios. O sistema já modela isso (producer → farm_link), mas o financeiro deve vincular conta bancária ao produtor (entidade existente), não apenas à fazenda.

**FUNRURAL obrigatório:** Produtor rural pessoa física paga 2,3% sobre receita bruta. Esse valor é descontado pelo comprador na NF (comprador retém e recolhe). O CR precisa registrar o valor bruto e a dedução FUNRURAL. Sem isso, o resultado financeiro parece maior do que é.

**Crédito rural como instrumento de planejamento:** PRONAF/PRONAMP têm taxas de 5-12% a.a. vs 30%+ do mercado livre. Produtor precisa saber quanto de crédito rural ainda pode contratar (limite por categoria) e quando vencem as parcelas. Esse é um diferencial real do Protos Farm.

**CNAB ainda em uso:** Apesar do PIX, grandes fazendas pagam folha e fornecedores via CNAB 240 (remessa) e recebem confirmação via retorno bancário. Bancos cooperativos (Sicoob, Sicredi) que dominam o rural exigem CNAB para pagamentos em lote.

**Cheque pré-datado:** Em regiões do interior (Mato Grosso, Goiás, Minas Gerais), fornecedor de insumo aceita cheque pré-datado de 90-180 dias no início da safra. Sistema deve tratar cheque como CP com data de compensação separada da emissão, e calcular saldo bancário vs saldo contábil.

---

## Sources

- `PROJECT.md` — Requirements validated and active stories (FN01–FN15), constraints, out-of-scope items. Confidence: HIGH (primary source).
- `MEMORY.md` — Existing modules (EPIC-10 Estoque, EPIC-11–EPIC-15) as integration context. Confidence: HIGH.
- `.planning/codebase/INTEGRATIONS.md` — Tech stack and existing integrations. Confidence: HIGH.
- Training data on Brazilian rural ERP landscape (Aegro, Siagri, AgroSoft, GestãoAgro) — Confidence: MEDIUM (knowledge cutoff Aug 2025; market may have shifted).
- Training data on FEBRABAN CNAB layouts 240/400, BACEN Open Finance regulations, FUNRURAL legislation — Confidence: MEDIUM (stable regulatory frameworks but verify current rates).
- WebSearch unavailable during research — market claims on competitors not independently verified.

---

_Feature research for: Protos Farm — Módulo Financeiro Base (Fase 3)_
_Researched: 2026-03-15_
