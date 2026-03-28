# Phase 38: Fechamento Mensal e Conciliacao Contabil - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Workflow estruturado de fechamento mensal com checklist de 6 etapas sequenciais que consulta automaticamente os modulos existentes (attendance, payroll-runs, depreciation, auto-posting, reconciliation, trial-balance). Inclui: modelo MonthlyClosing persistido, stepper vertical com status por etapa, enforcement centralizado de bloqueio de periodo em endpoints contabeis, e reabertura admin-only com auditoria. Conciliacao bancaria contabil usa o modulo reconciliation/ existente (wiring no checklist, sem novo modulo).

</domain>

<decisions>
## Implementation Decisions

### Checklist de Fechamento

- **D-01:** Stepper vertical em pagina dedicada (/monthly-closing). Cada etapa mostra status (pendente/ok/erro), resumo de dados, e expand para detalhes. Botao "Fechar Periodo" so habilita quando todas as 6 etapas passam.
- **D-02:** Modelo MonthlyClosing persistido no banco com status IN_PROGRESS/COMPLETED/REOPENED. Resultado de cada etapa salvo (tabela filha ou JSON). Historico de fechamentos preservado.
- **D-03:** Etapas em ordem obrigatoria com dependencias sequenciais. Etapa N so pode ser validada apos etapa N-1 estar OK.
- **D-04:** Fechamento parcial suportado. MonthlyClosing criado ao iniciar com status IN_PROGRESS. Etapas ja validadas ficam salvas. Contador pode sair e voltar.
- **D-05:** Quando etapa falha: mostra problema + link direto para o modulo correspondente + botao "Revalidar" na etapa. Contador nao precisa sair do fluxo.
- **D-06:** Criterios de sucesso rigidos (binarios) por etapa. Sem tolerancia/override.

### Conciliacao Contabil

- **D-07:** Modulo reconciliation/ existente atende FECH-02. Etapa 5 do checklist consulta se existe conciliacao completa para o periodo. Se nao, link para ReconciliationPage.
- **D-08:** Relatorio de conciliacao existente (getReconciliationReport) e suficiente. Sem export PDF/CSV adicional nesta phase.

### Bloqueio e Reabertura

- **D-09:** Middleware/helper centralizado checkPeriodOpen(date, orgId) que todo endpoint de escrita contabil chama. Retorna 422 se periodo CLOSED ou BLOCKED. Implementado uma vez, importado em journal-entries, auto-posting, etc.
- **D-10:** Reabertura exclusiva de usuarios com role ADMIN. Sem permissao configuravel adicional.
- **D-11:** Ao reabrir, MonthlyClosing existente ganha status REOPENED + motivo + quem reabriu. Para fechar novamente, novo processo de checklist completo.

### Integracao entre Modulos

- **D-12:** 6 etapas padrao: (1) Ponto aprovado (attendance), (2) Folha fechada (payroll-runs), (3) Depreciacao processada (depreciation), (4) Lancamentos pendentes zerados (auto-posting), (5) Conciliacao bancaria (reconciliation), (6) Balancete equilibrado (trial-balance).
- **D-13:** Consultas read-only aos services existentes. Cada etapa chama o service do modulo correspondente para verificar status do periodo.

### Frontend

- **D-14:** Pagina dedicada MonthlyClosingPage, rota /monthly-closing. Botao "Iniciar Fechamento" na FiscalPeriodsPage abre para o periodo selecionado.
- **D-15:** Sidebar no grupo CONTABILIDADE.

### Claude's Discretion

- Estrutura do modelo MonthlyClosing (campos, tabela filha vs JSON para etapas)
- Nome/assinatura exata do middleware checkPeriodOpen
- Quais endpoints especificos recebem o middleware de bloqueio
- Detalhes visuais do stepper (icones, cores de status, layout do resumo por etapa)
- Queries exatas para cada etapa de validacao

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` FECH-01, FECH-02, FECH-03 -- fechamento mensal, conciliacao, bloqueio/reabertura

### Prior Phase Context

- `.planning/phases/37-regras-e-lan-amentos-autom-ticos/37-CONTEXT.md` -- auto-posting decisions (D-14 a D-25: PendingJournalPosting, periodo fechado = ERROR, processamento sincrono)

### Existing Modules (Backend)

- `apps/backend/src/modules/fiscal-periods/` -- FiscalYear, AccountingPeriod (OPEN/CLOSED/BLOCKED), closePeriod, reopenPeriod, blockPeriod
- `apps/backend/src/modules/reconciliation/` -- import OFX/CSV, auto-match GL vs extrato, manual link, reconciliation report
- `apps/backend/src/modules/auto-posting/` -- PendingJournalPosting status tracking, listPending, getPendingCounts
- `apps/backend/src/modules/journal-entries/` -- JournalEntry CRUD, ledger, trial balance
- `apps/backend/src/modules/payroll-runs/` -- payroll run status
- `apps/backend/src/modules/depreciation/` -- depreciation runs

### Existing Frontend Pages

- `apps/frontend/src/pages/FiscalPeriodsPage.tsx` -- fiscal year/period management
- `apps/frontend/src/pages/ReconciliationPage.tsx` -- bank reconciliation UI
- `apps/frontend/src/pages/JournalEntriesPage.tsx` -- 3 tabs (Lancamentos, Pendencias, Regras)
- `apps/frontend/src/pages/TrialBalancePage.tsx` -- trial balance

### Schema

- `apps/backend/prisma/schema.prisma` -- AccountingPeriod model (status: PeriodStatus), PendingJournalPosting model

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `fiscal-periods.service.ts`: closePeriod, reopenPeriod, blockPeriod -- state machine ja implementada
- `auto-posting.service.ts`: getPendingCounts -- retorna contagem PENDING/ERROR por org
- `reconciliation.service.ts`: getReconciliationReport -- relatorio completo por import/conta
- FiscalPeriodsPage, ReconciliationPage -- paginas frontend existentes para link/navegacao

### Established Patterns

- Services colocalizados em modules/{domain}/ com controller+service+routes+types
- RLS via withRlsContext para multi-tenancy
- Audit trail via logAudit service
- Express 5 middleware pattern para auth/permission checks

### Integration Points

- FiscalPeriodsPage: botao "Iniciar Fechamento" abrira nova MonthlyClosingPage
- auto-posting.service.process(): ja verifica periodo aberto (D-25 phase 37) -- middleware complementa
- journal-entries routes: precisam do middleware checkPeriodOpen
- Sidebar: grupo CONTABILIDADE ja existe com Plano de Contas, Lancamentos, Razao, Balancete, Periodos Fiscais, Conciliacao

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches aligned with existing patterns.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

_Phase: 38-fechamento-mensal-e-conciliacao-contabil_
_Context gathered: 2026-03-28_
