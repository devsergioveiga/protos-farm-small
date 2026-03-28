# Phase 37: Regras e Lançamentos Automáticos - Research

**Researched:** 2026-03-27
**Domain:** Double-entry GL automation, Postgres queue patterns, TypeScript module hooks
**Confidence:** HIGH

## Summary

Phase 37 introduces a configurable accounting rule engine that bridges operational modules (payroll, payables, receivables, depreciation, stock) to the double-entry GL (JournalEntry) established in Phase 36. The architecture follows the non-blocking post-transaction pattern already proven in `accounting-entries.service.ts` — and replaces that entire legacy module with a superior design.

The central new module is `modules/auto-posting/`, which owns: (1) `AccountingRule` and `AccountingRuleLine` models (1:N, per D-05), (2) `PendingJournalPosting` as a Postgres-native queue (per D-14 — no BullMQ/Redis), and (3) a data-extractor map dispatching to per-sourceType fetch functions. All 6 hook modules call `autoPostingService.process(sourceType, sourceId, orgId)` synchronously after their main transactions; GL failure never reverts the business operation.

The frontend extends the existing `JournalEntriesPage` with two new tabs (Pendências + Regras), matching the established tab pattern used in Phase 36. The `AccountingEntriesPage` legacy page and its underlying model/enums are removed entirely.

**Primary recommendation:** Build `auto-posting` module first (schema + service + routes), then add hooks to the 6 source modules, then wire the frontend tabs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Regras de Mapeamento**
- D-01: Tabela única administrativa listando todas as operações. Cada linha mapeia tipo → conta débito + conta crédito + template de histórico + flag CC obrigatório. Modal para edição.
- D-02: Regras pré-populadas com mapeamentos padrão quando o template COA rural é criado. Contador só ajusta se necessário.
- D-03: Preview de lançamento no modal da regra — botão "Pré-visualizar" mostra exemplo com dados reais da última operação daquele tipo.
- D-04: Migrar AccountingEntry (v1.3 stubs) para JournalEntry. Lançamentos automáticos geram JournalEntry com entryType=AUTOMATIC. AccountingEntry vira legado — migrar e depreciar.
- D-05: AccountingRule com AccountingRuleLines (1:N). Folha = 1 regra com 5+ linhas (salário D/C, INSS D/C, FGTS D/C etc).
- D-06: Template de histórico com placeholders {{variáveis}} substituídas no momento da geração. Variáveis disponíveis dependem do sourceType.
- D-07: Regra por sub-tipo de operação — STOCK_OUTPUT_CONSUMPTION e STOCK_OUTPUT_TRANSFER são regras separadas. Sem lógica condicional na regra.
- D-08: Cada regra tem flag isActive. Quando inativa, operações não geram lançamento GL.
- D-09: Alteração de regra só afeta operações futuras. Lançamentos já postados ficam inalterados (imutabilidade contábil).
- D-10: Enum extenso no schema (~15-20 valores) para sourceType cobrindo todos os sub-tipos. Typesafe via Prisma.
- D-11: Centro de custo inferido da operação origem (farmId → CostCenter). Regra só define se CC é obrigatório para aquele tipo.
- D-12: Lançamentos automáticos postados automaticamente (status POSTED) com postedAt. Sem revisão manual — contador estorna se necessário.
- D-13: Regras por organização com seed automático. organizationId + RLS. Seed cria regras junto com template COA.

**Estratégia de Fila**
- D-14: Tabela Postgres PendingJournalPosting como fila (sem BullMQ/Redis). Status: PENDING → PROCESSING → COMPLETED | ERROR.
- D-15: Processamento síncrono inline — após a transaction da operação (non-blocking). Falha no GL não reverte a operação.
- D-16: Retry manual via botão na tela de pendências. Sem cron automático.
- D-17: Idempotência: se já existe COMPLETED para sourceType+sourceId, silenciosamente ignora. Sem erro.
- D-18: Sem regra ativa = não cria PendingJournalPosting.
- D-19: Re-busca dados da tabela de origem no retry (sem snapshot JSON).
- D-20: Um PendingJournalPosting → um JournalEntry multi-linha.
- D-21: sourceId consolidado: payrollRunId, depreciationRunId, stockEntryId, stockOutputId, payableId, receivableId.
- D-22: PendingJournalPosting armazena accountingRuleId para rastreabilidade.
- D-23: Campos sourceType e sourceId adicionados ao JournalEntry para consulta direta.
- D-24: Estorno automático em cascata quando operação origem é estornada.
- D-25: Período contábil fechado = PendingJournalPosting com ERROR "período fechado".

**Hooks nos Módulos**
- D-26: Chamada direta ao service (não event system). Módulo importa e chama `autoPostingService.process(sourceType, sourceId, orgId)`.
- D-27: Módulo novo `modules/auto-posting/` com service, types, routes (CRUD regras + retry + pendências).
- D-28: Data extractors centralizados no auto-posting.service com map sourceType → função extratora.
- D-29: Substituir AccountingEntry stubs completamente. Remover accounting-entries/ module, AccountingEntry model, enums AccountingEntryType/AccountingSourceType, ACCOUNT_CODES const.
- D-30: Hook de folha independente do módulo de ausências.
- D-31: Provisões de folha (férias/13º) migradas para auto-posting com regras configuráveis.
- D-32: Testes reescritos do zero em auto-posting.routes.spec.ts.
- D-33: Para CR, usar `settleReceivable` (análoga a `settlePayment` de payables). Criar se não existir.

**Tela de Pendências e Regras (Frontend)**
- D-34: 3 tabs na JournalEntriesPage: Lançamentos | Pendências | Regras.
- D-35: Tab Pendências: filtros por status e tipo de operação. Retry individual + retry em lote.
- D-36: Colunas: badge status (cor), tipo operação, link para origem, data, ações.
- D-37: Linha expandível (accordion) para ERROR mostrando mensagem + botão retry.
- D-38: Badge com count de ERRORs (vermelho) e PENDINGs (amarelo) na tab Pendências.
- D-39: Link na coluna Origem navega para página do módulo correspondente.
- D-40: Botão "Ver" em COMPLETED navega para tab Lançamentos filtrada pelo JournalEntry.
- D-41: Badge visual de entryType na tab Lançamentos (Manual, Automático, Estorno).
- D-42: CRUD de regras em modal. Modal com: tipo (readonly), isActive, linhas débito/crédito (tabela editável), template histórico, flag CC obrigatório, botão preview.

### Claude's Discretion
- Escolha de nomes específicos dos valores do enum extenso de sourceType
- Estrutura interna do data extractor map
- Ordem das colunas e detalhes visuais de badges
- Validação de contas no processamento (período aberto + regra ativa confirmados como suficientes)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANC-01 | Sistema gera lançamentos contábeis automáticos (partidas dobradas) para: liquidação de CP, recebimento de CR, fechamento de folha, depreciação mensal, entrada/saída de estoque | AccountingRule engine + PendingJournalPosting queue + hooks in 6 modules |
| LANC-02 | Contador pode configurar regras de lançamento automático por tipo de operação com conta débito, conta crédito, template de histórico e flag CC obrigatório, com tela administrativa | AccountingRule CRUD + RulesTab + AccountingRuleModal in frontend |
| LANC-06 | Sistema garante idempotência — re-processamento não gera duplicatas, constraint único (sourceType + sourceId), fila de pendências com retry | UNIQUE constraint on PendingJournalPosting + JournalEntry.sourceType/sourceId + retry endpoint |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.6.0 | ORM + migrations | Already in use; AccountingRule and PendingJournalPosting as native Postgres tables |
| Decimal.js | ^10.6.0 | Monetary arithmetic | Already in use throughout service layer; no float math |
| Express 5 | ^5.1.0 | HTTP routes | Already in use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @protos-farm/shared | workspace | assertBalanced, assertPeriodOpen, Money | GL line validation before auto-post |
| lucide-react | installed | Icons (Settings, Clock, AlertTriangle, CheckCircle, RefreshCw) | Badges and action buttons in Pendências/Regras tabs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres-as-queue (PendingJournalPosting) | BullMQ + Redis | BullMQ needs Redis; D-14 locks this to Postgres-only |
| Sync inline processing (D-15) | Async worker | Async worker needs queue polling; D-15 mandates non-blocking inline |

**Installation:** No new packages required. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/auto-posting/
├── auto-posting.service.ts     # process(), retry(), extractors map
├── auto-posting.routes.ts      # CRUD rules + pending list + retry
├── auto-posting.routes.spec.ts # All tests (D-32)
└── auto-posting.types.ts       # AutoPostingError, input/output interfaces

apps/frontend/src/
├── pages/JournalEntriesPage.tsx         # Add PendenciasTab + RegrasTab
├── components/accounting/
│   ├── PendingPostingsTab.tsx           # Tab content with accordion rows
│   ├── AccountingRulesTab.tsx           # Rules table
│   └── AccountingRuleModal.tsx          # CRUD modal + preview
├── hooks/
│   ├── usePendingPostings.ts
│   └── useAccountingRules.ts
└── types/
    └── auto-posting.ts                  # PendingJournalPosting, AccountingRule
```

### Pattern 1: Non-Blocking Hook Pattern

This is the established pattern from `accounting-entries.service.ts`. The GL call is always after the business transaction, in a try/catch. This already works for payroll close and payable settlement.

```typescript
// In any source module service, after business operation completes:
try {
  await autoPostingService.process('PAYROLL_RUN_CLOSE', runId, organizationId);
} catch (err) {
  console.error('[payroll-runs] Failed to auto-post GL entry:', err);
  // Business operation already committed — GL failure is non-blocking
}
```

**Current hook points identified:**
- `payroll-runs.service.ts` line 1059: Currently calls `createPayrollEntries()`. Replace with `autoPostingService.process('PAYROLL_RUN_CLOSE', runId, orgId)`.
- `payables.service.ts` line 479: Currently calls `createReversalEntry()`. Replace with `autoPostingService.process('PAYABLE_SETTLEMENT', payableId, orgId)`.
- `receivables.service.ts` line ~460: After `settleReceivable`. Add call with `'RECEIVABLE_SETTLEMENT'`.
- `depreciation-batch.service.ts`: After DepreciationRun reaches COMPLETED status. Inject call with `'DEPRECIATION_RUN'`.
- `stock-entries.service.ts` function `createStockEntry` (line 493): After entry creation. Call with `'STOCK_ENTRY'`.
- `stock-outputs.service.ts` function `createStockOutput` (line 293): After output creation. Call with `'STOCK_OUTPUT_CONSUMPTION'` or `'STOCK_OUTPUT_TRANSFER'` based on outputType.

### Pattern 2: PendingJournalPosting State Machine

```
PENDING → PROCESSING → COMPLETED
                     → ERROR
```

The `process()` function:
1. Check if COMPLETED already exists for (sourceType, sourceId) → if yes, return silently (D-17).
2. Create PendingJournalPosting with status=PENDING.
3. Find active AccountingRule for (organizationId, sourceType).
4. If no active rule → return without creating posting (D-18).
5. Update status to PROCESSING.
6. Extract data from source table via extractor map (D-28).
7. Build JournalEntry lines from AccountingRuleLines.
8. Substitute {{placeholders}} in description.
9. Infer costCenterId from operation's farmId → CostCenter.
10. Call existing `createJournalEntryDraft()` + `postJournalEntry()` OR inline creation with AUTOMATIC type.
11. Update PendingJournalPosting to COMPLETED + journalEntryId.
12. On any error → update to ERROR + errorMessage.

**Key insight on posting:** `postJournalEntry()` calls `validateAccountsForManualEntry()` which checks `allowManualEntry`. For automatic entries, a separate validation path is needed that skips the `allowManualEntry` check — automatic postings can target accounts not open to manual entries.

### Pattern 3: AccountingRule + AccountingRuleLines

```typescript
// AccountingRule: 1 per sourceType per org
model AccountingRule {
  id             String   // uuid
  organizationId String
  sourceType     AutoPostingSourceType  // enum ~15-20 values
  isActive       Boolean  @default(true)
  historyTemplate String  // "Salário {{referenceMonth}} — {{employeeName}}"
  requireCostCenter Boolean @default(false)
  createdAt      DateTime
  updatedAt      DateTime
  lines          AccountingRuleLine[]
  @@unique([organizationId, sourceType])
}

model AccountingRuleLine {
  id              String  // uuid
  ruleId          String
  lineOrder       Int
  side            LedgerSide  // reuse existing enum
  accountId       String  // FK → ChartOfAccount
  description     String? // per-line description template
}
```

### Pattern 4: sourceType Enum Design

Based on D-10 (~15-20 values) and D-07 (sub-type granularity):

```typescript
enum AutoPostingSourceType {
  PAYROLL_RUN_CLOSE           // closeRun → salary + charges + tax liability
  PAYROLL_PROVISION_VACATION  // vacation provision (D-31)
  PAYROLL_PROVISION_THIRTEENTH // 13th provision (D-31)
  PAYABLE_SETTLEMENT          // settlePayment CP
  RECEIVABLE_SETTLEMENT       // settleReceivable CR
  DEPRECIATION_RUN            // depreciation batch
  STOCK_ENTRY                 // stock entry (entrada)
  STOCK_OUTPUT_CONSUMPTION    // consumption output (D-07)
  STOCK_OUTPUT_TRANSFER       // transfer output (D-07)
  STOCK_OUTPUT_DISPOSAL       // disposal output
  PAYABLE_REVERSAL            // when payable is cancelled/reversed (D-24)
  RECEIVABLE_REVERSAL         // when receivable is reversed (D-24)
  // Additional as needed
}
```

Note: The planner has full discretion on exact enum values (Claude's Discretion).

### Pattern 5: JournalEntry AUTOMATIC type

The `JournalEntryType` enum currently has: `MANUAL`, `OPENING_BALANCE`, `REVERSAL`, `TEMPLATE_INSTANCE`. Phase 37 adds `AUTOMATIC`.

This requires a migration. The `journal-entries.service.ts` auto-validates `allowManualEntry` — the auto-posting path bypasses this (uses direct `prisma.journalEntry.create` with the lines, skips `validateAccountsForManualEntry`).

**The auto-posting service creates and posts the JournalEntry atomically** (not via createJournalEntryDraft + postJournalEntry flow), because: (1) it needs to skip allowManualEntry validation, (2) it posts immediately without requiring a DRAFT stage, (3) it sets entryType=AUTOMATIC and sourceType+sourceId on the JournalEntry. The `postJournalEntry()` posting logic (AccountBalance update + sequential entryNumber) must be replicated inline or extracted to a shared helper.

### Pattern 6: Template Placeholder Substitution

```typescript
// Simple string replace — no library needed
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// Per sourceType variable map:
// PAYROLL_RUN_CLOSE:    { referenceMonth, organizationName }
// PAYABLE_SETTLEMENT:   { supplierName, documentNumber, description }
// RECEIVABLE_SETTLEMENT:{ clientName, documentNumber, description }
// DEPRECIATION_RUN:     { periodYear, periodMonth }
// STOCK_ENTRY:          { supplierName, documentNumber, referenceDate }
// STOCK_OUTPUT_*:       { outputType, referenceDate, productCount }
```

### Pattern 7: Seed AccountingRules alongside COA template

`seedRuralTemplate()` in `chart-of-accounts.service.ts` (line 349) calls `prisma.chartOfAccount.upsert()` in a loop. After Phase 37, a new `seedAccountingRules(organizationId)` function must be called from the same route handler (`POST /api/org/:orgId/chart-of-accounts/seed`). This seeds default AccountingRules referencing the well-known COA codes from `coa-rural-template.ts`.

### Anti-Patterns to Avoid

- **Nesting GL posting inside source transaction:** If GL fails, it rolls back the business operation. Always call `autoPostingService.process()` after the main transaction commits.
- **Using `window.confirm()` for retry confirmation:** Always use `ConfirmModal` per CLAUDE.md.
- **Using string literals for sourceType:** Always use the Prisma enum. CLAUDE.md forbids typing enum fields as `string`.
- **Calling `postJournalEntry()` for automatic entries:** That function validates `allowManualEntry`. Create a private `postAutomaticEntry()` helper that skips this check.
- **Adding BullMQ/Redis:** D-14 explicitly forbids this. The queue is Postgres-native.
- **Checking for COMPLETED before creating PENDING:** Do the idempotency check at the start of `process()`, before creating a PENDING record, to avoid orphaned PENDING rows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic | Custom rounding | Decimal.js (already used) | Float precision errors in monetary amounts |
| Period open check | Custom query | `assertPeriodOpen` from @protos-farm/shared | Already handles OPEN/CLOSED/BLOCKED status |
| Balance validation | Manual sum | `assertBalanced` from @protos-farm/shared | Already validates DEBIT === CREDIT |
| Template interpolation | regex library | Inline `replace(/{{(\w+)}}/g)` | ~3 lines, no dependency needed |
| Account balance update | Custom SQL | Reuse the raw SQL block from `postJournalEntry` | Tested, handles closing balance recalculation |
| Sequential entry number | UUID or timestamp | Reuse `aggregate._max.entryNumber + 1` pattern | Matches existing ledger numbering scheme |

**Key insight:** The posting engine in `journal-entries.service.ts` (`postJournalEntry`) already handles all the complex accounting mechanics. The auto-posting service should reuse the account balance update SQL and sequential numbering logic, extracted into a shared internal helper or called via the existing service (with a bypass flag for `allowManualEntry`).

## Common Pitfalls

### Pitfall 1: allowManualEntry Blocks Automatic Entries

**What goes wrong:** Auto-posting calls `createJournalEntryDraft` → `postJournalEntry`, which calls `validateAccountsForManualEntry`. Many accounts in the rural COA have `allowManualEntry: false` (synthetic accounts, restricted accounts). GL entry silently fails.

**Why it happens:** `validateAccountsForManualEntry` was built for human-originated entries. Automatic entries should be able to target any active analytic account.

**How to avoid:** The auto-posting service must create JournalEntries directly via `prisma.journalEntry.create()` (bypassing `validateAccountsForManualEntry`) and then run the posting logic inline. A private `_postAutomaticEntry(tx, entry, period)` function shared between `postJournalEntry` and auto-posting avoids code duplication.

**Warning signs:** `MANUAL_ENTRY_DISALLOWED` or `SYNTHETIC_ACCOUNT` errors in auto-posting logs.

### Pitfall 2: Duplicate PendingJournalPosting on Retry

**What goes wrong:** User clicks Retry on an ERROR posting. The `process()` function checks for COMPLETED, doesn't find one, and creates a second PENDING record. Now two PENDING records exist for the same (sourceType, sourceId).

**How to avoid:** The `retry()` endpoint should update the existing PendingJournalPosting record to PENDING (reset) and re-run the extractor+posting logic. Never create a new PendingJournalPosting on retry — always update the existing one.

**Warning signs:** Multiple PENDING or PROCESSING rows for the same (sourceType, sourceId).

### Pitfall 3: AccountingEntry Migration Leaves Orphan References

**What goes wrong:** `AccountingEntry` model is deleted in Phase 37 migration. But `payroll-runs.service.ts` still imports `createPayrollEntries` from `accounting-entries.service.ts`. Build fails with missing module.

**How to avoid:** The migration plan must update ALL import sites simultaneously: `payroll-runs.service.ts`, `payables.service.ts`, and `accounting-entries.routes.ts`. The test file `accounting-entries.routes.spec.ts` must also be removed or replaced with `auto-posting.routes.spec.ts`.

**Warning signs:** TypeScript build errors after schema migration for `@prisma/client` enum imports.

### Pitfall 4: Payroll Hook Sends Multiple sourceTypes

**What goes wrong:** `closeRun` currently calls `createPayrollEntries` which creates 5 AccountingEntry records (PAYROLL_SALARY, PAYROLL_CHARGES, VACATION_PROVISION, THIRTEENTH_PROVISION, TAX_LIABILITY). If Phase 37 maps each to a separate sourceType, then `closeRun` needs to call `process()` 5 times.

**How to avoid:** Per D-05 and D-20: one AccountingRule for payroll close (sourceType=PAYROLL_RUN_CLOSE) with multiple AccountingRuleLines (one per debit/credit pair). One PendingJournalPosting → one multi-line JournalEntry. The data extractor for PAYROLL_RUN_CLOSE aggregates all the totals in one pass.

**For provisions (D-31):** PAYROLL_PROVISION_VACATION and PAYROLL_PROVISION_THIRTEENTH are separate sourceTypes because they come from PayrollProvision records, not PayrollRun. The `closeRun` hook calls `process()` once for PAYROLL_RUN_CLOSE. The provision hook is called separately when provisions are calculated.

### Pitfall 5: CostCenter Inference May Fail

**What goes wrong:** D-11 says CC is inferred from the operation's farmId → CostCenter. But not all farms have a CostCenter, and stock entries can span multiple farms.

**How to avoid:** The extractor for each sourceType should query the most relevant farmId (e.g., for PAYROLL_RUN_CLOSE: the predominant farm from PayrollRunItems). If no CostCenter found and the rule has `requireCostCenter=true`: add an error to the PendingJournalPosting (`ERROR: "Centro de custo obrigatório não encontrado"`). If `requireCostCenter=false`: proceed without CC.

### Pitfall 6: Accounting Period Not Found for Auto-Post Date

**What goes wrong:** `postJournalEntry` requires a valid `periodId`. The auto-posting service needs to find the correct AccountingPeriod for the operation date. If the period doesn't exist or is CLOSED, posting fails.

**How to avoid:** The auto-posting extractor should resolve `periodId` from the operation's date (e.g., `referenceMonth` for payroll, `createdAt` date for stock). Look up `AccountingPeriod` by (organizationId, year, month) where status=OPEN. Per D-25: if period is CLOSED, store ERROR message on PendingJournalPosting — the operation succeeds normally.

**Warning signs:** `PERIOD_NOT_FOUND` or `PeriodNotOpenError` in auto-posting logs.

## Code Examples

Verified patterns from existing codebase:

### Non-Blocking Hook (from payroll-runs.service.ts L1057-1062)

```typescript
// Pattern established in payroll-runs.service.ts — auto-post AFTER main operation
try {
  await createPayrollEntries(rls.organizationId, runId);
} catch (err) {
  console.error('[payroll-runs] Failed to create accounting entries:', err);
}
// Phase 37 replaces with:
try {
  await autoPostingService.process('PAYROLL_RUN_CLOSE', runId, rls.organizationId);
} catch (err) {
  console.error('[payroll-runs] Failed to auto-post GL entry:', err);
}
```

### assertPeriodOpen Usage (from journal-entries.service.ts)

```typescript
// Source: apps/backend/src/modules/journal-entries/journal-entries.service.ts
import { assertPeriodOpen } from '@protos-farm/shared';

const period = await prisma.accountingPeriod.findFirst({
  where: { id: input.periodId, organizationId },
  select: { id: true, month: true, year: true, status: true },
});
assertPeriodOpen(period);  // throws PeriodNotOpenError if CLOSED/BLOCKED
```

### AccountBalance Update (from journal-entries.service.ts L255-301)

```typescript
// Reuse this exact SQL block for automatic entries:
await tx.$executeRaw`
  UPDATE account_balances ab
  SET "closingBalance" = ab."openingBalance" +
    CASE WHEN coa.nature = 'DEVEDORA' THEN ab."debitTotal" - ab."creditTotal"
         ELSE ab."creditTotal" - ab."debitTotal" END
  FROM chart_of_accounts coa
  WHERE coa.id = ab."accountId"
    AND ab."organizationId" = ${organizationId}
    AND ab."fiscalYearId" = ${period.fiscalYearId}
    AND ab.month = ${period.month}
    AND ab."accountId" = ANY(${accountIds}::text[])
`;
```

### seedRuralTemplate Pattern (from chart-of-accounts.service.ts)

```typescript
// Extend seedRuralTemplate route handler to also seed AccountingRules:
// POST /api/org/:orgId/chart-of-accounts/seed
const coaResult = await service.seedRuralTemplate(orgId);
const rulesResult = await autoPostingService.seedDefaultRules(orgId);
return res.json({ coa: coaResult, rules: rulesResult });
```

### PendingJournalPosting Idempotency Check

```typescript
// Check COMPLETED before creating PENDING (not after)
const completed = await prisma.pendingJournalPosting.findFirst({
  where: { organizationId, sourceType, sourceId, status: 'COMPLETED' },
});
if (completed) return; // D-17: silent ignore

// Check for existing non-completed record (avoid duplicates)
let posting = await prisma.pendingJournalPosting.findFirst({
  where: { organizationId, sourceType, sourceId },
});
if (!posting) {
  posting = await prisma.pendingJournalPosting.create({
    data: { organizationId, sourceType, sourceId, status: 'PENDING', accountingRuleId: rule.id },
  });
}
```

### Frontend Tab Pattern (from JournalEntriesPage.tsx — extend existing)

```typescript
// Add to JournalEntryType enum in types/journal-entries.ts:
type JournalEntryType = 'MANUAL' | 'OPENING_BALANCE' | 'REVERSAL' | 'TEMPLATE_INSTANCE' | 'AUTOMATIC';

// Tab component (3 tabs):
const TABS = ['lancamentos', 'pendencias', 'regras'] as const;
type TabId = typeof TABS[number];
const [activeTab, setActiveTab] = useState<TabId>('lancamentos');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AccountingEntry flat records (v1.3) | JournalEntry multi-line (double-entry) | Phase 36 | Full double-entry GL; AccountingEntry is now legacy |
| Hardcoded ACCOUNT_CODES const | Configurable AccountingRule per org | Phase 37 | Accountants can adjust mappings without code changes |
| BullMQ as queue option | Postgres table as queue (D-14) | Phase 37 decision | No Redis dependency; simpler ops |

**Deprecated/outdated after Phase 37:**
- `AccountingEntry` model: deleted. Data should be migrated (or accepted as historical loss — confirm with user).
- `AccountingEntryType` enum: deleted from schema.
- `AccountingSourceType` enum: deleted from schema.
- `ACCOUNT_CODES` const in `accounting-entries.types.ts`: eliminated.
- `modules/accounting-entries/` directory: entirely removed.
- `AccountingEntriesPage.tsx` frontend page: removed or redirected to JournalEntriesPage.

## Open Questions

1. **Migration of existing AccountingEntry records**
   - What we know: AccountingEntry records exist from v1.3 payroll close operations (PAYROLL_SALARY, PAYROLL_CHARGES, etc.)
   - What's unclear: Should existing rows be migrated to JournalEntry records, or simply dropped as legacy?
   - Recommendation: Drop with a migration that deletes all accounting_entries records first, then drops the table. The historical data is already partially visible in payroll runs and payables. If migration is needed, it should be a one-time script converting each AccountingEntry to a JournalEntry+JournalEntryLines.

2. **settleReceivable hook — receivables module**
   - What we know: `settleReceivable` exists in `receivables.service.ts` line 396. It currently has no GL hook.
   - What's unclear: D-33 says "criar se não existir" a `receivePayment` function — but `settleReceivable` already exists. The hook should be added to `settleReceivable`.
   - Recommendation: Add the auto-posting hook directly to `settleReceivable` after the `withRlsContext` transaction. No new function needed.

3. **Depreciation hook insertion point**
   - What we know: `depreciation-batch.service.ts` creates individual DepreciationEntry records per asset, then marks the DepreciationRun COMPLETED.
   - What's unclear: The hook should fire once per run (not per asset). The correct insertion point is after the loop completes and the run is marked COMPLETED.
   - Recommendation: After the run status update to COMPLETED, call `process('DEPRECIATION_RUN', run.id, orgId)`.

4. **Preview endpoint data source**
   - What we know: D-03 says "preview usa dados reais da última operação daquele tipo".
   - What's unclear: Which DB query fetches "last operation" — needs to query the source table (e.g., last PayrollRun COMPLETED for PAYROLL_RUN_CLOSE).
   - Recommendation: The preview endpoint accepts a ruleId, finds the most recent completed operation of that sourceType, runs the extractor, and returns the JournalEntry lines without persisting.

## Environment Availability

Step 2.6: SKIPPED — Phase 37 is purely code/schema changes with no new external tool dependencies. All required tools (Node, Prisma, PostgreSQL) are confirmed operational from Phase 36.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 |
| Config file | `apps/backend/jest.config.js` |
| Quick run command | `pnpm --filter @protos-farm/backend test -- --testPathPattern=auto-posting --no-coverage` |
| Full suite command | `pnpm --filter @protos-farm/backend test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LANC-01 | Auto-posting creates JournalEntry for PAYROLL_RUN_CLOSE | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "PAYROLL_RUN_CLOSE"` | ❌ Wave 0 |
| LANC-01 | Auto-posting creates JournalEntry for PAYABLE_SETTLEMENT | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "PAYABLE_SETTLEMENT"` | ❌ Wave 0 |
| LANC-01 | Auto-posting creates JournalEntry for RECEIVABLE_SETTLEMENT | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "RECEIVABLE_SETTLEMENT"` | ❌ Wave 0 |
| LANC-01 | Auto-posting creates JournalEntry for DEPRECIATION_RUN | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "DEPRECIATION_RUN"` | ❌ Wave 0 |
| LANC-01 | Auto-posting creates JournalEntry for STOCK_ENTRY | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "STOCK_ENTRY"` | ❌ Wave 0 |
| LANC-01 | Auto-posting creates JournalEntry for STOCK_OUTPUT | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "STOCK_OUTPUT"` | ❌ Wave 0 |
| LANC-02 | GET /auto-posting/rules lists all org rules | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "list rules"` | ❌ Wave 0 |
| LANC-02 | PATCH /auto-posting/rules/:id updates rule | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "update rule"` | ❌ Wave 0 |
| LANC-02 | GET /auto-posting/rules/:id/preview returns dry-run lines | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "preview"` | ❌ Wave 0 |
| LANC-06 | Re-processing COMPLETED operation returns silently (no duplicate) | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "idempotent"` | ❌ Wave 0 |
| LANC-06 | Retry endpoint resets ERROR posting to PENDING | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "retry"` | ❌ Wave 0 |
| LANC-06 | GET /auto-posting/pending lists with status filter | unit | `pnpm --filter backend test -- --testPathPattern=auto-posting -t "list pending"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern=auto-posting --no-coverage`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/auto-posting/auto-posting.routes.spec.ts` — covers LANC-01, LANC-02, LANC-06 (all tests)
- [ ] Framework already installed — no setup needed

## Sources

### Primary (HIGH confidence)

- Direct codebase read: `apps/backend/src/modules/journal-entries/journal-entries.service.ts` — full posting engine, AccountBalance update SQL, sequential entryNumber logic
- Direct codebase read: `apps/backend/src/modules/accounting-entries/accounting-entries.service.ts` — v1.3 stubs to be replaced, non-blocking hook pattern
- Direct codebase read: `apps/backend/prisma/schema.prisma` L8965-9062 — JournalEntry, JournalEntryLine, AccountingEntry, all relevant enums
- Direct codebase read: `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` L1057-1062 — established non-blocking hook pattern
- Direct codebase read: `apps/backend/src/modules/payables/payables.service.ts` L465-488 — existing settlement hook pattern
- Direct codebase read: `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts` L345-403 — seedRuralTemplate extension point
- Direct codebase read: `37-CONTEXT.md` — all locked decisions D-01 through D-42

### Secondary (MEDIUM confidence)

- Prisma 7.6.0 (npm registry verified) — `@@unique` constraint behavior for idempotency, enum migration patterns
- Phase 36 CONTEXT.md decisions carried in STATE.md — `postJournalEntry` uses Serializable isolation, sequential entryNumber pattern

### Tertiary (LOW confidence)

None — all findings based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in use
- Architecture: HIGH — patterns directly read from existing working code
- Pitfalls: HIGH — identified from direct reading of `validateAccountsForManualEntry` and existing hook patterns

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable codebase)
