# Requirements: Protos Farm — v1.4 Contabilidade e Demonstrações Financeiras

**Defined:** 2026-03-26
**Core Value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.

## v1.4 Requirements

Requirements for Accounting and Financial Statements module. Each maps to roadmap phases.

### Plano de Contas e Configuração Contábil

- [x] **COA-01**: Contador pode gerenciar plano de contas hierárquico (até 5 níveis) com código, nome, tipo (Ativo, Passivo, PL, Receita, Despesa), natureza (devedora/credora), flag sintético/analítico, flag permite lançamento manual, status ativo/inativo, com CRUD completo e visualização em árvore expansível
- [x] **COA-02**: Sistema carrega template de plano de contas rural pré-configurado (modelo CFC/Embrapa) incluindo contas específicas agropecuárias: ativo biológico (CPC 29), culturas em formação, terras rurais, máquinas agrícolas, crédito rural (PRONAF/Funcafé), FUNRURAL a recolher, obrigações trabalhistas rurais e resultado por cultura
- [x] **COA-03**: Contador pode mapear cada conta analítica para o código referencial SPED (plano L300R rural) com validação de compatibilidade tipo/natureza, possibilidade de N:1 (várias contas internas → 1 referencial), relatório de contas não mapeadas e alerta de obrigatoriedade antes do fechamento
- [x] **COA-04**: Contador pode configurar exercícios fiscais com data início/fim (calendário jan-dez ou safra jul-jun), e períodos contábeis mensais com status (ABERTO, FECHADO, BLOQUEADO), abertura automática do próximo período e impedimento de lançamento em período não aberto
- [x] **COA-05**: Contador pode vincular centros de custo existentes (fazenda, talhão, atividade) a lançamentos contábeis para DRE gerencial por cultura/fazenda, com rateio proporcional quando lançamento envolve múltiplos centros

### Lançamentos Contábeis

- [x] **LANC-01**: Sistema gera lançamentos contábeis automáticos (partidas dobradas) para: liquidação de CP (débito despesa, crédito banco/caixa), recebimento de CR (débito banco/caixa, crédito receita), fechamento de folha (débito despesas pessoal por rubrica, crédito obrigações), depreciação mensal (débito despesa, crédito depreciação acumulada), entrada de estoque (débito estoque, crédito fornecedor) e saída de estoque (débito despesa/custo, crédito estoque)
- [x] **LANC-02**: Contador pode configurar regras de lançamento automático por tipo de operação com conta débito, conta crédito, template de histórico e flag de centro de custo obrigatório, com tela administrativa para mapear operações existentes e preview dos lançamentos antes de ativar
- [x] **LANC-03**: Contador pode criar lançamentos manuais com data, histórico descritivo, múltiplas linhas débito/crédito (partidas dobradas), validação de balanceamento (total débitos = total créditos), vinculação opcional a centro de custo, templates salvos para lançamentos recorrentes e importação de lançamentos via CSV
- [x] **LANC-04**: Contador pode estornar lançamento existente gerando lançamento inverso vinculado ao original, com motivo obrigatório, trail de auditoria (quem, quando, por quê), e impedimento de estorno de lançamentos em períodos fechados
- [x] **LANC-05**: Contador pode registrar saldo de abertura inicial para todas as contas do balanço (wizard pré-populado com saldos existentes: saldo bancário, CP/CR em aberto, valor contábil líquido dos ativos, provisões trabalhistas), como lançamento especial contra conta de Lucros/Prejuízos Acumulados
- [x] **LANC-06**: Sistema garante idempotência nos lançamentos automáticos — re-processamento de operação já contabilizada não gera duplicatas, com constraint único (sourceType + sourceId) e fila de pendências com retry automático

### Razão Contábil e Balancete

- [x] **RAZAO-01**: Contador pode consultar razão contábil (livro razão) por conta e período com saldo anterior, lançamentos em ordem cronológica e saldo progressivo, drill-down para detalhe do lançamento, filtros por centro de custo e exportação PDF/CSV
- [x] **RAZAO-02**: Contador pode gerar balancete de verificação em formato 3 colunas (saldo anterior, movimento, saldo atual) para qualquer período, com totais por grupo de contas, validação de balanceamento (total débitos = total créditos), comparativo com período anterior e exportação PDF/XLSX
- [x] **RAZAO-03**: Contador pode consultar livro diário com todos os lançamentos em ordem cronológica, termos de abertura e encerramento, numeração sequencial, filtros por período/tipo/valor e exportação PDF

### Fechamento Mensal

- [x] **FECH-01**: Contador pode executar fechamento mensal seguindo checklist estruturado com etapas dependentes: (1) verificar ponto aprovado, (2) verificar folha fechada, (3) verificar depreciação processada, (4) verificar lançamentos pendentes na fila, (5) executar conciliação bancária contábil, (6) verificar balancete equilibrado — cada etapa consulta automaticamente o módulo correspondente
- [x] **FECH-02**: Contador pode executar conciliação bancária contábil comparando razão das contas banco (GL) com extratos importados (módulo financeiro v1.0), identificando divergências, permitindo ajustes, com relatório de conciliação exportável
- [x] **FECH-03**: Contador pode fechar período após todas etapas do checklist aprovadas, bloqueando qualquer novo lançamento no período, com possibilidade de reabertura controlada (exige motivo, gera log de auditoria, requer papel de administrador)

### DRE — Demonstração do Resultado do Exercício

- [ ] **DRE-01**: Contador pode gerar DRE com layout rural configurável: Receita Bruta (vendas agrícolas + pecuárias + industrialização), Deduções (FUNRURAL, devoluções), Receita Líquida, CPV (custo dos produtos vendidos por cultura), Lucro Bruto, Despesas Operacionais (administrativas + comerciais + financeiras + depreciação), Resultado Operacional, Variação Valor Justo Ativo Biológico (CPC 29 — seção dedicada), Resultado Antes IR/CSLL, Resultado Líquido
- [ ] **DRE-02**: Contador pode visualizar DRE com análise vertical (% sobre receita líquida), análise horizontal (variação vs período anterior ou mesmo período ano anterior), e colunas comparativas (mês atual, acumulado exercício, mesmo período ano anterior)
- [ ] **DRE-03**: Gerente pode filtrar DRE por centro de custo (fazenda, cultura, talhão) para visão gerencial de rentabilidade por atividade, com ranking de culturas por margem e gráficos comparativos

### Balanço Patrimonial

- [ ] **BP-01**: Contador pode gerar Balanço Patrimonial com classificação rural: Ativo Circulante (caixa/bancos, estoques, créditos rurais de curto prazo), Ativo Não Circulante (imobilizado rural/terras/máquinas, ativo biológico CPC 29, culturas em formação, intangível), Passivo Circulante (fornecedores, obrigações trabalhistas/tributárias, financiamentos CP), Passivo Não Circulante (crédito rural LP, financiamentos LP), PL (capital, reservas, lucros/prejuízos acumulados)
- [ ] **BP-02**: Contador pode visualizar indicadores financeiros calculados automaticamente: Liquidez Corrente (AC/PC), Liquidez Seca ((AC−Estoques)/PC), Endividamento Geral (PE/AT), Composição do Endividamento (PC/PE), ROE (RL/PL), PL por hectare, e evolução dos indicadores ao longo dos períodos com gráficos de tendência

### DFC — Demonstração do Fluxo de Caixa

- [ ] **DFC-01**: Contador pode gerar DFC pelo método direto com três seções (Atividades Operacionais, Investimento, Financiamento), reaproveitando a classificação de fluxo de caixa já existente no módulo financeiro v1.0, com reconciliação do saldo inicial/final de caixa
- [ ] **DFC-02**: Contador pode gerar DFC pelo método indireto partindo do Lucro Líquido (DRE), com ajustes de itens não-caixa (depreciação, provisões, variação valor justo ativo biológico CPC 29), variação de capital de giro (delta CR, estoques, CP, obrigações), e atividades de investimento e financiamento
- [ ] **DFC-03**: Sistema valida cruzamento entre DFC e BP (variação de caixa na DFC = variação da conta caixa/bancos no BP) com alerta automático de divergência

### Vinculação, Relatórios Integrados e SPED

- [ ] **VINC-01**: Contador pode visualizar painel de vinculação e validação cruzada DRE↔BP↔DFC com 4 invariantes: (1) resultado líquido DRE = variação lucros acumulados BP, (2) variação caixa DFC = variação caixa/bancos BP, (3) ativo total BP = passivo total + PL BP, (4) total débitos = total créditos no balancete — com indicador visual verde/vermelho por invariante
- [ ] **VINC-02**: Contador pode gerar relatório integrado de demonstrações financeiras em PDF profissional contendo DRE, BP, DFC e notas explicativas em documento único, com capa, índice, cabeçalho com dados da fazenda/empresa e formatação compatível com exigências de instituições financeiras para crédito rural (PRONAF, Funcafé)
- [ ] **SPED-01**: Contador pode gerar arquivo SPED Contábil (ECD) no formato pipe-delimited da RFB com Blocos 0 (abertura), I (lançamentos e saldos — registros I050, I100, I150/I155, I200/I250, I350/I355), J (demonstrações — J005, J100, J150, J210), 9 (encerramento), usando plano referencial L300R rural
- [ ] **SPED-02**: Sistema executa pré-validação do arquivo ECD antes do download verificando: contas mapeadas ao referencial, períodos fechados, balancete equilibrado, I050 sem duplicatas, totalização I155 consistente — com relatório de erros/avisos e impedimento de download se houver erros críticos
- [ ] **DASH-01**: Gerente pode visualizar dashboard contábil executivo com: resultado acumulado no exercício (card), evolução mensal receita vs despesa (gráfico linha 12 meses), composição de custos por natureza (gráfico pizza), indicadores BP (liquidez, endividamento), alertas (períodos não fechados, lançamentos pendentes, contas sem mapeamento SPED)

## v1.5+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Compliance Fiscal Avançado

- **LALUR-01**: LALUR/ECF — Livro de Apuração do Lucro Real e Escrituração Contábil Fiscal
- **LALUR-02**: Apuração de IR e CSLL com adições e exclusões
- **BUDG-01**: Módulo de planejamento orçamentário por fazenda/cultura
- **BUDG-02**: Orçado vs realizado com variance analysis

### Integrações Avançadas

- **NFE-01**: Emissão de NF-e integrada ao faturamento (requer SEFAZ + certificado digital)
- **BARTER-01**: Contratos de barter com contabilização em commodities
- **CPR-01**: Emissão de CPR (Cédula de Produto Rural) com registro em cartório

## Out of Scope

| Feature | Reason |
|---------|--------|
| LALUR / ECF | Complexidade de especialista tributário, escopo de produto separado |
| Planejamento orçamentário | Categoria de produto separada, não é contabilidade |
| NF-e emissão | Requer homologação SEFAZ + certificado digital, milestone separado |
| Barter / CPR emissão | Operações de comercialização, EPIC futuro |
| Contabilidade de custos ABC | Over-engineering para fazendas, custeio por absorção via centro de custo é suficiente |
| Consolidação multi-empresa | Fazendas tratadas como centros de custo, não como entidades legais separadas |
| LCDPR (Livro Caixa Digital) | Específico para produtor rural PF no Lucro Presumido, avaliar demanda real |
| Bloco K do SPED ECD | Opcional e raramente usado por agropecuárias |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COA-01 | Phase 35 | Complete |
| COA-02 | Phase 35 | Complete |
| COA-03 | Phase 35 | Complete |
| COA-04 | Phase 35 | Complete |
| COA-05 | Phase 35 | Complete |
| LANC-01 | Phase 37 | Complete |
| LANC-02 | Phase 37 | Complete |
| LANC-03 | Phase 36 | Complete |
| LANC-04 | Phase 36 | Complete |
| LANC-05 | Phase 36 | Complete |
| LANC-06 | Phase 37 | Complete |
| RAZAO-01 | Phase 36 | Complete |
| RAZAO-02 | Phase 36 | Complete |
| RAZAO-03 | Phase 36 | Complete |
| FECH-01 | Phase 38 | Complete |
| FECH-02 | Phase 38 | Complete |
| FECH-03 | Phase 38 | Complete |
| DRE-01 | Phase 39 | Pending |
| DRE-02 | Phase 39 | Pending |
| DRE-03 | Phase 39 | Pending |
| BP-01 | Phase 39 | Pending |
| BP-02 | Phase 39 | Pending |
| DFC-01 | Phase 40 | Pending |
| DFC-02 | Phase 40 | Pending |
| DFC-03 | Phase 40 | Pending |
| VINC-01 | Phase 39 | Pending |
| VINC-02 | Phase 41 | Pending |
| SPED-01 | Phase 41 | Pending |
| SPED-02 | Phase 41 | Pending |
| DASH-01 | Phase 40 | Pending |

**Coverage:**
- v1.4 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after initial definition*
