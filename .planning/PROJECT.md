# Protos Farm — Fase 3: Módulos Administrativos

## Current State

**All 5 milestones shipped.** Fase 3 complete.

**Shipped:** v1.0 Financeiro Base, v1.1 Compras, v1.2 Patrimônio, v1.3 RH e Folha, v1.4 Contabilidade
**Total:** 41 phases, 178 plans shipped across 5 milestones (2026-03-16 to 2026-03-28)

**Next:** `/gsd:new-milestone` to define Fase 4 scope

## What This Is

Sistema de gestão agrícola completo com módulos financeiro, compras, patrimônio e RH já operacionais. Próximo milestone cobre contabilidade completa com plano de contas rural, lançamentos automáticos, fechamento mensal e demonstrações financeiras (DRE, BP, DFC) com vinculação cruzada. Destinado a contadores, gerentes financeiros e proprietários de fazendas.

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
- ✓ Cadastro de colaboradores com dados pessoais, trabalhistas, contratos, cargos, escalas — v1.3
- ✓ Registro de ponto mobile+web, apontamento por atividade, HE/noturno rural, banco de horas — v1.3
- ✓ Folha de pagamento mensal com INSS/IRRF/FGTS/FUNRURAL/moradia, adiantamento, 13º, holerite PDF — v1.3
- ✓ Férias (programação, cálculo, fracionamento), afastamentos com impacto na folha, rescisão com TRCT/GRRF — v1.3
- ✓ Provisão mensal de férias e 13º com lançamento contábil e rateio por CC — v1.3
- ✓ Segurança do trabalho NR-31: EPIs, treinamentos, ASO/PCMSO com alertas e conformidade — v1.3
- ✓ eSocial eventos XML (S-1.3), guias de recolhimento, RAIS, informe de rendimentos — v1.3
- ✓ Integração financeira (folha→CP) e contábil (folha→DRE/BP por CC), dashboard RH — v1.3
- ✓ Plano de contas hierárquico rural (5 níveis) com template CFC/Embrapa e mapeamento SPED L300R — v1.4
- ✓ Regras de lançamento automático por tipo de operação (CP/CR, folha, depreciação, estoque) — v1.4
- ✓ Períodos contábeis e exercícios fiscais com status aberto/fechado — v1.4
- ✓ Lançamentos contábeis manuais com partidas dobradas, estorno, templates e importação CSV — v1.4
- ✓ Razão contábil, balancete de verificação 3 colunas e livro diário — v1.4
- ✓ Fechamento mensal com checklist de 6 etapas e conciliação bancária contábil — v1.4
- ✓ DRE rural com CPC 29, análise V/H, comparativos e filtro por centro de custo — v1.4
- ✓ Balanço Patrimonial com indicadores (liquidez, endividamento, PL/ha) — v1.4
- ✓ DFC método direto e indireto com validação cruzada DFC↔BP — v1.4
- ✓ Painel de vinculação DRE↔BP↔DFC com 4 invariantes — v1.4
- ✓ SPED ECD (blocos 0/I/J/9, plano L300R) com pré-validação PVA — v1.4
- ✓ Relatório integrado PDF profissional (DRE+BP+DFC+notas explicativas) para crédito rural — v1.4
- ✓ Dashboard contábil executivo com resultado acumulado, evolução 12m e alertas — v1.4

### Active

<!-- Next milestone requirements will be defined via /gsd:new-milestone -->

(No active requirements — all Fase 3 requirements validated. Use `/gsd:new-milestone` to define next scope.)

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

### Current State (Fase 3 complete — 2026-03-28)

All 5 milestones of Fase 3 shipped: Financeiro (v1.0), Compras (v1.1), Patrimônio (v1.2), RH/Folha (v1.3), Contabilidade (v1.4).
41 phases, 178 plans shipped across 13 days (2026-03-16 to 2026-03-28).
Tech stack: Express 5, React 19, Prisma 7, PostgreSQL 16 + PostGIS 3.4.
All administrative modules complete with full bidirectional financial/accounting integration.
Complete accounting suite: COA rural 115 contas, auto-posting 12 source types, journal entries, monthly closing, DRE/BP/DFC with 4-invariant cross-validation, SPED ECD, integrated PDF report for crédito rural.

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

| Decision                                      | Rationale                                                       | Outcome                                |
| --------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| Financeiro Base primeiro na Fase 3            | Pré-requisito para Compras, Patrimônio, RH, Contabilidade       | ✓ Good — shipped v1.0, fundação sólida |
| 5 milestones separados para Fase 3            | Fase 3 tem 126 stories/865 pts — muito grande para um milestone | ✓ Good — v1.0 completo em 2 dias       |
| Web-only neste milestone                      | Financeiro é operação de escritório, não de campo               | ✓ Good — decisão correta               |
| Money factory (not class)                     | Money(100) funciona sem new keyword                             | ✓ Good — ergonômico                    |
| producerId nullable em BankAccount            | Contas de org não têm produtor, rural sim                       | ✓ Good — flexível                      |
| CnabAdapter pattern por banco                 | BB e Sicoob têm extensões proprietárias                         | ✓ Good — extensível                    |
| Cheques como entidade com máquina de estados  | Não campo metadata em pagamento                                 | ✓ Good — rastreável                    |
| OFX parser custom (regex SGML, não ofx-js)    | Baixa manutenção, mirrors CNAB pattern                          | ✓ Good — funciona                      |
| Fluxo de caixa 12 meses (não 90 dias)         | Sazonalidade agrícola                                           | ✓ Good — essential                     |
| reconciliation:manage permission separada     | Não financial:\* per spec                                       | ✓ Good — granular                      |
| Pure calculation engine separado de service   | Testabilidade: 43 tests sem DB, payroll-calculation.service.ts  | ✓ Good — facilita TDD                  |
| Rubricas-sistema auto-seed na migration       | 18 rubricas legais não devem depender de setup manual           | ✓ Good — onboarding instantâneo        |
| Rural night shift 21h-5h hardcoded            | Lei 5.889/73 não permite configuração — jurisprudência clara    | ✓ Good — compliance correto            |
| eSocial XML geração local, transmissão async  | Portal tem rate limits e janelas de manutenção                  | ✓ Good — resiliente                    |
| Absence impact calculado dentro da tx payroll | Consistência: dados de ausência lidos no mesmo snapshot         | ✓ Good — sem race conditions           |
| Pure calculator pattern (DRE/BP/DFC)          | Sem imports Prisma → testável sem DB, segue payroll-calculation | ✓ Good — testabilidade excelente       |
| Auto-posting hooks non-blocking (try/catch)   | GL não deve bloquear operação principal                         | ✓ Good — resiliente                    |
| SpedEcdWriter pure class sem Prisma           | Testável com dados mock, separação de concerns                  | ✓ Good — 7 blocos, validação incluída  |
| SPED L300R plano referencial rural            | Compatível com SPED PVA da RFB para empresas rurais             | ✓ Good — compliance correto            |

---

_Last updated: 2026-03-28 after v1.4 milestone — Fase 3 complete_
