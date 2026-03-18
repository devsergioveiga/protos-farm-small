# Protos Farm — Fase 3: Módulo Financeiro Base

## What This Is

Módulo financeiro base do Protos Farm, cobrindo contas bancárias, cartões de crédito corporativos, contas a pagar, contas a receber, conciliação bancária, fluxo de caixa e gestão de crédito rural. Pré-requisito para integração financeira de compras, folha, patrimônio e contabilidade. Destinado a gerentes financeiros e proprietários de fazendas.

## Core Value

O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing system capabilities -->

- ✓ Monorepo pnpm com backend Express 5 + frontend React 19 + mobile React Native — EPIC-01
- ✓ Autenticação JWT + OAuth, RBAC com papéis hierárquicos, multitenancy RLS — EPIC-02
- ✓ CRUD fazendas com perímetros georreferenciados, produtores, vínculos — EPIC-03
- ✓ Gestão de talhões com mapa, subdivisão, merge, histórico — EPIC-04
- ✓ Rebanho: cadastro animal, lotes, pastos, ficha individual, consulta avançada — EPIC-05
- ✓ App mobile com auth, navegação, sync offline, mapa offline — EPIC-06
- ✓ Operações de campo: plantio, tratos culturais, colheita (grãos, café, laranja) — EPIC-07/08/09
- ✓ Estoque de insumos: produtos, entradas, saídas, alertas, inventário, receituário — EPIC-10
- ✓ Manejo sanitário: doenças, protocolos, vacinação, exames — EPIC-11
- ✓ Manejo reprodutivo: touros, IATF, gestação, parto, desmama — EPIC-12
- ✓ Produção de leite: ordenha, análise, mastite, tanque, lactação — EPIC-13
- ✓ Sincronização offline avançada — EPIC-14
- ✓ Nutrição animal: alimentos, dietas, trato/fornecimento — EPIC-15

### Active

<!-- Milestone: Financeiro Base (EPIC-FN1 a FN4) — 15 stories, 110 pts -->

#### EPIC-FN1: Contas Bancárias (6 stories, 44 pts)

- [ ] US-FN01: Cadastro de contas bancárias (tipos, dados FEBRABAN, vinculação fazenda, saldo inicial, convênio CNAB)
- [ ] US-FN02: Cadastro de cartões de crédito corporativos (bandeira, limite, fechamento, portador, centro de custo)
- [ ] US-FN03: Saldo e extrato por conta bancária (saldo real-time, projetado, dashboard contas, export PDF/Excel)
- [ ] US-FN04: Transferências entre contas (espelhada, tarifa, aplicação/resgate, entre fazendas)
- [ ] US-FN05: Gestão de fatura de cartão (lançamentos, parcelamento, fechamento → CP, pagamento, import CSV/OFX)
- [ ] US-FN06: Conciliação bancária automática (import OFX/CSV/PDF, pareamento com confiança, conciliação mensal)

#### EPIC-FN2: Contas a Pagar (4 stories, 29 pts)

- [ ] US-FN07: Lançamento de contas a pagar (fornecedor, categoria, rateio CC, parcelamento, recorrência, multi-origem)
- [ ] US-FN08: Baixa de pagamento individual e em lote (juros/multa/desconto, CNAB 240/400, retorno bancário, estorno)
- [ ] US-FN09: Gestão de cheques emitidos e recebidos (pré-datados, compensação, saldo contábil vs bancário, folha de cheques)
- [ ] US-FN10: Aging e alertas de contas a pagar (faixas vencimento, alertas configuráveis, digest matinal, calendário)

#### EPIC-FN3: Contas a Receber (2 stories, 16 pts)

- [ ] US-FN11: Lançamento de contas a receber (cliente, categorias rurais, vinculação NF-e, parcelamento, recorrência)
- [ ] US-FN12: Baixa de recebimento e inadimplência (juros/multa/glosa, PDD automática, renegociação, aging)

#### EPIC-FN4: Fluxo de Caixa e Crédito Rural (3 stories, 21 pts)

- [ ] US-FN13: Fluxo de caixa realizado e projetado (cenários otimista/realista/pessimista, alerta saldo negativo, classificação DFC)
- [ ] US-FN14: Gestão de operações de crédito rural (PRONAF/PRONAMP/funcafé/CPR, cronograma parcelas, amortização SAC/Price/Bullet)
- [ ] US-FN15: Dashboard financeiro consolidado (saldo total, CP vs CR 7/30d, resultado mês, endividamento, top despesas/receitas)

### Out of Scope

<!-- Explícito para evitar scope creep -->

- Open Finance API (integração bancária automática) — complexidade regulatória, futuro
- Emissão de boletos bancários — requer homologação por banco, Fase 5
- NF-e emissão/importação — módulo fiscal separado (Fase 5)
- Barter (troca de produção por insumos) — complexidade contábil, futuro
- CPR emissão — módulo de comercialização avançada (Fase 5)
- Conciliação de leite (produção vs coleta vs pagamento) — módulo específico, futuro
- Mobile: funcionalidades financeiras no app mobile — escopo web-only neste milestone

## Context

### Particularidades do Financeiro Rural

- Múltiplos produtores fiscais por fazenda, cada um com contas bancárias próprias
- Crédito rural subsidiado: Plano Safra, PRONAF, PRONAMP com carência e amortização específicas
- Sazonalidade: receita concentrada em 2-3 meses de safra, despesas o ano todo
- FUNRURAL: contribuição sobre receita bruta descontada pelo comprador na NF
- Cheques pré-datados ainda são comuns em transações rurais

### Integrações Futuras (preparar interfaces)

- Compras (Fase 3 próximo milestone): recebimento + NF gera CP automaticamente
- Folha (Fase 3): processamento gera CP (salários, encargos)
- Patrimônio (Fase 3): compra gera CP, venda gera CR
- Contabilidade (Fase 3): toda baixa gera lançamento contábil

### Padrões Existentes Reutilizáveis

- Módulos backend colocalizados: `modules/{domínio}/controller+service+routes+types`
- Frontend: modais para CRUD, páginas com tabs, sidebar com grupos
- Estoque de insumos como referência arquitetural (CRUD + movimentações + alertas + dashboard)

## Constraints

- **Tech stack**: Mesmo monorepo — Express 5, React 19, Prisma 7, PostgreSQL
- **Multitenancy**: Todas as entidades financeiras devem respeitar RLS por organização
- **Centro de custo**: Rateio por fazenda/setor obrigatório em CP e CR
- **Produtor rural**: Contas vinculadas ao produtor (entidade já existente no sistema)
- **CNAB**: Suporte a layouts 240 e 400 para remessa/retorno bancário
- **OFX/CSV**: Importação de extratos para conciliação

## Key Decisions

| Decision                                     | Rationale                                                       | Outcome   |
| -------------------------------------------- | --------------------------------------------------------------- | --------- |
| Financeiro Base primeiro na Fase 3           | Pré-requisito para Compras, Patrimônio, RH, Contabilidade       | — Pending |
| 5 milestones separados para Fase 3           | Fase 3 tem 126 stories/865 pts — muito grande para um milestone | — Pending |
| Manter prefixos de módulo (FN, CP, C, P, RH) | Seguir numeração da documentação original                       | — Pending |
| Web-only neste milestone                     | Financeiro é operação de escritório, não de campo               | — Pending |
| Preparar interfaces para integrações futuras | Compras, Folha, Patrimônio vão gerar CP/CR automaticamente      | — Pending |

---

_Last updated: 2026-03-15 after initialization_
