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
- ✓ Contas bancárias: CRUD, saldo real-time, extrato, export PDF/Excel, dashboard — v1.0 Phase 1
- ✓ Contas a pagar: CRUD, parcelamento, rateio CC, baixa, CNAB 240/400, aging, alertas — v1.0 Phase 2
- ✓ Contas a receber: CRUD, FUNRURAL, baixa, renegociação, aging — v1.0 Phase 2
- ✓ Dashboard financeiro: saldo consolidado, CP/CR 7/30d, resultado mês, endividamento — v1.0 Phase 3
- ✓ Transferências entre contas: espelhada, tarifa, aplicação/resgate — v1.0 Phase 4
- ✓ Cartões corporativos: CRUD, fatura, fechamento → CP, parcelamento — v1.0 Phase 4
- ✓ Cheques pré-datados: máquina de estados, compensação, saldo contábil vs bancário — v1.0 Phase 4

### Active

<!-- Milestone v1.1: Conciliação, Fluxo de Caixa e Crédito Rural -->

## Current Milestone: v1.1 Conciliação, Fluxo de Caixa e Crédito Rural

**Goal:** Completar o módulo financeiro base com conciliação bancária automática, projeção de fluxo de caixa 12 meses e gestão de crédito rural

**Target features:**
- Import OFX/CSV com matching por score de confiança (exato/provável/sem match)
- Fluxo de caixa projetado 12 meses com cenários otimista/realista/pessimista e alerta saldo negativo
- Gestão de crédito rural (PRONAF/PRONAMP/Funcafé/CPR) com cronograma SAC/Price/Bullet e carência
- Parcelas de crédito rural alimentam fluxo de caixa e módulo CP

#### EPIC-FN1: Conciliação Bancária

- [ ] US-FN06: Conciliação bancária automática (import OFX/CSV/PDF, pareamento com confiança, conciliação mensal)

#### EPIC-FN4: Fluxo de Caixa e Crédito Rural

- [ ] US-FN13: Fluxo de caixa realizado e projetado (cenários otimista/realista/pessimista, alerta saldo negativo, classificação DFC)
- [ ] US-FN14: Gestão de operações de crédito rural (PRONAF/PRONAMP/funcafé/CPR, cronograma parcelas, amortização SAC/Price/Bullet)

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-03-26 after milestone v1.1 started_
