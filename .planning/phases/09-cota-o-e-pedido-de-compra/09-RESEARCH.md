# Phase 9: Cotacao e Pedido de Compra - Research

**Researched:** 2026-03-17
**Domain:** Purchase Quotation Flow (Solicitation → Comparative Map → Approval → Purchase Order with PDF)
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Criacao de cotacao e selecao de fornecedores**

- Uma cotacao por RC aprovada — evita complexidade de merge de itens de multiplas RCs
- Selecao de fornecedores via multi-select com sugestao Top 3 por categoria (reusa ranking de Phase 7)
- Prazo de resposta como campo de data limite na solicitacao de cotacao
- Registro de cotacao recebida por WhatsApp/telefone: comprador registra manualmente no sistema (sem integracao externa)
- Fornecedor bloqueado nao aparece na selecao; inativo aparece com aviso visual
- Numero sequencial: SC-YYYY/NNNN (Solicitacao de Cotacao) por organizacao

**Mapa comparativo e registro de propostas**

- Layout tabela: fornecedores nas colunas x itens nas linhas — padrao de mapa comparativo
- Destaque visual: menor preco por item em verde, maior em vermelho, diferenca percentual
- Split de fornecedores: comprador pode selecionar fornecedor diferente por item (checkbox por celula)
- Total por fornecedor inclui frete e impostos declarados na proposta
- Historico de precos: badge com ultimo preco pago no mapa comparativo (consulta StockEntry/Payable)
- Calculo de custo financeiro avancado (a vista vs parcelado) postergado — exibir apenas totais
- Campos por proposta: preco unitario, prazo entrega, condicao pagamento, frete, validade da proposta, upload da proposta original (PDF/imagem)

**Aprovacao e geracao do pedido**

- Aprovacao simples pelo gerente — justificativa obrigatoria se cotacao vencedora NAO for o menor preco
- Aprovar cotacao gera OC automaticamente em status EMITIDA
- Pedido emergencial: botao que cria OC sem cotacao, com justificativa obrigatoria
- Clone de pedido recorrente: botao "Duplicar" na ficha do OC cria nova OC em RASCUNHO com mesmos itens
- Aprovacao via mobile: comprador/gerente pode aprovar cotacao na tela de pendencias existente (reusa ApprovalAction)

**PDF do pedido e tracking de status**

- PDF da OC com layout profissional: dados da org, fornecedor, itens com precos, totais, condicoes de pagamento, observacoes — gerado com PDFKit (padrao existente)
- Envio por email: botao "Enviar por Email" com modal (email fornecedor pre-preenchido, anexa PDF). Envio real pode ser placeholder inicialmente (como push na Phase 8)
- Numero sequencial: OC-YYYY/NNNN por organizacao
- Maquina de estados do OC: RASCUNHO -> EMITIDA -> CONFIRMADA -> EM_TRANSITO -> ENTREGUE / CANCELADA (padrao VALID_TRANSITIONS)
- Alerta de prazo vencido: badge na listagem + notificacao via NotificationBell quando data prevista de entrega passa
- OC emitida congela precos — edicao bloqueada apos emissao (snapshot de precos da cotacao)

### Claude's Discretion

- Design exato do skeleton loading
- Espacamento e tipografia (seguindo design system)
- Empty state da listagem de cotacoes e pedidos
- Layout exato do mapa comparativo (responsividade, scroll horizontal)
- Ordem e agrupamento de campos nos formularios
- Tratamento de erros de upload de proposta
- Implementacao tecnica do envio de email (placeholder vs real)

### Deferred Ideas (OUT OF SCOPE)

- Link para preenchimento online pelo fornecedor (portal de cotacao) — listado em v1.2 (NOTI-01)
- Envio automatico de RFQ por email com template configuravel — v1.2 (NOTI-01)
- Grafico de evolucao de precos por produto — Phase 12 (FINC-03)
- Calculo de custo financeiro avancado (taxa de desconto para a vista vs parcelado) — avaliar em v1.2
- Leilao reverso / bidding — explicitamente fora de escopo (REQUIREMENTS.md Out of Scope)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                          | Research Support                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COTA-01 | Comprador cria solicitacao de cotacao a partir de RC aprovada, seleciona fornecedores (top 3 sugeridos), define prazo de resposta, registra cotacao recebida manualmente                                                             | getNextSequentialNumber pattern (SC-YYYY/NNNN); getTopSuppliersByCategory from suppliers.service; PurchaseRequest.status=APROVADA as entry gate                                   |
| COTA-02 | Registro de cotacoes recebidas, mapa comparativo automatico (fornecedores x itens), destaque menor/maior preco, total com frete+impostos, historico de precos, split por item, upload proposta original                              | QuotationProposal model with upload via multer (existing pattern); comparative map is a complex stateful frontend component with horizontal scroll; price history from StockEntry |
| COTA-03 | Gerente aprova cotacao vencedora com justificativa obrigatoria se nao for menor preco; aprovacao mobile reutiliza ApprovalAction; aprovacao gera OC automaticamente em status EMITIDA                                                | Reuse canTransition pattern; notification dispatch (fire-and-forget); OC auto-creation on approval is an atomic Prisma transaction                                                |
| PEDI-01 | OC com numero sequencial OC-YYYY/NNNN, PDF profissional, envio email, pedido emergencial sem cotacao, clone de pedido, status tracking RASCUNHO->EMITIDA->CONFIRMADA->EM_TRANSITO->ENTREGUE/CANCELADA, alerta prazo, preco congelado | PDFKit (installed); VALID_TRANSITIONS map pattern; getNextSequentialNumber (OC-YYYY/NNNN); PurchaseOrderItem snapshot frozen at issuance                                          |

</phase_requirements>

## Summary

Phase 9 implements the middle layer of the procurement cycle: from a pre-approved purchase request (RC), a buyer creates a solicitation of quotation (SC), registers vendor proposals, compares them in a comparative map, gets manager approval on the winner, and finally emits a formal purchase order (OC) with a PDF. The critical invariant is price immutability: once the OC is emitted, the prices stored in PurchaseOrderItem are frozen snapshots and cannot be edited.

The domain involves two primary workflows running in sequence. First is the quotation workflow (SC) where a Quotation document holds one-to-many QuotationSupplier records (the invited vendors) and one-to-many QuotationProposal records per vendor, each with proposal items. The comparative map aggregates these into a vendor-vs-item matrix with computed highlights. Second is the purchase order workflow (OC) where approval of a quotation atomically creates a PurchaseOrder with its items containing frozen prices; alternatively, an emergency PO skips the SC entirely.

All patterns (state machines, sequential numbering, notifications, PDFKit, multer uploads, RLS context, module colocation) are already established by Phases 7 and 8. Phase 9 is predominantly an assembly of existing pieces with two genuinely new challenges: the comparative map UI component (complex stateful grid with horizontal scroll and per-cell selection) and the multi-supplier split logic that can generate multiple OCs from a single SC.

**Primary recommendation:** Implement in this wave order: (1) Prisma schema + migrations, (2) quotations backend module (SC CRUD + proposal registration + comparative data endpoint), (3) purchase orders backend module (OC CRUD + PDF + state machine), (4) quotations frontend (SC list + proposal modal + comparative map), (5) purchase orders frontend (OC list + detail + PDF download + email modal).

## Standard Stack

### Core

| Library      | Version  | Purpose                                  | Why Standard                                     |
| ------------ | -------- | ---------------------------------------- | ------------------------------------------------ |
| Prisma 7     | 7.x      | ORM + migrations                         | Project standard; cuid() IDs for Phase 8+ models |
| PDFKit       | existing | PDF generation for OC                    | Already used in pesticide-prescriptions module   |
| multer       | existing | Upload of proposal originals (PDF/image) | Already used in purchase-requests attachments    |
| Express 5    | 5.x      | REST API                                 | Project standard                                 |
| React 19     | 19.x     | Frontend                                 | Project standard                                 |
| Lucide React | existing | Icons                                    | Project standard                                 |

### Supporting

| Library                                       | Version          | Purpose                       | When to Use                                       |
| --------------------------------------------- | ---------------- | ----------------------------- | ------------------------------------------------- |
| withRlsContext                                | internal         | RLS scoping on all DB queries | Every service function                            |
| createNotification + dispatchPushNotification | internal         | In-app + push notifications   | On SC approval, OC status changes, overdue alerts |
| getNextSequentialNumber                       | internal pattern | SC-YYYY/NNNN and OC-YYYY/NNNN | On create SC and create OC                        |

### Alternatives Considered

| Instead of               | Could Use             | Tradeoff                                                                         |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------- |
| PDFKit (existing)        | Puppeteer/HTML-to-PDF | PDFKit is already installed and proven; Puppeteer adds ~200MB; stick with PDFKit |
| Manual email placeholder | Nodemailer now        | Email is placeholder (log only) this phase; full SMTP comes in Phase 12          |

**Installation:**

```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
  quotations/
    quotations.routes.ts      # Express router
    quotations.service.ts     # Business logic + state machine
    quotations.types.ts       # SC_VALID_TRANSITIONS, QuotationError, input types
    quotations.routes.spec.ts # Jest tests (mocked service)
  purchase-orders/
    purchase-orders.routes.ts
    purchase-orders.service.ts
    purchase-orders.types.ts  # OC_VALID_TRANSITIONS, PurchaseOrderError, input types
    purchase-orders.routes.spec.ts

apps/frontend/src/
  pages/
    QuotationsPage.tsx         # List + filter SC
    QuotationsPage.css
    PurchaseOrdersPage.tsx     # List + filter OC
    PurchaseOrdersPage.css
  components/
    quotations/
      QuotationModal.tsx       # Create SC from RC
      QuotationModal.css
      QuotationDetailModal.tsx # View SC + register proposals + comparative map
      QuotationDetailModal.css
      ComparativeMapTable.tsx  # Complex grid component (separate file)
    purchase-orders/
      PurchaseOrderModal.tsx   # Create emergency OC (no SC)
      PurchaseOrderModal.css
      PurchaseOrderDetailModal.tsx # View OC + PDF download + email modal
  hooks/
    useQuotations.ts
    usePurchaseOrders.ts
  types/
    quotation.ts
    purchase-order.ts
```

### Pattern 1: State Machine (reuse from Phase 8)

**What:** Immutable VALID_TRANSITIONS map + canTransition() guard
**When to use:** Every status change for both SC (Quotation) and OC (PurchaseOrder)
**Example:**

```typescript
// Source: apps/backend/src/modules/purchase-requests/purchase-requests.types.ts
export const SC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['AGUARDANDO_PROPOSTA'],
  AGUARDANDO_PROPOSTA: ['EM_ANALISE', 'CANCELADA'],
  EM_ANALISE: ['APROVADA', 'CANCELADA'],
  APROVADA: ['FECHADA'],
  CANCELADA: [],
  FECHADA: [],
};

export const OC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['EMITIDA', 'CANCELADA'],
  EMITIDA: ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['EM_TRANSITO', 'CANCELADA'],
  EM_TRANSITO: ['ENTREGUE', 'CANCELADA'],
  ENTREGUE: [],
  CANCELADA: [],
};

export function canTransition(from: string, to: string, map: Record<string, string[]>): boolean {
  return map[from]?.includes(to) ?? false;
}
```

### Pattern 2: Sequential Numbering (reuse from Phase 8)

**What:** Transaction-scoped findFirst + increment pattern
**When to use:** SC creation (SC-YYYY/NNNN) and OC creation (OC-YYYY/NNNN)
**Example:**

```typescript
// Source: apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
async function getNextScNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.quotation.findFirst({
    where: { organizationId, sequentialNumber: { startsWith: `SC-${year}/` } },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  const lastNum = last ? parseInt(last.sequentialNumber.split('/')[1] ?? '0', 10) : 0;
  return `SC-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}
```

### Pattern 3: Price Snapshot on OC Issuance

**What:** When OC status transitions RASCUNHO->EMITIDA, PurchaseOrderItem fields are frozen; subsequent edits blocked
**When to use:** OC issuance transition handler
**Example:**

```typescript
// Freeze prices at issuance — copy from winning QuotationProposalItem
if (action === 'EMIT') {
  if (po.quotationId) {
    const approvedItems = await tx.quotationProposalItem.findMany({
      where: { proposal: { quotationId: po.quotationId, isSelected: true } },
    });
    // Write unitPrice/totalPrice into PurchaseOrderItem as immutable snapshot
  }
  await tx.purchaseOrder.update({
    where: { id },
    data: { status: 'EMITIDA', issuedAt: new Date() },
  });
}
// Block edit if status !== RASCUNHO
if (po.status !== 'RASCUNHO') throw new PurchaseOrderError('OC emitida nao pode ser editada', 400);
```

### Pattern 4: Comparative Map Data Endpoint

**What:** Backend aggregates all proposals for a SC into a single response suited for matrix display
**When to use:** GET /quotations/:id/comparative
**Example:**

```typescript
// Response shape for frontend comparative map
{
  items: [
    { rcItemId, productName, unitName, quantity, lastPricePaid: 45.00 }
  ],
  suppliers: [
    { supplierId, supplierName, rating: 4.2, proposalId, freightTotal: 150.00, proposalItems: [
      { rcItemId, unitPrice: 42.00, total: 420.00, deliveryDays: 5 }
    ]}
  ],
  perItemMinPrice: { 'item-1': 42.00, 'item-2': null },
  perItemMaxPrice: { 'item-1': 55.00, 'item-2': null },
}
```

### Pattern 5: PDF Generation (reuse PDFKit)

**What:** Stream PDFKit document to HTTP response with Content-Disposition: attachment
**When to use:** GET /purchase-orders/:id/pdf
**Example:**

```typescript
// Source: apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts
// (existing pattern — adapt for OC layout)
import PDFDocument from 'pdfkit';
export async function generatePurchaseOrderPdf(po: PurchaseOrderDetail, res: Response) {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="OC-${po.sequentialNumber}.pdf"`);
  doc.pipe(res);
  // ... draw header, items table, totals, conditions, notes
  doc.end();
}
```

### Pattern 6: Multer Upload for Proposal Original

**What:** Reuse existing multer configuration for file upload
**When to use:** POST /quotations/:id/suppliers/:supplierId/proposal — accepts PDF/image
**Example:**

```typescript
// Reuse pattern from purchase-requests attachments module
import multer from 'multer';
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });
router.post('/:id/suppliers/:supplierId/proposal', upload.single('file'), async (req, res) => { ... });
```

### Anti-Patterns to Avoid

- **Editing OC after issuance:** After status EMITIDA, block all PUT /purchase-orders/:id calls at service layer; return 400
- **Creating SC from non-APROVADA RC:** Validate `rc.status === 'APROVADA'` before creating Quotation; throw 400 otherwise
- **Mutating supplier selection after proposals recorded:** Once any proposal exists for a QuotationSupplier, disallow removing that supplier
- **Computing totals in frontend only:** Comparative map totals (frete + impostos + item subtotals) must be verified server-side on approval
- **Blocking HTTP response waiting for email send:** Email dispatch must be fire-and-forget (placeholder log pattern from dispatchPushNotification)
- **Multiple OCs from one approval in same request:** When split is selected, generate one OC per selected supplier in a single transaction; do NOT make N separate HTTP calls from frontend

## Don't Hand-Roll

| Problem              | Don't Build                  | Use Instead                                       | Why                                                                                   |
| -------------------- | ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Sequential numbering | Custom counter table         | getNextSequentialNumber() pattern                 | Already handles race conditions via transaction scope and `findFirst + orderBy: desc` |
| PDF generation       | HTML template + wkhtmltopdf  | PDFKit (installed)                                | PDFKit is already in package.json and proven in pesticide-prescriptions               |
| File upload          | Custom multipart parser      | multer (installed)                                | Already used in PurchaseRequestAttachment; handles size limits, temp storage          |
| Status transitions   | Inline if/else chains        | VALID_TRANSITIONS map + canTransition()           | Prevents invalid transitions, easy to audit, matches project pattern                  |
| Push notifications   | Direct Expo API call         | dispatchPushNotification() (fire-and-forget void) | Prevents push failures from rolling back Prisma transactions                          |
| RLS context          | Manual organizationId filter | withRlsContext(ctx, ...)                          | Enforces multitenancy on every query automatically                                    |

**Key insight:** This phase adds zero new libraries. Every technical pattern is already established in Phases 7 and 8. The only genuine complexity is the comparative map UI component and the multi-OC split logic.

## Common Pitfalls

### Pitfall 1: OC Generated with Stale Prices

**What goes wrong:** The OC is created referencing the QuotationProposalItem IDs but the frontend sent updated prices in the same request, resulting in mismatched snapshot.
**Why it happens:** Approving and creating the OC in two separate backend calls with a race condition in between.
**How to avoid:** Approval (SC->APROVADA) and OC creation must be a single Prisma transaction. Never accept item prices from the approval request body — read them from the DB at transaction time.
**Warning signs:** PurchaseOrderItem.unitPrice differs from QuotationProposalItem.unitPrice for the same item.

### Pitfall 2: Import Route Shadowing /:id

**What goes wrong:** Express matches `GET /quotations/comparative` as `:id = 'comparative'`.
**Why it happens:** Dynamic segment routes defined before specific literal routes.
**How to avoid:** Register literal routes (`/import`, `/comparative`) BEFORE `/:id` — learned in Phase 7.
**Warning signs:** 404 or wrong handler for specific-path routes.

### Pitfall 3: Decimal Type Arithmetic in TypeScript

**What goes wrong:** `item.unitPrice * item.quantity` produces NaN when unitPrice is Prisma Decimal object.
**Why it happens:** Prisma Decimal fields return a Decimal object, not a JS number.
**How to avoid:** Cast with `Number(item.unitPrice)` before arithmetic — established in Phase 8 (Decimal type decision in STATE.md).
**Warning signs:** NaN in total calculations, TypeScript strict mode errors on arithmetic operators.

### Pitfall 4: Split OC Atomicity

**What goes wrong:** Approving with split creates 2 OCs but second one fails, leaving SC in APROVADA without complete OC set.
**Why it happens:** OC creation done in a loop outside the approval transaction.
**How to avoid:** The entire approval + OC generation loop must be inside one `withRlsContext` transaction block.
**Warning signs:** SC status = APROVADA but PurchaseOrder count < expected supplier count.

### Pitfall 5: Comparative Map Horizontal Scroll on Mobile

**What goes wrong:** The table overflows and breaks the layout on narrow screens.
**Why it happens:** Fixed-width table with many columns (one per supplier) has no overflow container.
**How to avoid:** Wrap the comparative map in `overflow-x: auto` container; the table uses `min-width` per column not `width: 100%`. Claude's discretion per CONTEXT.md.
**Warning signs:** Table content clipped or horizontally misaligned on <768px viewport.

### Pitfall 6: Notification FK on purchaseRequestId

**What goes wrong:** Notification model has a `purchaseRequestId` FK that is optional but still must be null (not a quotationId or purchaseOrderId) for Phase 9 notifications.
**Why it happens:** The Notification model was designed in Phase 8 with a direct FK to PurchaseRequest; quotation/PO notifications must use `referenceId`/`referenceType` string fields instead.
**How to avoid:** Use `referenceId: quotationId` + `referenceType: 'quotation'` (or `'purchase_order'`) for all Phase 9 notifications. Do NOT add new FKs to the Notification model.
**Warning signs:** Prisma error on notification.create if you attempt to use a non-existent FK field.

## Code Examples

### Prisma Schema Models for Phase 9

```prisma
// Source: design from Phase 8 schema patterns (schema.prisma lines 5999-6154)

model Quotation {
  id               String            @id @default(cuid())
  organizationId   String
  purchaseRequestId String
  sequentialNumber String
  status           QuotationStatus   @default(RASCUNHO)
  responseDeadline DateTime?
  notes            String?
  approvedBy       String?
  approvalJustification String?
  approvedAt       DateTime?
  createdBy        String
  deletedAt        DateTime?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  organization    Organization       @relation(fields: [organizationId], references: [id])
  purchaseRequest PurchaseRequest    @relation(fields: [purchaseRequestId], references: [id])
  creator         User               @relation("QuotationCreator", fields: [createdBy], references: [id])
  approver        User?              @relation("QuotationApprover", fields: [approvedBy], references: [id])
  suppliers       QuotationSupplier[]
  purchaseOrders  PurchaseOrder[]

  @@unique([organizationId, sequentialNumber])
  @@index([organizationId, status])
  @@index([purchaseRequestId])
  @@map("quotations")
}

model QuotationSupplier {
  id          String    @id @default(cuid())
  quotationId String
  supplierId  String
  isSelected  Boolean   @default(false) // "winner" flag (may be partial per item)
  createdAt   DateTime  @default(now())

  quotation   Quotation  @relation(fields: [quotationId], references: [id], onDelete: Cascade)
  supplier    Supplier   @relation(fields: [supplierId], references: [id])
  proposal    QuotationProposal?

  @@unique([quotationId, supplierId])
  @@index([quotationId])
  @@map("quotation_suppliers")
}

model QuotationProposal {
  id                  String    @id @default(cuid())
  quotationSupplierId String    @unique
  freightTotal        Decimal?  @db.Decimal(12, 2)
  taxTotal            Decimal?  @db.Decimal(12, 2)
  paymentTerms        String?
  validUntil          DateTime?
  deliveryDays        Int?
  fileUrl             String?
  fileName            String?
  notes               String?
  registeredAt        DateTime  @default(now())
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  quotationSupplier  QuotationSupplier     @relation(fields: [quotationSupplierId], references: [id], onDelete: Cascade)
  items              QuotationProposalItem[]

  @@map("quotation_proposals")
}

model QuotationProposalItem {
  id                String   @id @default(cuid())
  proposalId        String
  purchaseRequestItemId String
  unitPrice         Decimal  @db.Decimal(12, 4)
  quantity          Decimal  @db.Decimal(12, 3)
  totalPrice        Decimal  @db.Decimal(14, 2)
  notes             String?

  proposal           QuotationProposal  @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  purchaseRequestItem PurchaseRequestItem @relation(fields: [purchaseRequestItemId], references: [id])

  @@unique([proposalId, purchaseRequestItemId])
  @@index([proposalId])
  @@map("quotation_proposal_items")
}

model PurchaseOrder {
  id               String              @id @default(cuid())
  organizationId   String
  quotationId      String?             // null for emergency PO
  supplierId       String
  sequentialNumber String
  status           PurchaseOrderStatus @default(RASCUNHO)
  isEmergency      Boolean             @default(false)
  emergencyJustification String?
  notes            String?
  internalReference String?
  expectedDeliveryDate DateTime?
  confirmedAt      DateTime?
  issuedAt         DateTime?
  overdueNotifiedAt DateTime?
  cancelledAt      DateTime?
  createdBy        String
  deletedAt        DateTime?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  organization  Organization        @relation(fields: [organizationId], references: [id])
  quotation     Quotation?          @relation(fields: [quotationId], references: [id])
  supplier      Supplier            @relation(fields: [supplierId], references: [id])
  creator       User                @relation("POCreator", fields: [createdBy], references: [id])
  items         PurchaseOrderItem[]

  @@unique([organizationId, sequentialNumber])
  @@index([organizationId, status])
  @@index([supplierId])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id                    String   @id @default(cuid())
  purchaseOrderId       String
  purchaseRequestItemId String?
  productName           String   // snapshot
  unitName              String   // snapshot
  quantity              Decimal  @db.Decimal(12, 3) // snapshot
  unitPrice             Decimal  @db.Decimal(12, 4) // FROZEN snapshot
  totalPrice            Decimal  @db.Decimal(14, 2) // FROZEN snapshot
  notes                 String?

  purchaseOrder PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)

  @@index([purchaseOrderId])
  @@map("purchase_order_items")
}
```

### Backend Routes Pattern

```typescript
// Source: apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts (adapted)
// Register in apps/backend/src/app.ts

// quotations.routes.ts
router.get('/', listHandler);
router.post('/', createHandler); // SC from RC
router.get('/:id', getByIdHandler);
router.get('/:id/comparative', comparativeHandler); // comparative map data
router.patch('/:id/transition', transitionHandler); // status changes
router.post('/:id/proposals', upload.single('file'), registerProposalHandler);
router.delete('/:id', deleteHandler); // RASCUNHO only

// purchase-orders.routes.ts
router.get('/', listHandler);
router.post('/', createHandler); // emergency OC or duplicate
router.get('/:id', getByIdHandler);
router.get('/:id/pdf', pdfHandler); // stream PDF
router.patch('/:id/transition', transitionHandler);
router.patch('/:id', updateHandler); // RASCUNHO only
router.delete('/:id', deleteHandler);
```

### Frontend Hook Pattern

```typescript
// Source: apps/frontend/src/hooks/useMilkTanks.ts (adapted pattern)
// hooks/useQuotations.ts

export function useQuotations(filters: QuotationFilters) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<PaginatedResponse<Quotation>>('/org/quotations', {
        params: filters,
      });
      setQuotations(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cotacoes');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchQuotations();
  }, [fetchQuotations]);
  return { quotations, isLoading, error, refetch: fetchQuotations };
}
```

### Notification Types for Phase 9

```typescript
// Source: apps/backend/src/modules/notifications/notifications.types.ts (extend)
// New notification types to add:
// 'QUOTATION_PENDING_APPROVAL' — notifies manager when SC reaches EM_ANALISE
// 'QUOTATION_APPROVED'        — notifies buyer when SC approved
// 'PO_OVERDUE'                — notifies buyer when expectedDeliveryDate passes
// 'QUOTATION_DEADLINE_NEAR'   — notifies buyer when SC responseDeadline approaches

// All use referenceId/referenceType, NOT purchaseRequestId FK
```

## State of the Art

| Old Approach                             | Current Approach                        | When Changed      | Impact                                               |
| ---------------------------------------- | --------------------------------------- | ----------------- | ---------------------------------------------------- |
| Inline status if/else                    | VALID_TRANSITIONS map + canTransition() | Phase 8           | All state machines in this project use this pattern  |
| window.confirm() for destructive actions | ConfirmModal component                  | Phase 8           | Cancel OC and delete SC must use ConfirmModal        |
| uuid() IDs                               | cuid() IDs for Phase 8+ models          | Phase 8           | All new models (Quotation, PurchaseOrder) use cuid() |
| Fire-and-forget with &                   | void + .catch() pattern                 | Phase 8           | dispatchPushNotification always void + .catch()      |
| Separate email await in transaction      | BullMQ job after commit                 | STATE.md decision | Email placeholder this phase; never await inside tx  |

**Deprecated/outdated:**

- `uuid()` for new models: replaced by `cuid()` starting Phase 8 — use `@default(cuid())` for all new models

## Open Questions

1. **QuotationSupplier.isSelected vs per-item selection for split**
   - What we know: Split means different supplier per item; a single QuotationSupplier can't capture per-item selection
   - What's unclear: Is isSelected a supplier-level flag (simpler, one winner per supplier) or do we need a QuotationProposalItemSelection join table?
   - Recommendation: Add a `QuotationItemSelection` model with `(quotationId, purchaseRequestItemId, quotationSupplierId)` unique constraint. This supports split at item granularity without overloading the proposal model. Each row represents "item X is sourced from supplier Y's proposal."

2. **Last price paid badge in comparative map**
   - What we know: The badge shows last price from StockEntry or a Payable record
   - What's unclear: Which table to query — StockEntryItem (if product exists) or PurchaseOrderItem (if product was previously ordered)? Neither table may have data for new products.
   - Recommendation: Query PurchaseOrderItem.unitPrice WHERE purchaseRequestItemId matches (for exact product) OR where productName matches; fall back to null gracefully. Show badge only when found.

3. **Mobile approval of Quotation via existing ApprovalAction screen**
   - What we know: CONTEXT.md says "reusa ApprovalAction"; ApprovalAction is tied to purchaseRequestId FK in schema
   - What's unclear: Does mobile approval screen need a new quotation-specific ApprovalAction or reuse the same model with a different reference?
   - Recommendation: Do NOT add quotation ApprovalActions to the existing ApprovalAction model (it has a required purchaseRequestId FK). Instead, implement quotation approval as a simple PATCH /quotations/:id/transition with role guard (MANAGER only). The mobile pending screen can show quotations in EM_ANALISE status separately from RC approvals.

## Validation Architecture

### Test Framework

| Property           | Value                                                      |
| ------------------ | ---------------------------------------------------------- | ----------------------------------- |
| Framework          | Jest + @swc/jest (backend)                                 |
| Config file        | `apps/backend/jest.config.js`                              |
| Quick run command  | `cd apps/backend && npx jest --testPathPattern="quotations | purchase-orders" --passWithNoTests` |
| Full suite command | `cd apps/backend && npx jest`                              |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                                                            | Test Type          | Automated Command                                     | File Exists? |
| ------- | ----------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- | ------------ |
| COTA-01 | POST /quotations creates SC from APROVADA RC with SC-YYYY/NNNN                      | unit (routes.spec) | `npx jest --testPathPattern="quotations.routes"`      | Wave 0       |
| COTA-01 | POST /quotations rejects if RC not APROVADA                                         | unit (routes.spec) | same                                                  | Wave 0       |
| COTA-01 | Top 3 supplier suggestion query returns ACTIVE suppliers ordered by rating          | unit (routes.spec) | same                                                  | Wave 0       |
| COTA-02 | POST /quotations/:id/proposals registers proposal with items                        | unit (routes.spec) | same                                                  | Wave 0       |
| COTA-02 | GET /quotations/:id/comparative returns matrix with min/max highlights              | unit (routes.spec) | same                                                  | Wave 0       |
| COTA-03 | PATCH /quotations/:id/transition APPROVE requires justification if not lowest price | unit (routes.spec) | same                                                  | Wave 0       |
| COTA-03 | Approval auto-creates PurchaseOrder in EMITIDA status atomically                    | unit (routes.spec) | same                                                  | Wave 0       |
| PEDI-01 | POST /purchase-orders creates emergency OC without quotation                        | unit (routes.spec) | `npx jest --testPathPattern="purchase-orders.routes"` | Wave 0       |
| PEDI-01 | OC edit blocked when status != RASCUNHO                                             | unit (routes.spec) | same                                                  | Wave 0       |
| PEDI-01 | GET /purchase-orders/:id/pdf returns PDF content-type                               | unit (routes.spec) | same                                                  | Wave 0       |
| PEDI-01 | Overdue detection fires notification when expectedDeliveryDate passes               | unit (routes.spec) | same                                                  | Wave 0       |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern="quotations|purchase-orders" --passWithNoTests`
- **Per wave merge:** `cd apps/backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/quotations/quotations.routes.spec.ts` — covers COTA-01, COTA-02, COTA-03
- [ ] `apps/backend/src/modules/purchase-orders/purchase-orders.routes.spec.ts` — covers PEDI-01

_(Frontend components have no automated test framework configured — manual testing per design system rules)_

## Sources

### Primary (HIGH confidence)

- `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — RC_VALID_TRANSITIONS, canTransition, getNextSequentialNumber patterns inspected directly
- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` — full service implementation inspected
- `apps/backend/prisma/schema.prisma` lines 5927-6154 — Supplier, PurchaseRequest, ApprovalAction, Notification models inspected
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification, dispatchPushNotification patterns inspected
- `.planning/phases/09-cota-o-e-pedido-de-compra/09-CONTEXT.md` — locked decisions, canonical refs
- `apps/backend/jest.config.js` — test runner configuration inspected

### Secondary (MEDIUM confidence)

- `apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` (partial read) — PDFKit usage pattern confirmed
- `apps/frontend/src/pages/PurchaseRequestsPage.tsx` — frontend page pattern confirmed
- `.planning/STATE.md` — key architecture decisions (price snapshot, BullMQ email, cuid(), VALID_TRANSITIONS) confirmed

### Tertiary (LOW confidence)

- QuotationItemSelection model design (inferred from split requirement — not yet in schema)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed present in project
- Architecture: HIGH — patterns directly inspected from existing Phase 8 code
- Pitfalls: HIGH — most derived from STATE.md documented decisions and direct code inspection
- Comparative map component design: MEDIUM — complexity level estimated from requirement, no prior implementation to reference
- QuotationItemSelection model: LOW — inferred from requirements, needs validation during schema design

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack, patterns are frozen by prior phases)
