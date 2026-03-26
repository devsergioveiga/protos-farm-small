# Phase 31: Obrigações Acessórias e eSocial - Research

**Researched:** 2026-03-26
**Domain:** Brazilian payroll compliance — eSocial S-1.3 XML generation, SEFIP/DARF tax guides, income statement PDF
**Confidence:** HIGH (codebase), MEDIUM (eSocial leiaute specifics — official docs verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Gerar arquivos digitais nos formatos oficiais — SEFIP/GFIP (.RE) para FGTS, DARF numérico para INSS/IRRF, GPS/DARF para FUNRURAL. Contador importa nos sistemas da Receita/Caixa sem digitar valores manualmente.
- **D-02:** Cada guia gerada cria automaticamente uma Conta a Pagar com `originType='TAX_GUIDE'`, valor calculado, vencimento legal e categoria (FGTS/INSS/IRRF/FUNRURAL). Mesmo padrão payroll→payables existente.
- **D-03:** Alertas de vencimento: amarelo 10 dias antes, vermelho 5 dias antes. Visível no dashboard e na listagem de guias.
- **D-04:** FUNRURAL configurável por organização: campo `funruralBasis` = 'GROSS_REVENUE' (2,05% até março 2026, 2,23% a partir de abril 2026 — PJ) ou 'PAYROLL' (2,7% folha). Default: PAYROLL. Alíquotas via payroll-tables com effective-date.
- **D-05:** Sistema gera XMLs válidos conforme leiaute S-1.3 e disponibiliza para download. Contador transmite manualmente via portal eSocial ou software fiscal. Sem transmissão direta via Web Service nesta phase (não requer certificado digital no servidor).
- **D-06:** Validação XSD obrigatória — XSDs oficiais do leiaute S-1.3 embarcados no projeto. XML validado antes de liberar download. Erros exibidos inline com campo e mensagem.
- **D-07:** Todos os 4 grupos de eventos: Tabela (S-1000/S-1005/S-1010/S-1020), Não Periódicos (S-2190/S-2200/S-2206/S-2230/S-2299), Periódicos (S-1200/S-1210/S-1299), SST (S-2210/S-2220/S-2240).
- **D-08:** Eventos gerados automaticamente a partir de ações no sistema — admissão cria S-2200, rescisão cria S-2299, fechamento folha cria S-1200/S-1210/S-1299, ASO cria S-2220, etc. Eventos ficam em status PENDENTE para revisão pelo contador antes do download.
- **D-09:** Dashboard eSocial por competência + status. Seletor mês/ano, cards resumo (total eventos, pendentes, exportados, com erro), tabela de eventos com filtro por grupo e status.
- **D-10:** Fluxo de status: PENDENTE → EXPORTADO (ao fazer download) → ACEITO ou REJEITADO (marcação manual pelo contador após transmitir no portal).
- **D-11:** Reprocessamento de rejeitados: contador marca REJEITADO com motivo (campo texto), corrige dados de origem, regenera XML com versão incremental (v2, v3). Histórico de versões preservado.
- **D-12:** Páginas separadas no sidebar: grupo OBRIGAÇÕES com sub-itens: Guias de Recolhimento, Eventos eSocial, Informes de Rendimentos. Cada um com página dedicada.
- **D-13:** PDF seguindo modelo oficial da Receita Federal: seções de rendimentos tributáveis, deduções (INSS, dependentes), IRRF retido, rendimentos isentos, informações complementares. Gerado via pdfkit.
- **D-14:** Distribuição: email em lote (botão 'Enviar informes') para colaboradores com email + acesso na ficha do colaborador (web) e app. Mesmo padrão dos holerites (Phase 28).
- **D-15:** RAIS substituída pelo eSocial — sistema mostra banner informativo + relatório de consistência que verifica se todos os eventos de tabela/admissão/remuneração foram gerados corretamente no ano-base.
- **D-16:** Histórico de informes sem limite — manter todos os anos-base já gerados. Filtro por ano na tela de informes.

### Claude's Discretion

- Estrutura dos models Prisma (TaxGuide, EsocialEvent, IncomeStatement, etc.)
- Endpoints REST e query params
- Formato interno dos arquivos SEFIP/GFIP (.RE) e DARF numérico
- Implementação da validação XSD (libxmljs2 ou xml-validator ou custom)
- Organização dos componentes frontend
- Template do relatório de consistência RAIS
- Mapeamento exato de cada ação do sistema para evento eSocial correspondente
- Lógica de versionamento de XMLs rejeitados

### Deferred Ideas (OUT OF SCOPE)

- Transmissão direta via Web Service eSocial (requer certificado A1 no servidor) — phase futura
- Assinatura digital XML com ICP-Brasil — acompanha transmissão direta
- Integração com DCTFWeb (substituiu GFIP para parte das obrigações) — phase futura
- DIRF (Declaração de Imposto de Renda Retido na Fonte) — abolida em 2025, dados fluem via eSocial + EFD-Reinf
- Contribuição sindical patronal e laboral — pode adicionar depois
- Relatórios gerenciais de custo tributário por fazenda — Phase 32 (dashboard RH)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ESOCIAL-01 | Contador pode gerar guias de recolhimento (FGTS via GFIP/DCTFWeb, INSS via DARF, IRRF via DARF, FUNRURAL via GPS/DARF com alíquota configurável receita bruta vs folha), com calendário de vencimentos, alertas antecipados, histórico e integração com Contas a Pagar | PayrollRunItem já tem fgtsAmount/inssAmount/irrfAmount; payroll-tables já tem FUNRURAL rows; payables upsert padrão via originType='TAX_GUIDE'; cron pattern for alerts |
| ESOCIAL-02 | Contador pode gerar eventos eSocial (tabela: S-1000/S-1005/S-1010/S-1020; não periódicos: S-2190/S-2200/S-2206/S-2230/S-2299; periódicos: S-1200/S-1210/S-1299; SST: S-2210/S-2220/S-2240) em XML conforme leiaute S-1.3, com validação, dashboard e reprocessamento | xmlbuilder2 needs install; @xmldom/xmldom already installed for parsing; XSD validation via custom approach; Employee/MedicalExam/EmployeeAbsence/EmployeeTermination/PayrollRunItem all have required source fields |
| ESOCIAL-03 | Contador pode gerar RAIS (ou verificar substituição por eSocial), informe de rendimentos por colaborador em PDF, envio por email, histórico por ano-base | pdfkit already installed; mail.service exists; PayrollRunItem aggregation across runs by year; RAIS banner + consistency report approach |
</phase_requirements>

---

## Summary

Phase 31 closes the compliance loop for the rural payroll module by producing three outputs: (1) downloadable tax collection guides in official formats (SEFIP .RE, DARF numerico, GPS/DARF), (2) eSocial event XMLs validated against S-1.3 XSD schemas, and (3) income statement PDFs per employee. All monetary values are already computed by existing payroll-engine and stored in PayrollRunItem — this phase is primarily about output format generation, not new calculations.

The critical architectural decision from CONTEXT.md is that eSocial transmission is out of scope. The system generates valid, downloadable XMLs. This eliminates the need for xmlbuilder2 digital signature (xml-crypto) and BullMQ queue (referenced in STATE.md but not yet installed and not needed here). The approach is synchronous generation on demand, with status tracking in a new EsocialEvent model.

XSD validation presents the main technical challenge. libxmljs2 requires native compilation; the preferred lightweight approach for this project is to embed the official eSocial S-1.3 XSD files and use a pure-JS validator. The existing @xmldom/xmldom (already installed) can parse documents for field-level error reporting; xmlbuilder2 (needs install, v4.0.3) builds the XML output. For XSD validation, the `xsd-schema-validator` package (v0.11.0, available on npm, uses Java CLI) is an option but adds a Java dependency. A better fit is a schema-based structural check using the XSD constraints translated to JS validation rules — since we are generating (not parsing) the XML, we control the structure and can validate completeness pre-generation.

**Primary recommendation:** Install xmlbuilder2@^4.0.3. Use @xmldom/xmldom already installed for XSD parsing/structural validation. Embed official S-1.3 XSDs as project assets. Validate by building the DOM and checking required element presence against XSD constraints programmatically — not by running a full XSD validator (avoids native dependency). Flag any missing required fields with field path and message before download.

## Project Constraints (from CLAUDE.md)

- Backend modules: colocalized pattern `modules/{domain}/service+routes+types+spec`
- Express 5: `req.params.id as string` — never destructure without cast
- Prisma: enums must be typed with `as const` or imported enum, never plain `string`
- Prisma: verify exact field names in schema before using in `select` — e.g. `eSocialCode`, `pisPassep`, `ctpsNumber`
- Decimal.js: `Decimal.max(a, b)` is static — no instance `.max()` method
- Frontend: function components, no `any`, useState+useCallback pattern
- Forms: always in modal, never dedicated page
- Destructive confirm: ConfirmModal (medium/low) or ConfirmDeleteModal (high criticality)
- Tailwind CSS for styling; lucide-react for icons; pdfkit for PDFs
- Tests: `**/*.spec.ts` (backend = Jest with `@swc/jest`), `**/*.spec.tsx` (frontend = Vitest)

---

## Standard Stack

### Core (all already installed unless noted)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @xmldom/xmldom | ^0.8.11 | XML DOM parsing (already used in NF-e parser, OFX parser, KML parser) | Installed |
| pdfkit | ^0.17.2 | PDF generation (already used for payslips, EPI cards, TRCT) | Installed |
| nodemailer | ^8.0.1 | Email distribution (already used for payslip batch send) | Installed |
| date-fns | ^4.1.0 | Date calculations (due dates, year boundaries) | Installed |
| decimal.js | ^10.6.0 | Monetary arithmetic (FUNRURAL, totals) | Installed |
| node-cron | ^4.2.1 | Alert scheduling (already used for contract-expiry, depreciation) | Installed |
| **xmlbuilder2** | **^4.0.3** | **XML document building for eSocial events** | **NEEDS INSTALL** |

### Supporting

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Prisma 7 | ^7.4.1 | New models: EsocialEvent, TaxGuide, IncomeStatement | Already installed |
| ioredis | ^5.9.3 | Cron lock (idempotency, already used in other crons) | Installed |

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| xmlbuilder2 | @xmldom/xmldom + manual createElement | More verbose, error-prone for deeply-nested eSocial structure |
| xmlbuilder2 | xml2js reverse (object→XML) | Less type-safe, not designed for output |
| Custom XSD validator | libxmljs2 | Requires native compilation (node-gyp), brittle in CI |
| Custom XSD validator | xsd-schema-validator | Requires Java runtime on server |
| Custom XSD validator | Structural JS validation of pre-generation data | No native deps, already know structure — RECOMMENDED |

**Installation:**
```bash
cd apps/backend && pnpm add xmlbuilder2@^4.0.3
```

Version verified: `npm view xmlbuilder2 version` → `4.0.3` (confirmed 2026-03-26)

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/
├── tax-guides/
│   ├── tax-guides.service.ts       # SEFIP .RE builder, DARF numerado builder, GPS builder
│   ├── tax-guides.routes.ts        # GET list, POST generate, GET download/:id
│   ├── tax-guides.types.ts         # TaxGuideOutput, TaxGuideType enum, etc.
│   └── tax-guides.spec.ts
├── esocial-events/
│   ├── esocial-events.service.ts   # XML builder per event type, XSD structural validator
│   ├── esocial-events.routes.ts    # GET list, POST generate, GET download/:id, PATCH status
│   ├── esocial-events.types.ts     # EsocialEventOutput, EventGroup enum, EventStatus enum
│   ├── esocial-builders/           # One file per event group
│   │   ├── s1000-builder.ts        # evtInfoEmpregador
│   │   ├── s1005-builder.ts        # evtTabEstab
│   │   ├── s1010-builder.ts        # evtTabRubrica
│   │   ├── s1020-builder.ts        # evtTabLotacao
│   │   ├── s2200-builder.ts        # evtAdmissao
│   │   ├── s2206-builder.ts        # evtAltContratual
│   │   ├── s2230-builder.ts        # evtAfastTemp
│   │   ├── s2299-builder.ts        # evtDeslig
│   │   ├── s1200-builder.ts        # evtRemun
│   │   ├── s1210-builder.ts        # evtPgtos
│   │   ├── s1299-builder.ts        # evtFechaEvPer
│   │   ├── s2210-builder.ts        # evtCAT
│   │   ├── s2220-builder.ts        # evtMonit (ASO)
│   │   └── s2240-builder.ts        # evtExpRisco
│   └── esocial-events.spec.ts
├── income-statements/
│   ├── income-statements.service.ts  # Aggregate from PayrollRunItems, generate PDF
│   ├── income-statements.routes.ts
│   ├── income-statements.types.ts
│   └── income-statements.spec.ts
apps/backend/src/shared/
└── esocial-xsd/                    # Embedded official S-1.3 XSD files (read-only assets)
    ├── evtAdmissao-v02_05_00.xsd
    ├── evtDeslig.xsd
    ├── evtRemun.xsd
    └── ... (all required events)
```

### Frontend Module Structure

```
apps/frontend/src/
├── pages/
│   ├── TaxGuidesPage.tsx           # Guias de Recolhimento
│   ├── EsocialEventsPage.tsx       # Eventos eSocial (tabs: Tabela / Não Periódicos / Periódicos / SST)
│   └── IncomeStatementsPage.tsx    # Informes de Rendimentos
├── hooks/
│   ├── useTaxGuides.ts
│   ├── useEsocialEvents.ts
│   └── useIncomeStatements.ts
└── types/
    ├── tax-guide.ts
    ├── esocial-event.ts
    └── income-statement.ts
```

### Pattern 1: EsocialEvent Status State Machine

Follows the existing PayrollRun state machine pattern:

```typescript
// Source: apps/backend/src/modules/payroll-runs/payroll-runs.types.ts (adapted)
export const VALID_ESOCIAL_TRANSITIONS: Record<string, Record<string, string>> = {
  EXPORT: { PENDENTE: 'EXPORTADO' },
  ACCEPT: { EXPORTADO: 'ACEITO' },
  REJECT: { EXPORTADO: 'REJEITADO' },
  REPROCESS: { REJEITADO: 'PENDENTE' }, // creates new version row, increments version
};
```

### Pattern 2: Payables Upsert for Tax Guides

Reuses the established `originType` + `originId` upsert pattern from payroll-runs.service.ts:

```typescript
// Source: apps/backend/src/modules/payroll-runs/payroll-runs.service.ts ~line 689
await tx.payable.upsert({
  where: {
    originType_originId: {
      originType: 'TAX_GUIDE',
      originId: taxGuide.id,
    },
  },
  create: {
    organizationId: rls.organizationId,
    farmId,
    supplierName: 'FGTS',
    category: 'TAXES' as const, // use TAXES, not PAYROLL, for tax guides
    description: `FGTS ${label}`,
    totalAmount: new Decimal(totalFgts),
    dueDate: fgtsDueDate,
    originType: 'TAX_GUIDE',
    originId: taxGuide.id,
  },
  update: { totalAmount: new Decimal(totalFgts), dueDate: fgtsDueDate },
});
```

Note: `PayableCategory` enum does not yet include `TAX_GUIDE` as a category value — use `TAXES` (already in enum) for tax guide payables. No enum migration needed.

### Pattern 3: xmlbuilder2 eSocial XML Builder

```typescript
// Source: https://oozcitak.github.io/xmlbuilder2/
import { create } from 'xmlbuilder2';

export function buildS2200(data: S2200Input): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' });
  const root = doc.ele('eSocial', {
    xmlns: 'http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation': 'http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00 evtAdmissao-v02_05_00.xsd',
  });
  const evtAdmissao = root.ele('evtAdmissao', { Id: `ID_${data.organizationCnpj}_${data.nrInsc}` });
  // ideEvento group
  const ideEvento = evtAdmissao.ele('ideEvento');
  ideEvento.ele('indRetificacao').txt('1'); // 1=original, 2=retificação
  ideEvento.ele('nrRec'); // recibo to fill after government returns (empty on generation)
  // ... remaining structure per MoS S-1.3
  return doc.end({ prettyPrint: true });
}
```

### Pattern 4: XSD Structural Validation (pure-JS, no native deps)

Since we **generate** (not parse) the XML, validation means checking data completeness **before** building. Validate the data object against required field rules derived from XSD:

```typescript
export interface ValidationError {
  field: string;   // e.g. "evtAdmissao.trabalhador.nmTrab"
  message: string; // e.g. "Campo obrigatório não informado"
}

export function validateS2200Input(data: S2200Input): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.employee.name) errors.push({ field: 'nmTrab', message: 'Nome do trabalhador obrigatório' });
  if (!data.employee.cpf) errors.push({ field: 'cpfTrab', message: 'CPF do trabalhador obrigatório' });
  if (!data.employee.pisPassep) errors.push({ field: 'nisTrab', message: 'NIS/PIS obrigatório para eSocial' });
  if (!data.contract.salary) errors.push({ field: 'vrSalFx', message: 'Salário contratual obrigatório' });
  if (!data.position.cbo) errors.push({ field: 'codCBO', message: 'CBO do cargo obrigatório' });
  // ... all required fields per MoS S-1.3
  return errors;
}
```

### Pattern 5: Alert Cron for Tax Guide Due Dates

```typescript
// Source: apps/backend/src/shared/cron/contract-expiry-alerts.cron.ts (adapted)
// Schedule: daily at 07:00 — check guides due in 10 and 5 days
export function startTaxGuideAlertsCron(): void {
  cron.schedule('0 7 * * *', async () => {
    const lockKey = `cron:tax-guide-alerts:${today}`;
    const locked = await redis.set(lockKey, '1', 'EX', 3600, 'NX');
    if (!locked) return;
    // query TaxGuide where dueDate between now+5 and now+10 AND status != PAID
    // createNotification for each — amber at 10 days, red at 5 days
  });
}
```

### Anti-Patterns to Avoid

- **Never use xml-crypto for signing**: D-05 explicitly defers digital signature. Installing xml-crypto now adds dead weight.
- **Never build XML with string concatenation**: Invalid characters in employee names (apostrophes, accents) will corrupt the document. Always use xmlbuilder2's `.txt()` which escapes automatically.
- **Never aggregate totals in the frontend**: FGTS/INSS/IRRF guide values must be computed server-side from PayrollRunItem aggregates — floating-point in JS is unsafe for monetary values.
- **Never use `prisma.payable.create` inside a `withRlsContext` transaction when creating tax-guide payables**: Use `tx.payable.create` directly (same anti-nesting pattern as established in Phase 25 decisions).
- **Never hardcode FUNRURAL rate**: Two phases in 2026 (Jan-Mar at 2.05% PJ, Apr onwards at 2.23% PJ). Always look up from PayrollLegalTable with effective-date, same as INSS/IRRF tables already implemented.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML building | Manual string concat | xmlbuilder2 | Handles escaping, namespaces, encoding declaration, pretty-print |
| PDF generation | HTML→PDF, jsPDF | pdfkit (already installed) | Already used for payslips, TRCT, EPI cards — consistent output |
| Email batch send | Custom SMTP client | nodemailer (already installed) | Same pattern as payslip distribution (Phase 28) |
| Date arithmetic | Manual JS Date math | date-fns (already installed) | Handles month-end, leap years, timezone-safe |
| FGTS/INSS/IRRF values | Recalculate from scratch | Sum from PayrollRunItem.fgtsAmount/inssAmount/irrfAmount | Values already computed and stored — avoid recalculation drift |
| FUNRURAL rate lookup | Hardcode aliquots | PayrollLegalTable (type=FUNRURAL) with effective-date | Two-phase 2026 rate change already handled by this table |

**Key insight:** The monetary values for all four tax guides are already stored in the database — the entire calculation infrastructure was built in Phases 26-29. Phase 31 is format output and compliance tracking, not new financial calculations.

---

## eSocial S-1.3 Event Reference

### Event Groups and Triggers

| Event | Group | XML Root Element | Trigger in System | Data Source |
|-------|-------|-----------------|-------------------|-------------|
| S-1000 | Tabela | evtInfoEmpregador | Manual / org setup | Organization (CNPJ, name, address) |
| S-1005 | Tabela | evtTabEstab | Manual / farm setup | Farm (CNPJ establishment, CNAE) |
| S-1010 | Tabela | evtTabRubrica | PayrollRubrica change | PayrollRubrica (code, name, eSocialCode, incideINSS/FGTS/IRRF) |
| S-1020 | Tabela | evtTabLotacao | Position/CostCenter change | Position (CBO, name) + CostCenter |
| S-2190 | Não Periódico | evtTSVInicio | Not applicable (rural employees) | — |
| S-2200 | Não Periódico | evtAdmissao | Employee admission (status ATIVO) | Employee + EmployeeContract + Position |
| S-2206 | Não Periódico | evtAltContratual | ContractAmendment with salary/position change | ContractAmendment.changes JSON |
| S-2230 | Não Periódico | evtAfastTemp | EmployeeAbsence creation | EmployeeAbsence (type, startDate, catNumber) |
| S-2299 | Não Periódico | evtDeslig | EmployeeTermination processed | EmployeeTermination (type, date, amounts) |
| S-1200 | Periódico | evtRemun | PayrollRun close (MONTHLY) | PayrollRunItem per employee (lineItemsJson rubricas) |
| S-1210 | Periódico | evtPgtos | PayrollRun close (MONTHLY) | PayrollRunItem (netSalary, payment date) |
| S-1299 | Periódico | evtFechaEvPer | PayrollRun close | PayrollRun (referenceMonth, COMPLETED status) |
| S-2210 | SST | evtCAT | EmployeeAbsence type=ACCIDENT with catNumber | EmployeeAbsence.catNumber |
| S-2220 | SST | evtMonit | MedicalExam creation | MedicalExam (type, date, doctor CRM, result) |
| S-2240 | SST | evtExpRisco | EpiDelivery with risk exposure | EpiDelivery + PositionEpiRequirement |

### Key eSocial S-1.3 Field Mappings

**S-2200 evtAdmissao — critical fields from Employee model:**

| eSocial Field | Prisma Source | Notes |
|---------------|--------------|-------|
| cpfTrab | Employee.cpf | Unmask digits only |
| nisTrab | Employee.pisPassep | REQUIRED — many employees may not have this filled |
| nmTrab | Employee.name | |
| dtNascimento | Employee.birthDate | |
| codCateg | Derived from ContractType | 101=empregado geral, 102=rural por pequeno prazo |
| dtAdm | Employee.admissionDate | |
| tpRegPrev | 1 (RGPS) | Fixed for CLT rural |
| vrSalFx | EmployeeContract.salary | |
| undSalFixo | 5 (mensário) | Fixed for monthly salary |
| codCBO | Position.cbo | REQUIRED — many positions may not have CBO filled |
| qtdHrsSem | EmployeeContract.weeklyHours | |
| matricula | Auto-generated or Employee.id | |

**Critical data gaps to validate:** `Employee.pisPassep` and `Position.cbo` are nullable in the schema. S-2200 generation will fail validation for employees missing PIS/PASEP or positions without CBO. The service must return a pre-generation validation error, not silently omit the field.

**S-1200 evtRemun — from PayrollRunItem.lineItemsJson:**

The `lineItemsJson` field stores line items as JSON with structure `{ code, description, reference, type, value }`. The `code` field maps to `PayrollRubrica.code`, which has `eSocialCode` field (nullable). S-1200 requires `codRubr` (rubrica code) and `natRubr` (nature from eSocial rubrica nature table). Only rubricas with `eSocialCode` populated should be included in S-1200.

### eSocial Employer Identification for Rural Producers

Rural producers (Pessoa Física with employees) use **CAEPF** (Cadastro de Atividade Econômica da Pessoa Física) instead of CNPJ for eSocial identification. However, the Organization model uses `document` field which stores CNPJ. If the client is a rural PF employer, a CAEPF field may need to be added to Organization. This is a data gap requiring business clarification.

**Current assessment:** The project uses `OrganizationType` enum — if organizations are always PJ (Pessoa Jurídica with CNPJ), no CAEPF field is needed. Verify organization types in use.

---

## FUNRURAL 2026 Rates

Source: FarmPlus blog + official SENAR/FUNRURAL regulations (verified March 2026)

**Two-phase rate change in 2026 (Lei Complementar nº 224/2025):**

| Period | Basis | PJ Rate | PF Rate | Notes |
|--------|-------|---------|---------|-------|
| Jan–Mar 2026 | Gross Revenue | 2.05% (1.80% FUNRURAL + 0.25% SENAR) | 1.50% | Old rate |
| Apr 2026+ | Gross Revenue | 2.23% (1.98% FUNRURAL + 0.25% SENAR) | 1.63% | New rate (Lei 224/2025) |
| Any period | Payroll | 2.7% | N/A | Not affected by new law |

**Already implemented:** Phase 26 decision recorded: `FUNRURAL 2026 implemented as two PayrollLegalTable rows (Jan-Mar effectiveFrom 2026-01-01 and Apr-Dec effectiveFrom 2026-04-01)`. Tax guide generation should query PayrollLegalTable type=FUNRURAL with effective-date lookup — no hardcoding.

---

## Tax Guide Formats

### SEFIP/GFIP (.RE file format)

Source: CAIXA Manual SEFIP 8.4 (March 2024), Caixa Econômica Federal

The SEFIP .RE file is a fixed-width text file with hierarchical record types:

| Record | Type Code | Content |
|--------|-----------|---------|
| HEADER | 10 | Identificação do arquivo (versão SEFIP, CNPJ empregador, competência) |
| EMPREGADOR | 20 | Dados do empregador (CNPJ/CEI, razão social, endereço, FPAS, código terceiros) |
| TRABALHADOR | 30 | Dados do trabalhador (PIS/PASEP, nome, CPF, data admissão, categoria) |
| REM. TRABALHADOR | 32 | Remuneração do período (ocorrência, valor) |
| BASE CALC PREVID | 34 | Base de cálculo previdenciária |
| TOTAIS TRABALHADOR | 40 | Totais por trabalhador |
| TOTAIS EMPREGADOR | 50 | Totais por empregador |
| TRAILER | 99 | Totalizadores do arquivo |

Key fields: competência (AAAAMM), FPAS code (Rural CLT = 604), remuneração values per trabalhador, FGTS deposit values, códigos de ocorrência (00=normal, 05=afastado, 06=rescisão).

**Note on SEFIP vs DCTFWeb:** SEFIP 8.4 is still used for FGTS collection even though DCTFWeb has replaced GFIP for INSS contributions. The `.RE` format is the import format for SEFIP 8.4 application still maintained by CAIXA. D-01 is correct — SEFIP .RE for FGTS.

### DARF Numérico

The DARF (Documento de Arrecadação de Receitas Federais) has a fixed set of fields for programmatic generation (not a file format — it is a structured data set for filling the DARF form):

| Field | Content | Notes |
|-------|---------|-------|
| CNPJ/CPF | Organization.document | |
| Código Receita | 2100 (IRRF Trabalho) / 1120 (INSS) | Fixed per guide type |
| Número de Referência | Competência AAAAMM | |
| Data de Vencimento | Calculated due date | |
| Período de Apuração | First day of reference month | |
| Valor Principal | Total calculated | |
| Valor Total | Same as principal (no juros if on time) | |

DARF does not have an import file format like SEFIP — it is a PDF form that the taxpayer fills. For programmatic generation, the recommended approach is generating a pre-filled PDF that exactly matches the DARF layout, which the contador can print and pay. Use pdfkit for this.

**Practical approach for DARF:** Generate a PDF that replicates the official DARF layout with all fields pre-filled. This is the same approach used by accounting software (ContaAzul, Omie, etc.). The "DARF numérico" from D-01 refers to the electronic DARF code (long numeric string used for payment via internet banking) — this can be generated as a formatted string alongside the PDF.

### GPS (Guia de Previdência Social) for FUNRURAL

GPS is used for FUNRURAL recolhimento when basis is PAYROLL. Fields: código de pagamento (2100 for rural employer), competência, valor INSS, valor outras entidades (RAT, FUNRURAL, SENAR), valor total, CNPJ/CEI.

Like DARF, GPS is a PDF form. Generate pre-filled PDF via pdfkit.

---

## Common Pitfalls

### Pitfall 1: Missing PIS/PASEP on Employee

**What goes wrong:** S-2200 requires `nisTrab` (NIS = PIS/PASEP). Many employees in the system may have `pisPassep = null` (nullable in schema).
**Why it happens:** Employee was registered before payroll module enforcement, or is a new hire without PIS yet.
**How to avoid:** Pre-generation validation step returns field-level errors: `"NIS/PIS não informado para {nome}. Preencha na ficha do colaborador antes de gerar o evento S-2200."` Never silently omit the field — eSocial will reject the XML.
**Warning signs:** `pisPassep` null count > 0 when querying active employees.

### Pitfall 2: Missing CBO on Position

**What goes wrong:** S-2200 requires `codCBO` from the position. `Position.cbo` is nullable.
**Why it happens:** Positions were created without CBO mapping.
**How to avoid:** Same pre-generation validation. Add CBO requirement to position edit modal as part of this phase.
**Warning signs:** `Position.cbo = null` for any position linked to active employees.

### Pitfall 3: Rural Employer CNPJ vs CAEPF

**What goes wrong:** eSocial uses CAEPF for rural PF employers, not CNPJ. If any organization is Pessoa Física, the `Organization.document` (CPF) must map to CAEPF number.
**Why it happens:** Leiaute S-1.3 S-1000 has different `tpInsc` codes: 1=CNPJ, 2=CPF. Rural PF use `tpInsc=2` with the CPF, but must also provide CAEPF.
**How to avoid:** For v1.3, if OrganizationType only includes PJ entities (all have CNPJ), use `tpInsc=1`. Document the CAEPF gap as a future enhancement. Verify with client.
**Warning signs:** `Organization.document` with 11 digits (CPF) instead of 14 (CNPJ).

### Pitfall 4: SEFIP FPAS Code for Rural Activity

**What goes wrong:** Wrong FPAS code generates incorrect contribution calculations in SEFIP.
**Why it happens:** Urban CLT uses FPAS 515, rural CLT uses FPAS 604. If the code is hardcoded from an urban template, FGTS rates will be wrong.
**How to avoid:** Hardcode FPAS 604 for this system (it is a rural farm management system — all employees are rural workers). Document this assumption.
**Warning signs:** FPAS != 604 in any generated SEFIP .RE file.

### Pitfall 5: S-1299 Must Be Last in Periodic Group

**What goes wrong:** If S-1299 (closing event) is downloaded before S-1200/S-1210 events are exported, the government's eSocial system may reject subsequent S-1200 events for that period.
**Why it happens:** No ordering enforcement in the dashboard.
**How to avoid:** Mark S-1299 generation as blocked until all S-1200/S-1210 events for the same competência are in EXPORTADO or ACEITO status. Show warning badge.
**Warning signs:** Dashboard shows S-1299 EXPORTADO but S-1200 still PENDENTE for same period.

### Pitfall 6: FUNRURAL Rate Phase Change — April 2026

**What goes wrong:** Tax guide for April 2026 uses January 2026 rate (2.05% instead of 2.23% for PJ).
**Why it happens:** Hardcoded rate or wrong effectiveFrom date in PayrollLegalTable.
**How to avoid:** Phase 26 already inserted two PayrollLegalTable rows. Tax guide generation MUST query with `effectiveFrom <= referenceMonth ORDER BY effectiveFrom DESC LIMIT 1`. Never hardcode.
**Warning signs:** FUNRURAL guide for April+ 2026 shows 2.05% instead of 2.23%.

### Pitfall 7: lineItemsJson Nullability for S-1200

**What goes wrong:** `PayrollRunItem.lineItemsJson` is nullable (`Json?`). If null, S-1200 generation will produce an empty remunerations block.
**Why it happens:** Old runs before Phase 26 may have null lineItemsJson. Or runs where the calculation stored totals only.
**How to avoid:** Pre-generation validation for S-1200: check that lineItemsJson is non-null and has at least one rubrica with eSocialCode populated. Return actionable error if not.
**Warning signs:** lineItemsJson = null on any PayrollRunItem being processed for S-1200.

### Pitfall 8: Cron Duplicate Alerts

**What goes wrong:** Tax guide due date alerts fire multiple times on the same day.
**Why it happens:** Server restart, cron running twice.
**How to avoid:** Same Redis lock pattern as contract-expiry-alerts.cron.ts — key `cron:tax-guide-alerts:{YYYY-MM-DD}`, TTL 3600s, NX flag.
**Warning signs:** Multiple identical notifications for same guide on same day.

---

## Code Examples

### Example 1: xmlbuilder2 eSocial namespace structure

```typescript
// Source: https://oozcitak.github.io/xmlbuilder2/ + eSocial S-1.3 MoS
import { create } from 'xmlbuilder2';

const NS = 'http://www.esocial.gov.br/schema/evt/evtAdmissao/v02_05_00';
const doc = create({ version: '1.0', encoding: 'UTF-8' });
const esocial = doc.ele(NS, 'eSocial');
const evtAdmissao = esocial.ele('evtAdmissao', {
  Id: `ID_${tpInsc === '1' ? 'E' : 'P'}${nrInsc}_${yyyymm}${seq}`,
});
// ideEvento
evtAdmissao.ele('ideEvento')
  .ele('indRetificacao').txt('1').up()
  .ele('percAC').txt('0').up()
  .up();
// ideEmpregador
evtAdmissao.ele('ideEmpregador')
  .ele('tpInsc').txt('1').up()  // 1=CNPJ
  .ele('nrInsc').txt(cnpj14digits).up()
  .up();
const xml: string = doc.end({ prettyPrint: false }); // prettyPrint: false for smaller files
```

### Example 2: Pre-generation data validation

```typescript
// Source: Pattern derived from existing payroll-engine validation approach
export function validateS2200Data(
  employee: EmployeeForEsocial,
  contract: ContractForEsocial,
  position: PositionForEsocial,
): EsocialValidationError[] {
  const errors: EsocialValidationError[] = [];
  if (!employee.pisPassep) {
    errors.push({ field: 'nisTrab', employeeName: employee.name, message: 'NIS/PIS não informado' });
  }
  if (!position.cbo) {
    errors.push({ field: 'codCBO', employeeName: employee.name, message: 'CBO do cargo não informado' });
  }
  if (!contract.salary || contract.salary.lte(0)) {
    errors.push({ field: 'vrSalFx', employeeName: employee.name, message: 'Salário inválido ou zero' });
  }
  return errors;
}
```

### Example 3: FUNRURAL rate lookup (effective-date pattern)

```typescript
// Source: Pattern from payroll-tables.service.ts (Phase 26 pattern)
const funruralTable = await prisma.payrollLegalTable.findFirst({
  where: {
    organizationId: null,  // system-level tables have null orgId
    tableType: 'FUNRURAL',
    effectiveFrom: { lte: referenceMonth },
  },
  orderBy: { effectiveFrom: 'desc' },
  select: { brackets: true },
});
// brackets JSON contains rate for GROSS_REVENUE and PAYROLL basis
```

### Example 4: Income statement PDF structure

```typescript
// Source: Adapted from apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 40 });

// Section 1: Header — org name, CNPJ, statement type, year-base
// Section 2: Employee identification — name, CPF, PIS/PASEP
// Section 3: Rendimentos tributáveis (salary total, HE, 13th, vacation pay)
// Section 4: Deduções (INSS total, dependents × 2.275,08, alimony)
// Section 5: IRRF retido (sum of irrfAmount from all PayrollRunItems for year)
// Section 6: Rendimentos isentos (salary-family benefit, 13th first parcel)
// Footer: "Este documento substitui o antigo DIRF — abolida em 2025"
```

---

## Prisma Model Design

### New Models Needed

```prisma
// Migration: 20260508100000_add_esocial_tax_guide_income_statement

model TaxGuide {
  id              String        @id @default(uuid())
  organizationId  String
  guideType       TaxGuideType  // FGTS | INSS | IRRF | FUNRURAL
  referenceMonth  DateTime      @db.Date
  dueDate         DateTime      @db.Date
  totalAmount     Decimal       @db.Decimal(14, 2)
  status          TaxGuideStatus @default(PENDING)  // PENDING | GENERATED | PAID | OVERDUE
  fileKey         String?       // path to generated file (SEFIP .RE or DARF PDF)
  payrollRunId    String?       // source run
  originType      String?       // for payable upsert: 'TAX_GUIDE'
  generatedBy     String?
  generatedAt     DateTime?
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  organization Organization @relation(...)

  @@unique([organizationId, guideType, referenceMonth])
  @@index([organizationId, status])
  @@map("tax_guides")
}

model EsocialEvent {
  id              String          @id @default(uuid())
  organizationId  String
  eventType       String          // S-1000, S-2200, S-1200, etc.
  eventGroup      EsocialGroup    // TABELA | NAO_PERIODICO | PERIODICO | SST
  referenceMonth  DateTime?       @db.Date  // null for non-periodic events
  sourceType      String          // EMPLOYEE, PAYROLL_RUN, MEDICAL_EXAM, ABSENCE, TERMINATION
  sourceId        String          // FK to source record (polymorphic)
  status          EsocialStatus   @default(PENDENTE)  // PENDENTE | EXPORTADO | ACEITO | REJEITADO
  version         Int             @default(1)  // increments on reprocessing
  xmlContent      String?         @db.Text  // generated XML (stored for re-download)
  rejectionReason String?
  exportedAt      DateTime?
  acceptedAt      DateTime?
  rejectedAt      DateTime?
  createdBy       String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  organization Organization @relation(...)

  @@index([organizationId, eventGroup, status])
  @@index([organizationId, referenceMonth])
  @@index([sourceType, sourceId])
  @@map("esocial_events")
}

model IncomeStatement {
  id              String    @id @default(uuid())
  organizationId  String
  employeeId      String
  yearBase        Int       // e.g., 2025
  totalTaxable    Decimal   @db.Decimal(14, 2)  // total tributável
  totalInss       Decimal   @db.Decimal(14, 2)
  totalIrrf       Decimal   @db.Decimal(14, 2)
  totalExempt     Decimal   @db.Decimal(14, 2)  // isentos (salário-família, 1ª parcela 13º)
  pdfKey          String?   // file path
  sentAt          DateTime?
  sentTo          String?   // email address
  createdBy       String
  createdAt       DateTime  @default(now())

  organization Organization @relation(...)
  employee     Employee     @relation(...)

  @@unique([organizationId, employeeId, yearBase])
  @@index([organizationId, yearBase])
  @@map("income_statements")
}

enum TaxGuideType {
  FGTS
  INSS
  IRRF
  FUNRURAL
}

enum TaxGuideStatus {
  PENDING    // generated, not yet due
  GENERATED  // file created and available for download
  PAID
  OVERDUE
}

enum EsocialGroup {
  TABELA
  NAO_PERIODICO
  PERIODICO
  SST
}

enum EsocialStatus {
  PENDENTE
  EXPORTADO
  ACEITO
  REJEITADO
}
```

**Organization model — missing fields for eSocial:**

The Organization model does NOT currently have `funruralBasis` field (D-04 requires it). Add:

```prisma
// In Organization model:
funruralBasis   FunruralBasis @default(PAYROLL)

enum FunruralBasis {
  GROSS_REVENUE
  PAYROLL
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DIRF (declaração IRRF retido) | Abolished — data flows via eSocial + EFD-Reinf | 2025 (REQUIREMENTS.md confirms) | IncomeStatement PDF replaces DIRF for employee delivery |
| GFIP for INSS | DCTFWeb | ~2019 (progressive rollout) | Deferred to future phase per CONTEXT.md |
| RAIS annual declaration | Replaced by eSocial ongoing reporting | 2023 (eSocial phase 3 completion) | Show informative banner + consistency report (D-15) |
| eSocial S-1.0/S-1.1/S-1.2 | S-1.3 (current, with NT 06/2026 amendments) | Dec 2024 (S-1.3 released) | Use S-1.3 namespace URIs in all XML |

**Current eSocial version:** S-1.3 with NT 06/2026 amendments (effective Feb 2026). The official MoS (Manual de Orientação) is available at `https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/` — XSD schemas available at official eSocial portal.

---

## Open Questions

1. **Organization type: PJ only or PF producers too?**
   - What we know: `OrganizationType` enum exists; `Organization.document` stores the identifier
   - What's unclear: Whether any organizations are Pessoa Física rural producers (who need CAEPF, not CNPJ, for eSocial S-1000)
   - Recommendation: Assume all PJ (CNPJ, tpInsc=1) for this phase. Add a validation that returns error if `document` has 11 digits (CPF format). Document CAEPF as future enhancement.

2. **XSD file embedding strategy**
   - What we know: Official XSDs are available from government portal and GitHub (tst-labs/esocial)
   - What's unclear: License terms for embedding XSD files in the project repository
   - Recommendation: Download official XSDs from `https://www.gov.br/esocial/pt-br/documentacao-tecnica` at build time or embed directly (government documents are public domain). Store in `apps/backend/src/shared/esocial-xsd/`.

3. **xmlContent storage: DB column or filesystem?**
   - What we know: MedicalExam stores `documentUrl` (file path); payslips are generated on demand
   - What's unclear: XML size per event (S-1200 for 100 employees can be large)
   - Recommendation: Store in `xmlContent TEXT` column in EsocialEvent. eSocial XMLs are typically under 50KB per event. Avoids filesystem path management complexity. Can be re-generated on demand if storage becomes concern.

4. **S-2240 (Condições Ambientais) trigger**
   - What we know: S-2240 comes from EpiDelivery / PositionEpiRequirement
   - What's unclear: S-2240 requires detailed risk agent codes (chemical, physical, biological) and PPE description — EpiDelivery has CA number and product info but may not have the eSocial risk factor codes
   - Recommendation: Implement S-2240 as a manual-trigger event in the dashboard (not auto-generated) for this phase. The SST module can be enhanced in a future phase with proper risk factor registry.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v24.12.0 | — |
| pdfkit | Income statement PDF, DARF PDF | ✓ | ^0.17.2 | — |
| @xmldom/xmldom | XSD parsing, XML DOM validation | ✓ | ^0.8.11 | — |
| xmlbuilder2 | eSocial XML generation | ✗ | — | Install required: `pnpm add xmlbuilder2@^4.0.3` |
| node-cron | Alert scheduling | ✓ | ^4.2.1 | — |
| ioredis | Cron idempotency lock | ✓ | ^5.9.3 | — |
| nodemailer | Income statement batch email | ✓ | ^8.0.1 | — |
| PostgreSQL | Database | ✓ | 16 (assumed from project) | — |

**Missing dependencies with no fallback:**
- `xmlbuilder2@^4.0.3` — required for eSocial XML generation. Must be installed before Plan 02 (eSocial event builders).

**Missing dependencies with fallback:**
- None beyond xmlbuilder2.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + @swc/jest |
| Config file | `apps/backend/jest.config.js` |
| Quick run command | `cd apps/backend && pnpm jest --testPathPattern=esocial-events --no-coverage` |
| Full suite command | `cd apps/backend && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ESOCIAL-01 | TaxGuide generation sums FGTS/INSS/IRRF from PayrollRunItems correctly | unit | `pnpm jest --testPathPattern=tax-guides.spec` | ❌ Wave 0 |
| ESOCIAL-01 | TaxGuide payable upsert with originType=TAX_GUIDE | unit | `pnpm jest --testPathPattern=tax-guides.spec` | ❌ Wave 0 |
| ESOCIAL-01 | Due date calculation: FGTS=7th next month, INSS=20th next month, IRRF=20th next month | unit | `pnpm jest --testPathPattern=tax-guides.spec` | ❌ Wave 0 |
| ESOCIAL-01 | FUNRURAL rate lookup uses effective-date (Jan-Mar vs Apr+ 2026) | unit | `pnpm jest --testPathPattern=tax-guides.spec` | ❌ Wave 0 |
| ESOCIAL-02 | S-2200 builder produces valid XML with correct namespace | unit | `pnpm jest --testPathPattern=esocial-builders` | ❌ Wave 0 |
| ESOCIAL-02 | Pre-generation validation catches missing pisPassep | unit | `pnpm jest --testPathPattern=esocial-events.spec` | ❌ Wave 0 |
| ESOCIAL-02 | Pre-generation validation catches missing CBO | unit | `pnpm jest --testPathPattern=esocial-events.spec` | ❌ Wave 0 |
| ESOCIAL-02 | S-1200 builder maps lineItemsJson rubricas with eSocialCode | unit | `pnpm jest --testPathPattern=esocial-builders` | ❌ Wave 0 |
| ESOCIAL-02 | Status transitions: PENDENTE→EXPORTADO→ACEITO/REJEITADO | unit | `pnpm jest --testPathPattern=esocial-events.spec` | ❌ Wave 0 |
| ESOCIAL-03 | IncomeStatement aggregates all PayrollRunItems for a year-base | unit | `pnpm jest --testPathPattern=income-statements.spec` | ❌ Wave 0 |
| ESOCIAL-03 | IncomeStatement PDF generates without error for valid data | unit | `pnpm jest --testPathPattern=income-statements.spec` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm jest --testPathPattern="tax-guides|esocial-events|esocial-builders|income-statements" --no-coverage`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/tax-guides/tax-guides.spec.ts` — covers ESOCIAL-01
- [ ] `apps/backend/src/modules/esocial-events/esocial-events.spec.ts` — covers ESOCIAL-02 status machine, validation
- [ ] `apps/backend/src/modules/esocial-events/esocial-builders/s2200-builder.spec.ts` — covers S-2200 XML structure
- [ ] `apps/backend/src/modules/esocial-events/esocial-builders/s1200-builder.spec.ts` — covers S-1200 rubrica mapping
- [ ] `apps/backend/src/modules/income-statements/income-statements.spec.ts` — covers ESOCIAL-03
- [ ] Install xmlbuilder2: `cd apps/backend && pnpm add xmlbuilder2@^4.0.3`

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection — payroll-runs.service.ts, payroll-engine.types.ts, payroll-rubricas.types.ts, schema.prisma, payroll-pdf.service.ts, contract-expiry-alerts.cron.ts
- CONTEXT.md Phase 31 — all locked decisions
- STATE.md — Phases 26-30 accumulated decisions
- [xmlbuilder2 npm page](https://www.npmjs.com/package/xmlbuilder2) — version 4.0.3 confirmed
- [@xmldom/xmldom npm](https://www.npmjs.com/package/@xmldom/xmldom) — version 0.8.11 confirmed

### Secondary (MEDIUM confidence)

- [eSocial Governo Federal — Documentação Técnica](https://www.gov.br/esocial/pt-br/documentacao-tecnica) — S-1.3 current version, MoS, XSD schemas location
- [TecnoSpeed — eSocial S-1.3 Manual e XSD](https://blog.tecnospeed.com.br/esocial-versao-s-1-3-leiautes-e-esquemas-xsd/) — event structure overview
- [TecnoSpeed — NT 06/2026](https://blog.tecnospeed.com.br/esocial-nota-tecnica-s-1-3-06-2026-ajustes-nos-layouts-e-campo-infopatprec/) — 2026 amendments confirmed
- [CAIXA Manual SEFIP 8.4](https://www.caixa.gov.br/Downloads/fgts-manuais-e-cartilhas-operacionais/Manual_SEFIP_8_4_01032024.pdf) — SEFIP .RE file format
- [FarmPlus FUNRURAL 2026](https://www.farmplus.com.br/aprenda/funrural-2026-o-que-e-quem-paga-aliquotas-como-calcular) — rate changes April 2026
- [Senior Sistemas — S-2200 Leiaute](https://documentacao.senior.com.br/gestao-de-pessoas-hcm/esocial/leiautes/nao-periodicos/s-2200.htm) — S-2200 field reference
- [tst-labs/esocial GitHub](https://github.com/tst-labs/esocial) — XSD schemas S-1.3 with NT 03/2025

### Tertiary (LOW confidence)

- DARF numérico programmatic generation — official RFB protocol document referenced in search; full spec requires direct RFB portal consultation. Approach (pre-filled PDF via pdfkit) is industry-standard confirmed by multiple accounting software vendors but formal spec URL not retrieved.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via `npm view`, codebase confirmed
- Architecture patterns: HIGH — directly derived from existing patterns in codebase
- eSocial event structure: MEDIUM — field names verified via Senior Sistemas docs + MoS references; full XSD verification requires downloading official files at plan time
- FUNRURAL rates: HIGH — confirmed via multiple agro sources, consistent with Phase 26 PayrollLegalTable implementation
- SEFIP format: MEDIUM — based on CAIXA manual 8.4 (March 2024); format is stable but manual review of actual .RE spec recommended
- Pitfalls: HIGH — derived directly from schema inspection (nullable fields) and existing codebase patterns

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (30 days — eSocial S-1.3 is stable; FUNRURAL rate changed April 1st was already captured)
