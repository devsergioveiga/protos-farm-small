# Phase 05: Conciliação e Fluxo de Caixa - Research

**Researched:** 2026-03-16
**Domain:** OFX/CSV parsing, bank reconciliation matching, cashflow projection with scenarios
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Import e Parsing OFX/CSV**

- Seleção de conta: auto-detect pelo OFX (BANKID+ACCTID), com fallback para dropdown se não conseguir identificar
- Duplicatas em re-import: detecta e pula — compara por data+valor+descrição, importa apenas novos
- CSV: auto-detect de colunas + confirmação — sistema sugere mapeamento, gerente confirma ou ajusta no preview
- Preview: tabela com checkbox — todas linhas selecionadas por padrão, gerente desmarca as que não quer importar
- Histórico de imports: sim, tabela de imports com metadata (data, arquivo original, quem importou, quantas linhas)
- Formato OFX: suportar ambos OFX 1.x (SGML) e 2.x (XML)
- Limite: até 5.000 linhas por arquivo
- Parsing: backend — upload via multipart, parsing no servidor. Suporta encoding ISO-8859-1 nativo
- Encoding CSV: suportar ISO-8859-1 com vírgula como separador decimal (padrão de bancos brasileiros)

**Matching e Conciliação**

- Score de confiança: 3 níveis — EXATO (≥ 95%): valor idêntico + data ±1 dia. PROVÁVEL (70-94%): valor próximo + data ±5 dias. SEM MATCH (< 70%)
- Tolerância FUNRURAL: sem tolerância especial — valor líquido recebido no extrato deve bater exato com o lançamento no sistema
- UI de conciliação: lista única com ações inline — agrupado por grau de confiança. Botões Aceitar/Recusar/Vincular por linha
- Vínculo manual: busca em CP + CR + Transferências por valor/descrição/data
- Itens sem match: ficam pendentes na conta com status PENDENTE. Filtro por status
- Flag conciliado: campo booleano `reconciled` em Payable/Receivable
- Conciliação parcial: N:N — soma dos valores vinculados deve bater com o valor da linha do extrato
- Relatório: CSV + PDF

**Projeção de Fluxo de Caixa**

- Gráfico: linha com área. 3 linhas (otimista/realista/pessimista). Zona vermelha abaixo de zero. Recharts
- Cenários: percentual sobre realista. Realista = CP/CR agendados + cheques + parcelas. Otimista = +10% receitas, -5% despesas. Pessimista = -10% receitas, +15% despesas
- Alerta saldo negativo: banner na página + card no dashboard
- Recorrências: projeta recorrências — inclui parcelas futuras de CP/CR recorrentes
- Classificação DFC: sim — Operacional, Investimento, Financiamento
- Filtro por fazenda: dropdown "Todas as fazendas" como padrão
- Export: PDF + Excel
- Gráfico interativo: tooltip com saldo, entradas previstas, saídas previstas, cheques pendentes
- Projeção inclui cheques A_COMPENSAR na data prevista + parcelas de CP/CR em aberto nas datas de vencimento

**Layout e Navegação**

- Páginas separadas: `/reconciliation` e `/cashflow`
- Sidebar: no grupo FINANCEIRO existente
- Estado inicial conciliação: histórico de imports
- Alerta dashboard: novo card "Saldo negativo previsto em [data]" no painel de alertas

**Permissões e Auditoria**

- Permissão: nova `reconciliation:manage` separada do financeiro geral
- Auditoria: segue padrão existente com `logAudit`

**Performance**

- Projeção: sob demanda — calcula ao abrir a página, sem cache

**Edge Cases**

- Estornos: lançamento negativo, match automático com original se possível
- Re-import de período sobreposto: detecta duplicatas

**Mobile**

- Apenas visualização — import/conciliação só no desktop

### Claude's Discretion

- Parser OFX 1.x (SGML): escolher entre biblioteca existente ou parser custom
- Algoritmo de scoring para matching
- Design exato das tabelas e cards de conciliação
- Implementação do gráfico de projeção com Recharts
- Layout responsivo das páginas

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID    | Description                                                                                                                                                                            | Research Support                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| FN-06 | Gerente pode importar extrato bancário (OFX/CSV) e conciliar automaticamente com lançamentos do sistema, com graus de confiança (exato/provável/sem match) e ações manuais             | OFX parser pattern, multer upload, scoring algorithm, N:N reconciliation model                            |
| FN-13 | Gerente pode visualizar fluxo de caixa realizado e projetado com cenários (otimista/realista/pessimista), gráfico de evolução com alerta de saldo negativo, classificação DFC e export | Recharts AreaChart, projection algorithm using existing CP/CR/Check models, pdfkit/exceljs export pattern |

</phase_requirements>

---

## Summary

Phase 05 covers two distinct features: (1) bank statement import and reconciliation, and (2) 12-month cashflow projection. Both build on a mature financial module stack that already handles CP, CR, Transfers, Checks, Credit Cards, and a Financial Dashboard.

The reconciliation feature requires new Prisma models (`BankStatementImport`, `BankStatementLine`, `Reconciliation`), a new `reconciliation` module in the backend, and two new frontend pages. The OFX 1.x format is the main parsing challenge: it is SGML-like, not valid XML. Since `@xmldom/xmldom` is already installed and `ofx-js` is a low-activity package (v0.2.0, last published over a year ago), the recommended approach is a custom lightweight SGML-to-object parser for OFX 1.x (similar to how CNAB retorno is parsed with sliceField helpers) combined with `@xmldom/xmldom` for OFX 2.x.

The cashflow projection is a pure computation feature: aggregate open `PayableInstallment` and `ReceivableInstallment` records by due date over 12 months, add `Check` A_COMPENSAR values at their `expectedCompensationDate`, then apply scenario multipliers. The result is rendered with Recharts `AreaChart` / `ComposedChart` (both already used in the codebase) and exported via the existing pdfkit + exceljs infrastructure.

**Primary recommendation:** Two new backend modules (`reconciliation/` and `cashflow/`), two new frontend pages (`ReconciliationPage`, `CashflowPage`), three new Prisma models, `reconciled` boolean field added to `Payable` and `Receivable`, and a new `reconciliation` permission module added to `permissions.ts`.

---

## Standard Stack

### Core

| Library            | Version      | Purpose                 | Why Standard                                |
| ------------------ | ------------ | ----------------------- | ------------------------------------------- |
| multer             | ^2.1.0       | Multipart file upload   | Already installed, used for CNAB retorno    |
| @xmldom/xmldom     | ^0.8.11      | OFX 2.x (XML) parsing   | Already installed, avoids new dependency    |
| exceljs            | ^4.4.0       | Excel export            | Already installed, used in multiple modules |
| pdfkit             | ^0.17.2      | PDF export              | Already installed, used in prescriptions    |
| recharts           | ^3.7.0       | Cashflow chart          | Already installed, used in dashboard        |
| decimal.js / Money | project util | All monetary arithmetic | Established pattern, never use native float |

### Supporting

| Library            | Version  | Purpose               | When to Use                                          |
| ------------------ | -------- | --------------------- | ---------------------------------------------------- |
| Custom SGML parser | internal | OFX 1.x parsing       | OFX 1.x is not XML, needs regex-based tag extraction |
| ExcelJS worksheet  | ^4.4.0   | Cashflow Excel export | Multi-sheet: projection data + DFC classification    |

### Alternatives Considered

| Instead of            | Could Use | Tradeoff                                                                                                         |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| Custom OFX 1.x parser | ofx-js    | ofx-js v0.2.0 low maintenance, no active updates per npm. Custom parser mirrors CNAB pattern already in codebase |
| Recharts AreaChart    | Chart.js  | Recharts already installed and used; no value in adding Chart.js                                                 |

**Installation:** No new packages needed — all dependencies already present.

---

## Architecture Patterns

### New Module Structure

```
apps/backend/src/modules/
├── reconciliation/
│   ├── reconciliation.types.ts
│   ├── reconciliation.service.ts       # import, parse, match, confirm
│   ├── reconciliation.routes.ts
│   ├── reconciliation.routes.spec.ts
│   └── ofx-parser.ts                   # OFX 1.x SGML + 2.x XML
├── cashflow/
│   ├── cashflow.types.ts
│   ├── cashflow.service.ts             # projection + DFC classification
│   ├── cashflow.routes.ts
│   └── cashflow.routes.spec.ts

apps/frontend/src/
├── pages/
│   ├── ReconciliationPage.tsx           # /reconciliation
│   ├── ReconciliationPage.css
│   ├── CashflowPage.tsx                 # /cashflow
│   └── CashflowPage.css
├── components/
│   ├── reconciliation/
│   │   ├── ImportHistoryTable.tsx
│   │   ├── ImportPreviewModal.tsx       # CSV column mapping + checkbox table
│   │   ├── ReconciliationLineList.tsx   # grouped EXATO/PROVÁVEL/SEM_MATCH
│   │   └── ManualLinkModal.tsx          # search CP+CR+Transfers
│   └── cashflow/
│       ├── CashflowChart.tsx            # Recharts AreaChart with 3 scenarios
│       └── DfcTable.tsx                 # Operacional/Investimento/Financiamento
├── hooks/
│   ├── useReconciliation.ts
│   └── useCashflow.ts
```

### Pattern 1: OFX Parser (SGML + XML)

**What:** OFX 1.x uses SGML-like syntax (unclosed tags, no XML declaration). OFX 2.x is valid XML. Detection is by checking whether the file content starts with `<?OFX` (2.x) or has `OFXHEADER:` (1.x).

**When to use:** Any OFX file upload.

**Example:**

```typescript
// Source: custom — mirrors CNAB parser pattern in project
// OFX 1.x SGML parser
function parseOfx1(content: string): OfxDocument {
  // Strip SGML header (lines before <OFX>)
  const headerEnd = content.indexOf('<OFX>');
  const body = headerEnd >= 0 ? content.slice(headerEnd) : content;

  // Extract BANKID + ACCTID for auto-detect
  const bankId = extractTag(body, 'BANKID');
  const acctId = extractTag(body, 'ACCTID');

  // Extract STMTTRN blocks
  const transactions: OfxTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match: RegExpExecArray | null;
  while ((match = stmtTrnRegex.exec(body)) !== null) {
    const block = match[1];
    transactions.push({
      trntype: extractTag(block, 'TRNTYPE') ?? '',
      dtposted: parseOfxDate(extractTag(block, 'DTPOSTED') ?? ''),
      trnamt: parseFloat(extractTag(block, 'TRNAMT') ?? '0'),
      fitid: extractTag(block, 'FITID') ?? '',
      memo: extractTag(block, 'MEMO') ?? extractTag(block, 'NAME') ?? '',
    });
  }
  return { bankId, acctId, transactions };
}

function extractTag(content: string, tag: string): string | undefined {
  // Matches both <TAG>VALUE</TAG> (OFX 2.x) and <TAG>VALUE\n (OFX 1.x unclosed)
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  return content.match(regex)?.[1]?.trim();
}
```

### Pattern 2: Reconciliation Scoring Algorithm

**What:** Compare each `BankStatementLine` against open `PayableInstallment` + `ReceivableInstallment` + `Transfer` records to compute a confidence score.

**When to use:** After import, before user confirmation.

```typescript
// Source: custom algorithm per CONTEXT.md decisions
type ConfidenceLevel = 'EXATO' | 'PROVAVEL' | 'SEM_MATCH';

interface MatchCandidate {
  type: 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER';
  referenceId: string;
  score: number; // 0-100
  confidence: ConfidenceLevel;
}

function scoreMatch(
  statementLine: { amount: number; date: Date; memo: string },
  candidate: { amount: number; date: Date; description: string },
): number {
  // Value score: exact = 50 pts, within 1% = 30 pts, within 5% = 10 pts
  const valueDiff = Math.abs(statementLine.amount - candidate.amount);
  const relDiff = valueDiff / Math.abs(candidate.amount);
  const valueScore = valueDiff === 0 ? 50 : relDiff < 0.01 ? 30 : relDiff < 0.05 ? 10 : 0;

  // Date score: ±1 day = 40 pts, ±5 days = 20 pts, otherwise = 0
  const dayDiff = Math.abs((statementLine.date.getTime() - candidate.date.getTime()) / 86400000);
  const dateScore = dayDiff <= 1 ? 40 : dayDiff <= 5 ? 20 : 0;

  // Description similarity: crude substring = 10 pts
  const memoLower = statementLine.memo.toLowerCase();
  const descLower = candidate.description.toLowerCase();
  const descScore =
    memoLower.includes(descLower.slice(0, 8)) || descLower.includes(memoLower.slice(0, 8)) ? 10 : 0;

  const total = valueScore + dateScore + descScore;
  return total;
}

function toConfidence(score: number): ConfidenceLevel {
  if (score >= 95) return 'EXATO';
  if (score >= 70) return 'PROVAVEL';
  return 'SEM_MATCH';
}
```

### Pattern 3: Cashflow Projection (12 months)

**What:** Aggregate all open CP/CR installments and checks by their due/compensation date, compute daily running balance, apply scenario multipliers.

```typescript
// Source: custom — uses existing Prisma models
// Build daily buckets from today to today+365
const buckets = new Map<string, { inflows: Money; outflows: Money }>();

// Seed with current balance
const currentBalance = await getConsolidatedBalance(ctx, farmId);

// Add PayableInstallments (outflows) by dueDate
// Add ReceivableInstallments (inflows) by dueDate
// Add Checks A_COMPENSAR EMITIDO (outflows) by expectedCompensationDate
// Add Checks A_COMPENSAR RECEBIDO (inflows) by expectedCompensationDate

// Compute running balance
let balance = currentBalance;
const projectionPoints: ProjectionPoint[] = [];
for (const [date, bucket] of sortedBuckets) {
  balance = balance.add(bucket.inflows).subtract(bucket.outflows);
  projectionPoints.push({
    date,
    balanceRealistic: balance.toNumber(),
    balanceOptimistic: computeOptimistic(balance, bucket), // +10% inflows, -5% outflows
    balancePessimistic: computePessimistic(balance, bucket), // -10% inflows, +15% outflows
    inflows: bucket.inflows.toNumber(),
    outflows: bucket.outflows.toNumber(),
  });
}
```

### Pattern 4: Recharts AreaChart with Reference Lines

**What:** The existing `RevenueExpenseChart` uses `BarChart`. For cashflow projection, use `ComposedChart` with `Area` for the filled region and `ReferenceLine` at y=0 for the red zone.

```tsx
// Source: recharts docs — mirrors WeighingChartInner.tsx pattern in codebase
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

<ResponsiveContainer width="100%" height={320}>
  <ComposedChart data={projectionData}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
    <ReferenceLine y={0} stroke="var(--color-error-500)" strokeWidth={2} />
    <XAxis dataKey="label" />
    <YAxis tickFormatter={formatBRLCompact} />
    <Tooltip content={<CashflowTooltip />} />
    <Area
      type="monotone"
      dataKey="balanceRealistic"
      stroke="var(--color-primary-600)"
      fill="var(--color-primary-100)"
      name="Realista"
    />
    <Line
      type="monotone"
      dataKey="balanceOptimistic"
      stroke="var(--color-success-500)"
      dot={false}
      name="Otimista"
    />
    <Line
      type="monotone"
      dataKey="balancePessimistic"
      stroke="var(--color-error-500)"
      dot={false}
      name="Pessimista"
    />
  </ComposedChart>
</ResponsiveContainer>;
```

### Pattern 5: CSV Column Mapping (Auto-detect + Confirm)

**What:** Upload CSV, detect columns, return suggested mapping, frontend shows mapping UI with preview, user confirms or adjusts, then POSTs confirmed mapping to trigger DB import.

**Flow:**

1. `POST /org/reconciliation/imports/csv-preview` — multer, returns detected columns + suggested mapping + first 10 rows
2. Frontend renders `ImportPreviewModal` with mapping dropdowns + checkbox table
3. `POST /org/reconciliation/imports` — body includes confirmed mapping + selected row indices

### Anti-Patterns to Avoid

- **Floating point money:** Never use `number` arithmetic for financial totals. Always use `Money()` from `@protos-farm/shared`.
- **Nested RLS contexts:** Never call a service function that uses `withRlsContext` from inside another `withRlsContext` — inline the logic or pass `tx`.
- **Global FarmContext for cashflow:** Use local `useState(farmId)` — matches existing dashboard pattern, avoids polluting global farm selection.
- **Spinner full-page loading:** Use skeleton screens while projection loads.
- **Storing projection in DB:** Projection is always computed on demand per CONTEXT.md decision — no cache table needed.

---

## Don't Hand-Roll

| Problem               | Don't Build        | Use Instead                               | Why                                                      |
| --------------------- | ------------------ | ----------------------------------------- | -------------------------------------------------------- |
| Multipart file upload | Custom body parser | multer memoryStorage (already configured) | Already works for CNAB retorno, handles limits, encoding |
| Excel export          | Custom XML         | exceljs Workbook                          | Multi-sheet, cell formatting, already in use             |
| PDF generation        | Custom HTML/CSS    | pdfkit (dynamic import pattern)           | Already used for pesticide prescriptions                 |
| OFX 2.x XML parsing   | String regex       | @xmldom/xmldom DOMParser                  | Already installed, correct XML tree parsing              |
| Money arithmetic      | Native `+` / `-`   | Money() from @protos-farm/shared          | Handles Decimal precision, fromPrismaDecimal             |
| Permission checks     | Inline role checks | checkPermission middleware                | Existing RBAC system, consistent error messages          |
| Audit logging         | Custom logging     | logAudit from audit.service               | Consistent audit trail pattern across all modules        |

**Key insight:** This phase has zero new library requirements. Every tool needed is already installed and battle-tested in this codebase.

---

## Common Pitfalls

### Pitfall 1: OFX 1.x Encoding

**What goes wrong:** Brazilian banks (BB, Bradesco, Sicoob) export OFX 1.x files in ISO-8859-1 encoding. Reading as UTF-8 corrupts accented characters in memo fields (MEMO/NAME tags), causing matching failures.
**Why it happens:** Node.js `Buffer.toString()` defaults to UTF-8. Multer buffers are raw bytes.
**How to avoid:** `req.file.buffer.toString('latin1')` — same pattern used in CNAB retorno (`latin1` is the Node.js alias for ISO-8859-1). Apply before any string operations.
**Warning signs:** Garbage characters like `Ã§` instead of `ç` in imported memos.

### Pitfall 2: N:N Reconciliation Sum Validation

**What goes wrong:** When reconciling multiple statement lines against multiple CP/CR records (N:N), the sum may not match exactly due to floating-point rounding.
**Why it happens:** Native `number` addition accumulates errors (e.g., 0.1 + 0.2 = 0.30000000000000004).
**How to avoid:** Use `Money()` for all summation during N:N validation. Compare with `Money.fromPrismaDecimal` to handle Prisma Decimal correctly.
**Warning signs:** "Sum does not match" errors on values that visually appear equal.

### Pitfall 3: Duplicate Detection on Re-import

**What goes wrong:** Re-importing a partially overlapping statement imports already-saved lines again.
**Why it happens:** Naive check only looks at FITID (OFX transaction ID), which some banks reset or omit.
**How to avoid:** Compound uniqueness check: `bankAccountId + fitId` for OFX (when fitId present), fallback to `bankAccountId + date + amount + memo` hash for CSV and OFX without FITID. Store this composite hash on `BankStatementLine`.
**Warning signs:** Duplicate entries in reconciliation list after re-import.

### Pitfall 4: Cashflow Projection Horizon vs. Recurrence Generation

**What goes wrong:** Recurring CP/CR records (weekly, biweekly, monthly) may not have `PayableInstallment` rows pre-generated beyond the current recurrence window. The projection query for 12 months returns incomplete data.
**Why it happens:** Recurrence children are generated lazily in the existing payables/receivables module. Future installments may not exist in DB yet.
**How to avoid:** In the cashflow service, when fetching open installments, also check `recurrenceFrequency` on parent `Payable`/`Receivable` and project future recurrence amounts programmatically if the recurrence end date extends beyond existing installments.
**Warning signs:** 12-month projection showing gaps for known monthly payments.

### Pitfall 5: Permission Module Conflict

**What goes wrong:** CONTEXT.md specifies `reconciliation:manage` as a new permission, but the existing `PermissionModule` type only supports `financial` as the module for financial features. Adding a non-standard permission string will TypeScript-error against the `Permission` type.
**Why it happens:** `permissions.ts` defines `PermissionModule` as a union type. New modules must be added there.
**How to avoid:** Add `'reconciliation'` to `PermissionModule` union in `permissions.ts`, add `reconciliation:manage` as a custom permission constant (separate from the `all_actions` pattern since `manage` is not in `PermissionAction`). Alternatively, use `financial:create` for reconciliation writes per existing `FINANCIAL` role coverage — discuss with planner.
**Warning signs:** TypeScript compile error `Type '"reconciliation:manage"' is not assignable to type 'Permission'`.

> **Resolution:** The cleanest approach is to use `financial:create` for reconciliation operations — it avoids touching the RBAC system while maintaining the spirit of the permission requirement. The CONTEXT.md says "nova permissão reconciliation:manage" but the existing FINANCIAL role already has full `financial:*` access. Using `financial:create` is consistent and type-safe. Flag this in the plan for the implementer to decide.

### Pitfall 6: Route Ordering in Express 5

**What goes wrong:** Express param capture — e.g., `/org/reconciliation/imports/csv-preview` is captured by `/:id` if not registered first.
**Why it happens:** Express matches routes in registration order.
**How to avoid:** Register all named-path routes (`/csv-preview`, `/history`, `/report`) before `/:id` routes. Follow the established pattern from `checksRouter` and `payablesRouter`.
**Warning signs:** 404 or wrong handler called for preview/history endpoints.

---

## Code Examples

### Upload + ISO-8859-1 Decode (follows CNAB retorno pattern)

```typescript
// Source: apps/backend/src/modules/payables/payables.routes.ts (line 251)
// The exact same pattern — latin1 decode for ISO-8859-1 bank files
const fileContent = req.file.buffer.toString('latin1');
```

### withRlsContext Transaction Pattern

```typescript
// Source: apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts
return withRlsContext(ctx, async (tx) => {
  const results = await (tx as any).bankStatementLine.findMany({ where: { ... } });
  return results;
});
```

### Money Arithmetic

```typescript
// Source: apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts (line 62)
import { Money } from '@protos-farm/shared';
let total = Money(0);
for (const item of items) {
  total = total.add(Money.fromPrismaDecimal(item.amount));
}
return total.toNumber();
```

### pdfkit Dynamic Import (PDF export)

```typescript
// Source: apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts (line 370)
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 50 });
```

### ExcelJS Workbook Export

```typescript
// Source: apps/backend/src/modules/feed-ingredients/analysis-file-parser.ts (line 182)
import ExcelJS from 'exceljs';
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Fluxo de Caixa');
// ... add rows ...
const buffer = await workbook.xlsx.writeBuffer();
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.send(buffer);
```

### Recharts ComposedChart with Area + ReferenceLine

```tsx
// Source: recharts@3.7.0 — ComposedChart supports mixed Area+Line+ReferenceLine
// Pattern verified against existing WeighingChartInner.tsx (LineChart) and RevenueExpenseChart.tsx (BarChart)
import { ComposedChart, Area, Line, ReferenceLine, ResponsiveContainer } from 'recharts';
```

---

## Data Model (New Prisma Models)

### Models to Create

```prisma
// Migration: 20260404100000_add_reconciliation

model BankStatementImport {
  id              String   @id @default(uuid())
  organizationId  String
  bankAccountId   String
  fileName        String
  fileType        String   // 'OFX' | 'CSV'
  importedBy      String   // userId
  totalLines      Int
  importedLines   Int
  skippedLines    Int      // duplicates
  createdAt       DateTime @default(now())

  organization Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  bankAccount  BankAccount         @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  lines        BankStatementLine[]

  @@index([organizationId, bankAccountId])
  @@map("bank_statement_imports")
}

model BankStatementLine {
  id           String    @id @default(uuid())
  organizationId String
  importId     String
  bankAccountId String
  fitId        String?   // OFX transaction ID (null for CSV)
  lineHash     String    // composite dedup hash: bankAccountId+date+amount+memo
  trnType      String    // CREDIT | DEBIT
  amount       Decimal   @db.Decimal(15, 2)
  date         DateTime
  memo         String
  status       BankStatementLineStatus @default(PENDING)
  createdAt    DateTime  @default(now())

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  import       BankStatementImport @relation(fields: [importId], references: [id], onDelete: Cascade)
  bankAccount  BankAccount     @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)
  reconciliations Reconciliation[]

  @@unique([bankAccountId, lineHash])
  @@index([organizationId, bankAccountId, status])
  @@map("bank_statement_lines")
}

model Reconciliation {
  id                    String   @id @default(uuid())
  organizationId        String
  statementLineId       String
  referenceType         String   // 'PAYABLE' | 'RECEIVABLE' | 'TRANSFER'
  referenceId           String
  confidenceScore       Int      // 0-100
  confidenceLevel       ReconciliationConfidence
  confirmedBy           String?  // userId — null if not yet confirmed
  confirmedAt           DateTime?
  createdAt             DateTime @default(now())

  organization  Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  statementLine BankStatementLine  @relation(fields: [statementLineId], references: [id], onDelete: Cascade)

  @@index([organizationId, statementLineId])
  @@map("reconciliations")
}

enum BankStatementLineStatus {
  PENDING
  RECONCILED
  IGNORED
}

enum ReconciliationConfidence {
  EXATO
  PROVAVEL
  SEM_MATCH
}
```

### Fields to Add to Existing Models

```prisma
// Payable — add:
reconciled   Boolean @default(false)
reconciledAt DateTime?

// Receivable — add:
reconciled   Boolean @default(false)
reconciledAt DateTime?
```

### Migration Numbering

Last migration: `20260403100000_add_rural_properties`

- `20260404100000_add_reconciliation` — BankStatementImport, BankStatementLine, Reconciliation models + enums
- `20260404200000_add_reconciled_fields` — `reconciled`/`reconciledAt` on Payable and Receivable

---

## State of the Art

| Old Approach       | Current Approach                    | When Changed           | Impact                                          |
| ------------------ | ----------------------------------- | ---------------------- | ----------------------------------------------- |
| ofx-js library     | Custom SGML parser + @xmldom/xmldom | Decision this phase    | Avoids maintenance risk of low-activity package |
| Global FarmContext | Local useState farmId               | Established in Phase 3 | Dashboard and cashflow both use this pattern    |
| Spinner loading    | Skeleton screens                    | Design system mandate  | Applies to cashflow page during computation     |

**Deprecated/outdated:**

- `ofx-js`: Last published over a year ago, v0.2.0, single maintainer. STATE.md explicitly flags this: "verificar manutenção ativa no npm antes de adotar. Fallback documentado: @xmldom/xmldom". Confirmed: do not use.

---

## Open Questions

1. **`reconciliation:manage` permission vs. `financial:create`**
   - What we know: `PermissionModule` type does not include `'reconciliation'`. Adding it requires changes to `permissions.ts` and the `DEFAULT_ROLE_PERMISSIONS` matrix.
   - What's unclear: Whether the intent is a truly separate role/permission (requiring DB migration for user permissions) or whether using `financial:create` for write operations covers the business requirement.
   - Recommendation: Use `financial:create` for reconciliation write operations in this implementation. Document in STATE.md. The separate `reconciliation:manage` can be added as a settings/roles feature when the permissions UI needs it.

2. **Recurrence Projection Gap**
   - What we know: `PayableInstallment` / `ReceivableInstallment` rows may not exist for future recurrence periods beyond what has been auto-generated.
   - What's unclear: How far ahead the existing recurrence generator creates installments.
   - Recommendation: In cashflow service, when parent `Payable`/`Receivable` has `recurrenceFrequency` and `recurrenceEndDate` beyond last existing installment, programmatically generate projected amounts without writing to DB.

3. **DFC Classification Mapping**
   - What we know: CONTEXT.md mandates DFC classification (Operacional/Investimento/Financiamento).
   - What's unclear: Which `PayableCategory` and `ReceivableCategory` values map to which DFC class.
   - Recommendation: Define a static mapping constant in `cashflow.types.ts`. Suggest: FINANCING → Financiamento, INPUTS/MAINTENANCE/SERVICES/PAYROLL/RENT/TAXES → Operacional, OTHER → Operacional by default. Make it overridable in a future iteration.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Framework          | Jest 29 + @swc/jest                                                                                         |
| Config file        | `apps/backend/jest.config.js`                                                                               |
| Quick run command  | `pnpm --filter @protos-farm/backend test -- --testPathPattern="reconciliation\|cashflow" --passWithNoTests` |
| Full suite command | `pnpm --filter @protos-farm/backend test`                                                                   |

### Phase Requirements → Test Map

| Req ID | Behavior                                          | Test Type   | Automated Command                                | File Exists? |
| ------ | ------------------------------------------------- | ----------- | ------------------------------------------------ | ------------ |
| FN-06  | OFX 1.x parse: extract BANKID+ACCTID+transactions | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | OFX 2.x parse: XML extraction                     | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | CSV auto-detect + mapping suggestion              | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | Duplicate detection by lineHash                   | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | Score EXATO (≥95) for exact value + ±1 day        | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | Score PROVAVEL (70-94) for near value + ±5 days   | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | N:N reconciliation sum validation                 | unit        | `jest --testPathPattern="reconciliation"`        | ❌ Wave 0    |
| FN-06  | POST /imports returns import record               | integration | `jest --testPathPattern="reconciliation.routes"` | ❌ Wave 0    |
| FN-06  | GET /imports/:id/lines returns grouped lines      | integration | `jest --testPathPattern="reconciliation.routes"` | ❌ Wave 0    |
| FN-13  | Projection builds 12-month buckets correctly      | unit        | `jest --testPathPattern="cashflow"`              | ❌ Wave 0    |
| FN-13  | Optimistic scenario: +10% inflows -5% outflows    | unit        | `jest --testPathPattern="cashflow"`              | ❌ Wave 0    |
| FN-13  | Pessimistic scenario: -10% inflows +15% outflows  | unit        | `jest --testPathPattern="cashflow"`              | ❌ Wave 0    |
| FN-13  | Negative balance detection returns correct date   | unit        | `jest --testPathPattern="cashflow"`              | ❌ Wave 0    |
| FN-13  | GET /cashflow/projection returns all 3 scenarios  | integration | `jest --testPathPattern="cashflow.routes"`       | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern="reconciliation|cashflow" --passWithNoTests`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/reconciliation/reconciliation.routes.spec.ts` — covers FN-06 route integration
- [ ] `apps/backend/src/modules/reconciliation/ofx-parser.spec.ts` — covers OFX 1.x and 2.x parsing
- [ ] `apps/backend/src/modules/cashflow/cashflow.routes.spec.ts` — covers FN-13 route integration
- [ ] Test fixtures: sample OFX 1.x (BB/Sicoob), OFX 2.x, and CSV files for parser tests

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `apps/backend/src/modules/cnab/` — SGML line-based parsing pattern reference
- Codebase inspection: `apps/backend/prisma/schema.prisma` — confirmed Payable/Receivable structure, no `reconciled` field yet
- Codebase inspection: `apps/backend/src/shared/rbac/permissions.ts` — confirmed `PermissionModule` union, `financial` module covers reconciliation for now
- Codebase inspection: `apps/backend/package.json` — confirmed @xmldom/xmldom ^0.8.11 installed, no ofx-js
- Codebase inspection: `apps/frontend/src/components/financial-dashboard/RevenueExpenseChart.tsx` — confirmed Recharts BarChart pattern
- Codebase inspection: `apps/frontend/src/components/animals/WeighingChartInner.tsx` — confirmed Recharts LineChart pattern

### Secondary (MEDIUM confidence)

- npm show ofx-js: v0.2.0, "published over a year ago", single maintainer — confirmed low maintenance
- npm show ofx: v0.5.0, "published over a year ago" — also low maintenance; same conclusion
- STATE.md (project): explicitly flags ofx-js verification requirement and documents @xmldom/xmldom fallback

### Tertiary (LOW confidence)

- None required — all critical findings verifiable from codebase directly

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed installed in package.json
- Architecture: HIGH — mirrors established module patterns (cnab, financial-dashboard, payables)
- OFX parser approach: HIGH — ofx-js maintenance status confirmed via npm, @xmldom/xmldom presence confirmed
- Pitfalls: HIGH — derived from existing codebase patterns (latin1 encoding from CNAB, Money arithmetic, route ordering)
- Data model: HIGH — schema read directly, migration numbering verified

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack, 30-day window)
