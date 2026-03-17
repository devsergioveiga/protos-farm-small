# Phase 7: Cadastro de Fornecedores - Research

**Researched:** 2026-03-17
**Domain:** Supplier management — fiscal data, bulk import, rating/ranking, CSV/PDF export
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Formulario e dados**

- Modal unico com secoes visiveis: Dados Fiscais, Dados Comerciais, Endereco, Categorias e Produtos, Anexos
- Toggle PF/PJ no topo do formulario — adapta campos automaticamente (PJ: Razao Social/CNPJ/IE; PF: Nome/CPF)
- Campos obrigatorios: Tipo (PF/PJ), Nome/Razao Social, CNPJ/CPF, pelo menos 1 categoria
- Campos opcionais: IE, endereco completo, contato (nome, telefone, email), condicao de pagamento, frete CIF/FOB, observacoes
- CNPJ/CPF unico por organizacao — duplicata mostra "Fornecedor ja cadastrado" com link para o existente
- Fornecedor pertence a organizacao (nao a fazenda) — qualquer fazenda da org pode usa-lo
- Categorias como multi-select de opcoes fixas (Insumo Agricola, Pecuario, Pecas, Combustivel, EPI, Servicos etc.) — mesmas categorias da requisicao de compra (Phase 8)
- Condicao de pagamento padrao como campo texto com autocomplete de sugestoes (30 dias, 30/60/90, A vista, 7 dias)
- Upload de documentacao: secao simples de anexos com nome, tipo (Contrato, Certidao, Alvara, Outro) e data upload, drag & drop
- Campo de observacoes/notas como textarea simples no final do formulario
- Status com 3 estados: ativo, inativo, bloqueado

**Status e comportamento**

- Fornecedor bloqueado NAO aparece na lista de selecao ao criar cotacao (Phase 9)
- Fornecedor inativo aparece na lista com aviso visual

**Importacao em massa**

- Aceita CSV (.csv) e Excel (.xlsx)
- Template para download com colunas esperadas
- Ao importar, fornecedores com CNPJ/CPF ja existente sao pulados (nao importados) e aparecem no relatorio final como "ja cadastrado"
- Tabela de preview apos upload: linhas validas em verde, invalidas em vermelho com motivo do erro. Botao "Importar X de Y" para confirmar

**Busca e filtros**

- Campo de busca full-text (nome, CNPJ, nome fantasia)
- Filtros dropdown: categoria, status (ativo/inativo/bloqueado), cidade/UF

**Avaliacao e ranking**

- Avaliacao manual a qualquer momento — botao "Avaliar" na ficha do fornecedor
- 4 criterios com pesos iguais (25% cada): prazo, qualidade, preco, atendimento
- Escala de 1 a 5 estrelas por criterio
- Media simples dos 4 criterios = nota final
- Top 3 fornecedores por categoria exibidos na pagina de listagem (cards com nome, estrelas, nota media, numero de avaliacoes)
- Alerta de rating baixo (< 3): badge amarelo/vermelho ao lado do nome durante selecao de fornecedor em cotacao (Phase 9), com tooltip mostrando nota media e numero de avaliacoes. Nao bloqueia, so avisa
- Historico de avaliacoes na ficha do fornecedor (lista com data, notas por criterio, comentario)

**Exportacao**

- CSV: exporta listagem filtrada com BOM UTF-8 (padrao existente do codebase)
- PDF: listagem formatada com cabecalho da org, tabela com dados principais (nome, CNPJ, categorias, status, rating, cidade), filtros aplicados no titulo. Usa PDFKit (padrao do receituario)

**Pagina e navegacao**

- Tabela de fornecedores com colunas: Nome/Razao Social, CNPJ/CPF, Categorias (badges), Status (badge colorido), Rating (estrelas), Acoes
- Secao "Top Fornecedores" acima da tabela com select de categoria e 3 cards
- Em mobile: tabela transforma em cards empilhados (design system)
- Sidebar: novo grupo "COMPRAS" com item "Fornecedores" — fases 8-12 adicionam itens ao mesmo grupo

### Claude's Discretion

- Design exato do skeleton loading
- Espacamento e tipografia (seguindo design system)
- Empty state da listagem (ilustracao + CTA)
- Formato exato do template de importacao
- Tratamento de erros de upload
- Ordem dos campos no formulario dentro de cada secao

### Deferred Ideas (OUT OF SCOPE)

- Consulta automatica de CNPJ na Receita Federal para auto-preenchimento — listado em v1.2 (FORN-04)
- Relatorio de performance completo com graficos e filtro por periodo — Phase 12 (Dashboard)
- Vinculacao de avaliacao a entrega especifica — Phase 10 (Recebimento) pode adicionar trigger
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                                                                                     | Research Support                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FORN-01 | Gerente pode cadastrar fornecedor com dados fiscais (razao social, CNPJ/CPF, IE, endereco), dados comerciais (contato principal, condicao de pagamento padrao, frete CIF/FOB), classificacao por categorias, upload de documentacao, avaliacao (rating 1-5), e status (ativo/inativo/bloqueado) | Prisma schema pattern from Producer model; document-validator.ts reusable; multer memoryStorage for file uploads; PDFKit already installed                |
| FORN-02 | Gerente pode importar fornecedores em massa via CSV/Excel, buscar por nome/CNPJ/categoria/produto/cidade, e exportar listagem (CSV, PDF)                                                                                                                                                        | animal-file-parser.ts (ExcelJS + manual CSV) reusable with modifications; BOM UTF-8 CSV export pattern established; PDFKit PDF export pattern established |
| FORN-03 | Gerente pode avaliar fornecedor (prazo, qualidade, preco, atendimento), ver ranking automatico por media ponderada, historico de avaliacoes, top 3 por categoria, alerta ao cotar com fornecedor rating < 3                                                                                     | New SupplierRating model needed; rating aggregation via Prisma aggregation; average computed server-side                                                  |

</phase_requirements>

---

## Summary

Phase 7 builds the `suppliers` module from scratch within an existing, mature Express 5 + Prisma 7 + React 19 codebase. The domain is well-understood: supplier CRUD with fiscal data (PF/PJ), bulk CSV/XLSX import with preview, rating/ranking, and dual export (CSV + PDF). All required libraries are already installed in the project.

The primary reference model for backend structure is `modules/producers/` — same PF/PJ toggle, same document uniqueness constraint per organization, same `ProducerDocument` attachment pattern. The file import pattern is fully established in `animal-file-parser.ts` (ExcelJS + manual CSV parsing), and the PDF export pattern is established in `pesticide-prescriptions.service.ts` (PDFKit via dynamic import). No new npm packages are needed.

The main novelty of this phase is the rating system: a `SupplierRating` model with 4 criteria (25% each), aggregated average computed server-side, and the `top3ByCategory` endpoint. The rating alert for Phase 9 (cotação) must be delivered as a field in the supplier list/detail response (`averageRating`, `ratingCount`) rather than as a separate notification — Phase 9 will consume it.

**Primary recommendation:** Model Supplier after Producer; reuse animal-file-parser pattern for import; reuse pesticide-prescriptions pattern for PDF export; introduce `purchases` RBAC permission module alongside existing `financial`.

---

## Standard Stack

### Core

| Library   | Version | Purpose                | Why Standard                                       |
| --------- | ------- | ---------------------- | -------------------------------------------------- |
| Prisma 7  | 7.x     | ORM + migrations       | Project standard — all models here                 |
| Express 5 | 5.x     | HTTP routing           | Project standard                                   |
| ExcelJS   | latest  | CSV + XLSX parsing     | Already used in animal-file-parser.ts              |
| PDFKit    | ^0.17.2 | PDF generation         | Already installed, used in pesticide-prescriptions |
| multer    | ^2.1.0  | File upload middleware | Already installed, memoryStorage pattern           |

### Supporting

| Library                          | Version  | Purpose                                  | When to Use                    |
| -------------------------------- | -------- | ---------------------------------------- | ------------------------------ |
| document-validator.ts (internal) | —        | isValidCPF / isValidCNPJ / cleanDocument | All fiscal document validation |
| supertest                        | existing | HTTP integration tests                   | Backend routes.spec.ts         |
| Vitest + @testing-library/react  | existing | Frontend component tests                 | Frontend spec files            |

### Alternatives Considered

| Instead of                         | Could Use          | Tradeoff                                                                            |
| ---------------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| Manual CSV parse (current pattern) | csv-parse library  | csv-parse is cleaner but not installed; manual pattern is proven and avoids new dep |
| PDFKit                             | pdf-lib, puppeteer | PDFKit already installed and patterned; others would add bundle weight              |

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/suppliers/
├── suppliers.routes.ts          # Express Router, multer upload config
├── suppliers.routes.spec.ts     # supertest integration tests (mock service)
├── suppliers.service.ts         # Business logic, DB queries via withRlsContext
├── suppliers.types.ts           # Error class, constants, Input/Output interfaces
└── supplier-file-parser.ts      # CSV + XLSX import parsing (adapts animal-file-parser)

apps/frontend/src/
├── pages/SuppliersPage.tsx      # List page with Top3 section + filter bar + table
├── pages/SuppliersPage.css      # Page styles
├── components/suppliers/
│   ├── SupplierModal.tsx         # Create/Edit modal (multi-section)
│   ├── SupplierModal.css
│   ├── SupplierRatingModal.tsx   # Rating modal (4 criteria + comment)
│   ├── SupplierRatingModal.css
│   └── SupplierImportModal.tsx  # Bulk import with preview table
├── hooks/
│   ├── useSuppliers.ts          # List with filters + pagination
│   ├── useSupplierForm.ts       # Create/edit form state
│   └── useSupplierRating.ts     # Rating submission
└── types/supplier.ts            # Frontend types
```

### Pattern 1: Backend Module (collocated)

The standard module pattern for this codebase is:

```typescript
// suppliers.service.ts — all functions are named exports, no class
import { withRlsContext, type RlsContext } from '../../database/rls';
import { SupplierError, type CreateSupplierInput } from './suppliers.types';

export async function createSupplier(
  ctx: RlsContext,
  input: CreateSupplierInput,
  createdBy: string,
): Promise<SupplierOutput> {
  return withRlsContext(ctx, async (tx) => {
    // validate, check duplicate document, create
  });
}
```

### Pattern 2: Document Uniqueness Check

Reuse the Producer model constraint pattern — `@@unique([document, organizationId])` in Prisma schema, plus service-level check that throws a structured error with the existing supplier's ID when a duplicate is detected:

```typescript
const existing = await tx.supplier.findFirst({
  where: { document: cleanDocument(input.document), organizationId: ctx.organizationId },
  select: { id: true, name: true },
});
if (existing) {
  throw new SupplierError(`Fornecedor já cadastrado: ${existing.name}`, 409, {
    existingId: existing.id,
  });
}
```

### Pattern 3: Bulk Import (two-step preview + execute)

Copy `animal-file-parser.ts` structure exactly, renamed to `supplier-file-parser.ts`. The routes expose two endpoints:

```
POST /api/org/suppliers/import/preview   -- parses file, returns { valid: Row[], invalid: InvalidRow[] }
POST /api/org/suppliers/import/execute   -- re-parses same payload, skips existing CNPJs, returns ImportReport
```

The preview does not persist; execute persists only valid rows. `multer({ storage: memoryStorage() })` with 5MB limit, accept `.csv` and `.xlsx`.

### Pattern 4: Rating Aggregation

Compute `averageRating` in service layer using Prisma aggregation. Expose it as a computed field on `SupplierOutput`:

```typescript
const agg = await tx.supplierRating.aggregate({
  where: { supplierId },
  _avg: { deadline: true, quality: true, price: true, service: true },
  _count: { id: true },
});
const avg = (agg._avg.deadline + agg._avg.quality + agg._avg.price + agg._avg.service) / 4;
```

For `top3ByCategory`, compute averages in a raw query or via Prisma groupBy to avoid N+1. Return the top 3 suppliers per requested category sorted by `averageRating DESC, ratingCount DESC`.

### Pattern 5: CSV Export with BOM

```typescript
// Source: animals.service.ts line 743-777
const BOM = '\uFEFF';
const headers = ['Nome', 'CNPJ/CPF', 'Categorias', 'Status', 'Rating', 'Cidade', 'UF'];
const rows = suppliers.map((s) => [
  s.name,
  s.document,
  s.categories.join('|'),
  s.status,
  s.averageRating?.toFixed(1) ?? '',
  s.city ?? '',
  s.state ?? '',
]);
return BOM + [headers, ...rows].map((r) => r.join(';')).join('\n');
```

### Pattern 6: PDF Export (PDFKit)

```typescript
// Source: pesticide-prescriptions.service.ts line 370
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 50 });
const chunks: Buffer[] = [];
doc.on('data', (chunk: Buffer) => chunks.push(chunk));
doc.on('end', () => resolve(Buffer.concat(chunks)));
// ... add header, table rows, footer
doc.end();
```

### Pattern 7: RBAC — New Module

Add `purchases` to `PermissionModule` in `apps/backend/src/shared/rbac/permissions.ts`. Assign `purchases:manage` to MANAGER and ADMIN; `purchases:view` (i.e., `purchases:read`) to FINANCIAL, AGRONOMIST, CONSULTANT.

### Anti-Patterns to Avoid

- **Rating computed client-side:** Always compute `averageRating` on the server — clients must never sum/average SupplierRating rows themselves to avoid divergence.
- **Supplier scoped to farmId:** Supplier belongs to `organizationId` only — no `farmId` on the model. Follows org-level resource pattern (same as Producer).
- **Blocking on rating < 3:** Phase 7 only surfaces the rating value. Phase 9 implements the selection-list filter. Do not implement cotação blocking logic here.
- **Inline page form:** All create/edit forms must be in modals per CLAUDE.md. No dedicated `/suppliers/new` route.
- **window.confirm for destructive actions:** Use `ConfirmModal` with `variant="danger"` for supplier deletion (medium criticality — no name typing required unless decided otherwise).

---

## Don't Hand-Roll

| Problem             | Don't Build           | Use Instead                                        | Why                                                         |
| ------------------- | --------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| CNPJ/CPF validation | Custom regex          | `document-validator.ts` `isValidCNPJ`/`isValidCPF` | Already handles check digits, known-bad sequences           |
| XLSX parsing        | Manual buffer parsing | ExcelJS (already in `animal-file-parser.ts`)       | Cell type handling (Date, formula result, empty) is complex |
| PDF generation      | HTML-to-PDF, canvas   | PDFKit (already installed)                         | Established pattern, handles streaming correctly            |
| CSV export BOM      | Custom encoding       | `'\uFEFF'` prefix (existing pattern)               | Excel on Windows requires UTF-8 BOM to render pt-BR chars   |
| File upload         | Custom multipart      | multer `memoryStorage()` (already installed)       | Handles multipart/form-data, file size limits               |
| RLS context         | Direct Prisma client  | `withRlsContext(ctx, async tx => ...)`             | All org-scoped queries must go through RLS                  |

---

## Common Pitfalls

### Pitfall 1: Document Stored With Formatting

**What goes wrong:** CNPJ stored as `12.345.678/0001-99` in DB — uniqueness check fails for `12345678000199`.
**Why it happens:** Frontend sends formatted string; service doesn't strip before persist.
**How to avoid:** Always call `cleanDocument(input.document)` before any DB read/write. Store only digits.
**Warning signs:** Duplicate supplier created despite same CNPJ; `@@unique` constraint never fires.

### Pitfall 2: Rating N+1 in List Query

**What goes wrong:** `listSuppliers` runs a `SupplierRating.aggregate` query per supplier row — 50 suppliers = 51 queries.
**Why it happens:** Using `include: { ratings: true }` and computing average in TypeScript map.
**How to avoid:** Use `_avg` aggregation in a subquery or batch via `groupBy`. For the list endpoint, either: (a) maintain a `cachedAverageRating` denormalized field on the Supplier model updated on each rating creation, or (b) use a single `groupBy` query for the page of results and merge in memory.
**Warning signs:** List endpoint slow with >20 suppliers; DB query count visible in logs.

### Pitfall 3: Import Execute Without Re-Validation

**What goes wrong:** Preview validates rows at T0; between preview and execute another import runs; execute inserts a row that was valid at preview but is now a duplicate.
**Why it happens:** Preview result cached client-side; execute trusts the preview result.
**How to avoid:** Execute endpoint always re-validates. The "skip existing" logic runs again at execute time. Return an `ImportReport` showing how many were inserted vs skipped vs failed.
**Warning signs:** Duplicate key error at DB level; 500 error on execute.

### Pitfall 4: SupplierCategory Enum Divergence with Phase 8

**What goes wrong:** Phase 7 uses a different set of category values than Phase 8 (Requisicao de Compra) — downstream references break.
**Why it happens:** Phase 7 hardcodes an enum; Phase 8 creates a different enum independently.
**How to avoid:** Define `SupplierCategory` as a Prisma enum (not a string field) with agreed-upon values: `INSUMO_AGRICOLA`, `PECUARIO`, `PECAS`, `COMBUSTIVEL`, `EPI`, `SERVICOS`, `OUTROS`. Phase 8 imports/references the same enum. Document the enum in a comment in schema.prisma.
**Warning signs:** Phase 9 asks which category enum to use for cotação; values don't match.

### Pitfall 5: PDF Streaming in Express 5

**What goes wrong:** Response hangs or sends empty body when PDFKit stream not properly piped.
**Why it happens:** Forgetting to set `Content-Type` and `Content-Disposition` headers before piping; or resolving promise before `doc.end()` fires.
**How to avoid:** Follow exact pattern from `pesticide-prescriptions.service.ts` — collect chunks in `data` event, resolve in `end` event, return Buffer. Route sets headers then calls `res.send(buffer)`.

### Pitfall 6: RBAC Module Not Added

**What goes wrong:** `checkPermission('purchases:manage')` throws at startup because `purchases` is not in `PermissionModule` type.
**Why it happens:** Forgetting to update `permissions.ts` before adding routes.
**How to avoid:** Wave 0 task explicitly updates `permissions.ts` and `DEFAULT_ROLE_PERMISSIONS` for MANAGER, ADMIN, FINANCIAL roles before any route is written.

---

## Code Examples

### Prisma Schema — Supplier Models

```prisma
// Source: schema.prisma pattern from Producer model (line 679)

enum SupplierType {
  PF
  PJ
}

enum SupplierStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}

enum SupplierCategory {
  INSUMO_AGRICOLA
  PECUARIO
  PECAS
  COMBUSTIVEL
  EPI
  SERVICOS
  OUTROS
}

enum SupplierDocumentType {
  CONTRATO
  CERTIDAO
  ALVARA
  OUTRO
}

model Supplier {
  id                  String         @id @default(uuid())
  organizationId      String
  type                SupplierType
  name                String
  tradeName           String?
  document            String         // stored clean (digits only)
  stateRegistration   String?        // IE
  address             String?
  city                String?
  state               String?        @db.VarChar(2)
  zipCode             String?
  contactName         String?
  contactPhone        String?
  contactEmail        String?
  paymentTerms        String?        // free text with autocomplete
  freightType         String?        // "CIF" | "FOB"
  notes               String?
  status              SupplierStatus @default(ACTIVE)
  categories          SupplierCategory[]
  createdBy           String
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  organization Organization     @relation(fields: [organizationId], references: [id])
  documents    SupplierDocument[]
  ratings      SupplierRating[]

  @@unique([document, organizationId])
  @@index([organizationId])
  @@index([organizationId, status])
  @@map("suppliers")
}

model SupplierDocument {
  id          String               @id @default(uuid())
  supplierId  String
  type        SupplierDocumentType
  filename    String
  url         String
  mimeType    String?
  sizeBytes   Int?
  uploadedAt  DateTime             @default(now())

  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@index([supplierId])
  @@map("supplier_documents")
}

model SupplierRating {
  id          String   @id @default(uuid())
  supplierId  String
  organizationId String
  deadline    Int      // 1–5
  quality     Int      // 1–5
  price       Int      // 1–5
  service     Int      // 1–5
  comment     String?
  ratedBy     String
  createdAt   DateTime @default(now())

  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@index([supplierId])
  @@index([organizationId])
  @@map("supplier_ratings")
}
```

### Route Registration Pattern (app.ts)

```typescript
// Add to imports
import { suppliersRouter } from './modules/suppliers/suppliers.routes';

// Add to route registrations (after ruralCreditRouter)
app.use('/api', suppliersRouter);
```

### Route URL Scheme

All suppliers are org-level (no farmId in path):

```
GET    /api/org/suppliers                       -- list with filters + pagination
POST   /api/org/suppliers                       -- create
GET    /api/org/suppliers/top3                  -- top3 by category (?category=PECUARIO)
GET    /api/org/suppliers/export/csv            -- export filtered list as CSV
GET    /api/org/suppliers/export/pdf            -- export filtered list as PDF
GET    /api/org/suppliers/:id                   -- get single
PATCH  /api/org/suppliers/:id                   -- update
DELETE /api/org/suppliers/:id                   -- soft delete (or hard delete — TBD in plan)
POST   /api/org/suppliers/:id/ratings           -- add rating
GET    /api/org/suppliers/:id/ratings           -- list rating history
POST   /api/org/suppliers/import/preview        -- parse file, return preview rows
POST   /api/org/suppliers/import/execute        -- persist valid rows, return ImportReport
GET    /api/org/suppliers/import/template       -- download CSV template
```

### Frontend Hook Pattern

```typescript
// hooks/useSuppliers.ts
export function useSuppliers(params: SuppliersQueryParams) {
  const [data, setData] = useState<SuppliersListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => {
      // fetch /api/org/suppliers with params
    },
    [
      /* param deps */
    ],
  );

  return { suppliers: data?.data ?? [], total: data?.total ?? 0, isLoading, error, refetch };
}
```

### Sidebar Group Addition (Sidebar.tsx)

Insert before the `CONFIGURACAO` group:

```typescript
{
  title: 'COMPRAS',
  items: [
    { to: '/suppliers', icon: Handshake, label: 'Fornecedores' },
    // phases 8-12 add items here
  ],
},
```

Import `Handshake` from `lucide-react`.

---

## State of the Art

| Old Approach                         | Current Approach                | When Changed  | Impact                                                                  |
| ------------------------------------ | ------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `supplierName String?` on StockEntry | Separate Supplier model with FK | Phase 7 (now) | StockEntry keeps loose string for backward compat; new purchases use FK |
| Inline permission check              | `checkPermission()` middleware  | Existing      | Add `purchases` module to PermissionModule type                         |

**Deprecated/outdated:**

- `supplierName` on `StockEntry` and `StockOutput` models: These are plain string fields (no FK). They remain as-is for existing records. The new Supplier entity is for the P2P cycle — backward compatibility is not required; no migration of old strings needed.

---

## Open Questions

1. **Soft delete vs hard delete for suppliers**
   - What we know: Producer uses no soft delete (hard delete). Most domain entities in this codebase use `deletedAt` soft delete pattern.
   - What's unclear: Whether a supplier with ratings or future purchase references should be hard-deleted.
   - Recommendation: Use `deletedAt DateTime?` soft delete on Supplier. A supplier with ratings should never be hard-deleted — hide from UI, preserve for historical P2P cycle references. Planner should decide and document.

2. **Document/attachment storage**
   - What we know: `ProducerDocument` stores a `url String` — implying S3 or similar. No upload infrastructure is visible in the codebase (no S3 client import found).
   - What's unclear: Is the URL a placeholder or is there an actual S3 bucket configured?
   - Recommendation: For Phase 7, defer actual file storage — store only metadata (filename, type, uploadedAt) with `url` as empty string or stub. Mark as a known limitation. Phase 12 can wire actual storage.

3. **SupplierCategory as Prisma enum vs string array**
   - What we know: Prisma 7 supports `String[]` arrays on PostgreSQL. Using an enum ensures type safety and Phase 8 reuse.
   - What's unclear: Whether Phase 8 will use the same Prisma enum or its own.
   - Recommendation: Use `SupplierCategory[]` array field on Supplier. Define the Prisma enum now. Phase 8 planning should reference `SupplierCategory` explicitly.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Framework          | Jest (backend) + Vitest (frontend)                                      |
| Config file        | `apps/backend/jest.config.js` / `apps/frontend/vite.config.ts`          |
| Quick run command  | `cd apps/backend && npx jest --testPathPattern=suppliers --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage`                             |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                 | Test Type      | Automated Command                                          | File Exists? |
| ------- | -------------------------------------------------------- | -------------- | ---------------------------------------------------------- | ------------ |
| FORN-01 | POST /api/org/suppliers creates supplier with valid CNPJ | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "should create"`     | ❌ Wave 0    |
| FORN-01 | POST returns 409 on duplicate document                   | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "duplicate"`         | ❌ Wave 0    |
| FORN-01 | PATCH /api/org/suppliers/:id updates status              | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "should update"`     | ❌ Wave 0    |
| FORN-01 | POST /api/org/suppliers/:id/ratings creates rating       | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "should add rating"` | ❌ Wave 0    |
| FORN-02 | POST /import/preview returns valid+invalid rows          | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "preview"`           | ❌ Wave 0    |
| FORN-02 | POST /import/execute skips existing CNPJs                | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "execute.*skip"`     | ❌ Wave 0    |
| FORN-02 | GET /export/csv returns UTF-8 BOM CSV                    | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "csv"`               | ❌ Wave 0    |
| FORN-02 | GET /export/pdf returns application/pdf                  | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "pdf"`               | ❌ Wave 0    |
| FORN-02 | supplier-file-parser parses CSV correctly                | unit (parser)  | `npx jest supplier-file-parser.spec.ts`                    | ❌ Wave 0    |
| FORN-03 | GET /top3 returns top 3 suppliers by category            | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "top3"`              | ❌ Wave 0    |
| FORN-03 | Rating average computed correctly (4 criteria)           | unit (service) | `npx jest suppliers.service.spec.ts -t "average"`          | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern=suppliers --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/suppliers/suppliers.routes.spec.ts` — covers FORN-01, FORN-02, FORN-03
- [ ] `apps/backend/src/modules/suppliers/supplier-file-parser.spec.ts` — covers import parsing
- No framework install needed — Jest already configured at `apps/backend/jest.config.js`

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection — `apps/backend/src/modules/animals/animal-file-parser.ts` — ExcelJS + manual CSV pattern
- Direct code inspection — `apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` — PDFKit streaming pattern
- Direct code inspection — `apps/backend/src/shared/utils/document-validator.ts` — CNPJ/CPF validation
- Direct code inspection — `apps/backend/src/modules/producers/producers.types.ts` + `schema.prisma` lines 679-813 — Producer/ProducerDocument model reference
- Direct code inspection — `apps/backend/src/shared/rbac/permissions.ts` — permission module/action pattern
- Direct code inspection — `apps/frontend/src/components/layout/Sidebar.tsx` — sidebar group structure
- Direct code inspection — `apps/backend/src/app.ts` — route registration pattern
- Direct code inspection — `apps/frontend/src/App.tsx` — lazy route registration pattern

### Secondary (MEDIUM confidence)

- `apps/backend/package.json` — confirmed multer ^2.1.0, pdfkit ^0.17.2, @types/multer installed
- `.planning/phases/07-cadastro-de-fornecedores/07-CONTEXT.md` — locked decisions and established patterns

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified in package.json and actively used
- Architecture: HIGH — direct pattern reuse from Producer and animal-import modules, both fully inspected
- Pitfalls: HIGH — derived from code inspection, not speculation
- Rating system: MEDIUM — pattern is clear but `groupBy` performance at scale not stress-tested (low risk for expected data volume of 10-100 suppliers per org)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable dependencies, no fast-moving parts)
