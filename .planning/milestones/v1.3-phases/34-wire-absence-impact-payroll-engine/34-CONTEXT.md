# Phase 34: Wire Absence Impact to Payroll Engine - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Importar e consumir `getAbsenceImpactForMonth` no motor de cálculo da folha de pagamento, para que afastamentos INSS (>15 dias), dias empresa e suspensões disciplinares sejam corretamente tratados no cálculo salarial, com discriminação no holerite e tratamento especial de FGTS.

</domain>

<decisions>
## Implementation Decisions

### Prorateio Salarial

- **D-01:** Salário base aparece integral nos proventos. Dias INSS geram rubrica de **desconto** "Afastamento INSS" com referência "X/Y dias" e valor = (inssPaidDays / diasNoMês) × salárioBase. Empresa paga primeiros 15 dias implicitamente (ficam no salário base).
- **D-02:** Quando há admissão mid-month E afastamento INSS no mesmo mês, os prorateios são **cumulativos**: primeiro calcula pro-rata por admissão, depois deduz dias INSS do salário já prorateado.
- **D-03:** Dias pagos pela empresa (companyPaidDays) ficam **implícitos** no salário base — sem rubrica separada de provento. Apenas o desconto INSS aparece.
- **D-04:** INSS e IRRF incidem sobre o **salário já reduzido** (base de cálculo = salário base − desconto afastamento INSS − desconto suspensão).

### Discriminação no Holerite

- **D-05:** Afastamento INSS aparece como **rubrica de desconto** na seção Descontos do holerite PDF, com código (ex: 900), descrição "Afastamento INSS", referência "X/Yd" e valor. Segue o padrão existente de lineItems.
- **D-06:** Sem nota informativa no rodapé sobre dias empresa. Apenas o desconto INSS aparece. Layout tabular existente (Phase 28 D-04) não muda.

### FGTS em Afastamento

- **D-07:** Quando `fgtsFullMonth=true` (acidente de trabalho, INSS leave, maternidade), FGTS é calculado sobre o **salário integral** (sem prorateio), conforme Lei 8.036/90 art. 15 §5. O `calculateEmployeePayroll` precisa receber o flag e usar salário cheio como base FGTS.
- **D-08:** Base FGTS integral aparece no **rodapé de bases** do holerite (campo "Base FGTS: R$X"), sem rubrica separada nem nota explicativa. Padrão de mercado.

### Dias Suspensão

- **D-09:** Suspensão disciplinar (suspendedDays) gera rubrica de **desconto total** "Suspensão disciplinar" com referência "X/Yd" e valor = (suspendedDays / diasNoMês) × salárioBase. Sem pagamento, sem FGTS, sem contagem para 13º/férias.
- **D-10:** Suspensão **impacta DSR** — dias de suspensão contam como falta injustificada para efeito de DSR, gerando desconto adicional proporcional. Regra CLT art. 474.

### Claude's Discretion

- Códigos de rubrica para afastamento INSS e suspensão (900, 910 ou outro)
- Estrutura interna dos novos campos em `EmployeePayrollInput` e `EmployeePayrollResult`
- Lógica de cálculo do desconto DSR por suspensão
- Organização dos testes (novos cenários no spec existente vs arquivo separado)
- Se `AbsencePayrollImpact` é passado como campo no input ou buscado internamente pelo service

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Motor de Cálculo (implementado)

- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts` — `calculateEmployeePayroll` com pro-rata por admissão, OT, DSR, INSS, IRRF, FGTS
- `apps/backend/src/modules/payroll-runs/payroll-runs.types.ts` — `EmployeePayrollInput`, `EmployeePayrollResult`, lineItems
- `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — Orchestration: monta input e chama calculateEmployeePayroll (linhas ~352-376)
- `apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts` — Geração do holerite PDF com proventos/descontos/bases

### Afastamentos (implementado)

- `apps/backend/src/modules/employee-absences/employee-absences.service.ts` — `getAbsenceImpactForMonth` (linhas 363-420) e `computePayrollImpact` (linhas 68-140)
- `apps/backend/src/modules/employee-absences/employee-absences.types.ts` — `AbsencePayrollImpact` (companyPaidDays, inssPaidDays, suspendedDays, fgtsFullMonth)

### Contexto de Phases Anteriores

- `.planning/phases/28-processamento-da-folha-mensal/28-CONTEXT.md` — Decisões do fluxo de processamento, holerite PDF, adiantamento, 13º
- `.planning/REQUIREMENTS.md` — FERIAS-02 (afastamentos com impacto automático na folha)
- `.planning/ROADMAP.md` §Phase 34 — Goal, success criteria, dependencies

### Testes Existentes

- `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — Testes do calculateEmployeePayroll (pro-rata, OT, INSS, IRRF)
- `apps/backend/src/modules/employee-absences/employee-absences.routes.spec.ts` — Testes do getAbsenceImpactForMonth

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `getAbsenceImpactForMonth(employeeId, referenceMonth, tx)` — Função pronta que retorna `AbsencePayrollImpact`, não consumida pelo payroll
- `calculateEmployeePayroll(input, referenceMonth, params)` — Função pura de cálculo, precisa de novos campos no input para absence data
- `payroll-pdf.service.ts` — Geração PDF via pdfkit com lineItems (proventos/descontos), rodapé com bases INSS/IRRF/FGTS
- `payroll-runs.service.ts` — Orchestration que monta `EmployeePayrollInput` e chama o cálculo (ponto de integração principal)

### Established Patterns

- `EmployeePayrollInput` já tem `timesheetData` como campo opcional — absence data pode seguir o mesmo padrão
- lineItems com `{ code, description, reference, type: 'PROVENTO' | 'DESCONTO', value }` — rubricas de afastamento/suspensão seguem este formato
- Pro-rata por admissão já implementado com `proRataDays` — serve de referência para pro-rata por afastamento
- Testes com mock de Decimal e assertivas de valor

### Integration Points

- `payroll-runs.service.ts` linhas ~352-376: onde `EmployeePayrollInput` é montado — precisa chamar `getAbsenceImpactForMonth` e passar resultado
- `payroll-calculation.service.ts` Step 1 (pro-rata): onde o prorateio por afastamento deve ser aplicado após admissão
- `payroll-calculation.service.ts` Step FGTS: onde `fgtsFullMonth` deve alterar a base de cálculo
- `payroll-pdf.service.ts` rodapé de bases: onde base FGTS integral deve aparecer quando `fgtsFullMonth=true`

</code_context>

<specifics>
## Specific Ideas

- Rubrica de afastamento INSS segue formato tabular existente: código + descrição + referência "X/Yd" + valor
- Suspensão disciplinar impacta DSR (perde DSR da semana) — regra CLT art. 474
- FGTS integral em afastamento conforme Lei 8.036/90 art. 15 §5
- Prorateio admissão + afastamento = cumulativo (raro mas correto)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 34-wire-absence-impact-payroll-engine_
_Context gathered: 2026-03-26_
