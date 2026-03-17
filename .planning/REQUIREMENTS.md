# Requirements: Protos Farm — Financeiro Base

**Defined:** 2026-03-15
**Core Value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.

## v1 Requirements

Requirements for Financeiro Base milestone. Each maps to roadmap phases.

### Contas Bancárias

- [x] **FN-01**: Gerente pode cadastrar contas bancárias com tipo (corrente, poupança, investimento, crédito rural), dados FEBRABAN, vinculação a fazenda(s) e produtor rural, saldo inicial e convênio CNAB
- [x] **FN-02**: Gerente pode cadastrar cartões de crédito corporativos com bandeira, limite, dia de fechamento/vencimento, conta de débito vinculada e portador
- [x] **FN-03**: Gerente pode visualizar saldo atual (real-time) e extrato de cada conta com filtros, saldo projetado (7/15/30/60/90 dias) e dashboard de todas as contas lado a lado
- [x] **FN-04**: Gerente pode registrar transferências entre contas (espelhada), incluindo tarifa, aplicação/resgate de investimento e transferências entre fazendas
- [x] **FN-05**: Gerente pode registrar despesas no cartão (com parcelas), visualizar fatura por período de fechamento, e fechamento gera CP automaticamente com pagamento debitando da conta vinculada
- [x] **FN-06**: Gerente pode importar extrato bancário (OFX/CSV) e conciliar automaticamente com lançamentos do sistema, com graus de confiança (exato/provável/sem match) e ações manuais

### Contas a Pagar

- [x] **FN-07**: Gerente pode registrar contas a pagar com fornecedor, categoria, forma de pagamento, conta bancária, centro de custo, rateio por múltiplos CCs, parcelamento e recorrência
- [x] **FN-08**: Gerente pode dar baixa de pagamento individual ou em lote (bordero) com juros/multa/desconto, gerar arquivo CNAB 240/400, importar retorno bancário para baixa automática e estornar pagamento
- [x] **FN-09**: Gerente pode controlar cheques emitidos e recebidos com datas de emissão/entrega/compensação, status do cheque, saldo contábil vs bancário, alertas de compensação e folha de cheques
- [x] **FN-10**: Gerente pode visualizar aging de CP por faixas de vencimento (7/15/30/60/90/>90/vencidas), receber alertas configuráveis de vencimento e ver calendário financeiro

### Contas a Receber

- [x] **FN-11**: Gerente pode registrar contas a receber com cliente, categoria (venda grãos/gado/leite/arrendamento), vinculação a NF-e, parcelamento, recorrência e produtor rural emitente
- [x] **FN-12**: Gerente pode dar baixa de recebimento com juros/multa/glosa, registrar inadimplência com PDD automática por faixa de aging, renegociar títulos vencidos e visualizar aging de recebíveis

### Fluxo de Caixa e Crédito Rural

- [x] **FN-13**: Gerente pode visualizar fluxo de caixa realizado e projetado com cenários (otimista/realista/pessimista), gráfico de evolução com alerta de saldo negativo, classificação DFC e export
- [x] **FN-14**: Gerente pode cadastrar operações de crédito rural (PRONAF/PRONAMP/funcafé/CPR/crédito livre) com cronograma de parcelas automático (SAC/Price/Bullet + carência), saldo devedor e alertas
- [x] **FN-15**: Proprietário pode ver dashboard financeiro consolidado com saldo total, CP vs CR 7/30 dias, resultado do mês, endividamento, top despesas/receitas e comparativo ano anterior

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Integrações Financeiras

- **FN-INT-01**: CP gerado automaticamente a partir de recebimento de compra (milestone Compras)
- **FN-INT-02**: CP gerado automaticamente a partir de processamento de folha (milestone RH)
- **FN-INT-03**: CP/CR gerado automaticamente a partir de compra/venda de ativo (milestone Patrimônio)
- **FN-INT-04**: Lançamento contábil automático para toda baixa de CP/CR (milestone Contabilidade)

### Funcionalidades Avançadas

- **FN-ADV-01**: Integração Open Finance API para importação automática de extratos
- **FN-ADV-02**: Emissão de boletos bancários com homologação por banco
- **FN-ADV-03**: Importação de NF-e XML para conferência contra pedido de compra
- **FN-ADV-04**: Gestão de barter (troca de produção por insumos)
- **FN-ADV-05**: Conciliação de leite (produção vs coleta vs pagamento quinzenal)
- **FN-ADV-06**: Funcionalidades financeiras no app mobile

## Out of Scope

| Feature                      | Reason                                                 |
| ---------------------------- | ------------------------------------------------------ |
| Open Finance API             | Complexidade regulatória, requer certificação bancária |
| Emissão de boletos           | Homologação por banco necessária, Fase 5               |
| NF-e emissão/importação      | Módulo fiscal separado (Fase 5)                        |
| Barter                       | Complexidade contábil de troca por produção futura     |
| CPR emissão                  | Módulo comercialização avançada (Fase 5)               |
| Conciliação de leite         | Módulo específico para laticínios, futuro              |
| Mobile financeiro            | Operação de escritório, web-only neste milestone       |
| PDF parsing para conciliação | Layouts inconsistentes entre bancos, alto risco        |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| FN-01       | Phase 1 | Complete |
| FN-02       | Phase 4 | Complete |
| FN-03       | Phase 1 | Complete |
| FN-04       | Phase 4 | Complete |
| FN-05       | Phase 4 | Complete |
| FN-06       | Phase 5 | Complete |
| FN-07       | Phase 2 | Complete |
| FN-08       | Phase 2 | Complete |
| FN-09       | Phase 4 | Complete |
| FN-10       | Phase 2 | Complete |
| FN-11       | Phase 2 | Complete |
| FN-12       | Phase 2 | Complete |
| FN-13       | Phase 5 | Complete |
| FN-14       | Phase 6 | Complete |
| FN-15       | Phase 3 | Complete |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-15_
_Last updated: 2026-03-15 after roadmap creation_
