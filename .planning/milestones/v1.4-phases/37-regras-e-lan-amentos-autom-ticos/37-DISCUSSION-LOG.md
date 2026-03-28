# Phase 37: Regras e Lançamentos Automáticos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 37-regras-e-lan-amentos-autom-ticos
**Areas discussed:** Regras de mapeamento, Estratégia de fila, Hooks nos módulos, Tela de pendências

---

## Regras de Mapeamento

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela única com todos os tipos | Uma tela administrativa com tabela listando todas as operações | ✓ |
| Agrupado por módulo | Tabs/accordion por módulo (Financeiro, Folha, etc) | |
| Seed automático + edição | Regras padrão carregadas automaticamente | |

**User's choice:** Tabela única com todos os tipos
**Notes:** Preview no modal mostrado ao usuário e aceito

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pré-populadas + editáveis | Regras criadas automaticamente com mapeamentos padrão | ✓ |
| Vazias — contador configura tudo | Nenhuma regra criada automaticamente | |

**User's choice:** Pré-populadas + editáveis

---

| Option | Description | Selected |
|--------|-------------|----------|
| Preview no modal da regra | Botão 'Pré-visualizar' mostra exemplo com dados reais | ✓ |
| Simulação em lote | Processa todas as operações pendentes em preview | |
| Você decide | Claude escolhe | |

**User's choice:** Preview no modal da regra

---

| Option | Description | Selected |
|--------|-------------|----------|
| Migrar para JournalEntry | Lançamentos automáticos geram JournalEntry com entryType=AUTOMATIC | ✓ |
| Manter AccountingEntry separado | Duas tabelas com dados contábeis | |
| Eliminar AccountingEntry | Remover tabela e código legado | |

**User's choice:** Migrar para JournalEntry

---

| Option | Description | Selected |
|--------|-------------|----------|
| Regra com múltiplas linhas | AccountingRule com AccountingRuleLines (1:N) | ✓ |
| Uma regra por rubrica | Cada rubrica é uma regra separada | |
| Você decide | Claude escolhe | |

**User's choice:** Regra com múltiplas linhas

---

| Option | Description | Selected |
|--------|-------------|----------|
| Template com placeholders | Texto com {{variáveis}} substituídas na geração | ✓ |
| Texto fixo por regra | Histórico estático | |
| Você decide | Claude escolhe | |

**User's choice:** Template com placeholders

---

| Option | Description | Selected |
|--------|-------------|----------|
| Regra por sub-tipo de operação | STOCK_OUTPUT_CONSUMPTION e STOCK_OUTPUT_TRANSFER separados | ✓ |
| Regra com condições | Uma regra com campo condicional | |
| Você decide | Claude escolhe | |

**User's choice:** Regra por sub-tipo de operação

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, com flag isActive | Cada regra tem isActive | ✓ |
| Não, sempre ativa | Deletar para desativar | |
| Você decide | Claude escolhe | |

**User's choice:** Sim, com flag isActive

---

| Option | Description | Selected |
|--------|-------------|----------|
| Não — só novas operações | Alteração só afeta operações futuras | ✓ |
| Sim — reprocessar pendentes | Pendentes reprocessados com nova regra | |
| Você decide | Claude escolhe | |

**User's choice:** Não — só novas operações

---

| Option | Description | Selected |
|--------|-------------|----------|
| Enum extenso no schema | ~15-20 valores cobrindo todos os sub-tipos | ✓ |
| Campo string livre | sourceType como String | |
| Você decide | Claude escolhe | |

**User's choice:** Enum extenso no schema

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inferido da operação | CC extraído automaticamente do contexto (farmId → CostCenter) | ✓ |
| Fixo na regra | Regra define CC padrão | |
| Você decide | Claude escolhe | |

**User's choice:** Inferido da operação

---

| Option | Description | Selected |
|--------|-------------|----------|
| Postados automaticamente | Status POSTED com postedAt imediato | ✓ |
| Criados como DRAFT | Contador aprova/posta manualmente | |
| Config por regra | Flag autoPost por regra | |

**User's choice:** Postados automaticamente

---

| Option | Description | Selected |
|--------|-------------|----------|
| Por organização com seed | organizationId + RLS + seed automático | ✓ |
| Template global + override | Regras globais com sobrescrita por org | |

**User's choice:** Por organização com seed

---

## Estratégia de Fila

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela Postgres como fila | PendingJournalPosting com status PENDING/PROCESSING/COMPLETED/ERROR | ✓ |
| BullMQ + Redis | Processamento assíncrono com workers | |
| Sem fila — direto | JournalEntry criado diretamente sem intermediário | |

**User's choice:** Tabela Postgres como fila
**Notes:** Preview do modelo aceito

---

| Option | Description | Selected |
|--------|-------------|----------|
| Após a transaction | Operação faz commit primeiro, depois tenta GL | ✓ |
| Dentro da transaction | GL criado atomicamente com operação | |
| Você decide | Claude escolhe | |

**User's choice:** Após a transaction

---

| Option | Description | Selected |
|--------|-------------|----------|
| Botão retry manual na tela | Tela de pendências mostra erros com botão 'Reprocessar' | ✓ |
| Retry automático com backoff | 3 tentativas com intervalo crescente | |
| Ambos | Manual + cron automático | |

**User's choice:** Botão retry manual na tela

---

| Option | Description | Selected |
|--------|-------------|----------|
| Silenciosamente ignora | Se já existe COMPLETED, não faz nada | ✓ |
| Retorna aviso ao usuário | Toast 'Lançamento já gerado' | |
| Você decide | Claude escolhe | |

**User's choice:** Silenciosamente ignora

---

| Option | Description | Selected |
|--------|-------------|----------|
| Não cria PendingJournalPosting | Se não há regra ativa, não gera nada | ✓ |
| Cria com status SKIPPED | Registra tentativa para auditoria | |
| Você decide | Claude escolhe | |

**User's choice:** Não cria PendingJournalPosting

---

| Option | Description | Selected |
|--------|-------------|----------|
| Re-busca da origem no retry | Armazena apenas sourceType + sourceId | ✓ |
| Snapshot JSON na pendência | Cópia dos dados em campo JSON | |
| Você decide | Claude escolhe | |

**User's choice:** Re-busca da origem no retry

---

| Option | Description | Selected |
|--------|-------------|----------|
| Um PendingJournalPosting → um JournalEntry multi-linha | Regra define todas as linhas | ✓ |
| Múltiplos PendingJournalPosting | Um por rubrica | |

**User's choice:** Um PendingJournalPosting → um JournalEntry multi-linha

---

| Option | Description | Selected |
|--------|-------------|----------|
| payrollRunId — um por run | JournalEntry com valores agregados | ✓ |
| payrollRunItemId — um por funcionário | JournalEntry por funcionário | |
| Você decide | Claude escolhe | |

**User's choice:** payrollRunId — um por run

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, com ruleId | Campo accountingRuleId para rastreabilidade | ✓ |
| Não, só sourceType/Id | Rastreio apenas por origem | |
| Você decide | Claude escolhe | |

**User's choice:** Sim, com ruleId

---

| Option | Description | Selected |
|--------|-------------|----------|
| Campos sourceType/sourceId no JournalEntry | Consulta direta sem join | ✓ |
| Só via PendingJournalPosting | JournalEntry não sabe sua origem | |
| Você decide | Claude escolhe | |

**User's choice:** Campos sourceType/sourceId no JournalEntry

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, estorno automático em cascata | Gera lançamento de estorno GL automaticamente | ✓ |
| Não, estorno manual | Contador estorna manualmente | |
| Você decide | Claude escolhe | |

**User's choice:** Sim, estorno automático em cascata

---

| Option | Description | Selected |
|--------|-------------|----------|
| PendingJournalPosting com status ERROR | Operação funciona, GL fica pendente | ✓ |
| Bloqueia a operação | Operação impedida se período fechado | |
| Lança no próximo período aberto | Pode distorcer temporalmente | |

**User's choice:** PendingJournalPosting com status ERROR

---

## Hooks nos Módulos

| Option | Description | Selected |
|--------|-------------|----------|
| Chamada direta ao service | Cada módulo chama autoPostingService.process() | ✓ |
| Event emitter (pub/sub) | Eventos com listener central | |
| Decorator/middleware | Decorator nos endpoints | |

**User's choice:** Chamada direta ao service

---

| Option | Description | Selected |
|--------|-------------|----------|
| Módulo novo: auto-posting/ | auto-posting.service.ts, types, routes | ✓ |
| Dentro de journal-entries/ | Estender módulo existente | |
| accounting-rules/ + accounting-engine/ | Dois módulos separados | |

**User's choice:** Módulo novo: auto-posting/

---

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-posting.service com switch/map | Map sourceType → função extratora centralizada | ✓ |
| Cada módulo exporta seu extractor | Distribuído, potenciais deps circulares | |
| Você decide | Claude escolhe | |

**User's choice:** No auto-posting.service com switch/map

---

| Option | Description | Selected |
|--------|-------------|----------|
| Substituir tudo nesta phase | Remove stubs, todos usam auto-posting | ✓ |
| Gradual — só novos hooks | Mantém AccountingEntry para folha | |
| Você decide | Claude escolhe | |

**User's choice:** Substituir tudo nesta phase

---

| Option | Description | Selected |
|--------|-------------|----------|
| depreciationRunId — consolidado | Um JournalEntry por DepreciationRun | ✓ |
| depreciationId — por ativo | Um JournalEntry por ativo | |
| Você decide | Claude escolhe | |

**User's choice:** depreciationRunId — consolidado

---

| Option | Description | Selected |
|--------|-------------|----------|
| Por documento (entryId/outputId) | Um JournalEntry por StockEntry/Output | ✓ |
| Por item | Um JournalEntry por item | |
| Você decide | Claude escolhe | |

**User's choice:** Por documento (entryId/outputId)

---

| Option | Description | Selected |
|--------|-------------|----------|
| receivePayment no receivables | Análoga a settlePayment. Criar se não existir | ✓ |
| Mudança de status | Qualquer update que mude status | |
| Você decide | Claude analisa | |

**User's choice:** receivePayment no receivables

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, migrar para auto-posting | Provisões pelo mesmo fluxo com regras | ✓ |
| Manter separado por agora | Dois sistemas coexistindo | |
| Você decide | Claude decide | |

**User's choice:** Sim, migrar para auto-posting

---

| Option | Description | Selected |
|--------|-------------|----------|
| Período aberto + regra ativa são suficientes | Se falhar, ERROR com mensagem | ✓ |
| Adicionar validação de contas | Verificar contas existem e são analíticas | |
| Você decide | Claude escolhe | |

**User's choice:** Período aberto + regra ativa são suficientes

---

| Option | Description | Selected |
|--------|-------------|----------|
| Remover modelo e módulo | Deletar AccountingEntry, module, enums, ACCOUNT_CODES | ✓ |
| Manter tabela, remover módulo | Tabela fica para histórico | |
| Você decide | Claude escolhe | |

**User's choice:** Remover modelo e módulo

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, eliminar | ACCOUNT_CODES substituído por AccountingRules configuráveis | ✓ |
| Manter como fallback | Dois mecanismos | |

**User's choice:** Sim, eliminar

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reescrever para auto-posting | Novos testes em auto-posting.routes.spec.ts | ✓ |
| Manter e adaptar | Adaptar testes existentes | |
| Você decide | Claude escolhe | |

**User's choice:** Reescrever para auto-posting

---

| Option | Description | Selected |
|--------|-------------|----------|
| Independente — hook na folha padrão | Ausências afetam cálculos, não GL | ✓ |
| Considerar como dependência | Esperar módulo de ausências | |

**User's choice:** Independente — hook na folha padrão

---

## Tela de Pendências

| Option | Description | Selected |
|--------|-------------|----------|
| Tab na JournalEntriesPage | 3 tabs: Lançamentos, Pendências, Regras | ✓ |
| Página dedicada /auto-postings | Página separada | |
| Dentro de cada módulo | Distribuído | |

**User's choice:** Tab na JournalEntriesPage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tab na JournalEntriesPage | 3 tabs incluindo Regras | ✓ |
| Página separada /accounting-rules | Item adicional na sidebar | |

**User's choice:** Tab na JournalEntriesPage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Status + Tipo de operação | Filtros suficientes para visão operacional | ✓ |
| Status + Tipo + Período | Mais granular | |
| Você decide | Claude escolhe | |

**User's choice:** Status + Tipo de operação

---

| Option | Description | Selected |
|--------|-------------|----------|
| Status + Tipo + Origem + Data + Ação | Colunas completas com badges e botões | ✓ |
| Adicionar coluna de valor | Incluir amount | |
| Você decide | Claude escolhe | |

**User's choice:** Status + Tipo + Origem + Data + Ação

---

| Option | Description | Selected |
|--------|-------------|----------|
| Expandir/accordion na linha | Clicar expande mostrando erro + retry | ✓ |
| Tooltip no badge de erro | Hover mostra tooltip | |
| Você decide | Claude escolhe | |

**User's choice:** Expandir/accordion na linha

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, botão retry em lote | Reprocessa todos ERRORs de uma vez | ✓ |
| Só retry individual | Cada item com seu botão | |
| Você decide | Claude escolhe | |

**User's choice:** Sim, botão retry em lote

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, badge com count | Vermelho para ERRORs, amarelo para PENDINGs | ✓ |
| Não, só a tab | Sem badges | |
| Você decide | Claude escolhe | |

**User's choice:** Sim, badge com count

---

| Option | Description | Selected |
|--------|-------------|----------|
| Modal | Modal com tipo, isActive, linhas D/C, template, CC flag | ✓ |
| Edição inline | Editar na tabela | |
| Você decide | Claude escolhe | |

**User's choice:** Modal

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, link para operação origem | Navega para página do módulo correspondente | ✓ |
| Só texto descritivo | Sem link | |
| Você decide | Claude escolhe | |

**User's choice:** Sim, link para operação origem

---

| Option | Description | Selected |
|--------|-------------|----------|
| Navegar para tab Lançamentos com filtro | Reutiliza visualização existente | ✓ |
| Modal com detalhes | Visualização rápida | |
| Você decide | Claude escolhe | |

**User's choice:** Navegar para tab Lançamentos com filtro

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, badge com entryType | Manual (neutro), Automático (engrenagem), Estorno (vermelho) | ✓ |
| Filtro por entryType | Sem badge, só filtro | |
| Ambos | Badge + filtro | |

**User's choice:** Sim, badge com entryType

---

## Claude's Discretion

- Nomes específicos dos valores do enum extenso de sourceType
- Estrutura interna do data extractor map
- Ordem das colunas e detalhes visuais de badges
- Validação de contas no processamento

## Deferred Ideas

None — discussion stayed within phase scope
