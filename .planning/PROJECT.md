# Protos Farm — Fase 3: Módulos Administrativos

## Current Milestone: v1.3 RH e Folha de Pagamento Rural

**Goal:** Implementar o ciclo completo de gestão de pessoas em fazendas — cadastro e contratos, controle de ponto e jornada rural, folha de pagamento com particularidades do trabalhador rural (Lei 5.889/73, NR-31), férias, 13º, rescisão, eSocial, segurança do trabalho e integração bidirecional com os módulos financeiro e contábil.

**Target features:**

- Cadastro de colaboradores com dados pessoais, trabalhistas, dependentes, contratos (CLT, safra, intermitente)
- Cargos, faixas salariais, escalas de trabalho, histórico de movimentações
- Registro de ponto (mobile + web), apontamento por atividade/operação, horas extras, banco de horas
- Folha de pagamento mensal com cálculo automático (INSS, IRRF, FGTS, FUNRURAL, moradia/alimentação)
- Adiantamento salarial, holerites, 13º salário (1ª e 2ª parcela)
- Férias (programação, cálculo, fracionamento), afastamentos/licenças, rescisão (TRCT e guias)
- Provisão mensal de férias e 13º com lançamento contábil
- Guias de recolhimento (FGTS, INSS, IRRF, FUNRURAL), eSocial (eventos XML), RAIS/DIRF
- Controle de EPIs, treinamentos NR-31, ASO/PCMSO
- Integração financeira (folha → Contas a Pagar) e contábil (folha → lançamentos por CC)
- Dashboard de RH e custo de pessoal
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
- ✓ Cadastro de ativos (máquinas, veículos, implementos, benfeitorias, terras, biológicos) — v1.2
- ✓ Depreciação automática (linear, horas-uso, produção, acelerada) com centro de custo — v1.2
- ✓ Manutenção preventiva/corretiva com OS, Kanban, consumo de peças do estoque — v1.2
- ✓ Integração financeira: compra à vista/financiada, NF-e, leasing, venda com ganho/perda — v1.2
- ✓ Controle operacional: combustível, documentos, horímetro, custo/hora — v1.2
- ✓ Hierarquia pai-filho, imobilizado em andamento, reforma com capitalização — v1.2
- ✓ Ativos biológicos (CPC 29), leasing (CPC 06), troca com compensação — v1.2
- ✓ Relatórios e dashboard patrimonial com TCO e indicadores — v1.2

### Active

<!-- v1.3 RH e Folha de Pagamento Rural — 27 stories, 187 points, 7 épicos -->

- [ ] Cadastro completo de colaboradores com dados pessoais, trabalhistas, documentos e dependentes
- [ ] Gestão de contratos de trabalho (CLT, safra, intermitente, experiência, aprendiz)
- [ ] Cargos, faixas salariais, escalas, quadro de lotação e histórico de movimentações
- [ ] Importação em massa de colaboradores (CSV/Excel)
- [ ] Ficha completa do colaborador (contrato, salário, holerites, férias, EPIs, operações)
- [ ] Registro de ponto via mobile (geolocalização, offline) e web
- [ ] Apontamento de horas por atividade/operação com rateio por centro de custo
- [ ] Horas extras, banco de horas, adicional noturno rural (21h-5h, 25%)
- [ ] Espelho de ponto com fluxo de aprovação
- [ ] Configuração de rubricas e parâmetros da folha (INSS, IRRF, moradia, FUNRURAL)
- [ ] Processamento da folha mensal com cálculo automático completo
- [ ] Adiantamento salarial (vale) com desconto automático na folha
- [ ] Geração de holerites (PDF, email, app)
- [ ] Processamento de 13º salário (1ª e 2ª parcela)
- [ ] Gestão de férias (programação, cálculo, fracionamento, calendário visual)
- [ ] Gestão de afastamentos e licenças (atestado, acidente, maternidade, CAT)
- [ ] Processamento de rescisão contratual (TRCT, guias GRRF, seguro-desemprego)
- [ ] Provisão mensal de férias e 13º com lançamento contábil
- [ ] Geração de guias de recolhimento (FGTS, INSS, IRRF, FUNRURAL)
- [ ] Eventos do eSocial (XML, transmissão, dashboard de status)
- [ ] RAIS, DIRF e informe de rendimentos
- [ ] Controle de EPIs com ficha de entrega e alertas de vencimento
- [ ] Controle de treinamentos obrigatórios NR-31 com matriz de conformidade
- [ ] ASO e PCMSO com alertas de vencimento
- [ ] Lançamento automático da folha no financeiro (Contas a Pagar)
- [ ] Lançamento automático da folha na contabilidade (DRE/BP por centro de custo)
- [ ] Dashboard de RH e custo de pessoal

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

### Current State (v1.3 in progress — Phase 25 complete)

Shipped v1.0 Financeiro Base, v1.1 Compras, v1.2 Patrimônio (24 phases, 78 plans).
Phase 25 complete — Cadastro de Colaboradores e Contratos: 13 models, 7 enums, 5 backend modules (employees, contracts, positions, work-schedules, movements), full frontend with 3 pages, 14 modals/components, bulk CSV/XLSX import, 5-tab employee detail page with salary evolution chart. 69 backend tests passing.
Tech stack: Express 5, React 19, Prisma 7, PostgreSQL 16 + PostGIS 3.4.
Módulos financeiros, compras e patrimônio completos com integração bidirecional.
Equipes de campo (field_teams) já existem no módulo de operações — potencial reuso para apontamento de horas.

### Particularidades do Financeiro Rural

- Múltiplos produtores fiscais por fazenda, cada um com contas bancárias próprias
- Crédito rural subsidiado: Plano Safra, PRONAF, PRONAMP com carência e amortização específicas
- Sazonalidade: receita concentrada em 2-3 meses de safra, despesas o ano todo
- FUNRURAL: contribuição sobre receita bruta descontada pelo comprador na NF
- Cheques pré-datados ainda são comuns em transações rurais

### Integrações Existentes (reutilizar)

- Financeiro (v1.0): folha → Contas a Pagar (salários, guias, encargos)
- Compras (v1.1): fornecedores para prestadores de serviço
- Patrimônio (v1.2): custo de mão de obra em manutenção já existe (work_orders)
- Operações de campo: field_teams e apontamento de horas parcialmente implementados
- Contabilidade (futuro): folha → lançamentos contábeis por centro de custo

### Particularidades do Trabalhador Rural

- Lei 5.889/73: jornada, moradia, alimentação e contrato de safra
- Contrato de safra (art. 14-A): prazo determinado vinculado ao ciclo produtivo
- Adicional noturno rural: 21h-5h (não 22h-5h), 25% (não 20%)
- Desconto de moradia: até 25% do salário; alimentação: até 20%
- NR-31: segurança específica para trabalho rural (agrotóxicos, máquinas, animais)
- FUNRURAL patronal: 1,5% + RAT + SENAR sobre receita bruta ou opção pela folha
- eSocial: obrigatório para empregadores rurais
- Safristas: direitos proporcionais pagos ao fim do contrato

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

_Last updated: 2026-03-24 after Phase 25 complete_
