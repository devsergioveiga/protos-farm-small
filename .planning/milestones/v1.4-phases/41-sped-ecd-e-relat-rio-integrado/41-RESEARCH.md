# Phase 41: SPED ECD e Relatório Integrado - Research

**Researched:** 2026-03-28
**Domain:** SPED ECD pipe-delimited file generation, PDF report generation (pdfkit), Brazilian fiscal compliance
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Geração **síncrona** — resposta HTTP direta com download do arquivo. Sem BullMQ/fila async.
- **D-02:** **Todos os blocos fixos**: Bloco 0 + I + J + 9. Sem seleção de blocos.
- **D-03:** Período: **exercício fiscal completo** (FiscalYear). Seletor de exercício fiscal, gera todos os meses do ano.
- **D-04:** Bloco J: **J100 (BP) + J150 (DRE) + J210 (DLPA)**. Sem J215.
- **D-05:** Registro I050: **todas as contas ativas** (sintéticas + analíticas). Filtra isActive=false.
- **D-06:** Dados do contador: **campos na Organization** — accountantName, accountantCrc, accountantCpf. Requer migration.
- **D-07:** Registros I200/I250 (lançamentos): **ambos I150/I155 + I200/I250**. Saldos mensais + lançamentos individuais.
- **D-08:** Livro contábil: **tipo G — Diário Geral**.
- **D-09:** Encoding: **UTF-8**.
- **D-10:** Quebra de linha: **CRLF (\r\n)** conforme manual SPED.
- **D-11:** Assinatura: **sem hash interno** — PVA da RFB assina com certificado digital A1/A3.
- **D-12:** Nome do arquivo: **SPED*ECD*{CNPJ}\_{ANO}.txt** — CNPJ da Organization.
- **D-13:** Registros I350/I355 (saldos diários): **omitidos**. Rurais usam I150/I155 (mensal).
- **D-14:** Severidade: **ERRO bloqueia download + AVISO informativo permite**.
- **D-15:** Apresentação: **lista inline na página** com ícones vermelho/amarelo. Botão "Gerar SPED" desabilitado se houver erros.
- **D-16:** Trigger: **automático ao selecionar exercício fiscal**.
- **D-17:** Consistência I155: **verificar** que soma dos débitos/créditos I250 bate com total I155.
- **D-18:** Estrutura PDF: **6 seções** — Capa, Índice, DRE, BP, DFC método direto, Notas explicativas. pdfkit.
- **D-19:** Notas explicativas: **template automático + texto livre**.
- **D-20:** Dados da capa: **Organization + Farm selecionada**.
- **D-21:** Período: **exercício fiscal** — mesmo seletor de FiscalYear.
- **D-22:** Formato numérico: **padrão BR** — separador milhar ponto, decimal vírgula, prefixo R$.
- **D-23:** **Página única /sped-ecd** com tabs: "SPED ECD" e "Relatório Integrado".
- **D-24:** Sidebar: no **grupo CONTABILIDADE** existente, como último item. Label: "SPED / Relatórios".
- **D-25:** Notas explicativas: **textarea na própria página**. Salva como rascunho automático.

### Claude's Discretion

- Estrutura interna do SpedEcdWriter (classe pura vs funções, streaming vs buffer completo)
- Queries para buscar lançamentos do período (Prisma vs raw SQL)
- Formato exato dos registros SPED (campos, padding, delimitadores internos)
- Geração do DLPA no J210 (saldo anterior + resultado líquido + distribuições = saldo final)
- Template das notas explicativas automáticas (quais políticas contábeis incluir)
- Modelo de dados para rascunho de notas (campo na Organization vs tabela separada)
- Layout visual do PDF (fontes, margens, cabeçalhos de página)
- Detalhes do textarea de notas (rich text ou plain text, autosave interval)
- Campos adicionais na Organization para dados do contador (migration design)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                                                                                | Research Support                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VINC-02 | Contador pode gerar relatório integrado de demonstrações financeiras em PDF profissional contendo DRE, BP, DFC e notas explicativas em documento único, com capa, índice, cabeçalho com dados da fazenda/empresa e formatação compatível com exigências PRONAF/Funcafé                     | pdfkit pattern from pesticide-prescriptions; calculateDre/Bp/Dfc already return all needed data; buffer-based PDF generation pattern established                                                                                           |
| SPED-01 | Contador pode gerar arquivo SPED Contábil (ECD) no formato pipe-delimited da RFB com Blocos 0/I/J/9, registros I050, I100, I150/I155, I200/I250, J005/J100/J150/J210, usando plano referencial L300R rural                                                                                 | SPED ECD Layout 9 format verified; all register field layouts documented; spedRefCode already populated on ChartOfAccount; existing getTrialBalance and getLedger queries provide needed data                                              |
| SPED-02 | Sistema executa pré-validação do arquivo ECD antes do download verificando: contas mapeadas ao referencial, períodos fechados, balancete equilibrado, I050 sem duplicatas, totalização I155 consistente — com relatório de erros/avisos e impedimento de download se houver erros críticos | getUnmappedSped() already exists in chart-of-accounts.service; AccountingPeriod.status field available; getTrialBalance provides balance data for equilibrium check; spedRefCode null check pattern exists in accounting-dashboard.service |

</phase_requirements>

---

## Summary

Phase 41 completes the accounting module by adding two output capabilities: (1) a SPED ECD file generator that produces a pipe-delimited, UTF-8, CRLF-terminated text file following RFB Layout 9 with Blocos 0/I/J/9, and (2) an integrated PDF report combining DRE, BP, DFC, and explanatory notes for rural credit purposes.

The existing codebase provides nearly all required building blocks. The `calculateDre()`, `calculateBp()`, and `calculateDfc()` pure calculators already produce typed data that maps directly to the SPED J-block and PDF sections. The `getTrialBalance()` and `getLedger()` queries provide AccountBalance and JournalEntry data for I-block registers. pdfkit is already used in 19+ service files with an established pattern (async import, buffer collection, Promise resolve on `end` event). The `spedRefCode` field is already populated on every ChartOfAccount by the COA rural template (L300R mapping).

The main new work is: (1) the `SpedEcdWriter` class that formats data into pipe-delimited register lines, (2) the pre-validation service, (3) a `generateIntegratedReport()` function using pdfkit, (4) a migration adding three accountant fields to Organization, and (5) the frontend page with two tabs.

**Primary recommendation:** Implement SpedEcdWriter as a pure class (no Prisma) that receives typed data and returns a string. The service layer loads DB data, calls existing calculators, feeds results to SpedEcdWriter, and returns the buffer. Use the pesticide-prescriptions PDF pattern for the integrated report. Use the accounting-dashboard alerts pattern for pre-validation display.

---

## Standard Stack

### Core

| Library                 | Version   | Purpose                   | Why Standard                                                         |
| ----------------------- | --------- | ------------------------- | -------------------------------------------------------------------- |
| pdfkit                  | ^0.17.2   | PDF generation            | Already installed, used in 19+ modules, mature pattern               |
| Node.js Buffer / string | built-in  | SPED text file generation | No library needed; pipe-delimited text with CRLF                     |
| Prisma 7                | installed | DB queries for SPED data  | Project standard; existing patterns for AccountBalance, JournalEntry |
| Decimal.js              | installed | Monetary arithmetic       | Prevents floating-point errors in SPED amounts                       |

### Supporting

| Library       | Version   | Purpose                             | When to Use                                     |
| ------------- | --------- | ----------------------------------- | ----------------------------------------------- |
| date-fns      | installed | Date formatting for DDMMAAAA fields | SPED requires dates as 8-digit DDMMAAAA strings |
| @types/pdfkit | ^0.17.5   | TypeScript types for pdfkit         | Already installed                               |

### Alternatives Considered

| Instead of                   | Could Use          | Tradeoff                                                               |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------- |
| Pure string builder for SPED | BullMQ async queue | D-01 locked: synchronous. File generates in < 2s for typical rural org |
| pdfkit buffer pattern        | pdf-lib            | pdfkit already installed and battle-tested in project                  |

**Installation:** No new packages required. All dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/financial-statements/
├── sped-ecd.writer.ts          # Pure class: formats data → pipe-delimited lines (no Prisma)
├── sped-ecd.service.ts         # Orchestrator: loads DB → validates → calls writer → returns buffer
├── sped-ecd.types.ts           # SpedEcdInput, ValidationResult, SpedValidationItem
├── sped-ecd.writer.spec.ts     # Unit tests for writer (no DB)
├── sped-ecd.routes.ts          # GET /validate + GET /generate (download)
├── integrated-report.service.ts# pdfkit orchestrator: loads DRE+BP+DFC → generates PDF
└── integrated-report.routes.ts # GET /integrated-report

apps/frontend/src/pages/
└── SpedEcdPage.tsx             # Single page with 2 tabs

apps/frontend/src/hooks/
└── useSpedEcd.ts               # Validation hook (auto-triggers on fiscalYearId change)
```

### Pattern 1: SpedEcdWriter (pure class, no Prisma)

**What:** Class that receives typed data (accounts, balances, journal entries, org info) and emits pipe-delimited lines
**When to use:** All SPED register generation

```typescript
// Source: Manual de Orientação ECD Layout 9 — RFB
// Each register line: |REG|field2|field3|...|fieldN|\r\n
// Pipe character at start AND end of each line
// Dates: DDMMAAAA (8 digits, zero-padded)
// Amounts: N 019.02 — e.g. "123456789012345.12" (no thousand separator, decimal point)

class SpedEcdWriter {
  private lines: string[] = [];

  private line(fields: (string | number)[]): void {
    this.lines.push('|' + fields.join('|') + '|\r\n');
  }

  private formatDate(d: Date): string {
    // DDMMAAAA
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return dd + mm + yyyy;
  }

  private formatAmount(dec: Decimal): string {
    // No thousand separator, decimal point (not comma), 2 decimal places
    return dec.toFixed(2);
  }

  toString(): string {
    return this.lines.join('');
  }
}
```

### Pattern 2: Pre-validation (service function)

**What:** Runs validation checks against DB, returns typed error/warning list
**When to use:** Called automatically when fiscalYearId changes on frontend

```typescript
// Source: D-14, D-15 from CONTEXT.md + getUnmappedSped() pattern
export interface SpedValidationItem {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  navigateTo?: string; // link for user to fix issue
}

export async function validateSpedEcd(
  organizationId: string,
  fiscalYearId: string,
): Promise<SpedValidationItem[]> {
  const items: SpedValidationItem[] = [];
  // 1. Check unmapped accounts (ERROR) → link to /chart-of-accounts
  // 2. Check open/unclosed periods in fiscal year (ERROR) → link to /fiscal-periods
  // 3. Check trial balance equilibrium for each month (ERROR)
  // 4. Check I050 duplicate codes — shouldn't happen but validate (ERROR)
  // 5. Check accounts with no movement (WARNING) — informational only
  return items;
}
```

### Pattern 3: PDF Generation (buffer + Promise)

**What:** Established pdfkit pattern from pesticide-prescriptions.service.ts
**When to use:** All PDF generation in this phase

```typescript
// Source: apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts:370
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 50 });
const chunks: Buffer[] = [];

return new Promise((resolve, reject) => {
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  // ... document content ...
  doc.end();
});
```

### Pattern 4: Download route (stream vs buffer)

**What:** For SPED text file and PDF, return as download attachment
**When to use:** Both SPED and PDF generation endpoints

```typescript
// Source: apps/backend/src/modules/ledger/ledger.service.ts:476 (pipe pattern)
// OR pesticide-prescriptions pattern (buffer + res.send)

// SPED text file:
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
res.send(Buffer.from(spedContent, 'utf-8'));

// PDF:
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
res.send(pdfBuffer);
```

### Pattern 5: Frontend tabs (hidden attribute, not conditional render)

**What:** Tab switching via CSS `hidden` attribute preserves component state
**When to use:** Multi-tab pages where state should be preserved on switch

```typescript
// Source: STATE.md [Phase 37] — "Lancamentos panel uses hidden attribute"
// Source: STATE.md [Phase 40] — "Tabs use hidden attribute (not conditional render)"
<div hidden={activeTab !== 'sped'}>
  <SpedEcdTab ... />
</div>
<div hidden={activeTab !== 'report'}>
  <IntegratedReportTab ... />
</div>
```

### SPED ECD Register Format Reference

**Bloco 0 — Abertura**

```
|0000|LECD|01012025|31122025|FAZENDA XYZ LTDA|12345678000195|SP|123456789|3550308||0|0|0|0|||||
|0001|0|
|0007|Livro 1|1|G|01012025|31122025|1|SPED_ECD_12345678000195_2025.txt|
|0990|3|
```

**Registro 0000 fields (Layout 9):**

| #   | Field           | Value                                     |
| --- | --------------- | ----------------------------------------- |
| 1   | REG             | 0000                                      |
| 2   | LECD            | Fixed: LECD                               |
| 3   | DT_INI          | First day of fiscal year (DDMMAAAA)       |
| 4   | DT_FIN          | Last day of fiscal year (DDMMAAAA)        |
| 5   | NOME            | Organization.name                         |
| 6   | CNPJ            | Organization.document (CNPJ, digits only) |
| 7   | UF              | Organization state code                   |
| 8   | IE              | Organization state registration           |
| 9   | COD_MUN         | IBGE municipality code                    |
| 10  | IM              | Municipal registration                    |
| 11  | IND_SIT_ESP     | Special situation (blank = normal)        |
| 12  | IND_SIT_INI_PER | 0 = normal opening                        |
| 13  | IND_NIRE        | 0 = no NIRE                               |
| 14  | IND_FIN_ESC     | 0 = original                              |
| 15  | COD_HASH_SUB    | blank                                     |
| 16  | NIRE_SUBST      | blank                                     |
| 17  | IND_EMP_GRD_PRT | blank                                     |

**Registro 0007 fields (Livro):**

| #   | Field         | Value                               |
| --- | ------------- | ----------------------------------- |
| 1   | REG           | 0007                                |
| 2   | COD_ENT_LIVRO | Livro description (e.g., "Livro 1") |
| 3   | NUM_ORD       | Book number (1)                     |
| 4   | TIP_ESCRIT    | G (Diário Geral — D-08)             |
| 5   | DT_INI        | fiscal year start DDMMAAAA          |
| 6   | DT_FIN        | fiscal year end DDMMAAAA            |
| 7   | NUM_ORD_INI   | Initial entry number (1)            |
| 8   | HASH_ESC      | blank (D-11: no hash)               |

**Bloco I — register summary:**

| Register | Purpose                       | Key fields                                                                                                          |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| I001     | Block open                    | IND_DAD=0                                                                                                           |
| I010     | Writer identification         | COD_VRS_LC=009 (Layout 9)                                                                                           |
| I050     | Chart of accounts             | All active accounts (D-05), DT_ALT=last update, COD_NAT (01-05/09), IND_CTA (S/A), NIVEL, COD_CTA, COD_CTA_SUP, CTA |
| I051     | COA referential mapping       | COD_CTA → spedRefCode (L300R), one I051 per analytic account with spedRefCode                                       |
| I052     | Aggregation codes             | One per I050 line that has a spedRefCode aggregation code                                                           |
| I100     | Cost centers                  | Per farm/cost center (optional but recommended)                                                                     |
| I150     | Monthly balance period header | DT_INI=month start, DT_FIN=month end (one per month)                                                                |
| I155     | Monthly balance detail        | Per analytic account: VL_SLD_INI, IND_DC_INI, VL_DEB, VL_CRED, VL_SLD_FIN, IND_DC_FIN                               |
| I200     | Journal entry header          | NUM_LCTO=entryNumber, DT_LCTO, VL_LCTO=sum of debit lines, IND_LCTO=N                                               |
| I250     | Journal entry lines           | COD_CTA, VL_DC, IND_DC (D/C), HIST=description                                                                      |
| I990     | Block close                   | QTD_LIN                                                                                                             |

**COD_NAT mapping from AccountType:**

| AccountType  | COD_NAT     |
| ------------ | ----------- |
| ATIVO        | 01          |
| PASSIVO      | 02          |
| PL           | 03          |
| RECEITA      | 04          |
| DESPESA      | 04 (Result) |
| Compensation | 05          |

**IND_DC_INI / IND_DC_FIN logic:**

- If account nature is DEVEDORA and balance > 0 → "D"
- If account nature is CREDORA and balance > 0 → "C"
- If balance = 0 → use account's natural DC side

**Bloco J — register summary:**

| Register | Purpose                 | Key fields                                                                                                                                               |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J001     | Block open              | IND_DAD=0                                                                                                                                                |
| J005     | Statement period header | DT_INI=year start, DT_FIN=year end, ID_DEM=1 (single entity)                                                                                             |
| J100     | Balance sheet line      | COD_AGL=spedRefCode, IND_COD_AGL (T/D), NIVEL_AGL, COD_AGL_SUP, IND_GRP_BAL (A/P), DESCR_COD_AGL, VL_CTA_INI, IND_DC_CTA_INI, VL_CTA_FIN, IND_DC_CTA_FIN |
| J150     | Income statement line   | COD_AGL=spedRefCode, IND_COD_AGL, NIVEL_AGL, COD_AGL_SUP, DESCR_COD_AGL, VL_CTA, IND_DC_CTA, IND_GRP_DRE (D/R)                                           |
| J210     | DLPA line               | IND_TIP=0 (DLPA), COD_AGL, DESCR_COD_AGL, VL_CTA_INI, IND_DC_CTA_INI, VL_CTA_FIN, IND_DC_CTA_FIN                                                         |
| J990     | Block close             | QTD_LIN                                                                                                                                                  |

**Bloco 9 — encerramento:**

| Register | Purpose                                            |
| -------- | -------------------------------------------------- |
| 9001     | Block open (IND_DAD=0)                             |
| 9900     | Record count per type (one line per REG type used) |
| 9990     | Block close count                                  |
| 9999     | Total file line count                              |

### Anti-Patterns to Avoid

- **Comma as decimal separator in amounts:** SPED uses period (e.g., `1234.56`), NOT comma. Brazilian locale uses comma but SPED format is international period. Use `Decimal.toFixed(2)` not `Intl.NumberFormat`.
- **Missing pipe at start and end of line:** Every SPED line is `|REG|f2|f3|...|fN|` — pipe at both ends.
- **Including synthetic accounts in I155/I200/I250:** Only analytic accounts go in these registers. Synthetic accounts appear only in I050 and J-block aggregation.
- **CRLF vs LF:** D-10 requires CRLF. Node.js string defaults to LF. Must explicitly use `\r\n`.
- **Including inactive accounts in I050:** D-05 filters `isActive=false`. PVA would accept them but they increase file size unnecessarily.
- **Deriving year from FiscalYear.year field:** The schema does NOT have a `year` field on FiscalYear model. Derive from `startDate.getFullYear()` — see STATE.md [Phase 40] note.

---

## Don't Hand-Roll

| Problem                | Don't Build              | Use Instead                                               | Why                                                  |
| ---------------------- | ------------------------ | --------------------------------------------------------- | ---------------------------------------------------- |
| PDF generation         | Custom PDF builder       | pdfkit (already installed)                                | Layout engine, fonts, page breaks                    |
| Monetary arithmetic    | `parseFloat()` + `+`     | `Decimal.js` (already installed)                          | Floating-point precision in SPED amounts             |
| Date formatting        | Custom DDMMAAAA function | `date-fns format(d, 'ddMMyyyy')`                          | Already in project, handles edge cases               |
| SPED unmapped accounts | New query                | `getUnmappedSped()` in chart-of-accounts.service          | Already implemented                                  |
| Financial data         | New DB queries           | Reuse `calculateDre()`, `calculateBp()`, `calculateDfc()` | Pure calculators already return all needed numbers   |
| Trial balance          | New aggregation          | `getTrialBalance()` in ledger.service                     | Returns AccountBalance aggregation per account/month |

**Key insight:** The SpedEcdWriter's only job is format transformation — data → pipe-delimited text. All data loading already exists in the project.

---

## Runtime State Inventory

> Greenfield module — no rename/refactor. However, the migration adds fields to Organization model.

| Category            | Items Found                                                                   | Action Required                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Stored data         | Organization records exist without accountantName/accountantCrc/accountantCpf | Migration adds nullable columns; existing records will have NULL values (acceptable — fields shown as empty in generated files) |
| Live service config | None — SPED ECD is a new module                                               | None                                                                                                                            |
| OS-registered state | None                                                                          | None                                                                                                                            |
| Secrets/env vars    | None                                                                          | None                                                                                                                            |
| Build artifacts     | None — new module, no stale artifacts                                         | None                                                                                                                            |

---

## Common Pitfalls

### Pitfall 1: SPED Amount Format vs Brazilian Format

**What goes wrong:** Developer uses `Intl.NumberFormat('pt-BR')` for SPED amounts, producing `1.234,56` instead of `1234.56`.
**Why it happens:** SPED field format is international (period decimal, no thousand separator) even though the application is Brazilian.
**How to avoid:** Use `new Decimal(amount).toFixed(2)` directly. Never use locale formatting for SPED fields.
**Warning signs:** Any comma in an amount field in the generated file.

### Pitfall 2: Synthetic Accounts in I155

**What goes wrong:** Including synthetic (isSynthetic=true) accounts in I155 balance records. PVA rejects the file.
**Why it happens:** `getTrialBalance()` returns both synthetic and analytic accounts.
**How to avoid:** Filter to `isSynthetic=false` when building I155 and I250 registers. Synthetic accounts go only in I050 (plan structure) and J-block aggregation.
**Warning signs:** PVA error "Conta sintética não pode ter saldo em I155."

### Pitfall 3: I051 Missing for Analytic Accounts with spedRefCode

**What goes wrong:** Generating I050 for all accounts but forgetting I051 (the mapping register linking COD_CTA to COD_CTA_REF in the referential plan).
**Why it happens:** I051 is a child of I050 and easy to miss.
**How to avoid:** For every analytic account (IND_CTA=A) with a non-null spedRefCode, generate one I051 record immediately after its parent I050. The I051 fields are: `|I051|{COD_CTA_REF}|{COD_NAT_REF}|`.
**Warning signs:** PVA error "Conta sem mapeamento ao plano referencial."

### Pitfall 4: Off-by-one in Bloco 9 Line Count

**What goes wrong:** The `9900` register counts per record type, and `9999` is the total line count. An off-by-one causes PVA rejection.
**Why it happens:** Developer forgets to count the 9900 lines themselves, and the 9999 line, in the total.
**How to avoid:** Count lines as they are added to the buffer. The `SpedEcdWriter` should maintain a `lineCount` counter. The 9999 line includes itself in the count.
**Warning signs:** PVA error "Quantidade de linhas divergente."

### Pitfall 5: FiscalYear Has No year Field in Schema

**What goes wrong:** Code references `fiscalYear.year` which does not exist in the Prisma FiscalYear model schema (it exists on `AccountingPeriod`).
**Why it happens:** The service code uses `.year` but the actual Prisma schema at `schema.prisma:8882-8899` has no `year` field on FiscalYear.
**How to avoid:** Derive year as `fiscalYear.startDate.getFullYear()`. This is the established pattern per STATE.md [Phase 40]: "getDfc derives year from fiscalYear.startDate.getFullYear()".
**Warning signs:** TypeScript compiler error `Property 'year' does not exist on type FiscalYear`.

### Pitfall 6: DLPA (J210) Requires Prior Year Equity Balances

**What goes wrong:** J210 requires VL_CTA_INI (beginning of period equity) and VL_CTA_FIN (end of period equity). If the prior year has no AccountBalance records, opening balances will be zero.
**Why it happens:** J210 shows equity evolution: beginning balance + net income + distributions = ending balance.
**How to avoid:** Query AccountBalance for the last month of the prior fiscal year to get opening equity balances. If no prior year exists, use zero (acceptable for first year).
**Warning signs:** PVA warning "Saldo inicial DLPA diverge do saldo final do período anterior."

### Pitfall 7: PDF Multi-Page Tables Without Page Break Handling

**What goes wrong:** pdfkit does not auto-paginate tables. If a financial statement has many accounts, text overflows below the page margin.
**Why it happens:** pdfkit is a low-level API; `doc.y > 760` threshold must be checked manually.
**How to avoid:** Check `doc.y > 720` after each row, call `doc.addPage()` and re-render table header. Use the same pattern as `exportLedgerPdf()` in ledger.service.ts (line 526).
**Warning signs:** Rows disappearing from bottom of PDF pages.

---

## Code Examples

Verified patterns from existing codebase:

### getUnmappedSped Usage (pre-validation check 1)

```typescript
// Source: apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts
// Returns accounts where spedRefCode is null AND isActive=true AND isSynthetic=false
const unmapped = await getUnmappedSped(organizationId);
if (unmapped.length > 0) {
  items.push({
    severity: 'ERROR',
    code: 'UNMAPPED_SPED',
    message: `${unmapped.length} conta(s) analítica(s) sem mapeamento ao referencial L300R`,
    navigateTo: '/chart-of-accounts',
  });
}
```

### AccountingPeriod Status Check (pre-validation check 2)

```typescript
// Source: schema.prisma — AccountingPeriod.status: PeriodStatus @default(OPEN)
// PeriodStatus enum: OPEN | CLOSED | BLOCKED
const openPeriods = await prisma.accountingPeriod.findMany({
  where: {
    organizationId,
    fiscalYearId,
    status: 'OPEN',
  },
  select: { month: true, year: true },
});
if (openPeriods.length > 0) {
  items.push({
    severity: 'ERROR',
    code: 'OPEN_PERIODS',
    message: `${openPeriods.length} período(s) não fechado(s) no exercício`,
    navigateTo: '/fiscal-periods',
  });
}
```

### Date Formatting for SPED (DDMMAAAA)

```typescript
// date-fns is installed; format function supports this
import { format } from 'date-fns';
const spedDate = format(new Date(2025, 0, 1), 'ddMMyyyy'); // "01012025"
```

### pdfkit Buffer Pattern (established project pattern)

```typescript
// Source: apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts:370
export async function generateIntegratedReport(
  organizationId: string,
  fiscalYearId: string,
  additionalNotes?: string,
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Section 1: Cover page
    doc.fontSize(20).font('Helvetica-Bold').text('DEMONSTRAÇÕES FINANCEIRAS', { align: 'center' });
    // ... etc
    doc.end();
  });
}
```

### Express 5 Download Response

```typescript
// Source: CLAUDE.md — Express 5 pattern
// req.params.id as string, req.query.x as string | undefined
const orgId = req.params.orgId as string;
const fiscalYearId = req.query.fiscalYearId as string | undefined;

// For SPED text file download:
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
res.setHeader('Content-Disposition', `attachment; filename="SPED_ECD_${cnpj}_${year}.txt"`);
res.send(Buffer.from(content, 'utf-8'));
```

### Tabs with hidden attribute (state preservation)

```typescript
// Source: STATE.md [Phase 37] + [Phase 40]
const [activeTab, setActiveTab] = useState<'sped' | 'report'>('sped');

<div hidden={activeTab !== 'sped'}>
  <SpedEcdTab fiscalYearId={selectedFiscalYearId} />
</div>
<div hidden={activeTab !== 'report'}>
  <IntegratedReportTab fiscalYearId={selectedFiscalYearId} />
</div>
```

### Migration Convention (accountant fields)

```sql
-- Migration name: 20260604000000_add_accountant_fields_to_organization
ALTER TABLE "organizations" ADD COLUMN "accountantName" TEXT;
ALTER TABLE "organizations" ADD COLUMN "accountantCrc"  VARCHAR(20);
ALTER TABLE "organizations" ADD COLUMN "accountantCpf"  VARCHAR(14);
```

---

## State of the Art

| Old Approach                                                   | Current Approach                   | When Changed     | Impact                        |
| -------------------------------------------------------------- | ---------------------------------- | ---------------- | ----------------------------- |
| SPED ECD only in closed-source ERP (Protheus, Senior, Sankhya) | Open format in Layout 9 since 2020 | ADE Cofis 1/2021 | Can implement custom writer   |
| BullMQ required for large file generation                      | Synchronous for SMB rural orgs     | D-01 (locked)    | Simpler implementation        |
| Hash signature in file                                         | PVA/SPED handles signing           | Layout 9 spec    | D-11: no internal hash needed |

**SPED ECD Layout version:** Layout 9 is current and stable. In use since 2020 (ADE Cofis nº 1/2021). No planned changes for 2025-2026 fiscal years.

---

## Open Questions

1. **Organization fields: UF, IE, COD_MUN, IM**
   - What we know: Register 0000 requires UF (state), IE (state registration), COD_MUN (IBGE code), IM (municipal registration)
   - What's unclear: The Organization model only has `document` (CNPJ) and `name`. UF, IE, COD_MUN, IM are not present in the schema.
   - Recommendation: Add these fields to the Organization migration (D-06 covers accountant fields but not address fields). OR generate 0000 with blank UF/IE/COD_MUN/IM — PVA accepts blank for some of these. Research the PVA rules: IE and IM are optional for Lucro Real entities. UF can be blank if COD_MUN is present. **Recommend: generate with blanks and document this as a known gap; the PVA warning is non-blocking.**

2. **I010 register (accounting software identification)**
   - What we know: Layout 9 includes I010 as writer identification (software name, version, accountant data)
   - What's unclear: Whether I010 is mandatory or optional for private use
   - Recommendation: Include I010 with system name "Protos Farm", version "1.0", and accountantName/CRC/CPF from Organization. If fields are null, use blanks.

3. **I052 aggregate code register**
   - What we know: I052 maps between I050 accounts and J-block aggregation codes (spedRefCode)
   - What's unclear: Whether one I052 per account or per unique aggregation code
   - Recommendation: Per the Oracle SPED docs, I052 is generated once per unique COD_AGL (spedRefCode prefix). Only needed when a J-block aggregation code groups multiple I050 accounts. Since the L300R plan already has one spedRefCode per analytic account, I052 may be minimal.

---

## Environment Availability

| Dependency | Required By            | Available | Version   | Fallback                     |
| ---------- | ---------------------- | --------- | --------- | ---------------------------- |
| pdfkit     | Integrated report PDF  | Yes       | 0.17.2    | —                            |
| date-fns   | SPED date formatting   | Yes       | installed | Use manual string formatting |
| Decimal.js | SPED amount formatting | Yes       | installed | —                            |
| PostgreSQL | DB queries             | Yes       | 16        | —                            |
| Node.js    | Buffer/string ops      | Yes       | v24.12    | —                            |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| Framework          | Jest (backend)                                                       |
| Config file        | apps/backend/jest.config.ts                                          |
| Quick run command  | `pnpm --filter @protos-farm/backend test --testPathPattern=sped-ecd` |
| Full suite command | `pnpm --filter @protos-farm/backend test`                            |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                     | Test Type   | Automated Command                                                             | File Exists? |
| ------- | ---------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- | ------------ |
| SPED-01 | SpedEcdWriter generates valid pipe-delimited lines for each register         | unit        | `pnpm --filter @protos-farm/backend test --testPathPattern=sped-ecd.writer`   | ❌ Wave 0    |
| SPED-01 | Route GET /sped-ecd/generate returns 200 with Content-Disposition attachment | integration | `pnpm --filter @protos-farm/backend test --testPathPattern=sped-ecd.routes`   | ❌ Wave 0    |
| SPED-02 | validateSpedEcd returns ERROR for accounts without spedRefCode               | unit        | `pnpm --filter @protos-farm/backend test --testPathPattern=sped-ecd.service`  | ❌ Wave 0    |
| SPED-02 | validateSpedEcd returns ERROR for open periods                               | unit        | same file                                                                     | ❌ Wave 0    |
| SPED-02 | Route GET /sped-ecd/validate returns validation items                        | integration | `pnpm --filter @protos-farm/backend test --testPathPattern=sped-ecd.routes`   | ❌ Wave 0    |
| VINC-02 | generateIntegratedReport returns Buffer (PDF)                                | unit        | `pnpm --filter @protos-farm/backend test --testPathPattern=integrated-report` | ❌ Wave 0    |
| VINC-02 | Route GET /sped-ecd/integrated-report returns 200 with PDF content-type      | integration | same routes file                                                              | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test --testPathPattern=sped-ecd`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/financial-statements/sped-ecd.writer.spec.ts` — unit tests for SpedEcdWriter (SPED-01)
- [ ] `apps/backend/src/modules/financial-statements/sped-ecd.service.spec.ts` — unit tests for validateSpedEcd (SPED-02)
- [ ] `apps/backend/src/modules/financial-statements/sped-ecd.routes.spec.ts` — route integration tests (SPED-01, SPED-02, VINC-02)

---

## Sources

### Primary (HIGH confidence)

- ECD Layout 7/9 register specs — fetched from taxshape.com/especial-sped (mirrors official RFB manual)
- Oracle SPED ECD field documentation — fetched from docs.oracle.com/cd/E39557_01/doc.91/e51642/flds_fr_blks_reg_in_sped.htm
- apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts — spedRefCode L300R codes verified in project
- apps/backend/prisma/schema.prisma — FiscalYear, AccountingPeriod, ChartOfAccount, AccountBalance, JournalEntry schemas
- apps/backend/src/modules/financial-statements/ — all calculator and service files read directly

### Secondary (MEDIUM confidence)

- RFB SPED ECD Layout 9 manual reference — http://sped.rfb.gov.br/estatico/2D/9C01A0E619B48BAB27486D63FF9E4E750025D0/ (URL found via WebSearch, not directly fetched)
- WebSearch: SPED ECD Layout 9 is current layout since 2020, stable through 2025-2026

### Tertiary (LOW confidence)

- I052 register requirements — documentation is ambiguous on cardinality; recommend testing against PVA

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all dependencies already installed and in active use
- SPED register formats: HIGH — verified against two independent documentation sources (taxshape.com mirror of RFB manual, Oracle SPED docs)
- Architecture: HIGH — directly follows established project patterns (pure calculators, pdfkit buffer, tabs with hidden)
- Pre-validation logic: HIGH — getUnmappedSped() and AccountingPeriod.status already exist
- I052/I010 register details: MEDIUM — secondary sources agree but PVA validation is the ground truth
- Organization address fields in 0000: LOW — need to determine if PVA accepts blank UF/COD_MUN

**Research date:** 2026-03-28
**Valid until:** 2026-09-28 (SPED ECD Layout 9 is stable; 6-month validity)
