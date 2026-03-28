# Phase 37: Regras e Lançamentos Automáticos - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Configuração de regras de mapeamento operação→contas GL e geração automática de lançamentos contábeis (JournalEntry com entryType=AUTOMATIC) quando operações financeiras são concluídas. Inclui: modelo AccountingRule configurável, PendingJournalPosting como fila Postgres, hooks em 6 módulos (CP, CR, folha, depreciação, entrada/saída estoque), idempotência via UNIQUE(sourceType, sourceId), migração completa do AccountingEntry legado (v1.3 stubs), e frontend com tabs Pendências + Regras na JournalEntriesPage existente.

</domain>

<decisions>
## Implementation Decisions

### Regras de Mapeamento

- **D-01:** Tabela única administrativa listando todas as operações. Cada linha mapeia tipo → conta débito + conta crédito + template de histórico + flag CC obrigatório. Modal para edição.
- **D-02:** Regras pré-populadas com mapeamentos padrão quando o template COA rural é criado. Contador só ajusta se necessário.
- **D-03:** Preview de lançamento no modal da regra — botão "Pré-visualizar" mostra exemplo com dados reais da última operação daquele tipo.
- **D-04:** Migrar AccountingEntry (v1.3 stubs) para JournalEntry. Lançamentos automáticos geram JournalEntry com entryType=AUTOMATIC. AccountingEntry vira legado — migrar e depreciar.
- **D-05:** AccountingRule com AccountingRuleLines (1:N). Folha = 1 regra com 5+ linhas (salário D/C, INSS D/C, FGTS D/C etc).
- **D-06:** Template de histórico com placeholders {{variáveis}} substituídas no momento da geração. Variáveis disponíveis dependem do sourceType.
- **D-07:** Regra por sub-tipo de operação — STOCK_OUTPUT_CONSUMPTION e STOCK_OUTPUT_TRANSFER são regras separadas. Sem lógica condicional na regra.
- **D-08:** Cada regra tem flag isActive. Quando inativa, operações não geram lançamento GL.
- **D-09:** Alteração de regra só afeta operações futuras. Lançamentos já postados ficam inalterados (imutabilidade contábil).
- **D-10:** Enum extenso no schema (~15-20 valores) para sourceType cobrindo todos os sub-tipos. Typesafe via Prisma.
- **D-11:** Centro de custo inferido da operação origem (farmId → CostCenter). Regra só define se CC é obrigatório para aquele tipo.
- **D-12:** Lançamentos automáticos postados automaticamente (status POSTED) com postedAt. Sem revisão manual — contador estorna se necessário.
- **D-13:** Regras por organização com seed automático. organizationId + RLS. Seed cria regras junto com template COA.

### Estratégia de Fila

- **D-14:** Tabela Postgres PendingJournalPosting como fila (sem BullMQ/Redis). Status: PENDING → PROCESSING → COMPLETED | ERROR.
- **D-15:** Processamento síncrono inline — após a transaction da operação (non-blocking). Falha no GL não reverte a operação. Padrão já usado em createPayrollEntries.
- **D-16:** Retry manual via botão na tela de pendências. Sem cron automático.
- **D-17:** Idempotência: se já existe COMPLETED para sourceType+sourceId, silenciosamente ignora. Sem erro.
- **D-18:** Sem regra ativa = não cria PendingJournalPosting. Permite ativação gradual.
- **D-19:** Re-busca dados da tabela de origem no retry (sem snapshot JSON). PendingJournalPosting armazena apenas sourceType + sourceId + metadata.
- **D-20:** Um PendingJournalPosting → um JournalEntry multi-linha. Regra define todas as linhas.
- **D-21:** sourceId consolidado: payrollRunId (folha), depreciationRunId (depreciação), stockEntryId/stockOutputId (estoque), payableId (CP), receivableId (CR).
- **D-22:** PendingJournalPosting armazena accountingRuleId para rastreabilidade.
- **D-23:** Campos sourceType e sourceId adicionados ao JournalEntry para consulta direta (sem join com PendingJournalPosting).
- **D-24:** Estorno automático em cascata — quando operação origem é estornada, gera lançamento GL de estorno automaticamente.
- **D-25:** Período contábil fechado = PendingJournalPosting com ERROR "período fechado". Operação funciona normalmente. Contador reabre e faz retry.

### Hooks nos Módulos

- **D-26:** Chamada direta ao service: cada módulo importa e chama autoPostingService.process(sourceType, sourceId, orgId). Explícito, sem event system.
- **D-27:** Módulo novo modules/auto-posting/ com: service, types, routes (CRUD regras + retry + pendências).
- **D-28:** Data extractors centralizados no auto-posting.service com map sourceType → função extratora.
- **D-29:** Substituir AccountingEntry stubs completamente nesta phase. Remover accounting-entries/ module, AccountingEntry model, AccountingEntryType e AccountingSourceType enums, ACCOUNT_CODES const.
- **D-30:** Hook de folha independente do módulo de ausências (absence-impact-payroll-engine é independente).
- **D-31:** Provisões de folha (férias/13º) migradas para auto-posting com regras configuráveis.
- **D-32:** Testes reescritos do zero em auto-posting.routes.spec.ts.
- **D-33:** Para CR, usar receivePayment (análoga a settlePayment de payables). Criar se não existir.

### Tela de Pendências e Regras (Frontend)

- **D-34:** 3 tabs na JournalEntriesPage: Lançamentos | Pendências | Regras.
- **D-35:** Tab Pendências: filtros por status e tipo de operação. Retry individual + retry em lote.
- **D-36:** Colunas: badge status (cor), tipo operação, link para origem, data, ações.
- **D-37:** Linha expandível (accordion) para ERROR mostrando mensagem + botão retry.
- **D-38:** Badge com count de ERRORs (vermelho) e PENDINGs (amarelo) na tab Pendências.
- **D-39:** Link na coluna Origem navega para página do módulo correspondente.
- **D-40:** Botão "Ver" em COMPLETED navega para tab Lançamentos filtrada pelo JournalEntry.
- **D-41:** Badge visual de entryType na tab Lançamentos (Manual, Automático, Estorno).
- **D-42:** CRUD de regras em modal. Modal com: tipo (readonly), isActive, linhas débito/crédito (tabela editável), template histórico, flag CC obrigatório, botão preview.

### Claude's Discretion

- Escolha de nomes específicos dos valores do enum extenso de sourceType
- Estrutura interna do data extractor map
- Ordem das colunas e detalhes visuais de badges
- Validação de contas no processamento (período aberto + regra ativa confirmados como suficientes)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §Lançamentos Contábeis — LANC-01 (auto-entries), LANC-02 (rule config), LANC-06 (idempotency)

### Existing Models

- `apps/backend/prisma/schema.prisma` — JournalEntry (L8985), JournalEntryLine (L9019), AccountingEntry (L9038), AccountingSourceType (L8753), AccountingEntryType (L8759), JournalEntryType (L8967), JournalEntryStatus (L8974)

### Existing Services

- `apps/backend/src/modules/journal-entries/journal-entries.service.ts` — createJournalEntryDraft, postJournalEntry (posting engine)
- `apps/backend/src/modules/accounting-entries/accounting-entries.service.ts` — v1.3 stubs: createPayrollEntries (to be replaced)
- `apps/backend/src/modules/accounting-entries/accounting-entries.types.ts` — ACCOUNT_CODES const (to be eliminated)
- `apps/backend/src/modules/payables/payables.service.ts` — settlePayment (hook point for CP)
- `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — closeRun (hook point for payroll)
- `apps/backend/src/modules/depreciation/depreciation-batch.service.ts` — runBatch (hook point for depreciation)
- `apps/backend/src/modules/stock-entries/stock-entries.service.ts` — (hook point for stock entry)
- `apps/backend/src/modules/stock-outputs/stock-outputs.service.ts` — (hook point for stock output)
- `apps/backend/src/modules/payroll-provisions/payroll-provisions.service.ts` — createProvisionEntries (to be replaced)

### Frontend

- `apps/frontend/src/pages/JournalEntriesPage.tsx` — existing page (add tabs)
- `apps/frontend/src/pages/AccountingEntriesPage.tsx` — v1.3 stubs page (to be removed or repurposed)

### Design System

- `docs/design-system/04-componentes.md` — Modal, tabelas, badges, accordion patterns

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `journal-entries.service.ts`: createJournalEntryDraft + postJournalEntry — the posting engine that auto-posting will call
- `JournalEntryType` enum: needs AUTOMATIC value added
- `CostCenter` model with farmId relation: used for CC inference from operations
- `AccountingPeriod` with status ABERTO/FECHADO: used for period validation
- `assertPeriodOpen` shared utility: reusable for period check
- `assertBalanced` shared utility: reusable for balance validation

### Established Patterns

- Non-blocking post-transaction pattern: createPayrollEntries called OUTSIDE closeRun transaction (accounting-entries.service.ts L5-6)
- Modules colocated: controller+service+routes+types per domain
- RLS via organizationId on all models
- Prisma enums for type-safe source types

### Integration Points

- 6 module services need hook call added after their completion functions
- JournalEntriesPage needs 2 new tabs (Pendências, Regras)
- Sidebar CONTABILIDADE group already exists
- Chart of Accounts template seed needs to also seed AccountingRules

</code_context>

<specifics>
## Specific Ideas

- Preview no modal da regra usando dados reais da última operação daquele tipo
- Template histórico com {{placeholders}}: {{documentNumber}}, {{supplierName}}, {{referenceMonth}}, {{employeeName}} dependendo do sourceType
- Badges coloridos na tab Pendências: verde=COMPLETED, vermelho=ERROR, amarelo=PENDING
- Accordion expandível para mensagem de erro completa
- Badge na tab Lançamentos diferenciando MANUAL (neutro) vs AUTOMATIC (engrenagem/azul) vs REVERSAL (vermelho)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 37-regras-e-lan-amentos-autom-ticos_
_Context gathered: 2026-03-27_
