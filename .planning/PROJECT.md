# Protos Farm — Fase 3: Módulos Administrativos

## Current Milestone: v1.2 Gestão de Patrimônio

**Goal:** Implementar o ciclo de vida completo dos ativos da fazenda — cadastro, depreciação, manutenção preventiva/corretiva, controle operacional, documentação e integração bidirecional com o módulo financeiro (compra, venda, financiamento, leasing).

**Target features:**

- Cadastro de máquinas, veículos, implementos, benfeitorias, terras e ativos biológicos
- Imobilizado em andamento (obras) e ativo composto (hierarquia pai-filho)
- Reforma/ampliação com capitalização, importação em massa, inventário e ficha completa
- Depreciação automática (linear, horas-uso, produção, acelerada) com centro de custo
- Valoração de ativos biológicos (CPC 29/IAS 41) e relatórios patrimoniais
- Manutenção preventiva com planos, OS (CRUD), solicitação mobile, estoque de peças
- Dashboard de manutenção, classificação contábil de OS (despesa/capitalização/diferimento)
- Controle operacional: combustível, documentos, horímetro, custo/hora
- Integração financeira: compra à vista/financiada, NF-e, leasing, troca, venda com ganho/perda
- Baixa por sinistro/descarte, transferência entre fazendas, conciliação patrimonial, dashboard financeiro

## What This Is

Sistema de gestão agrícola completo com módulo financeiro base já operacional (contas bancárias, CP/CR, conciliação, fluxo de caixa, crédito rural). Próximos milestones cobrem compras, patrimônio, RH e contabilidade. Destinado a gerentes financeiros e proprietários de fazendas.

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
- ✓ Contas bancárias com saldo real-time, extrato, tipo Money (decimal.js), FEBRABAN — v1.0
- ✓ Contas a pagar com parcelamento, rateio CC, CNAB 240/400, aging e alertas — v1.0
- ✓ Contas a receber com FUNRURAL, renegociação, PDD, aging — v1.0
- ✓ Cartões corporativos com fatura→CP, cheques pré-datados com máquina de estados — v1.0
- ✓ Transferências entre contas com ledger espelhado — v1.0
- ✓ Conciliação bancária (OFX/CSV) com score matching e ações manuais — v1.0
- ✓ Fluxo de caixa 12 meses com 3 cenários, classificação DFC, alerta saldo negativo — v1.0
- ✓ Crédito rural (PRONAF/PRONAMP/Funcafé/CPR) com amortização SAC/Price/Bullet — v1.0
- ✓ Dashboard financeiro consolidado com saldo, CP/CR, resultado, endividamento — v1.0
- ✓ Fornecedores com dados fiscais, avaliação, ranking, import/export — v1.1
- ✓ Requisição de compra (web + mobile) com fluxo de aprovação configurável — v1.1
- ✓ Cotação a múltiplos fornecedores com mapa comparativo e aprovação justificada — v1.1
- ✓ Pedido de compra formal com PDF e envio por email — v1.1
- ✓ Recebimento e conferência em 6 cenários com geração automática de CP — v1.1
- ✓ Devolução com reversão de estoque, orçamento de compras, saving — v1.1
- ✓ Kanban, dashboard executivo e notificações do fluxo de compras — v1.1

### Active

<!-- v1.2 Gestão de Patrimônio — 44 stories, 295 points, 6 épicos -->

- [ ] Cadastro de máquinas, veículos e implementos com dados de aquisição e operacionais
- [ ] Cadastro de benfeitorias e ativos imóveis com geolocalização
- [ ] Cadastro de terras e imóveis rurais (ativo não depreciável, CPC 27)
- [ ] Imobilizado em andamento (obras com aportes parciais até ativação)
- [ ] Ativo composto com hierarquia pai-filho (até 3 níveis)
- [ ] Reforma e ampliação com capitalização
- [ ] Cadastro de implementos e equipamentos menores
- [ ] Importação em massa de ativos (CSV/Excel)
- [ ] Inventário e busca de ativos com exportação
- [ ] Ficha completa do ativo (TCO, disponibilidade, timeline)
- [ ] Baixa e transferência de ativos entre fazendas
- [ ] Configuração de métodos de depreciação (linear, horas-uso, produção, acelerada)
- [ ] Cálculo automático de depreciação mensal com pro rata die
- [ ] Valoração de ativos biológicos (CPC 29/IAS 41)
- [ ] Relatórios patrimoniais e contábeis
- [ ] Vinculação de ativo a centro de custo (fixo, rateio %, dinâmico)
- [ ] Apropriação de depreciação por centro de custo
- [ ] Apropriação de custo de manutenção por centro de custo
- [ ] Guia de decisão para criação de centro de custo
- [ ] Plano de manutenção preventiva com gatilhos configuráveis
- [ ] Criação e gestão de ordens de serviço (OS)
- [ ] Solicitação de manutenção pelo operador (mobile)
- [ ] Estoque de peças de reposição
- [ ] Dashboard de manutenção e disponibilidade
- [ ] Classificação contábil da OS (despesa/capitalização/diferimento)
- [ ] Diferimento de manutenção como despesa antecipada
- [ ] Provisão mensal de manutenção
- [ ] Registro de abastecimentos (combustível)
- [ ] Controle de documentos e vencimentos (CRLV, seguro, revisão)
- [ ] Atualização de horímetro/odômetro
- [ ] Custo/hora e custo operacional por ativo
- [ ] Compra de ativo à vista com geração de CP
- [ ] Compra de ativo financiada com parcelas no CP
- [ ] Importação e cadastro via NF-e (XML)
- [ ] Compra com múltiplos ativos na mesma NF
- [ ] Leasing e arrendamento mercantil (CPC 06)
- [ ] Troca de ativo com compensação financeira
- [ ] Centro de custo e classificação contábil na aquisição
- [ ] Venda de ativo com cálculo de ganho/perda e geração de CR
- [ ] Baixa por sinistro, descarte ou obsolescência
- [ ] Venda parcelada de ativo
- [ ] Transferência entre fazendas com reavaliação
- [ ] Conciliação patrimonial (físico vs contábil)
- [ ] Dashboard financeiro patrimonial

### Out of Scope

<!-- Explícito para evitar scope creep -->

- Open Finance API (integração bancária automática) — complexidade regulatória, futuro
- Emissão de boletos bancários — requer homologação por banco
- NF-e emissão/importação — módulo fiscal separado
- Barter (troca de produção por insumos) — complexidade contábil, futuro
- CPR emissão — módulo de comercialização avançada
- Conciliação de leite (produção vs coleta vs pagamento) — módulo específico, futuro
- Mobile: funcionalidades financeiras no app mobile — web-only por enquanto
- PDF parsing para conciliação bancária — layouts inconsistentes entre bancos

## Context

### Current State (v1.0 shipped)

Shipped v1.0 Financeiro Base com ~71,600 LOC across 236 files.
Tech stack: Express 5, React 19, Prisma 7, PostgreSQL 16 + PostGIS 3.4.
10 financial pages in sidebar (Contas, CP, CR, Transferências, Cartões, Cheques, Conciliação, Fluxo de Caixa, Crédito Rural, Dashboard Financeiro).
13 cross-phase integration flows verified.
6 minor tech debt items (see v1.0 audit).

### Particularidades do Financeiro Rural

- Múltiplos produtores fiscais por fazenda, cada um com contas bancárias próprias
- Crédito rural subsidiado: Plano Safra, PRONAF, PRONAMP com carência e amortização específicas
- Sazonalidade: receita concentrada em 2-3 meses de safra, despesas o ano todo
- FUNRURAL: contribuição sobre receita bruta descontada pelo comprador na NF
- Cheques pré-datados ainda são comuns em transações rurais

### Integrações Futuras (preparar interfaces)

- Compras (próximo milestone): recebimento + NF gera CP automaticamente
- Folha (futuro): processamento gera CP (salários, encargos)
- Patrimônio (futuro): compra gera CP, venda gera CR
- Contabilidade (futuro): toda baixa gera lançamento contábil

### Padrões Existentes Reutilizáveis

- Módulos backend colocalizados: `modules/{domínio}/controller+service+routes+types`
- Frontend: modais para CRUD, páginas com tabs, sidebar com grupos
- Money type (decimal.js) para aritmética financeira
- CnabAdapter pattern por banco para CNAB 240/400
- Installment generator + cost center rateio validator em packages/shared

## Constraints

- **Tech stack**: Mesmo monorepo — Express 5, React 19, Prisma 7, PostgreSQL
- **Multitenancy**: Todas as entidades devem respeitar RLS por organização
- **Centro de custo**: Rateio por fazenda/setor obrigatório em CP e CR
- **Produtor rural**: Contas vinculadas ao produtor (entidade já existente)
- **CNAB**: Layouts 240 e 400 para remessa/retorno bancário (BB + Sicoob)
- **OFX/CSV**: Importação de extratos para conciliação

## Key Decisions

| Decision                                     | Rationale                                                       | Outcome                                |
| -------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| Financeiro Base primeiro na Fase 3           | Pré-requisito para Compras, Patrimônio, RH, Contabilidade       | ✓ Good — shipped v1.0, fundação sólida |
| 5 milestones separados para Fase 3           | Fase 3 tem 126 stories/865 pts — muito grande para um milestone | ✓ Good — v1.0 completo em 2 dias       |
| Web-only neste milestone                     | Financeiro é operação de escritório, não de campo               | ✓ Good — decisão correta               |
| Money factory (not class)                    | Money(100) funciona sem new keyword                             | ✓ Good — ergonômico                    |
| producerId nullable em BankAccount           | Contas de org não têm produtor, rural sim                       | ✓ Good — flexível                      |
| CnabAdapter pattern por banco                | BB e Sicoob têm extensões proprietárias                         | ✓ Good — extensível                    |
| Cheques como entidade com máquina de estados | Não campo metadata em pagamento                                 | ✓ Good — rastreável                    |
| OFX parser custom (regex SGML, não ofx-js)   | Baixa manutenção, mirrors CNAB pattern                          | ✓ Good — funciona                      |
| Fluxo de caixa 12 meses (não 90 dias)        | Sazonalidade agrícola                                           | ✓ Good — essential                     |
| reconciliation:manage permission separada    | Não financial:\* per spec                                       | ✓ Good — granular                      |

---

_Last updated: 2026-03-19 after v1.2 milestone start_
