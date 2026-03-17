# Requirements: Protos Farm — Gestão de Compras

**Defined:** 2026-03-17
**Core Value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.

## v1.1 Requirements

Requirements for milestone v1.1. Each maps to roadmap phases.

### Fornecedores

- [ ] **FORN-01**: Gerente pode cadastrar fornecedor com dados fiscais (razão social, CNPJ/CPF, IE, endereço), dados comerciais (contato principal, condição de pagamento padrão, frete CIF/FOB), classificação por categorias, vinculação a produtos do catálogo, upload de documentação, avaliação (rating 1-5), e status (ativo/inativo/bloqueado)
- [ ] **FORN-02**: Gerente pode importar fornecedores em massa via CSV/Excel, consultar CNPJ para preencher dados automaticamente, buscar por nome/CNPJ/categoria/produto/cidade, e exportar listagem (CSV, PDF)
- [ ] **FORN-03**: Gerente pode avaliar fornecedor após cada entrega (prazo, qualidade, preço, atendimento), ver ranking automático por média ponderada, histórico de avaliações, top 3 por categoria, alerta ao cotar com fornecedor rating < 3, e relatório de performance por período

### Requisição de Compra

- [ ] **REQC-01**: Usuário pode criar requisição de compra com tipo (insumo agrícola, pecuário, peça, combustível, EPI, ativo, serviço), itens do catálogo ou descrição livre, quantidade, urgência (normal/urgente/emergencial), justificativa, centro de custo, fazenda, data de necessidade, anexos, e número sequencial automático
- [ ] **REQC-02**: Operador de campo pode criar requisição simplificada via mobile com produto, quantidade, urgência, foto e observação, com geolocalização automática, funcionamento offline, e acompanhamento de status pelo app
- [ ] **REQC-03**: Gerente pode configurar fluxo de aprovação por valor (até R$ X gerente de campo, acima gerente geral, acima de R$ Y aprovação dupla) e por tipo, com tela de aprovação com pendências, ações aprovar/rejeitar/devolver, notificação ao solicitante, aprovação via mobile, delegação temporária, SLA configurável, e histórico para auditoria

### Cotação

- [ ] **COTA-01**: Comprador pode criar solicitação de cotação a partir de requisições aprovadas, selecionar fornecedores (sugestão top 3 por categoria), enviar por email com template configurável, definir prazo de resposta, disponibilizar link para preenchimento online, e registrar cotação recebida via WhatsApp/telefone
- [ ] **COTA-02**: Comprador pode registrar cotações recebidas (preço unitário, prazo entrega, condição pagamento, frete, validade), fazer upload da proposta original, ver mapa comparativo automático (fornecedores x itens), destaque visual de menor/maior preço com diferença %, total por fornecedor com frete e impostos, comparativo de prazo/condição/rating, cálculo de custo financeiro (à vista vs parcelado), histórico de preços, e possibilidade de split entre fornecedores
- [ ] **COTA-03**: Gerente pode aprovar cotação vencedora com justificativa obrigatória se não for menor preço, ver resumo com comparativo de alternativas, aprovação rápida via mobile, e gerar pedido automaticamente após aprovação

### Pedido de Compra

- [ ] **PEDI-01**: Comprador pode emitir pedido de compra (OC) com geração automática a partir de cotação aprovada, número sequencial (OC-YYYY/NNNN), campos adicionais (observações, referências), PDF com layout profissional, envio por email, possibilidade de pedido manual (emergencial com justificativa), status tracking (emitido→confirmado→em trânsito→entregue→cancelado), alerta de prazo vencido, e clone de pedido recorrente

### Recebimento

- [ ] **RECE-01**: Conferente pode registrar recebimento com 6 cenários: (1) NF+mercadoria simultânea, (2) NF antecipada aguardando mercadoria, (3) mercadoria antecipada aguardando NF com entrada provisória/bloqueada, (4) recebimento parcial com saldo pendente e NFs parciais, (5) NF fracionada por fornecedor, (6) compra emergencial sem pedido formal
- [ ] **RECE-02**: Conferente pode fazer conferência física item a item (recebido vs pedido vs NF), registrar divergências (a mais, a menos, substituído, danificado, errado) com foto e ação (devolver/aceitar com desconto/registrar pendência), conferência de qualidade (visual, lote/validade, amostragem), vincular NF (digitação ou import XML/CTE), alerta de divergência >5%, e registro via mobile com foto
- [ ] **RECE-03**: Ao confirmar recebimento+NF: entrada automática no estoque (insumos) ou cadastro de ativo (equipamentos), com suporte a despesas acessórias de fornecedores diferentes, datas registradas separadamente (pedido, recebimento, NF, conferência), status do recebimento, e dashboard de pendências

### Devolução

- [ ] **DEVO-01**: Gerente de estoque pode registrar devolução total ou parcial vinculada ao recebimento, com motivo obrigatório (defeito, validade, produto errado, excedente, especificação divergente), fotos/laudo, ação esperada (troca/crédito/estorno), saída automática do estoque, referência de NF de devolução, notificação ao fornecedor, e acompanhamento da resolução

### Integração Financeira

- [ ] **FINC-01**: Ao confirmar recebimento+NF: lançamento automático no Contas a Pagar com fornecedor, valor, vencimento(s), centro de custo; suporte a despesas acessórias com CPs separados por fornecedor; cenários NF antecipada (CP provisório), recebimento antecipado (CP só com NF), parcial (CP por recebimento); parcelas automáticas da condição do pedido (30/60/90); classificação contábil sugerida; referência cruzada completa (CP→pedido→cotação→requisição); tela de revisão e navegação drill-down
- [ ] **FINC-02**: Gerente financeiro pode definir orçamento de compras por categoria e período (mensal/trimestral/safra), por centro de custo/fazenda, vinculado ao planejamento de safra, com acompanhamento orçado vs requisitado vs comprado vs pago, alerta ao aprovar se ultrapassar orçamento, dashboard de execução orçamentária, projeção de gasto, e relatório de desvios
- [ ] **FINC-03**: Gerente pode ver saving por cotação (diferença maior vs vencedora), saving acumulado por período, histórico de preço por produto (gráfico evolução), indicadores (% compras com cotação formal, % emergenciais, prazo médio ciclo), top 10 produtos por gasto, e top 5 fornecedores por volume

### Dashboard e Acompanhamento

- [ ] **DASH-01**: Comprador/gerente pode ver kanban do fluxo de compras com colunas por etapa (RC Pendente→Aprovada→Em Cotação→OC Emitido→Aguardando Entrega→Recebido→Pago), cards com nº/tipo/solicitante/valor/urgência/dias no estágio, drag & drop com ações obrigatórias, filtros, alertas visuais, e contadores por coluna
- [ ] **DASH-02**: Gerente/diretor pode ver dashboard executivo com indicadores (volume total, nº requisições/pedidos, prazo médio ciclo, % entrega no prazo, saving acumulado), gráficos por categoria e fornecedor, compras urgentes vs planejadas, requisições pendentes com aging, pedidos em atraso, comparativo com período anterior, e filtros por fazenda/período/categoria
- [ ] **DASH-03**: Participantes do processo recebem notificações via push/email/badge em cada etapa relevante (solicitante: aprovação/rejeição/entrega; aprovador: nova pendência/lembrete SLA; comprador: RC aprovada/cotação recebida/prazo entrega; financeiro: recebimento confirmado; gerente: digest diário), com configuração de preferências por canal

## v1.2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Fornecedores

- **FORN-04**: Consulta automática de CNPJ (Receita Federal/SINTEGRA) para auto-preenchimento ao cadastrar fornecedor

### Notificações Avançadas

- **NOTI-01**: Envio automático de RFQ por email com link para preenchimento online pelo fornecedor

## Out of Scope

| Feature                                 | Reason                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| NF-e XML import/parsing completo        | Requer módulo fiscal separado — complexidade de schema SEFAZ                       |
| Portal de fornecedores (login)          | Alto custo, baixo ROI para escala fazenda — fornecedores agro não adotam portais   |
| Leilão reverso / bidding                | Complexidade excessiva para contexto rural — fornecedores são locais e relacionais |
| Credit scoring Serasa/SPC               | Custo API, LGPD, overkill para 10-30 fornecedores conhecidos                       |
| Contratos guarda-chuva (blanket orders) | Fazendas não operam com frame agreements formais                                   |
| EDI / e-procurement                     | Nenhum fornecedor agro local tem capacidade EDI                                    |
| Mobile: funcionalidades financeiras     | Web-only para financeiro por enquanto                                              |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase    | Status  |
| ----------- | -------- | ------- |
| FORN-01     | Phase 7  | Pending |
| FORN-02     | Phase 7  | Pending |
| FORN-03     | Phase 7  | Pending |
| REQC-01     | Phase 8  | Pending |
| REQC-02     | Phase 8  | Pending |
| REQC-03     | Phase 8  | Pending |
| COTA-01     | Phase 9  | Pending |
| COTA-02     | Phase 9  | Pending |
| COTA-03     | Phase 9  | Pending |
| PEDI-01     | Phase 9  | Pending |
| RECE-01     | Phase 10 | Pending |
| RECE-02     | Phase 10 | Pending |
| RECE-03     | Phase 10 | Pending |
| FINC-01     | Phase 10 | Pending |
| DEVO-01     | Phase 11 | Pending |
| FINC-02     | Phase 11 | Pending |
| FINC-03     | Phase 11 | Pending |
| DASH-01     | Phase 12 | Pending |
| DASH-02     | Phase 12 | Pending |
| DASH-03     | Phase 12 | Pending |

**Coverage:**

- v1.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-17_
_Last updated: 2026-03-17 after roadmap creation_
