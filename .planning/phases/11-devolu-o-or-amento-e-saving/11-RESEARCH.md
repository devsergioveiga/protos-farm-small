# Phase 11: Devolucao, Orcamento e Saving - Research

**Researched:** 2026-03-18
**Domain:** Purchase returns, budget control, saving analysis — backend modules + frontend pages in the COMPRAS group
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Devolucao de mercadorias (DEVO-01)

- Maquina de estados: PENDENTE -> EM_ANALISE -> APROVADA -> CONCLUIDA / CANCELADA — seguindo padrao VALID_TRANSITIONS
- Numeracao sequencial: DEV-YYYY/NNNN por organizacao (consistente com REC/OC/SC/RC)
- Vinculacao obrigatoria ao GoodsReceipt (goodsReceiptId) — devolucao sempre referencia um recebimento
- Motivo obrigatorio enum: DEFEITO, VALIDADE, PRODUTO_ERRADO, EXCEDENTE, ESPECIFICACAO_DIVERGENTE
- Upload de fotos/laudo: padrao multer existente (como foto de divergencia no recebimento)
- 3 acoes esperadas determinam o tratamento financeiro:
  - TROCA: mantem CP original, aguarda nova entrega (cria novo recebimento quando chegar)
  - CREDITO: cria nota de credito — Payable com valor negativo vinculado ao CP original (abatimento)
  - ESTORNO: cancela ou reduz o CP original (atualiza totalAmount e parcelas)
- Saida automatica de estoque na aprovacao: cria StockOutput tipo RETURN (novo tipo a adicionar ao enum existente) vinculado ao GoodsReceipt
- Notificacao ao fornecedor: notificacao in-app via NotificationBell (email real placeholder, como nas fases anteriores)
- Acompanhamento da resolucao: campo resolutionStatus (PENDING, RESOLVED, EXPIRED) com data limite
- Referencia de NF de devolucao: campos opcionais (numero NF devolucao, data emissao)
- Devolucao parcial: selecao de itens e quantidades a devolver (subset do recebimento)

#### Orcamento de compras (FINC-02)

- Modelo PurchaseBudget: categoria (ProductCategory enum), periodo (MENSAL, TRIMESTRAL, SAFRA), centro de custo/fazenda, valor orcado
- Periodo safra: customizavel com data inicio/fim definida pelo gerente (nao fixo jan-dez)
- 4 colunas de acompanhamento: Orcado / Requisitado / Comprado / Pago — calculados em tempo real a partir de RC, OC e Payable
- Alerta de estouro: warning NAO-bloqueante ao aprovar RC ou emitir OC que ultrapassa orcamento — badge amarelo com % excedente
  - Nao bloqueia a operacao (contexto rural, operacoes urgentes nao podem travar)
  - Exibe alerta visual + registra flag budgetExceeded no RC/OC para auditoria
- Dashboard de execucao orcamentaria: barras de progresso por categoria, projecao de gasto (linear baseada no consumo atual)
- Relatorio de desvios: categorias acima de 100% do orcado, com drill-down para RCs/OCs que excederam

#### Analise de saving e historico de precos (FINC-03)

- Saving por cotacao: (maior proposta - proposta vencedora) — calculado a partir de QuotationProposalItem
- Saving acumulado por periodo com filtro por categoria e fornecedor
- Historico de preco por produto: grafico de linha temporal com pontos de compra (data + preco unitario) extraidos de PurchaseOrderItem
- Indicadores de ciclo:
  - % compras com cotacao formal (OCs com quotationId vs total)
  - % emergenciais (OCs com isEmergency=true vs total)
  - Prazo medio do ciclo RC -> OC -> Recebimento (em dias)
  - Top 10 produtos por gasto total
  - Top 5 fornecedores por volume total
- Biblioteca de graficos: Recharts (ja usado nos dashboards anteriores)
- Periodo de analise: filtro por data com presets (ultimo mes, trimestre, safra, ano)

#### Frontend

- 3 paginas separadas no grupo COMPRAS do sidebar:
  - DevolucoesPage: listagem com filtros + modal de registro + detalhe inline expansivel
  - OrcamentoComprasPage: tabela editavel (categoria x periodo) com barras de progresso por linha
  - SavingAnalysisPage: cards KPI no topo + graficos Recharts abaixo + tabelas de top 10/top 5
- Modal para registro de devolucao (consistente com padrao CLAUDE.md — formularios em modal)
- Sidebar: adicionar "Devoluções", "Orçamento" e "Análise de Saving" ao grupo COMPRAS

### Claude's Discretion

- Design exato dos graficos Recharts (cores, tooltips, responsividade)
- Layout interno da OrcamentoComprasPage (inline edit vs modal de edicao)
- Skeleton loading e empty states
- Espacamento e tipografia (seguindo design system)
- Implementacao tecnica do calculo de projecao de gasto
- Ordem dos cards KPI na SavingAnalysisPage
- Tratamento de periodos sem dados no historico de precos

### Deferred Ideas (OUT OF SCOPE)

- NF-e de devolucao emissao automatica — requer modulo fiscal separado
- Integracao com transportadora para logistica reversa — futuro
- Orcamento vinculado a planejamento de safra detalhado — requer modulo de planejamento agricola
- Barter (troca de producao por insumos) — complexidade contabil, explicitamente fora de escopo
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                                                                             | Research Support                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| DEVO-01 | Gerente de estoque pode registrar devolucao total ou parcial vinculada ao recebimento, com motivo obrigatorio, fotos/laudo, acao esperada (troca/credito/estorno), saida automatica do estoque, referencia de NF de devolucao, notificacao ao fornecedor, e acompanhamento da resolucao | New module `goods-returns/` with state machine + StockOutput RETURN type + Payable credit/reversal + multer upload             |
| FINC-02 | Gerente financeiro pode definir orcamento de compras por categoria e periodo, com acompanhamento orcado vs requisitado vs comprado vs pago, alerta ao aprovar se ultrapassar, dashboard de execucao orcamentaria, projecao de gasto, relatorio de desvios                               | New module `purchase-budgets/` with real-time aggregation queries from RC/OC/Payable + budgetExceeded flag injection points    |
| FINC-03 | Gerente pode ver saving por cotacao, saving acumulado por periodo, historico de preco por produto, indicadores de ciclo (% formal/emergencial, prazo medio ciclo), top 10 produtos, top 5 fornecedores                                                                                  | New module `saving-analysis/` — pure read-only analytics queries across QuotationProposalItem, PurchaseOrderItem, GoodsReceipt |

</phase_requirements>

---

## Summary

Phase 11 introduces three independent capabilities that close the purchase management cycle: goods returns (DEVO-01), budget control (FINC-02), and saving/analytics (FINC-03). Each maps cleanly to a new backend module and a new frontend page in the COMPRAS sidebar group.

The goods return flow is the most complex: it has a 5-state machine (PENDENTE → EM_ANALISE → APROVADA → CONCLUIDA / CANCELADA), triggers a StockOutput of the new RETURN type on approval, and branches into three financial treatments (TROCA/CREDITO/ESTORNO) that interact with existing Payable records. The RETURN enum value must be added to both the Prisma schema (`StockOutputType`) and the TypeScript constants in `stock-outputs.types.ts`.

Budget control (FINC-02) is architecturally simpler: a PurchaseBudget record stores the plan, and execution is calculated in real time by aggregating RC/OC/Payable amounts. The only invasive change is injecting a budget-check side-effect into the RC approval path (`purchase-requests.service.ts`) and the OC issuance path (`purchase-orders.service.ts`) — these set a `budgetExceeded` flag (new boolean field) without blocking the operation. Saving analysis (FINC-03) is entirely read-only analytics with no write operations or schema changes beyond what DEVO-01 and FINC-02 require.

**Primary recommendation:** Implement in wave order — Wave 0: Prisma schema + migrations (GoodsReturn, GoodsReturnItem, PurchaseBudget, PurchaseBudgetLine, plus StockOutputType RETURN and budgetExceeded flags). Wave 1: goods-returns backend. Wave 2: purchase-budgets backend. Wave 3: saving-analysis backend. Wave 4: all three frontend pages.

---

## Standard Stack

### Core

| Library      | Version           | Purpose                  | Why Standard                                          |
| ------------ | ----------------- | ------------------------ | ----------------------------------------------------- |
| Prisma 7     | project standard  | ORM + migrations         | All models in this codebase use Prisma                |
| Express 5    | project standard  | HTTP router              | All backend modules use Express Router                |
| multer       | project standard  | File/photo upload        | Already used in goods-receipts for divergence photos  |
| Recharts     | already installed | Charts (saving analysis) | Confirmed used in dashboards — do not add alternative |
| lucide-react | project standard  | Icons                    | Mandated by CLAUDE.md                                 |

### Supporting

| Library   | Version          | Purpose                   | When to Use                                  |
| --------- | ---------------- | ------------------------- | -------------------------------------------- |
| @swc/jest | project standard | TypeScript test transform | Already configured in jest.config.js         |
| supertest | project standard | HTTP integration tests    | Used in all existing \*.routes.spec.ts files |

### Alternatives Considered

| Instead of         | Could Use          | Tradeoff                                                                  |
| ------------------ | ------------------ | ------------------------------------------------------------------------- |
| Recharts           | Chart.js / Victory | Recharts is already installed — no reason to add another charting library |
| multer diskStorage | S3/cloud storage   | Out of scope; existing pattern uses local disk                            |

**Installation:**
No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
  goods-returns/
    goods-returns.types.ts      # State machine, enums, input/output types
    goods-returns.service.ts    # Business logic
    goods-returns.routes.ts     # Express router + multer upload
    goods-returns.routes.spec.ts

  purchase-budgets/
    purchase-budgets.types.ts
    purchase-budgets.service.ts
    purchase-budgets.routes.ts
    purchase-budgets.routes.spec.ts

  saving-analysis/
    saving-analysis.types.ts    # Query param + output types
    saving-analysis.service.ts  # Read-only aggregation queries
    saving-analysis.routes.ts
    saving-analysis.routes.spec.ts

apps/frontend/src/pages/
  DevolucoesPage.tsx + .css
  OrcamentoComprasPage.tsx + .css
  SavingAnalysisPage.tsx + .css

apps/frontend/src/components/
  goods-returns/
    GoodsReturnModal.tsx + .css

apps/backend/prisma/
  migrations/
    {timestamp}_add_goods_returns/
    {timestamp}_add_purchase_budgets/
    {timestamp}_add_budget_exceeded_flags/
    {timestamp}_add_stock_output_return_type/
```

### Pattern 1: State Machine with VALID_TRANSITIONS (DEVO-01)

**What:** GoodsReturn follows the same VALID_TRANSITIONS map + canTransition() helper used by GoodsReceipt and PurchaseOrder.

**When to use:** All multi-step approval flows in this codebase.

```typescript
// Source: goods-receipts.types.ts (GR_VALID_TRANSITIONS pattern)
export const GR_RETURN_STATUSES = [
  'PENDENTE',
  'EM_ANALISE',
  'APROVADA',
  'CONCLUIDA',
  'CANCELADA',
] as const;
export type GrReturnStatus = (typeof GR_RETURN_STATUSES)[number];

export const GR_RETURN_VALID_TRANSITIONS: Record<string, string[]> = {
  PENDENTE: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['APROVADA', 'CANCELADA'],
  APROVADA: ['CONCLUIDA'],
  CONCLUIDA: [],
  CANCELADA: [],
};

export function canGrReturnTransition(from: string, to: string): boolean {
  return GR_RETURN_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Pattern 2: Sequential Numbering (DEV-YYYY/NNNN)

**What:** Same pattern used for SC-YYYY/NNNN (quotations), OC-YYYY/NNNN (purchase orders), REC-YYYY/NNNN (goods receipts).

```typescript
// Source: quotations.service.ts getNextScSequentialNumber()
async function getNextDevSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.goodsReturn.findFirst({
    where: { organizationId, sequentialNumber: { startsWith: `DEV-${year}/` } },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  let lastNum = 0;
  if (last?.sequentialNumber) {
    const parts = last.sequentialNumber.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }
  return `DEV-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}
```

### Pattern 3: RETURN StockOutput on Approval

**What:** When a GoodsReturn transitions to APROVADA, the service calls createStockOutput (or calls the lower-level logic directly inside the same transaction) using the new RETURN type. The StockOutput must reference the GoodsReturn.

**Critical constraint:** The StockOutput creation must happen inside the same withRlsContext transaction as the status transition. Do NOT fire-and-forget or call a separate transaction.

```typescript
// Pattern: direct tx.stockOutput.create inside the transition transaction
// (same approach as Phase 10 Plan 03: tx.stockEntry.create and tx.payable.create inline)
await tx.stockOutput.create({
  data: {
    organizationId: ctx.organizationId,
    type: 'RETURN',          // new enum value
    status: 'CONFIRMED',     // auto-confirmed for returns
    goodsReturnId: returnId, // new FK on StockOutput
    items: { create: stockItems },
    ...
  },
});
```

### Pattern 4: Payable Credit (CREDITO action)

**What:** For CREDITO action, create a Payable with negative totalAmount linked to the original Payable (via goodsReturnId FK on Payable). This is an abatimento pattern — not a deletion of the original CP.

**Important:** The existing `Payable` model does not have a `goodsReturnId` field. This field must be added in the migration.

```typescript
// CREDITO treatment: create negative Payable
await tx.payable.create({
  data: {
    organizationId: ctx.organizationId,
    farmId: originalPayable.farmId,
    supplierName: originalPayable.supplierName,
    category: originalPayable.category,
    description: `Nota de crédito — devolução ${devNumber}`,
    totalAmount: -returnValue,   // negative amount
    dueDate: new Date().toISOString(),
    goodsReturnId: returnId,
    costCenterItems: { create: originalPayable.costCenterItems.map(...) },
  },
});
```

### Pattern 5: Budget Execution Real-Time Aggregation (FINC-02)

**What:** Budget execution columns (Requisitado, Comprado, Pago) are not stored — they are always calculated by querying RC/OC/Payable tables filtered by category + period. This avoids dual-write consistency problems.

```typescript
// Requisitado = SUM of approved RC items in this category/period
// Comprado = SUM of OC items in this category/period
// Pago = SUM of paid Payable amounts in this category/period

const requisitado = await tx.purchaseRequestItem.aggregate({
  _sum: { estimatedUnitPrice: true }, // or totalPrice
  where: {
    organizationId,
    product: { category: budgetCategory },
    purchaseRequest: {
      status: { in: ['APROVADA', 'EM_COTACAO', 'COMPRADA'] },
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  },
});
```

**Note:** SupplierCategory (INSUMO_AGRICOLA, PECUARIO, PECAS, COMBUSTIVEL, EPI, SERVICOS, OUTROS) is the available enum in this schema for categorizing purchases. There is no separate "ProductCategory" — the CONTEXT.md reference to `ProductCategory enum` likely means SupplierCategory, which is used on Supplier and on PurchaseRequestItem indirectly via product type. **Verify during Plan 01 (schema)** whether RC items already carry a category field or if the budget must group by product category/supplier category.

### Pattern 6: Budget Exceeded Flag Injection

**What:** When approving a RC or issuing an OC, a non-blocking budget check runs and sets `budgetExceeded = true` on the record if over budget.

**Where to inject:** `purchase-requests.service.ts` (approve function) and `purchase-orders.service.ts` (EMITIDA transition). The flag is written inside the same transaction as the status change.

```typescript
// In approveRC or transitionPO — after the status update
const budgetStatus = await checkBudgetExceeded(tx, ctx.organizationId, rc);
if (budgetStatus.exceeded) {
  await tx.purchaseRequest.update({
    where: { id: rc.id },
    data: { budgetExceeded: true },
  });
  // Return budgetWarning in the API response so the frontend can show the badge
}
```

### Pattern 7: Multer Upload for GoodsReturn Photos

**What:** Same pattern as goods-receipts divergence photos. Upload directory: `uploads/goods-returns/{orgId}/{returnId}/`.

```typescript
// Source: goods-receipts.routes.ts multer diskStorage pattern
const photoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = req.user?.organizationId ?? 'unknown';
    const returnId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'goods-returns', orgId, returnId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage: photoStorage, limits: { fileSize: 10 * 1024 * 1024 } });
```

### Pattern 8: Read-Only Analytics Routes (FINC-03)

**What:** Saving analysis has no write operations. All endpoints are GET with query params for date range and filters. No Prisma model needed — queries run against existing tables.

```typescript
// Saving por cotacao: JOIN quotation_proposals + quotation_proposal_items
// Find max proposal per item, subtract winner proposal price
const saving = await tx.$queryRaw`
  SELECT
    q.id as quotation_id,
    q.sequential_number,
    SUM(max_price.price - winner.unit_price) as saving_total
  FROM quotations q
  ...
`;
// Or use Prisma ORM groupBy — prefer typed ORM queries over raw SQL
```

### Anti-Patterns to Avoid

- **Separate transaction for StockOutput on return approval:** The StockOutput and the GoodsReturn status change MUST be in the same `withRlsContext` transaction. Phase 10 Plan 03 lesson: "Direct tx.stockEntry.create and tx.payable.create inside withRlsContext — never call wrapper functions that start their own transactions."
- **Blocking budget checks:** Budget exceeded is a WARNING, not a gate. Never throw an error or return 4xx when budget is exceeded — set the flag and include a `budgetWarning` field in the response.
- **Storing execution totals in PurchaseBudget:** Calculate Requisitado/Comprado/Pago in real time. Stored aggregates require complex dual-write logic and can drift.
- **Using raw SQL for saving analytics before confirming Prisma cannot express the query:** Try ORM groupBy/aggregate first. Use `$queryRaw` only if ORM cannot express max-per-group or complex window functions.
- **Deleting the original Payable for ESTORNO:** Update `totalAmount` and installments in place. Never delete — audit trail must remain.

---

## Don't Hand-Roll

| Problem                   | Don't Build                  | Use Instead                                       | Why                                                                         |
| ------------------------- | ---------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Sequential DEV number     | Custom counter table         | Same findFirst + padStart pattern from quotations | Already proven, no race condition with single DB                            |
| State machine transitions | Inline if/else status checks | VALID_TRANSITIONS map + canTransition()           | Consistent with all other modules, easy to test                             |
| File upload               | Custom multipart parser      | multer diskStorage (existing)                     | Already integrated, works with Express middleware                           |
| Photo serving             | Separate file server         | Express static + existing uploads/ path           | Same as goods-receipts photos                                               |
| Chart rendering           | Custom SVG                   | Recharts (already installed)                      | Recharts LineChart, BarChart, ComposedChart cover all needed chart types    |
| Budget % bar              | Custom canvas                | CSS width trick on a div + tokens                 | Simple enough — a `<div style={{ width: \`${pct}%\` }}>` inside a track div |

**Key insight:** Every problem in this phase has a solved pattern in phases 7-10. The main risk is forgetting to stay in-transaction when triggering side effects (StockOutput, Payable) from GoodsReturn approval.

---

## Common Pitfalls

### Pitfall 1: RETURN type missing in Prisma enum causes type error at compile time

**What goes wrong:** The Prisma StockOutputType enum only has CONSUMPTION, MANUAL_CONSUMPTION, TRANSFER, DISPOSAL. Adding RETURN to the TypeScript constants without a schema migration causes `prisma generate` to fail or the field to be rejected by the DB.

**Why it happens:** Two sources of truth — TypeScript constants in `stock-outputs.types.ts` AND the Prisma schema `enum StockOutputType`. Both must be updated atomically.

**How to avoid:** Wave 0 adds RETURN to `enum StockOutputType` in schema.prisma, runs migration, runs `prisma generate`. Wave 1 then updates the TypeScript constant.

**Warning signs:** TypeScript compiler error "Type 'RETURN' is not assignable to StockOutputType" or Prisma client error at runtime.

### Pitfall 2: Budget category mapping mismatch

**What goes wrong:** CONTEXT.md says "categoria (ProductCategory enum)" but the schema has `SupplierCategory` (INSUMO_AGRICOLA, PECUARIO, etc.) and `PayableCategory` (INPUTS, MAINTENANCE, etc.) — no single "ProductCategory" enum exists.

**Why it happens:** The domain model was designed with purchase/product categories, but implementation split them across different enums.

**How to avoid:** During Plan 01 (schema), decide which existing enum maps to budget categories. Most natural fit: `SupplierCategory` (INSUMO_AGRICOLA → Insumos Agrícolas, etc.) since PurchaseRequest items are categorized by supplier type. Alternatively, use `PayableCategory` since Payables are the "pago" column source.

**Warning signs:** Budget execution query returns 0 for "Requisitado" because the category filter doesn't match the field being grouped.

### Pitfall 3: Payable credit creates confusion in financial reports

**What goes wrong:** A negative-amount Payable (for CREDITO action) shows up as a "payable" in AP aging reports and dashboards, confusing users.

**Why it happens:** Payable model doesn't distinguish between debit and credit entries.

**How to avoid:** Add a `goodsReturnId String?` FK on Payable AND a `isCredit Boolean @default(false)` field. Filter `isCredit = false` in listPayables by default. The AP aging and dashboard queries already use status/date filters — add `isCredit: false` to the WHERE clause.

**Warning signs:** CP aging report shows negative amounts inflating the total owed.

### Pitfall 4: ESTORNO updates Payable but not installments

**What goes wrong:** Reducing `totalAmount` on a Payable when all installments have already been generated leaves installment amounts inconsistent (they still sum to the original total).

**Why it happens:** Payable has a `PayableInstallment[]` relation with individual amounts. Updating the parent `totalAmount` does not cascade to installments.

**How to avoid:** When applying ESTORNO, recalculate and update all PENDING installments proportionally (or cancel them if full estorno). Use a transaction that updates both the Payable and its installments atomically.

**Warning signs:** Payable.totalAmount = 500 but sum(installments.amount) = 800.

### Pitfall 5: Saving calculation includes emergenciais without cotacoes

**What goes wrong:** Saving per cotacao requires at least 2 proposals (to compute max vs winner). Emergency POs (isEmergency=true, quotationId=null) have no proposals — including them in saving totals produces divide-by-zero or NULL handling errors.

**Why it happens:** Saving query JOINs PurchaseOrder → Quotation → QuotationProposal but emergency POs have no quotation.

**How to avoid:** Filter saving query to `quotationId IS NOT NULL` and check that at least 2 proposals exist per quotation before computing saving. Emergency POs appear in cycle indicators (% emergencial) but not in saving totals.

**Warning signs:** NULL or NaN values in saving totals on the frontend.

### Pitfall 6: Route registration order — /static before /:id

**What goes wrong:** Express matches `GET /org/goods-returns/summary` as `/:id = "summary"` if the summary route is registered after the `/:id` route.

**Why it happens:** Express greedy parameter matching.

**How to avoid:** Register all static sub-routes BEFORE `/:id`. Pattern established in Phase 7 decision log: "Import routes placed BEFORE /:id routes". For saving-analysis: all filter/preset endpoints must come before any `:id` route.

**Warning signs:** 404 or "GoodsReturn not found with id=summary" error.

---

## Code Examples

### GoodsReturn Prisma Schema (Wave 0)

```prisma
// Source: pattern from goods_receipts model + decisions in 11-CONTEXT.md
enum GoodsReturnStatus {
  PENDENTE
  EM_ANALISE
  APROVADA
  CONCLUIDA
  CANCELADA
}

enum GoodsReturnReason {
  DEFEITO
  VALIDADE
  PRODUTO_ERRADO
  EXCEDENTE
  ESPECIFICACAO_DIVERGENTE
}

enum GoodsReturnAction {
  TROCA
  CREDITO
  ESTORNO
}

enum GoodsReturnResolutionStatus {
  PENDING
  RESOLVED
  EXPIRED
}

model GoodsReturn {
  id                   String                    @id @default(cuid())
  organizationId       String
  sequentialNumber     String
  goodsReceiptId       String
  supplierId           String
  status               GoodsReturnStatus         @default(PENDENTE)
  reason               GoodsReturnReason
  expectedAction       GoodsReturnAction
  resolutionStatus     GoodsReturnResolutionStatus @default(PENDING)
  resolutionDeadline   DateTime?
  returnInvoiceNumber  String?
  returnInvoiceDate    DateTime?
  notes                String?
  stockOutputId        String?                   // set when APROVADA triggers RETURN output
  creditPayableId      String?                   // set for CREDITO action
  createdBy            String
  deletedAt            DateTime?
  createdAt            DateTime                  @default(now())
  updatedAt            DateTime                  @updatedAt

  organization  Organization    @relation(fields: [organizationId], references: [id])
  goodsReceipt  GoodsReceipt    @relation(fields: [goodsReceiptId], references: [id])
  supplier      Supplier        @relation(fields: [supplierId], references: [id])
  creator       User            @relation("GRReturnCreator", fields: [createdBy], references: [id])
  items         GoodsReturnItem[]

  @@unique([organizationId, sequentialNumber])
  @@index([organizationId, status])
  @@index([goodsReceiptId])
  @@map("goods_returns")
}

model GoodsReturnItem {
  id             String      @id @default(cuid())
  goodsReturnId  String
  productId      String?
  productName    String
  unitName       String
  returnQty      Decimal     @db.Decimal(12, 3)
  unitPrice      Decimal     @db.Decimal(12, 4)
  totalPrice     Decimal     @db.Decimal(14, 2)
  batchNumber    String?
  photoUrl       String?
  photoFileName  String?
  createdAt      DateTime    @default(now())

  goodsReturn GoodsReturn @relation(fields: [goodsReturnId], references: [id], onDelete: Cascade)

  @@index([goodsReturnId])
  @@map("goods_return_items")
}
```

### PurchaseBudget Prisma Schema (Wave 0)

```prisma
// Source: decisions in 11-CONTEXT.md + SupplierCategory enum existing in schema
enum BudgetPeriodType {
  MENSAL
  TRIMESTRAL
  SAFRA
}

model PurchaseBudget {
  id             String          @id @default(cuid())
  organizationId String
  farmId         String?         // null = organization-wide
  costCenterId   String?
  category       SupplierCategory
  periodType     BudgetPeriodType
  periodStart    DateTime
  periodEnd      DateTime
  budgetedAmount Decimal         @db.Decimal(14, 2)
  notes          String?
  createdBy      String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  creator      User         @relation("PBCreator", fields: [createdBy], references: [id])

  @@index([organizationId, periodStart, periodEnd])
  @@index([organizationId, category])
  @@map("purchase_budgets")
}
```

### StockOutputType enum addition (Wave 0)

```prisma
enum StockOutputType {
  CONSUMPTION
  MANUAL_CONSUMPTION
  TRANSFER
  DISPOSAL
  RETURN        // NEW — devolucao ao fornecedor
}
```

### Payable schema additions (Wave 0)

```prisma
model Payable {
  // ... existing fields ...
  goodsReturnId String?   // FK for credit note traceability
  isCredit      Boolean   @default(false)
  // ... rest of model ...
}
```

### budgetExceeded flag additions on RC and OC (Wave 0)

```prisma
model PurchaseRequest {
  // ... existing fields ...
  budgetExceeded Boolean @default(false)
}

model PurchaseOrder {
  // ... existing fields ...
  budgetExceeded Boolean @default(false)
}
```

### Saving Query Pattern (FINC-03)

```typescript
// Source: pattern from quotations.service.ts (reads from DB inside transaction, not request body)
// Saving per quotation: max proposal price - winner proposal price per item

async function getSavingByQuotation(ctx: RlsContext, periodStart: Date, periodEnd: Date) {
  return withRlsContext(ctx, async (tx) => {
    // Fetch quotations with proposals in period
    const quotations = await tx.quotation.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'FECHADA',
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      include: {
        suppliers: {
          include: {
            proposal: { include: { items: true } },
          },
        },
      },
    });

    // For each quotation, compute saving = sum(max_price - winner_price) per item
    return quotations
      .map((q) => {
        const proposals = q.suppliers.map((s) => s.proposal).filter(Boolean);

        if (proposals.length < 2) return null; // need at least 2 proposals

        const itemSavings = computeItemLevelSaving(proposals);
        return {
          quotationId: q.id,
          sequentialNumber: q.sequentialNumber,
          savingTotal: itemSavings.reduce((acc, s) => acc + s.saving, 0),
          items: itemSavings,
        };
      })
      .filter(Boolean);
  });
}
```

### Recharts Line Chart (price history — FINC-03)

```tsx
// Source: Recharts already used in dashboards — follow existing pattern
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// data shape: [{ date: '2026-01', price: 45.90 }, ...]
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={priceHistory}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${v}`} />
    <Tooltip formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Preço']} />
    <Line
      type="monotone"
      dataKey="price"
      stroke="var(--color-primary-600)"
      strokeWidth={2}
      dot={{ r: 4 }}
    />
  </LineChart>
</ResponsiveContainer>;
```

---

## State of the Art

| Old Approach                          | Current Approach                         | When Changed                         | Impact                                       |
| ------------------------------------- | ---------------------------------------- | ------------------------------------ | -------------------------------------------- |
| Separate transaction for side effects | Direct tx.X.create inside withRlsContext | Phase 10 Plan 03                     | Prevents partial-commit bugs on confirm flow |
| Blocking on budget overrun            | Non-blocking flag + warning in response  | Phase 11 decision                    | Rural context: emergencies can't be blocked  |
| Saving analysis deferred              | Now in scope for Phase 11                | STATE.md note reversed in CONTEXT.md | Enough production data assumption lifted     |

**Deprecated/outdated:**

- `StockOutputType` constants array in `stock-outputs.types.ts` will be out of sync with schema until Wave 0 migration is applied — do not reference STOCK_OUTPUT_TYPES before Wave 0 is complete.

---

## Open Questions

1. **Which category enum maps to PurchaseBudget.category?**
   - What we know: Schema has `SupplierCategory` (INSUMO_AGRICOLA, PECUARIO, PECAS, COMBUSTIVEL, EPI, SERVICOS, OUTROS) and `PayableCategory` (INPUTS, MAINTENANCE, ...). CONTEXT.md says "ProductCategory enum" but no such enum exists.
   - What's unclear: RC items do not currently carry a category field directly — they carry a productId, and the product does not have a category enum (it has a `type` String or similar). Need to verify how RC/OC items will be grouped by category.
   - Recommendation: During Plan 01 (schema), choose `SupplierCategory` as the budget category enum (it aligns with how users think about purchases — insumo, peca, combustivel). Add a `category SupplierCategory` field to PurchaseRequestItem OR compute via product → supplier category. Simpler: budget is per `SupplierCategory`, and matching uses the RC item's manually-set category (add `category SupplierCategory?` to PurchaseRequestItem).

2. **GoodsReceipt reverse relation for GoodsReturn**
   - What we know: GoodsReceipt model does not have a `goodsReturns GoodsReturn[]` relation yet.
   - What's unclear: Does adding a back-relation break existing generated Prisma client?
   - Recommendation: Add `goodsReturns GoodsReturn[]` to GoodsReceipt in Wave 0. This is a non-breaking addition.

3. **How to track "Comprado" in budget execution — by OC total or by PO item + category?**
   - What we know: PurchaseOrderItem has unitPrice + quantity but no category field. Category must be inferred from product or from the RC item it references.
   - What's unclear: PurchaseOrderItem has `purchaseRequestItemId?` — for quotation-based POs this is set. Emergency POs may not have it.
   - Recommendation: For emergency POs without purchaseRequestItemId, skip or put in "OUTROS" bucket. Document this limitation in the OrcamentoComprasPage empty state messaging.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Framework          | Jest (via @swc/jest)                                                                                             |
| Config file        | `apps/backend/jest.config.js`                                                                                    |
| Quick run command  | `cd apps/backend && npx jest --testPathPattern="goods-returns\|purchase-budgets\|saving-analysis" --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage`                                                                      |

### Phase Requirements → Test Map

| Req ID  | Behavior                                           | Test Type        | Automated Command                                                          | File Exists? |
| ------- | -------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- | ------------ |
| DEVO-01 | Create GoodsReturn linked to GoodsReceipt          | unit/integration | `npx jest goods-returns.routes.spec.ts -t "POST /org/goods-returns"`       | Wave 0       |
| DEVO-01 | Transition PENDENTE→EM_ANALISE→APROVADA            | unit             | `npx jest goods-returns.routes.spec.ts -t "transition"`                    | Wave 0       |
| DEVO-01 | APROVADA triggers StockOutput RETURN               | integration      | `npx jest goods-returns.routes.spec.ts -t "APROVADA"`                      | Wave 0       |
| DEVO-01 | CREDITO creates negative Payable                   | integration      | `npx jest goods-returns.routes.spec.ts -t "CREDITO"`                       | Wave 0       |
| DEVO-01 | ESTORNO updates Payable totalAmount                | integration      | `npx jest goods-returns.routes.spec.ts -t "ESTORNO"`                       | Wave 0       |
| DEVO-01 | Partial return (subset of items)                   | unit             | `npx jest goods-returns.routes.spec.ts -t "partial"`                       | Wave 0       |
| FINC-02 | Create PurchaseBudget                              | unit             | `npx jest purchase-budgets.routes.spec.ts -t "POST /org/purchase-budgets"` | Wave 0       |
| FINC-02 | Budget execution real-time aggregation             | unit             | `npx jest purchase-budgets.routes.spec.ts -t "execution"`                  | Wave 0       |
| FINC-02 | budgetExceeded flag set on RC approval             | unit             | `npx jest purchase-budgets.routes.spec.ts -t "exceeded"`                   | Wave 0       |
| FINC-02 | Alert is non-blocking (does not 4xx)               | unit             | `npx jest purchase-budgets.routes.spec.ts -t "non-blocking"`               | Wave 0       |
| FINC-03 | Saving per quotation calculation                   | unit             | `npx jest saving-analysis.routes.spec.ts -t "saving"`                      | Wave 0       |
| FINC-03 | Price history by product                           | unit             | `npx jest saving-analysis.routes.spec.ts -t "price history"`               | Wave 0       |
| FINC-03 | Cycle indicators (% formal, % emergency, avg days) | unit             | `npx jest saving-analysis.routes.spec.ts -t "indicators"`                  | Wave 0       |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern="goods-returns\|purchase-budgets\|saving-analysis" --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts` — covers DEVO-01
- [ ] `apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.spec.ts` — covers FINC-02
- [ ] `apps/backend/src/modules/saving-analysis/saving-analysis.routes.spec.ts` — covers FINC-03

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection — `apps/backend/src/modules/goods-receipts/goods-receipts.types.ts` — state machine pattern
- Direct code inspection — `apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts` — multer upload pattern
- Direct code inspection — `apps/backend/src/modules/stock-outputs/stock-outputs.types.ts` — StockOutputType enum
- Direct code inspection — `apps/backend/src/modules/payables/payables.types.ts` — CreatePayableInput structure
- Direct code inspection — `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — isEmergency, quotationId
- Direct code inspection — `apps/backend/prisma/schema.prisma` lines 3022-3109 — StockOutput model
- Direct code inspection — `apps/backend/prisma/schema.prisma` lines 5385-5508 — Payable model
- Direct code inspection — `apps/backend/prisma/schema.prisma` lines 5919-5960 — SupplierCategory enum
- Direct code inspection — `apps/backend/prisma/schema.prisma` lines 6292-6462 — PurchaseOrder, GoodsReceipt models
- Direct code inspection — `.planning/phases/11-devolu-o-or-amento-e-saving/11-CONTEXT.md` — all locked decisions
- Direct code inspection — `apps/frontend/src/components/layout/Sidebar.tsx` — COMPRAS group structure

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — historical decisions from phases 7-10 (confirms VALID_TRANSITIONS, multer, cuid, in-transaction patterns)

### Tertiary (LOW confidence)

None — all findings verified directly from codebase.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified from existing modules and package.json
- Architecture: HIGH — all patterns verified from phases 7-10 source code
- Pitfalls: HIGH — derived from documented decisions in STATE.md and direct schema inspection
- Open questions: MEDIUM — flagged clearly, require schema decision in Plan 01

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable codebase)
