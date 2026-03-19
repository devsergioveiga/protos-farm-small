# Requirements: Protos Farm — Gestão de Patrimônio

**Defined:** 2026-03-19
**Core Value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.

## v1.2 Requirements

Requirements for milestone v1.2 Gestão de Patrimônio. Each maps to roadmap phases.

### Cadastro de Ativos

- [ ] **ATIV-01**: Gerente pode cadastrar ativo com classificação (máquina, veículo, implemento, benfeitoria, terra, biológico), dados de aquisição (valor, data, NF, fornecedor), número de série, fabricante, tag patrimônio sequencial e fotos
- [ ] **ATIV-02**: Gerente pode atribuir ativo a fazenda, centro de custo (fixo, rateio %, dinâmico) e status (EM_USO, EM_MANUTENÇÃO, INATIVO, BAIXADO, EM_ANDAMENTO) com campos específicos por tipo (HP/RENAVAM para veículos, área m² para benfeitorias, hectares/matrícula para terras)
- [ ] **ATIV-03**: Gerente pode criar hierarquia pai-filho de ativos (até 3 níveis), com custo e depreciação independentes por componente e TCO agregado no pai
- [ ] **ATIV-04**: Gerente pode importar ativos em massa via CSV/Excel com mapeamento de colunas e validação de campos obrigatórios
- [ ] **ATIV-05**: Gerente pode gerar QR code por ativo para scan no mobile que abre a ficha do ativo diretamente
- [ ] **ATIV-06**: Gerente pode visualizar ficha completa do ativo com abas (Dados Gerais, Depreciação, Manutenção, Combustível/Horímetro, Documentos, Financeiro) e buscar/filtrar ativos por tipo, fazenda, status, CC e período de aquisição
- [ ] **ATIV-07**: Gerente pode transferir ativo entre fazendas com atualização obrigatória de centro de custo e registro no histórico

### Depreciação

- [ ] **DEPR-01**: Gerente pode configurar depreciação linear por ativo (valor residual, vida útil) com cálculo automático de quota mensal e pro rata die no mês de aquisição e baixa
- [ ] **DEPR-02**: Sistema executa batch mensal de depreciação (idempotente, por organização) gerando uma entrada por ativo por período com atribuição ao(s) centro(s) de custo configurados
- [ ] **DEPR-03**: Gerente pode visualizar ledger de depreciação por ativo (data, método, quota, acumulada, valor contábil) e schedule projetado (passado + futuro)
- [ ] **DEPR-04**: Gerente pode configurar depreciação por horas-uso (quota proporcional às horas utilizadas no período) e por volume de produção (quota proporcional à produção do período)
- [ ] **DEPR-05**: Gerente pode configurar depreciação acelerada com dual-track CPC vs Fiscal (taxas RFB: 25-50% para uso em turnos), mantendo valor contábil e fiscal independentes (opt-in por organização)
- [ ] **DEPR-06**: Gerente pode registrar teste de impairment (valor recuperável) quando valor contábil excede valor recuperável, com redução ao valor recuperável registrada no ledger

### Manutenção (CMMS)

- [ ] **MANU-01**: Gerente pode criar planos de manutenção preventiva com gatilhos configuráveis (calendário, horímetro, volume de produção) vinculados a um ativo, com estimativa de duração, equipe e peças necessárias
- [ ] **MANU-02**: Gerente pode criar e gerenciar ordens de serviço (OS) com tipo (preventiva/corretiva/reforma), prioridade, equipe, peças do estoque, e máquina de estados (SOLICITADA→APROVADA→EM_EXECUÇÃO→CONCLUÍDA/CANCELADA)
- [ ] **MANU-03**: Gerente deve classificar contabilmente a OS ao concluir (Despesa Operacional, Capitalização ou Diferimento) — campo obrigatório que determina impacto no P&L vs balanço
- [ ] **MANU-04**: Operador no campo pode criar solicitação de manutenção pelo mobile com ativo (scan QR ou seleção), descrição, foto e urgência, que gerente converte em OS
- [ ] **MANU-05**: Gerente pode visualizar dashboard de manutenção com OS abertas por prioridade, ativos em manutenção, preventivas próximas (30 dias), MTBF e MTTR por tipo de ativo
- [ ] **MANU-06**: Gerente pode configurar provisão mensal de manutenção (CPC 25) com valor estimado anual/12, reversão quando custo real é registrado

### Controle Operacional

- [ ] **OPER-01**: Operador pode registrar leituras de horímetro/odômetro por ativo com data, valor e operador, com alerta quando leitura não atualizada há >30 dias
- [ ] **OPER-02**: Operador pode registrar abastecimentos (litros, custo/litro, total R$, operador) com cálculo automático de consumo l/hora e flag quando consumo >20% acima da média da frota
- [ ] **OPER-03**: Gerente pode cadastrar documentos por ativo (CRLV, seguro, revisão, CCIR, ITR) com data de emissão e vencimento, recebendo alertas 30/15/7 dias antes do vencimento
- [ ] **OPER-04**: Gerente pode visualizar custo/hora por ativo (depreciação + manutenção + combustível + seguro / horas usadas) e índice de disponibilidade (% tempo disponível vs em manutenção)

### Integração Financeira

- [ ] **FINP-01**: Ao registrar compra de ativo à vista, sistema gera CP automaticamente via módulo payables existente com fornecedor, valor e vencimento
- [ ] **FINP-02**: Ao registrar compra financiada, sistema gera CP com parcelas (usando installmentGenerator existente) com entrada + número de parcelas + intervalo
- [ ] **FINP-03**: Gerente pode registrar venda de ativo com cálculo automático de ganho/perda (preço venda − valor contábil) e geração de CR, inclusive venda parcelada
- [ ] **FINP-04**: Gerente pode registrar baixa por sinistro (reconhece perda, opcionalmente gera CR para recuperação seguro), descarte ou obsolescência (reconhece valor contábil como despesa)
- [ ] **FINP-05**: Gerente pode registrar leasing/arrendamento (CPC 06) com ativo de direito de uso + passivo de arrendamento e amortização com juros efetivos
- [ ] **FINP-06**: Gerente pode registrar troca de ativo com compensação financeira (baixa do antigo + aquisição do novo com abatimento) e registrar múltiplos ativos na mesma NF

### Ativos Biológicos (CPC 29)

- [ ] **BIOL-01**: Gerente pode registrar ativo biológico (gado, lavoura perene) com classificação explícita CPC 27 (planta portadora — café, laranja, depreciável) vs CPC 29 (animais — valor justo)
- [ ] **BIOL-02**: Gerente pode registrar mensuração a valor justo por período (entrada manual do preço de referência — arroba CEPEA para gado, ESALQ para grãos) com ganho/perda reconhecido no P&L
- [ ] **BIOL-03**: Gerente pode acompanhar maturidade de lavouras perenes (formação → produção) com custos capitalizados durante formação e reclassificação após 1ª colheita
- [ ] **BIOL-04**: Gerente pode visualizar dashboard biológico (valor total rebanho + lavouras a valor justo, variação no período) e separação do produto colhido (valor justo no ponto da colheita → entrada no estoque)

### Imobilizado em Andamento

- [ ] **IMOB-01**: Gerente pode registrar projeto de obra (galpão, silo, irrigação) com orçamento, data estimada de conclusão e aportes parciais vinculados a CPs pagos
- [ ] **IMOB-02**: Gerente pode ativar obra concluída (transfere custo acumulado para ativo ativo, inicia depreciação) e acompanhar orçamento vs realizado

### Relatórios e Inventário

- [ ] **RELP-01**: Gerente pode gerar relatório patrimonial (valor bruto / depreciação acumulada / valor contábil por classe e fazenda) e schedule de depreciação projetado (12/36/60 meses), exportável em PDF e Excel
- [ ] **RELP-02**: Gerente pode visualizar dashboard patrimonial com valor total do patrimônio, depreciação YTD, custo/hora por frota, e alerta quando custo de manutenção acumulado > 60-70% do valor de reposição
- [ ] **RELP-03**: Gerente pode realizar inventário físico (contagem com scan QR no mobile) e conciliar com registros contábeis, gerando relatório de divergências

## v1.1 Requirements (Shipped)

### Fornecedores

- [x] **FORN-01**: Gerente pode cadastrar fornecedor com dados fiscais (razão social, CNPJ/CPF, IE, endereço), dados comerciais (contato principal, condição de pagamento padrão, frete CIF/FOB), classificação por categorias, vinculação a produtos do catálogo, upload de documentação, avaliação (rating 1-5), e status (ativo/inativo/bloqueado)
- [x] **FORN-02**: Gerente pode importar fornecedores em massa via CSV/Excel, consultar CNPJ para preencher dados automaticamente, buscar por nome/CNPJ/categoria/produto/cidade, e exportar listagem (CSV, PDF)
- [x] **FORN-03**: Gerente pode avaliar fornecedor após cada entrega (prazo, qualidade, preço, atendimento), ver ranking automático por média ponderada, histórico de avaliações, top 3 por categoria, alerta ao cotar com fornecedor rating < 3, e relatório de performance por período

### Requisição de Compra

- [x] **REQC-01**: Usuário pode criar requisição de compra com tipo (insumo agrícola, pecuário, peça, combustível, EPI, ativo, serviço), itens do catálogo ou descrição livre, quantidade, urgência (normal/urgente/emergencial), justificativa, centro de custo, fazenda, data de necessidade, anexos, e número sequencial automático
- [x] **REQC-02**: Operador de campo pode criar requisição simplificada via mobile com produto, quantidade, urgência, foto e observação, com geolocalização automática, funcionamento offline, e acompanhamento de status pelo app
- [x] **REQC-03**: Gerente pode configurar fluxo de aprovação por valor e por tipo, com tela de aprovação com pendências, ações aprovar/rejeitar/devolver, notificação ao solicitante, aprovação via mobile, delegação temporária, SLA configurável, e histórico para auditoria

### Cotação

- [x] **COTA-01**: Comprador pode criar solicitação de cotação a partir de requisições aprovadas, selecionar fornecedores (sugestão top 3 por categoria), enviar por email com template configurável, definir prazo de resposta, e registrar cotação recebida
- [x] **COTA-02**: Comprador pode registrar cotações recebidas, ver mapa comparativo automático (fornecedores x itens), destaque de menor/maior preço, total por fornecedor com frete e impostos, e histórico de preços
- [x] **COTA-03**: Gerente pode aprovar cotação vencedora com justificativa obrigatória se não for menor preço, aprovação rápida via mobile, e gerar pedido automaticamente após aprovação

### Pedido de Compra

- [x] **PEDI-01**: Comprador pode emitir pedido de compra (OC) com número sequencial, PDF com layout profissional, envio por email, pedido emergencial com justificativa, status tracking, alerta de prazo vencido, e clone de pedido recorrente

### Recebimento

- [x] **RECE-01**: Conferente pode registrar recebimento com 6 cenários (NF+mercadoria simultânea, NF antecipada, mercadoria antecipada, parcial, NF fracionada, emergencial sem pedido)
- [x] **RECE-02**: Conferente pode fazer conferência física item a item, registrar divergências com foto e ação, conferência de qualidade, vincular NF
- [x] **RECE-03**: Ao confirmar recebimento+NF: entrada automática no estoque ou cadastro de ativo, com despesas acessórias e dashboard de pendências

### Devolução

- [x] **DEVO-01**: Gerente de estoque pode registrar devolução total ou parcial vinculada ao recebimento, com motivo obrigatório, fotos/laudo, ação esperada, saída automática do estoque, e acompanhamento da resolução

### Integração Financeira (Compras)

- [x] **FINC-01**: Ao confirmar recebimento+NF: lançamento automático no Contas a Pagar com fornecedor, valor, vencimento(s), centro de custo, referência cruzada completa
- [x] **FINC-02**: Gerente financeiro pode definir orçamento de compras por categoria e período, acompanhar orçado vs requisitado vs comprado vs pago, e alerta ao ultrapassar orçamento
- [x] **FINC-03**: Gerente pode ver saving por cotação, saving acumulado por período, histórico de preço por produto, e indicadores de ciclo

### Dashboard e Acompanhamento (Compras)

- [x] **DASH-01**: Comprador/gerente pode ver kanban do fluxo de compras com drag & drop que executa ações reais, filtros e alertas visuais
- [x] **DASH-02**: Gerente/diretor pode ver dashboard executivo com indicadores de volume, prazo, entrega, saving e comparativo por período
- [x] **DASH-03**: Participantes recebem notificações push/email/badge em cada etapa relevante, com configuração de preferências por canal

## Future Requirements

### Fornecedores

- **FORN-04**: Consulta automática de CNPJ (Receita Federal/SINTEGRA) para auto-preenchimento ao cadastrar fornecedor

### Notificações Avançadas

- **NOTI-01**: Envio automático de RFQ por email com link para preenchimento online pelo fornecedor

### Patrimônio Avançado

- **PATR-01**: CIAP (crédito ICMS sobre ativo imobilizado em 48 parcelas) — requer módulo fiscal
- **PATR-02**: Integração IoT/telemática para horímetro automático — complexidade vs benefício não justificada
- **PATR-03**: Manutenção preditiva via ML — requer 2-3 anos de histórico de falhas

## Out of Scope

| Feature | Reason |
|---------|--------|
| NF-e XML import/parsing completo | Requer módulo fiscal separado — complexidade de schema SEFAZ |
| Portal de fornecedores (login) | Alto custo, baixo ROI para escala fazenda |
| Leilão reverso / bidding | Complexidade excessiva para contexto rural |
| Credit scoring Serasa/SPC | Custo API, LGPD, overkill para 10-30 fornecedores |
| IoT / telematics integration | Fragmentação por marca de trator, custo de manutenção |
| Predictive maintenance via ML | Sem histórico suficiente de falhas |
| Asset-level P&L (profit center) | Requer módulo de contabilidade gerencial separado |
| Lease vs buy decision wizard | Inputs variáveis demais para automação confiável |
| Insurance integration (SUSEP API) | Nenhuma API pública disponível por seguradora |
| Full project management (Gantt) for construction | Escopo de gerenciamento de projetos, não patrimônio |
| Mobile: funcionalidades financeiras | Web-only para financeiro por enquanto |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ATIV-01 | TBD | Pending |
| ATIV-02 | TBD | Pending |
| ATIV-03 | TBD | Pending |
| ATIV-04 | TBD | Pending |
| ATIV-05 | TBD | Pending |
| ATIV-06 | TBD | Pending |
| ATIV-07 | TBD | Pending |
| DEPR-01 | TBD | Pending |
| DEPR-02 | TBD | Pending |
| DEPR-03 | TBD | Pending |
| DEPR-04 | TBD | Pending |
| DEPR-05 | TBD | Pending |
| DEPR-06 | TBD | Pending |
| MANU-01 | TBD | Pending |
| MANU-02 | TBD | Pending |
| MANU-03 | TBD | Pending |
| MANU-04 | TBD | Pending |
| MANU-05 | TBD | Pending |
| MANU-06 | TBD | Pending |
| OPER-01 | TBD | Pending |
| OPER-02 | TBD | Pending |
| OPER-03 | TBD | Pending |
| OPER-04 | TBD | Pending |
| FINP-01 | TBD | Pending |
| FINP-02 | TBD | Pending |
| FINP-03 | TBD | Pending |
| FINP-04 | TBD | Pending |
| FINP-05 | TBD | Pending |
| FINP-06 | TBD | Pending |
| BIOL-01 | TBD | Pending |
| BIOL-02 | TBD | Pending |
| BIOL-03 | TBD | Pending |
| BIOL-04 | TBD | Pending |
| IMOB-01 | TBD | Pending |
| IMOB-02 | TBD | Pending |
| RELP-01 | TBD | Pending |
| RELP-02 | TBD | Pending |
| RELP-03 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 38 total
- Mapped to phases: 0
- Unmapped: 38 (pending roadmap creation)

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after v1.2 milestone scoping*
