# Phase 30: Segurança do Trabalho Rural (NR-31) — Research

**Researched:** 2026-03-26
**Domain:** Occupational health & safety compliance (NR-31), EPI stock integration, training records, ASO management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Decision 1: Controle de EPIs**
- EPI é um Product existente com `category = 'EPI'`
- Tabela adicional `EpiProduct` vinculada ao `Product` com campos específicos: `caNumber`, `caExpiry`, `epiType` (enum: CAPACETE, LUVA, BOTA, OCULOS, PROTETOR_AURICULAR, MASCARA, AVENTAL, CINTO, PERNEIRA, OUTROS)
- Saída de estoque via `StockOutput` existente (type = `CONSUMPTION`)
- Tabela `EpiDelivery`: date, employeeId, epiProductId, quantity, reason (enum: NOVO, TROCA, DANIFICADO, EXTRAVIO), signatureUrl (upload imagem assinatura, opcional), observations, stockOutputId
- Baixa automática no estoque via criação de `StockOutput` + `StockOutputItem` ao registrar entrega
- Upload de assinatura: mesmo padrão `uploads/employees/{employeeId}/epi/`
- Tabela `PositionEpiRequirement`: positionId + epiProductId + quantity
- Alerta automático quando colaborador da função não tem EPI válido (entregue e CA não vencido)
- Compliance = colaborador tem todas as entregas ativas para os EPIs obrigatórios de sua Position
- PDF individual por colaborador (padrão NR-6) via pdfkit
- Endpoint: `GET /api/epi-deliveries/employees/:employeeId/pdf`

**Decision 2: Treinamentos NR-31**
- Todos os obrigatórios NR-31 pré-cadastrados via seed (7 tipos)
- `TrainingType`: name, description, minHours, defaultValidityMonths, nrReference, isSystem, isGlobal
- `PositionTrainingRequirement`: positionId + trainingTypeId
- `TrainingRecord`: date, trainingTypeId, instructorName, instructorType (INTERNO/EXTERNO), instructorRegistration, effectiveHours, location, observations, certificateUrl, attendanceListUrl, farmId, organizationId
- `EmployeeTrainingRecord`: trainingRecordId + employeeId + expiresAt (date + validityMonths)
- Certificado PDF por participante via pdfkit
- Endpoint: `GET /api/training-records/:id/employees/:employeeId/certificate`

**Decision 3: ASO e PCMSO**
- `AsoType` enum: ADMISSIONAL, PERIODICO, RETORNO_TRABALHO, MUDANCA_RISCO, DEMISSIONAL
- `MedicalExam`: employeeId, type (AsoType), date, doctorName, doctorCrm, result (APTO, INAPTO, APTO_COM_RESTRICAO), restrictions, nextExamDate, documentUrl, observations, farmId, organizationId
- Alerta, não bloqueante: dashboard mostra pendência
- Campo `asoPeriodicityMonths` na tabela `Position` (default: 12)
- Alertas: Amarelo 30d antes, Vermelho 15d antes, Vencido após nextExamDate

**Decision 4: Dashboard e Relatórios**
- Rota: `/safety-dashboard`
- Grupo SEGURANÇA no sidebar, abaixo de RH/Folha, ícone `Shield`
- Sub-itens: EPIs, Treinamentos, ASOs, Dashboard NR-31
- Endpoints relatórios: `GET /api/safety-compliance/report/csv`, `.../report/pdf`

**Módulos backend (novos):**
1. `modules/epi-products/`
2. `modules/epi-deliveries/`
3. `modules/training-types/`
4. `modules/training-records/`
5. `modules/medical-exams/`
6. `modules/safety-compliance/`

**Páginas frontend (novas):**
1. `EpiProductsPage`, `EpiDeliveriesPage`, `TrainingTypesPage`, `TrainingRecordsPage`, `MedicalExamsPage`, `SafetyDashboardPage`

### Deferred Ideas (OUT OF SCOPE)
- PPRA/PGR
- CIPA rural (eleição e gestão da comissão)
- Integração com eSocial (eventos S-2220, S-2240)
- Mapa de risco
- Confirmação mobile de recebimento de EPI
- Exames complementares como sub-registros do ASO
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEGUR-01 | Gerente controla EPIs: cadastro com CA e validade, ficha de entrega por colaborador com data/tipo/assinatura, alertas de vencimento CA e troca, alertas de EPIs obrigatórios por função, controle de estoque, ficha impressa PDF e relatório de conformidade | EpiProduct extends Product (category='EPI'); EpiDelivery with StockOutput integration; PositionEpiRequirement for compliance; pdfkit for PDF |
| SEGUR-02 | Técnico gerencia treinamentos obrigatórios NR-31 com registro, validade, alerta de reciclagem 30 dias antes, certificado PDF, matriz de conformidade | TrainingType (seed) + TrainingRecord + EmployeeTrainingRecord; pdfkit for certificate; compliance query by position |
| SEGUR-03 | Gerente controla ASOs por tipo com registro, periodicidade, alerta vencimento 30 dias, upload ASO digitalizado, integração com admissão/rescisão e relatório de conformidade | MedicalExam model; asoPeriodicityMonths on Position; alert thresholds 30d/15d; DocumentType enum extension |
</phase_requirements>

---

## Summary

Phase 30 builds a complete NR-31 occupational safety compliance module on top of the established HR foundation from Phase 25. The phase creates six new backend modules and six frontend pages, all following patterns already proven in the codebase: stock management (stock-outputs), alert systems (stock-alerts), PDF generation (pesticide-prescriptions), and compliance dashboards (sanitary-dashboard).

The key design insight is that EPIs are Products with `category = 'EPI'` and an extended `EpiProduct` table — this reuses the entire stock entry/output/alert pipeline without duplication. Training records follow the collective-session pattern where one `TrainingRecord` links to N `EmployeeTrainingRecord` rows, mirroring how vaccination records work in the veterinary modules. ASO management extends the existing `DocumentType` enum and adds `asoPeriodicityMonths` to the `Position` model.

The compliance engine (safety-compliance module) is a read-only aggregation layer that joins EPI deliveries, training records, and ASOs per employee to compute conformidade status. No new business logic is needed — it queries existing tables with date arithmetic.

**Primary recommendation:** Implement in migration order: schema migration first (new tables + Position field addition), then modules in dependency order (epi-products → epi-deliveries → training-types → training-records → medical-exams → safety-compliance), then frontend pages, then seed data for NR-31 training types.

---

## Standard Stack

### Core — All already installed, no new dependencies needed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfkit | 0.17.2 | PDF generation for EPI ficha, training certificate, compliance report | Already used in pesticide-prescriptions module |
| multer | in deps | File uploads for signatures, certificates, ASO scans | Already used in employees module |
| Prisma 7 | in deps | ORM for all new models | Project standard |
| Express 5 | in deps | Route handling | Project standard |
| Jest 29 | in deps | Backend unit/route tests | Project standard |
| Vitest | in deps | Frontend component tests | Project standard |

**No new npm dependencies required for Phase 30.** All necessary libraries are already present.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Module Structure

Each backend module follows the collocated pattern established in Phase 25+:

```
modules/epi-products/
  epi-products.routes.ts       # Express Router, auth + permission middleware
  epi-products.routes.spec.ts  # Jest routes test (supertest + mocked service)
  epi-products.service.ts      # Business logic with withRlsContext
  epi-products.types.ts        # Input/Output interfaces, Error class, constants

modules/epi-deliveries/
  epi-deliveries.routes.ts
  epi-deliveries.routes.spec.ts
  epi-deliveries.service.ts    # createDelivery triggers StockOutput creation
  epi-deliveries.types.ts

modules/training-types/
  training-types.routes.ts
  training-types.routes.spec.ts
  training-types.service.ts    # includes seed function for NR-31 types
  training-types.types.ts

modules/training-records/
  training-records.routes.ts
  training-records.routes.spec.ts
  training-records.service.ts  # generateCertificatePdf uses pdfkit
  training-records.types.ts

modules/medical-exams/
  medical-exams.routes.ts
  medical-exams.routes.spec.ts
  medical-exams.service.ts
  medical-exams.types.ts

modules/safety-compliance/
  safety-compliance.routes.ts
  safety-compliance.routes.spec.ts
  safety-compliance.service.ts # aggregates EPI + training + ASO compliance
  safety-compliance.types.ts
```

### Frontend page structure (pattern from EmployeesPage):

```
pages/
  EpiProductsPage.tsx + .css
  EpiDeliveriesPage.tsx + .css
  TrainingTypesPage.tsx + .css
  TrainingRecordsPage.tsx + .css
  MedicalExamsPage.tsx + .css
  SafetyDashboardPage.tsx + .css

hooks/
  useEpiProducts.ts
  useEpiDeliveries.ts
  useTrainingTypes.ts
  useTrainingRecords.ts
  useMedicalExams.ts
  useSafetyCompliance.ts

types/
  epi.ts          # EpiProduct, EpiDelivery, PositionEpiRequirement types
  training.ts     # TrainingType, TrainingRecord, EmployeeTrainingRecord types
  medical-exam.ts # MedicalExam, AsoType types
  safety.ts       # SafetyDashboard, ComplianceSummary types
```

### Pattern 1: EpiDelivery triggers StockOutput (reuse existing service)

The `createEpiDelivery` function must call `createStockOutput` from the stock-outputs service inside the same transaction. This is the same pattern used by `pesticide-prescriptions` (links to `stockOutputId`) and by `PesticideApplication` (triggers stock deduction).

**Key constraint from CONTEXT.md:** The EpiDelivery has a `stockOutputId` field that links to the auto-created StockOutput. The StockOutput type is `CONSUMPTION`.

```typescript
// Source: modules/stock-outputs/stock-outputs.service.ts pattern
export async function createEpiDelivery(
  ctx: RlsContext,
  input: CreateEpiDeliveryInput,
): Promise<EpiDeliveryOutput> {
  return withRlsContext(ctx, async (tx) => {
    // 1. Verify EpiProduct exists and belongs to org
    // 2. Create StockOutput with type CONSUMPTION
    const stockOutput = await tx.stockOutput.create({
      data: {
        organizationId: ctx.organizationId,
        type: 'CONSUMPTION',
        outputDate: new Date(input.date),
        responsibleName: input.employeeName,
        notes: `EPI entregue ao colaborador`,
        status: 'CONFIRMED',
        items: {
          create: [{
            productId: input.epiProductId,
            quantity: input.quantity,
            unitCost: 0, // resolved from StockBalance averageCost
          }]
        }
      }
    });
    // 3. Update StockBalance (same as stock-outputs.service)
    // 4. Create EpiDelivery linking stockOutputId
    const delivery = await tx.epiDelivery.create({ data: { ...input, stockOutputId: stockOutput.id } });
    return mapDelivery(delivery);
  });
}
```

### Pattern 2: PDF generation (reuse pdfkit — pesticide-prescriptions pattern)

```typescript
// Source: modules/pesticide-prescriptions/pesticide-prescriptions.service.ts line 370
export async function generateEpiFichaPdf(
  ctx: RlsContext,
  employeeId: string,
): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default; // dynamic import, verified working
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    // ... build PDF content
    doc.end();
  });
}
```

Route responds with:
```typescript
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="ficha-epi-${employeeId}.pdf"`);
const buffer = await generateEpiFichaPdf(ctx, employeeId);
res.send(buffer);
```

### Pattern 3: Compliance engine query

The safety-compliance module runs three separate queries and merges results by `employeeId`:

```typescript
// 1. EPI compliance: for each employee, check PositionEpiRequirement vs active EpiDeliveries
//    "active" = CA not expired AND delivery not superseded by newer delivery of same type
// 2. Training compliance: for each employee, check PositionTrainingRequirement (+ isGlobal types)
//    vs EmployeeTrainingRecord where expiresAt > now
// 3. ASO compliance: for each employee, latest MedicalExam per type + nextExamDate vs now
//    (alert threshold: 30d = YELLOW, 15d = RED, past = EXPIRED)
```

### Pattern 4: Seed data for TrainingTypes

Use Prisma seed file (or a dedicated seed function called once from the migration or a seed script):

```typescript
// Called from prisma/seed.ts or a dedicated seed route
const NR31_TRAINING_TYPES = [
  { name: 'Integração', nrReference: 'NR-31.7', minHours: 8, defaultValidityMonths: 12, isSystem: true, isGlobal: true },
  { name: 'Agrotóxicos', nrReference: 'NR-31.8', minHours: 20, defaultValidityMonths: 12, isSystem: true, isGlobal: false },
  { name: 'Máquinas e Implementos', nrReference: 'NR-31.12', minHours: 16, defaultValidityMonths: 24, isSystem: true, isGlobal: false },
  { name: 'Instalações Elétricas', nrReference: 'NR-31.9', minHours: 40, defaultValidityMonths: 24, isSystem: true, isGlobal: false },
  { name: 'Transporte de Trabalhadores', nrReference: 'NR-31.13', minHours: 8, defaultValidityMonths: 12, isSystem: true, isGlobal: false },
  { name: 'Trabalho em Altura', nrReference: 'NR-35', minHours: 8, defaultValidityMonths: 24, isSystem: true, isGlobal: false },
  { name: 'CIPA Rural', nrReference: 'NR-31.7.3', minHours: 20, defaultValidityMonths: 12, isSystem: true, isGlobal: false },
];
// Use upsert to be idempotent
await prisma.trainingType.upsert({ where: { organizationId_name: ... }, create: ..., update: {} });
```

**Important:** TrainingTypes with `isSystem = true` must be seeded per-organization (organizationId scoped) to work with RLS, OR as global reference records if organization-agnostic. Decision: seed per-organization on first use, or use a special system organizationId. **Recommended approach:** Seed globally with a special `isSystem = true` flag and no `organizationId`, then query via `WHERE isSystem = true OR organizationId = ?`. This avoids N inserts on organization creation. **Alternative (simpler):** Keep them org-scoped but seed during `POST /organizations` creation. Check what Phase 25 did for initial data — but the simplest is: seed once at global level with a separate query.

Actually, reviewing the CONTEXT.md: `TrainingType` has `isSystem` (seed = true, não editável) and no mention of `organizationId` being required. This suggests TrainingTypes may be global (not org-scoped). Verify when writing the schema migration.

### Pattern 5: Alert severity computation

```typescript
function classifyExpiryAlert(nextDate: Date, today: Date): 'OK' | 'YELLOW' | 'RED' | 'EXPIRED' {
  const daysUntil = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil <= 15) return 'RED';
  if (daysUntil <= 30) return 'YELLOW';
  return 'OK';
}
```

### Anti-Patterns to Avoid

- **Do not call `createStockOutput` service function directly inside `createEpiDelivery` transaction** — use raw `tx.stockOutput.create()` + balance update to avoid nested `withRlsContext` deadlocks (this is the established pattern from Phase 25 STATE.md: "tx.payable.create used directly in transactions")
- **Do not create a separate StockBalance table for EPIs** — EPIs are Products, they share the existing `stock_balances` table via `productId`
- **Do not make admission/termination flows throw errors** for missing ASO — CONTEXT.md explicitly says "Alerta, não bloqueante"
- **Do not build position compliance check as a separate real-time validator** — compute on dashboard load, not on employee assignment

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stock deduction on EPI delivery | Custom inventory logic | `tx.stockBalance` update + `tx.stockOutputItem` (same as stock-outputs.service) | FEFO, cost averaging already handled |
| PDF generation | HTML-to-PDF converter | `pdfkit` (already installed, proven pattern in pesticide-prescriptions) | No new dep, Buffer streaming works |
| File uploads for signatures/ASO scans | Custom file handler | `multer` diskStorage (same pattern as employees module, `uploads/employees/{orgId}/{employeeId}/...`) | Consistent path, auth middleware already serves static files |
| Date arithmetic for validity | Custom date library | Native JS Date math (same pattern as Phase 29 `calcPaymentDueDate`) | No new dep needed for simple day calculations |
| Alert thresholds | Custom notification engine | Simple query-time computation in compliance service (same as stock-alerts) | No queue or cron needed for dashboard display |

---

## Schema Migration

### New Prisma Models Required

Migration number: `20260507100000_add_safety_nr31_models`

**New enums:**
```sql
CREATE TYPE "EpiType" AS ENUM ('CAPACETE', 'LUVA', 'BOTA', 'OCULOS', 'PROTETOR_AURICULAR', 'MASCARA', 'AVENTAL', 'CINTO', 'PERNEIRA', 'OUTROS');
CREATE TYPE "EpiDeliveryReason" AS ENUM ('NOVO', 'TROCA', 'DANIFICADO', 'EXTRAVIO');
CREATE TYPE "InstructorType" AS ENUM ('INTERNO', 'EXTERNO');
CREATE TYPE "AsoType" AS ENUM ('ADMISSIONAL', 'PERIODICO', 'RETORNO_TRABALHO', 'MUDANCA_RISCO', 'DEMISSIONAL');
CREATE TYPE "AsoResult" AS ENUM ('APTO', 'INAPTO', 'APTO_COM_RESTRICAO');
```

**New tables:**
- `epi_products` — extends Product (FK productId, caNumber, caExpiry, epiType)
- `epi_deliveries` — employee EPI receipt records
- `position_epi_requirements` — EPI requirements per Position
- `training_types` — NR-31 training catalog (system + custom)
- `training_records` — training session records
- `employee_training_records` — per-employee attendance + expiry
- `position_training_requirements` — training requirements per Position
- `medical_exams` — ASO records

**Modifications to existing tables:**
- `positions`: add `asoPeriodicityMonths INT DEFAULT 12`
- `products`: add relation to `epi_products` (one-to-one, optional)
- `DocumentType` enum: add `FICHA_EPI`, `CERTIFICADO_TREINAMENTO` values (optional — only if uploading these docs via EmployeeDocument; may not be needed since EpiDelivery and TrainingRecord have their own URL fields)

**Important:** The `DocumentType` enum already has `ASO` value — `MedicalExam.documentUrl` stores the scanned ASO directly, no `EmployeeDocument` row needed for ASOs.

### Migration strategy

Use the established `prisma db push` + `prisma migrate resolve` pattern (same as Phase 25 and 26 — shadow DB out of sync, manually write SQL and mark applied).

---

## Common Pitfalls

### Pitfall 1: TrainingType global vs org-scoped
**What goes wrong:** If `training_types` table has `organizationId NOT NULL`, then system types must be seeded for every organization. If new orgs are created after Phase 30 deployment, they won't have the 7 NR-31 training types.
**Why it happens:** RLS assumes all records are org-scoped.
**How to avoid:** Make `organizationId` nullable on `training_types`. System types have `organizationId = NULL` and are visible to all orgs. Custom types have `organizationId = org-id`. Query: `WHERE isSystem = true OR organizationId = $orgId`.
**Warning signs:** Training types missing for new organizations after deployment.

### Pitfall 2: EpiDelivery stock deduction nested transaction
**What goes wrong:** Calling `createStockOutput()` service function inside `withRlsContext()` creates nested Prisma transactions, causing deadlocks.
**Why it happens:** `withRlsContext` sets RLS parameters in the transaction; nesting creates a second transaction with its own SET LOCAL.
**How to avoid:** Use raw `tx.stockOutput.create()` + `tx.stockBalance.update()` inside the outer `withRlsContext` callback directly (same pattern documented in STATE.md for payables).
**Warning signs:** Intermittent 500 errors on EPI delivery creation under load.

### Pitfall 3: CA expiry vs delivery validity conflation
**What goes wrong:** Treating EPI as non-compliant when the CA is expired, even if the employee already has the physical EPI.
**Why it happens:** `caExpiry` is the Certificado de Aprovação expiry (regulatory), not the EPI's physical lifespan.
**How to avoid:** Two separate alerts: (a) CA vencido = regulatory alert for procurement (the product's CA needs renewal), (b) EPI sem entrega = compliance alert for the employee. The EPI physically delivered remains valid even if the CA expires for new purchases.
**Warning signs:** All existing EPI deliveries showing as non-compliant after CA expiry date.

### Pitfall 4: PositionEpiRequirement populated at enrollment time
**What goes wrong:** Compliance check fails for employees who have EPIs delivered but whose position EPI requirements were added after the deliveries.
**Why it happens:** Compliance check joins deliveries against requirements; old deliveries predate the requirement records.
**How to avoid:** Compliance check uses delivery date vs requirement creation date — or simply checks current state (employee has delivery, requirement exists now). The simpler approach is: compliance = employee currently has at least `quantity` units delivered and CA not expired. Do not check that delivery happened after requirement was added.
**Warning signs:** Long-tenured employees showing as non-compliant even with full EPI history.

### Pitfall 5: `req.params` cast in Express 5
**What goes wrong:** TypeScript error `string | string[]` if `req.params.employeeId` is used without cast.
**Why it happens:** Express 5 params type changed (documented in CLAUDE.md).
**How to avoid:** Always `const employeeId = req.params.employeeId as string` — never destructure.
**Warning signs:** TypeScript compiler errors in routes.

### Pitfall 6: Sidebar group ordering
**What goes wrong:** SEGURANÇA group appears before or mixed with RH group.
**Why it happens:** Sidebar.tsx has a static array of groups; insertion position matters.
**How to avoid:** Insert the SEGURANÇA group after the RH group (after `payroll-provisions` item), before the CONFIGURAÇÃO group. Verify `Shield` is imported from `lucide-react` in Sidebar.tsx — it is already imported (used for Papéis item), but assigned a different icon constant; use a distinct icon like `ShieldCheck` or `HardHat` to avoid confusion with the CONFIGURAÇÃO/Papéis `Shield` icon.

---

## Code Examples

### Route handler pattern (verified from stock-alerts.routes.ts)

```typescript
// Source: modules/stock-alerts/stock-alerts.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { checkPermission } from '../../middleware/check-permission';
import type { RlsContext } from '../../database/rls';

export const epiProductsRouter = Router();

function buildRlsContext(req: import('express').Request): RlsContext {
  const organizationId = req.user!.organizationId;
  if (!organizationId) throw new EpiProductError('Acesso negado', 403);
  return { organizationId };
}

epiProductsRouter.get(
  '/api/epi-products',
  authenticate,
  checkPermission('farms', 'read'),
  async (req, res) => {
    try {
      const ctx = buildRlsContext(req);
      const result = await listEpiProducts(ctx, req.query);
      res.json(result);
    } catch (err) {
      handleError(err, res);
    }
  },
);
```

### Frontend hook pattern (verified from useStockAlerts.ts)

```typescript
// Source: hooks/useStockAlerts.ts — useState+useCallback pattern (no SWR)
export function useEpiProducts() {
  const [epiProducts, setEpiProducts] = useState<EpiProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEpiProducts = useCallback(async (params?: ListEpiProductsParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      // ... build params
      const data = await api.get<{ data: EpiProduct[]; total: number }>(`/epi-products?${searchParams}`);
      setEpiProducts(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar EPIs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { epiProducts, isLoading, error, fetchEpiProducts };
}
```

### Sidebar group insertion (verified from Sidebar.tsx lines 252-266)

Insert after line 266 (closing `}` of RH group), before line 268 (CONFIGURAÇÃO group):

```typescript
// New SEGURANÇA group — insert after RH group
{
  title: 'SEGURANÇA',
  items: [
    { to: '/epi-products', icon: HardHat, label: 'EPIs' },
    { to: '/epi-deliveries', icon: ClipboardCheck, label: 'Entregas de EPI' },
    { to: '/training-types', icon: GraduationCap, label: 'Tipos de Treinamento' },
    { to: '/training-records', icon: BookOpen, label: 'Treinamentos' },
    { to: '/medical-exams', icon: Stethoscope, label: 'ASOs' },
    { to: '/safety-dashboard', icon: ShieldCheck, label: 'Dashboard NR-31' },
  ],
},
```

**Note:** `HardHat`, `ClipboardCheck`, `GraduationCap`, `BookOpen` icons must be imported from `lucide-react`. `Stethoscope` already imported (line 263 uses it for Afastamentos). `ShieldCheck` already imported (line 3 of AppLayout.tsx, but must be added to Sidebar.tsx imports too).

---

## Reuse Map

| Asset | Location | How to Reuse |
|-------|----------|--------------|
| `withRlsContext` + `RlsContext` | `src/database/rls.ts` | Import in all 6 new service files |
| `StockOutput`/`StockOutputItem` Prisma models | `prisma/schema.prisma` | `tx.stockOutput.create()` in `createEpiDelivery` |
| `StockBalance` update logic | `modules/stock-outputs/stock-outputs.service.ts` (deductFromBalance function) | Copy the balance-update transaction pattern — do NOT import the function to avoid nested tx |
| `multer` diskStorage pattern | `modules/employees/employees.routes.ts` lines 81-91 | Same pattern for EPI signature uploads and training certificate uploads |
| pdfkit PDF generation | `modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` lines 363-440 | Dynamic import, Buffer stream, same page structure |
| `authenticate` + `checkPermission` middleware | `src/middleware/` | Same as all other routes |
| `buildRlsContext` helper | Any existing routes file | Copy per-module (same 4-line pattern used everywhere) |
| `FarmContext` (`useFarmContext`) | `stores/FarmContext.tsx` | Import in SafetyDashboardPage for farm filter |
| `ConfirmModal` / `ConfirmDeleteModal` | `components/ui/ConfirmModal` | Use `variant="danger"` for EPI delivery cancellation (if needed) |
| `DocumentType.ASO` enum value | `prisma/schema.prisma` line 7619 | Already exists — `MedicalExam.documentUrl` stores file path directly, no new DocumentType needed |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express 4 params as `string` | Express 5 params as `string \| string[]` | Phase 25 migration | Must cast `as string` — CLAUDE.md mandatory rule |
| Flat StockBalance updates | FEFO + weighted average cost tracking | Phase 26 | EPI deliveries consume from FEFO-ordered batches automatically |
| Global seed data without org scope | Org-scoped data with isSystem flag (or nullable orgId) | Design decision for this phase | TrainingTypes need special handling |
| Blocking validations on HR flows | Alert-only validations for compliance items | Phase 25 design | ASO/EPI missing = warning, not HTTP 400 |

---

## Open Questions

1. **TrainingType organization scoping**
   - What we know: CONTEXT.md shows TrainingType with `isSystem` flag but no explicit `organizationId` mention
   - What's unclear: Should system training types be org-scoped or global (NULL organizationId)?
   - Recommendation: Make `organizationId` nullable; system types have NULL and are visible to all orgs. This is the simplest approach for multi-tenant and avoids seeding per organization.

2. **EPI Compliance definition — "active" delivery**
   - What we know: Compliance = employee has all EPIs for their position, CA not expired
   - What's unclear: If employee receives 2 pairs of gloves (NOVO + TROCA), does the TROCA supersede the NOVO? Is "active" the most recent delivery of each epiProductId?
   - Recommendation: Active = most recent delivery per `epiProductId` per employee. If that delivery's EpiProduct has `caExpiry > today`, the employee is compliant for that EPI.

3. **Seed execution timing**
   - What we know: Phase 25+ uses manual SQL migrations, not `prisma migrate dev`
   - What's unclear: Where should TrainingType seed run? In the migration SQL or in a separate `prisma/seed.ts`?
   - Recommendation: Use a dedicated seed endpoint (`POST /api/training-types/seed`) called once by the planner task, guarded by `isSystem` check. Simpler than modifying the global seed.ts.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all libraries already installed, no new services required).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + @swc/jest |
| Config file | `apps/backend/jest.config.ts` |
| Quick run command | `cd apps/backend && npx jest modules/epi-products --testPathPattern=epi-products --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEGUR-01 | Create EpiProduct (extends Product) | unit | `npx jest modules/epi-products --no-coverage` | Wave 0 |
| SEGUR-01 | Create EpiDelivery triggers StockOutput | unit | `npx jest modules/epi-deliveries --no-coverage` | Wave 0 |
| SEGUR-01 | EPI compliance check per employee/position | unit | `npx jest modules/safety-compliance --no-coverage` | Wave 0 |
| SEGUR-01 | Generate EPI ficha PDF | unit | `npx jest modules/epi-deliveries --no-coverage` | Wave 0 |
| SEGUR-02 | Create TrainingType (system + custom) | unit | `npx jest modules/training-types --no-coverage` | Wave 0 |
| SEGUR-02 | Register training record with attendees | unit | `npx jest modules/training-records --no-coverage` | Wave 0 |
| SEGUR-02 | Training expiry alert 30 days | unit | `npx jest modules/safety-compliance --no-coverage` | Wave 0 |
| SEGUR-02 | Generate training certificate PDF | unit | `npx jest modules/training-records --no-coverage` | Wave 0 |
| SEGUR-03 | Create MedicalExam (ASO) | unit | `npx jest modules/medical-exams --no-coverage` | Wave 0 |
| SEGUR-03 | ASO expiry alerts (30d/15d/expired) | unit | `npx jest modules/medical-exams --no-coverage` | Wave 0 |
| SEGUR-03 | Safety compliance dashboard aggregation | unit | `npx jest modules/safety-compliance --no-coverage` | Wave 0 |
| SEGUR-03 | Report CSV export | unit | `npx jest modules/safety-compliance --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/backend && npx jest modules/epi-products modules/epi-deliveries modules/training-types modules/training-records modules/medical-exams modules/safety-compliance --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/modules/epi-products/epi-products.routes.spec.ts` — covers SEGUR-01 EPI CRUD
- [ ] `apps/backend/src/modules/epi-deliveries/epi-deliveries.routes.spec.ts` — covers SEGUR-01 delivery + stock deduction
- [ ] `apps/backend/src/modules/training-types/training-types.routes.spec.ts` — covers SEGUR-02 type management
- [ ] `apps/backend/src/modules/training-records/training-records.routes.spec.ts` — covers SEGUR-02 record + certificate
- [ ] `apps/backend/src/modules/medical-exams/medical-exams.routes.spec.ts` — covers SEGUR-03 ASO
- [ ] `apps/backend/src/modules/safety-compliance/safety-compliance.routes.spec.ts` — covers dashboard + reports

*(All spec files follow the exact pattern of `stock-alerts.routes.spec.ts` — supertest + jest.mock(service) + jest.mock(auth) + authAs helper)*

---

## Project Constraints (from CLAUDE.md)

The following directives apply to all Phase 30 work:

| Constraint | Applies To |
|------------|------------|
| `req.params.id as string` — never destructure params | All 6 route files |
| Prisma enums typed with `as const` or imported enum — never `: string` | EpiType, EpiDeliveryReason, InstructorType, AsoType, AsoResult in service mappers |
| `select: { field: true }` field names must match schema exactly | All Prisma queries — verify against schema before writing |
| `Decimal.max(a, b)` static, not instance method | Any Decimal arithmetic in compliance calculations |
| Frontend types must mirror backend — create in `src/types/` | epi.ts, training.ts, medical-exam.ts, safety.ts |
| `null` (Prisma) vs `undefined` (frontend input) | Optional fields in all new type interfaces |
| Modal pattern for create/edit forms — never dedicated page | All 6 new pages use modals for create/edit |
| `window.confirm()` forbidden — use `ConfirmModal` | EPI delivery cancellation if implemented |
| Design system colors via CSS custom properties — no hardcoded hex | All new `.css` files |
| Touch targets minimum 48x48px | All action buttons in new pages |
| Lucide icons for all UI icons | HardHat, ClipboardCheck, GraduationCap, BookOpen, Stethoscope, ShieldCheck |
| Breadcrumb on every web page | All 6 new pages |
| Empty state with illustration + CTA | All 6 new pages |
| `ConfirmModal` with `variant="danger"` for destructive actions | Any delete/cancel in new pages |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `apps/backend/src/modules/pesticide-prescriptions/` — pdfkit pattern
- Direct codebase inspection — `apps/backend/src/modules/stock-outputs/` — StockOutput + StockBalance pattern
- Direct codebase inspection — `apps/backend/src/modules/stock-alerts/` — alert threshold + routes.spec pattern
- Direct codebase inspection — `apps/backend/src/modules/employees/` — multer diskStorage pattern
- Direct codebase inspection — `apps/backend/prisma/schema.prisma` — Product, Employee, Position, EmployeeDocument models
- Direct codebase inspection — `apps/frontend/src/components/layout/Sidebar.tsx` — RH group location (line 253)
- Direct codebase inspection — `apps/frontend/src/hooks/useStockAlerts.ts` — useState+useCallback hook pattern
- Direct codebase inspection — `.planning/STATE.md` — "tx.payable.create used directly in transactions" pattern (no nested withRlsContext)
- Direct codebase inspection — `apps/backend/package.json` — pdfkit 0.17.2 already installed

### Secondary (MEDIUM confidence)
- CONTEXT.md — locked decisions from discuss-phase session (treated as HIGH within scope)
- REQUIREMENTS.md — SEGUR-01/02/03 acceptance criteria

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed in package.json
- Architecture: HIGH — all patterns confirmed by direct codebase inspection
- Schema design: HIGH — existing models inspected, new models follow established patterns
- Pitfalls: HIGH — sourced from STATE.md decisions and direct code patterns
- Training type org-scoping: MEDIUM — open question, recommendation provided

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (stable codebase, no external dependencies)
