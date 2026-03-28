# Phase 28: Processamento da Folha Mensal - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Ciclo mensal completo de processamento de folha de pagamento: processamento em lote com wizard multi-step, preview e recálculo individual, fechamento imutável com estorno completo, holerites PDF com distribuição por email e app, adiantamentos salariais com CP automática, e 13º salário em duas parcelas com médias de HE/noturno.

</domain>

<decisions>
## Implementation Decisions

### Fluxo de Processamento em Lote

- **D-01:** Wizard multi-step para iniciar folha: Step 1 (selecionar mês/ano e tipo: mensal/adiantamento/13º), Step 2 (preview com lista de colaboradores e status do ponto), Step 3 (confirmar/excluir colaboradores), Step 4 (processar). Permite recalcular individual antes de fechar.
- **D-02:** Bloqueio granular por colaborador — colaboradores sem ponto (espelho) aprovado ficam em status "Pendente" na lista, não entram no processamento. Contador pode processar os demais e incluir os pendentes depois via recálculo. A folha inteira NÃO é bloqueada.
- **D-03:** Estorno completo com rollback de CPs. Reverte status COMPLETED→REVERTED, cancela todas as Contas a Pagar geradas (status CANCELLED), destrói holerites, libera espelhos de ponto. Exige confirmação via ConfirmDeleteModal (digitar nome/referência da folha). Sem estorno parcial por colaborador nesta phase.

### Holerite PDF e Distribuição

- **D-04:** Layout clássico tabular — cabeçalho (empresa + colaborador + competência), tabela Proventos (rubricas + referência + valor), tabela Descontos (INSS, IRRF, VT, pensão, adiantamento), totais (bruto/descontos/líquido), rodapé com bases INSS/IRRF/FGTS. Formato familiar para contadores. Usar pdfkit + pdfkit-table (já instalado).
- **D-05:** Distribuição: email em lote ao fechar folha (se colaborador tem email cadastrado) + acesso na ficha do colaborador (web) e no app mobile. Histórico dos últimos 12 meses acessível.
- **D-06:** Lote gera ZIP com PDFs individuais. Nomes: `holerite_2026-03_JOAO-SILVA.pdf`. Contador pode reenviar individual. Não gera PDF consolidado único.

### Adiantamento Salarial

- **D-07:** Registro direto pelo contador (sem workflow de aprovação). Individual ou em lote (dia 15, 40% do salário). Limite configurável por organização (% máximo do salário). Gera recibo PDF automaticamente.
- **D-08:** Cada adiantamento gera uma CP individual por colaborador com originType='SALARY_ADVANCE', vencimento = data do adiantamento. Desconto automático na folha como rubrica de desconto.

### 13º Salário

- **D-09:** Tipo de run separado no mesmo módulo PayrollRun. runType = 'THIRTEENTH_FIRST' (1ª parcela até 30/nov, sem descontos) ou 'THIRTEENTH_SECOND' (2ª parcela até 20/dez, com INSS/IRRF). Mesmo wizard, mesma tabela de runs, cálculo diferente. Proporcional por meses trabalhados.
- **D-10:** Médias de HE e noturno calculadas pela média dos meses trabalhados no ano. Soma total do ano / meses trabalhados. Usa dados dos timesheets aprovados. Padrão CLT art. 7º.

### Claude's Discretion

- Estrutura exata dos models Prisma (PayrollRun, PayrollRunItem, SalaryAdvance, Payslip, ThirteenthSalary)
- Endpoints REST e query params
- Implementação interna do wizard frontend (steps, validação, loading states)
- Template do recibo PDF de adiantamento
- Lógica de envio de email (nodemailer ou similar)
- Organização dos componentes frontend
- Lógica de DSR sobre horas extras

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Roadmap

- `.planning/REQUIREMENTS.md` — FOLHA-02 a FOLHA-05 (critérios de aceite detalhados)
- `.planning/ROADMAP.md` §Phase 28 — Goal, success criteria, dependencies

### Documentação de Domínio

- `protos-farm-documentation-small/ProtosFarm_Fase3_RH_Folha_UserStories.docx` — User stories originais de RH e Folha de Pagamento

### Decisões Anteriores

- `.planning/STATE.md` — PayrollRun state machine, Payroll→Payables upsert, INSS progressive, rural night rules, time entries locked by payrollRunId
- `.planning/phases/25-cadastro-de-colaboradores-e-contratos/25-CONTEXT.md` — Employee entity, contracts, salary history, state machine

### Motor de Cálculo (Phase 26 — já implementado)

- `apps/backend/src/modules/payroll-engine/payroll-engine.service.ts` — calculateINSS, calculateIRRF, calculateFGTS, calculateSalaryFamily, calculateRuralNightPremium, calculateRuralUtilityDeductions, evaluateFormula
- `apps/backend/src/modules/payroll-engine/payroll-engine.types.ts` — INSSBracket, IRRFInput, FGTSResult, etc.
- `apps/backend/src/modules/payroll-rubricas/` — Rubrica CRUD, system formulas, eSocial codes
- `apps/backend/src/modules/payroll-tables/` — INSS/IRRF/FUNRURAL effective-date tables

### Ponto (Phase 27 — já implementado)

- `apps/backend/src/modules/timesheets/timesheets.service.ts` — Timesheet with approval state, HE/noturno aggregation
- `apps/backend/src/modules/time-calculations/time-calculations.service.ts` — calcDailyWork, calcMonthlyTotals

### Padrões de Código Existentes

- `apps/backend/src/modules/depreciation/` — DepreciationRun pattern (state machine, batch processing) — modelo para PayrollRun
- `apps/backend/src/modules/payables/` — Contas a Pagar (originType + originId upsert)
- `apps/frontend/src/pages/TimesheetPage.tsx` — Padrão de página com tabs, filtros, status chips

### Design System

- `docs/design-system/04-componentes.md` — Specs de componentes (modals, wizard, tables)
- `docs/design-system/05-padroes-ux.md` — Padrões UX (voz pt-BR, validação, formulários)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `payroll-engine` — 7 pure calculation functions (INSS, IRRF, FGTS, salário-família, noturno rural, moradia/alimentação, evaluateFormula)
- `payroll-rubricas` — Configurable rubrics with system formulas and eSocial codes
- `payroll-tables` — Effective-date rate tables for INSS/IRRF/FUNRURAL
- `timesheets` — Approved espelhos with calculateTimesheet aggregating HE/noturno
- `pdfkit` + `pdfkit-table` — Already installed, used for timesheet PDF export
- `ConfirmDeleteModal` — High-criticality confirmation (typing name)
- Contas a Pagar module with originType/originId upsert pattern

### Established Patterns

- DepreciationRun state machine (PENDING→PROCESSING→COMPLETED|ERROR) — direct model for PayrollRun
- Payables upsert prevents duplicate CPs on re-processing
- Express 5 module pattern: service + routes + types + spec colocalizados
- Frontend: useState+useCallback hooks (no SWR), modals for CRUD
- ZIP generation: archiver package (check if installed, or use JSZip)

### Integration Points

- PayrollRun.runType enum: MONTHLY, ADVANCE, THIRTEENTH_FIRST, THIRTEENTH_SECOND
- Timesheet approval state gates PayrollRun inclusion per employee
- PayrollRunItem → Payable (originType='PAYROLL_RUN_ITEM' or 'SALARY_ADVANCE')
- Employee ficha: new "Holerites" tab added in this phase
- Sidebar: "Folha de Pagamento" group under RH
- Mobile: payslip viewing in employee's own profile

</code_context>

<specifics>
## Specific Ideas

- Holerite segue formato clássico contábil (proventos/descontos/bases/totais) — não usar layout moderno com cards
- Adiantamento em lote sempre no dia 15, 40% do salário — é padrão rural
- 13º usa média simples dos meses trabalhados (total/meses), não últimos 12 meses fixo
- Estorno requer ConfirmDeleteModal com digitação (alta criticidade)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 28-processamento-da-folha-mensal_
_Context gathered: 2026-03-24_
