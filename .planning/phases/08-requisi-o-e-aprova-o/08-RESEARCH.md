# Phase 8: Requisição e Aprovação - Research

**Researched:** 2026-03-17
**Domain:** Purchase Request (RC) creation, approval workflow, in-app notifications, mobile offline RC
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Formulário da RC (web)**

- Modal grande full-width com seções: Dados Gerais, Itens (tabela editável), Anexos
- Itens: autocomplete busca no catálogo de produtos (EPIC-10) com fallback para descrição livre. Itens do catálogo vêm com unidade de medida; descrição livre pede unidade manual
- Uma fazenda por RC — para comprar para 2 fazendas, criar 2 RCs
- Campos obrigatórios: tipo (enum compartilhado com categorias de fornecedor — Phase 7), fazenda, pelo menos 1 item, urgência
- Campos opcionais: justificativa, centro de custo, data de necessidade, anexos (drag & drop)
- Urgência com 3 níveis: Normal (sem SLA), Urgente (aprovação em 24h), Emergencial (aprovação em 4h). Emergencial exige justificativa obrigatória
- Número sequencial automático: RC-YYYY/NNNN por organização (padrão getNextSequentialNumber em transação Prisma)

**RC simplificada mobile**

- Campos: produto (autocomplete ou texto livre), quantidade, urgência, foto (câmera), observação
- Fazenda vem do contexto do usuário logado
- Geolocalização automática capturada no momento da criação
- Centro de custo NÃO é preenchido pelo operador de campo
- Funciona 100% offline: catálogo de produtos sincronizado como reference data. RC salva local, entra na fila de sync (offline-queue.ts). Sem cache de catálogo, fallback para texto livre
- Tela "Minhas Requisições" com lista de RCs, badge de status (Pendente/Aprovada/Rejeitada), filtro por status

**Fluxo de aprovação**

- Máquina de estados com 6 estados (padrão VALID_TRANSITIONS de checks.types.ts):
  - RASCUNHO → PENDENTE → APROVADA / REJEITADA / DEVOLVIDA
  - DEVOLVIDA → PENDENTE (resubmit com edição)
  - APROVADA → CANCELADA (antes de virar cotação na Phase 9)
- Configuração de alçadas por valor + tipo: regras onde gerente define faixas de valor → aprovador; acima → outro aprovador; aprovação dupla
- Aprovação dupla é sequencial: primeiro aprovador aprova → RC vai para segundo → segundo aprova → APROVADA. Qualquer um rejeitar → REJEITADA
- Delegação temporária: aprovador configura período (de/até) + substituto
- Aprovação via mobile: tela de pendências no app com ações aprovar/rejeitar/devolver

**Notificações**

- Canais: in-app (badge/sino no web) + push notification no mobile. Email postergado para fase futura
- Central de notificações: ícone de sino no header com contador de não-lidas. Click abre dropdown com últimas 20. Cada item: título, descrição curta, tempo relativo, link para RC. Marcar como lida ao clicar
- Eventos: RC aprovada, RC rejeitada (com motivo), RC devolvida (com motivo) → para solicitante; nova RC pendente, lembrete SLA → para aprovador

**Histórico de auditoria**

- Timeline vertical de eventos na ficha da RC
- Cada evento: ator, data/hora, ação, comentário opcional
- Comentário obrigatório ao rejeitar ou devolver. Opcional ao aprovar

### Claude's Discretion

- Design exato do skeleton loading
- Espaçamento e tipografia (seguindo design system)
- Empty state da listagem de RCs
- Layout exato da tela de configuração de alçadas
- Formato da timeline de auditoria (vertical left-aligned, etc.)
- Implementação técnica das push notifications (Expo Notifications setup)
- Modelo de dados da central de notificações (tabela Notification vs solução lightweight)

### Deferred Ideas (OUT OF SCOPE)

- Notificação por email
- Digest diário para aprovadores
- Configuração de preferências de notificação por canal
- SLA com escalação automática
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                                                             | Research Support                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQC-01 | Usuário pode criar RC com tipo, itens do catálogo ou descrição livre, quantidade, urgência, justificativa, centro de custo, fazenda, data de necessidade, anexos, e número sequencial automático        | Prisma schema design, getNextSequentialNumber pattern, multer for attachments, SUPPLIER_CATEGORIES enum reuse                                                                  |
| REQC-02 | Operador de campo pode criar RC simplificada via mobile com produto, quantidade, urgência, foto e observação, com geolocalização automática, funcionamento offline, e acompanhamento de status pelo app | offline-queue.ts pattern, reference-data-repository.ts for products cache, expo-image-picker (already installed), expo-location (already installed), OperationEntity extension |
| REQC-03 | Gerente pode configurar fluxo de aprovação por valor e por tipo, aprovar/rejeitar/devolver, notificação ao solicitante, aprovação via mobile, delegação temporária, SLA, e histórico para auditoria     | VALID_TRANSITIONS pattern, ApprovalRule/ApprovalAction schema design, Notification table, Expo Notifications (needs install), Redis for SLA job scheduling                     |

</phase_requirements>

---

## Summary

Phase 8 implements the purchase request (RC) module — the entry point of the Procure-to-Pay cycle. It has four distinct subsystems: (1) web RC form with multi-item editing and attachments, (2) mobile offline RC creation with photo/geo, (3) a configurable approval workflow with state machine, and (4) an in-app notification system with push delivery on mobile.

All subsystems build on well-established patterns already present in the codebase. The backend follows the collocated module pattern. The state machine follows `checks.types.ts` VALID_TRANSITIONS. Sequential numbering follows `getNextSequentialNumber` from pesticide-prescriptions. Mobile offline follows the `offline-queue.ts` + `reference-data-repository.ts` duo. The only genuinely new infrastructure needed is push notifications via Expo Notifications (not yet installed in the mobile app) and a Notification table in Prisma (the CONTEXT.md leaves model design as Claude's discretion).

**Primary recommendation:** Implement in five backend waves (models+migration, RC CRUD, approval rules, workflow transitions+audit, notifications) and three frontend waves (RC web page+modal, approval configuration, notification bell), with mobile RC creation as a focused standalone plan.

---

## Standard Stack

### Core

| Library           | Version  | Purpose                                              | Why Standard                                 |
| ----------------- | -------- | ---------------------------------------------------- | -------------------------------------------- |
| Prisma 7          | ^7.4.1   | ORM — new models PurchaseRequest, ApprovalRule, etc. | Already used throughout backend              |
| Express 5         | ^5.1.0   | HTTP router for new modules                          | Existing server                              |
| multer 2          | ^2.1.0   | File attachment upload (drag & drop)                 | Already used for supplier import, CSV import |
| ioredis           | ^5.9.3   | SLA reminder scheduling via Redis EXPIRE/TTL         | Already installed, used for rate-limit       |
| expo-image-picker | ~17.0.10 | Photo capture in mobile RC                           | Already installed                            |
| expo-location     | ~19.0.8  | Geolocation on mobile RC creation                    | Already installed                            |

### Supporting (needs install)

| Library            | Version                          | Purpose                                       | When to Use                                        |
| ------------------ | -------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| expo-notifications | ~0.31.x (Expo SDK 54 compatible) | Push notifications for mobile approval events | Required for REQC-03 mobile approval notifications |

**Installation:**

```bash
# Mobile only
cd apps/mobile
npx expo install expo-notifications
```

### Alternatives Considered

| Instead of                     | Could Use             | Tradeoff                                                                                                                                |
| ------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Redis EXPIRE for SLA reminders | BullMQ                | BullMQ not installed; Redis direct is sufficient for simple 4h/24h SLA reminders. Add BullMQ if Phase 9+ needs more complex job queuing |
| Notification table in Postgres | Redis pub/sub         | Postgres table is simpler, auditable, works with existing RLS, no extra infra                                                           |
| expo-notifications             | Firebase FCM directly | Expo Notifications wraps FCM/APNs with simpler setup and Expo-managed credentials                                                       |

---

## Architecture Patterns

### Recommended Project Structure

**Backend — two new modules:**

```
apps/backend/src/modules/
├── purchase-requests/
│   ├── purchase-requests.routes.ts
│   ├── purchase-requests.routes.spec.ts
│   ├── purchase-requests.service.ts
│   └── purchase-requests.types.ts
└── approval-rules/
    ├── approval-rules.routes.ts
    ├── approval-rules.routes.spec.ts
    ├── approval-rules.service.ts
    └── approval-rules.types.ts
```

**Frontend:**

```
apps/frontend/src/
├── pages/
│   ├── PurchaseRequestsPage.tsx
│   ├── PurchaseRequestsPage.css
│   └── ApprovalRulesPage.tsx
├── components/
│   ├── purchase-requests/
│   │   ├── PurchaseRequestModal.tsx    ← create/edit RC
│   │   ├── PurchaseRequestModal.css
│   │   ├── PurchaseRequestDetailModal.tsx  ← read-only + timeline + actions
│   │   └── PurchaseRequestDetailModal.css
│   ├── approval-rules/
│   │   ├── ApprovalRuleModal.tsx
│   │   └── ApprovalRuleModal.css
│   └── notifications/
│       ├── NotificationBell.tsx        ← header bell + dropdown
│       └── NotificationBell.css
└── hooks/
    ├── usePurchaseRequests.ts
    ├── useApprovalRules.ts
    └── useNotifications.ts
```

**Mobile:**

```
apps/mobile/app/(app)/
├── purchase-request.tsx        ← simplified RC creation (offline-capable)
└── my-requests.tsx             ← "Minhas Requisições" list
apps/mobile/app/(app)/(tabs)/
└── (add "Requisições" entry point)
apps/mobile/services/db/
└── purchase-request-repository.ts   ← local SQLite repository
```

### Pattern 1: State Machine (VALID_TRANSITIONS)

Reuse the exact pattern from `checks.types.ts`:

```typescript
// Source: apps/backend/src/modules/checks/checks.types.ts
export const RC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['PENDENTE'],
  PENDENTE: ['APROVADA', 'REJEITADA', 'DEVOLVIDA'],
  DEVOLVIDA: ['PENDENTE'],
  APROVADA: ['CANCELADA'],
  REJEITADA: [],
  CANCELADA: [],
};

export function canTransition(from: string, to: string): boolean {
  return RC_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

The service layer checks `canTransition` before every status mutation and throws 400 if invalid.

### Pattern 2: Sequential Number (getNextSequentialNumber)

Reuse the pattern from `pesticide-prescriptions.service.ts` but scope to organizationId (not farmId, as CONTEXT.md specifies RC-YYYY/NNNN per org):

```typescript
// Adapted from: apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts
async function getNextSequentialNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.purchaseRequest.findFirst({
    where: { organizationId, sequentialNumber: { startsWith: `RC-${year}/` } },
    orderBy: { sequentialNumber: 'desc' },
    select: { sequentialNumber: true },
  });
  const lastNum = last ? parseInt(last.sequentialNumber.split('/')[1]) : 0;
  const next = String(lastNum + 1).padStart(4, '0');
  return `RC-${year}/${next}`;
}
```

Alternatively, store as separate `sequentialYear` + `sequentialIndex` columns for cleaner querying.

### Pattern 3: Offline Queue (mobile RC creation)

RC mobile follows the same pattern as `monitoring-record.tsx` / `planting-operation.tsx`:

1. Save RC to local SQLite repository (new `purchase-request-repository.ts`)
2. Enqueue in `offline-queue.ts` with entity `'purchase_requests'` (add to `OperationEntity` union type)
3. On sync: POST to `/org/purchase-requests`
4. Update local status from server response

`reference-data-repository.ts` already supports `'products'` as a `ReferenceEntityType` — the mobile RC form can search products from that cache. No changes needed to reference-data infrastructure.

### Pattern 4: Approval Rules Engine

Rules are evaluated in order by `priority` field. First matching rule wins. Rule matching:

- `requestType` matches (or `*` for all types)
- `maxAmount` >= RC total (or null for no upper bound)
- `minAmount` <= RC total (or 0)

When a rule matches and requires `approverCount: 2`, create two `ApprovalAction` rows — first with `step: 1`, second with `step: 2`. Service processes steps sequentially: second step is only evaluated when step 1 is in state APPROVED.

Delegation: before resolving approver, check `Delegation` table for active period covering `now()`. If found, route to `delegateId` instead.

### Pattern 5: Notification Table (Claude's Discretion — Recommendation)

Use a Postgres `Notification` table (not Redis pub/sub). Rationale: fits existing RLS context, is auditable, works with the existing backend module pattern, and simplifies the GET /notifications endpoint needed by the bell dropdown.

```prisma
model Notification {
  id             String   @id @default(cuid())
  organizationId String
  recipientId    String
  type           String   // RC_APPROVED, RC_REJECTED, RC_RETURNED, RC_PENDING, SLA_REMINDER
  title          String
  body           String
  referenceId    String?  // purchaseRequestId
  referenceType  String?  // "purchase_request"
  readAt         DateTime?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  recipient      User         @relation(fields: [recipientId], references: [id])
}
```

The bell component polls `GET /org/notifications?unread=true&limit=20` — or use polling interval (5s) since WebSocket infrastructure is not in scope.

### Anti-Patterns to Avoid

- **Inline status checks:** Never `if (rc.status === 'PENDENTE')` — always use `canTransition(rc.status, newStatus)` from the transitions map
- **Notifying inside Prisma transaction:** Follow the STATE.md decision: "BullMQ for async email — Never await emailService.send() inside Prisma transaction." Apply same principle to notifications: create Notification rows inside the transaction, but push notification dispatch happens after commit
- **One rule per approval level:** Rules should be evaluated as a sorted list, not a single record — makes adding new tiers non-destructive
- **Storing attachments in DB:** Store files via multer memoryStorage → write to disk/S3. For this phase, disk storage at `uploads/purchase-requests/` is sufficient (same approach as supplier documents if applicable)

---

## Don't Hand-Roll

| Problem                       | Don't Build                    | Use Instead                                         | Why                                                     |
| ----------------------------- | ------------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| State machine                 | Custom if/else chains          | VALID_TRANSITIONS map (checks.types.ts pattern)     | Central transitions map makes invalid states impossible |
| Sequential number             | Auto-increment + format string | getNextSequentialNumber in Prisma tx                | Race condition safe inside transaction                  |
| Offline queue                 | Custom retry loop              | createOfflineQueue (offline-queue.ts)               | Backoff, conflict resolution, metrics already built     |
| Product search cache (mobile) | Separate SQLite table          | reference-data-repository.ts with `'products'` type | Already present and synced                              |
| File upload                   | Custom multipart parser        | multer (already in backend)                         | Battle-tested, memoryStorage pattern proven in codebase |
| Push notifications            | Raw FCM/APNs calls             | expo-notifications                                  | Manages tokens, credentials, iOS/Android differences    |

**Key insight:** Every major RC subsystem maps to an existing pattern in the codebase. Phase 8 is pattern reuse, not pattern invention.

---

## Common Pitfalls

### Pitfall 1: Sequential Number Race Condition

**What goes wrong:** Two simultaneous RC creates collide on sequential number generation.
**Why it happens:** findFirst + compute + create is not atomic across requests.
**How to avoid:** Always run inside a `withRlsContext` transaction. The `getNextSequentialNumber` function must be called within the same Prisma `tx` client as the `create`. Never call it outside a transaction.
**Warning signs:** Duplicate RC-YYYY/NNNN numbers in production.

### Pitfall 2: Approval Rule Matching Order

**What goes wrong:** Overlapping rules match the same RC, creating ambiguity.
**Why it happens:** Rules with different value ranges and same type can both match.
**How to avoid:** Evaluate rules in ascending `priority` order (lower number = higher priority). Document that priority is the tiebreaker. The manager UI for configuring rules should make priority explicit and allow reordering.

### Pitfall 3: Delegation Timezone

**What goes wrong:** Delegation period active check uses UTC but manager specified local time.
**Why it happens:** No timezone handling in date comparisons.
**How to avoid:** Store delegation `startDate`/`endDate` as full ISO datetime. When checking active delegation, compare `now()` UTC against stored UTC values. The frontend sends dates in ISO format (same pattern as all other date fields in the codebase).

### Pitfall 4: Approval Step Ordering (Double Approval)

**What goes wrong:** Both approvers see the RC simultaneously and both approve, but the second approval is redundant or breaks state.
**Why it happens:** Not enforcing sequential step processing.
**How to avoid:** `ApprovalAction` rows have `step: 1` and `step: 2`. The service only surfaces step 2 to the second approver after step 1 is APPROVED. Check `pendingStep` (min unresolved step) before resolving approver.

### Pitfall 5: expo-notifications Token Registration

**What goes wrong:** Push tokens not registered or expired; notifications silently fail.
**Why it happens:** Expo push tokens are device-scoped and expire. Not calling `registerForPushNotificationsAsync` on each app launch.
**How to avoid:** Register token on each auth login and upsert to backend (new `User.expoPushToken` field or separate table). Send push via `fetch('https://exp.host/--/api/v2/push/send')` from backend after notification row is created.

### Pitfall 6: OperationEntity type extension

**What goes wrong:** Enqueuing `'purchase_requests'` in the offline queue fails TypeScript compilation.
**Why it happens:** `OperationEntity` union in `pending-operations-repository.ts` does not include `'purchase_requests'`.
**How to avoid:** Add `'purchase_requests'` to the `OperationEntity` union type in `apps/mobile/services/db/pending-operations-repository.ts`.

---

## Code Examples

### RC Backend Module — types.ts skeleton

```typescript
// Source: pattern from apps/backend/src/modules/suppliers/suppliers.types.ts
import { SUPPLIER_CATEGORIES } from '../suppliers/suppliers.types';

// RC types = same as supplier categories (locked decision)
export const RC_TYPES = SUPPLIER_CATEGORIES; // reuse — no duplication
export type RcType = (typeof RC_TYPES)[number];

export const RC_URGENCY_LEVELS = ['NORMAL', 'URGENTE', 'EMERGENCIAL'] as const;
export type RcUrgency = (typeof RC_URGENCY_LEVELS)[number];

export const RC_STATUSES = [
  'RASCUNHO',
  'PENDENTE',
  'APROVADA',
  'REJEITADA',
  'DEVOLVIDA',
  'CANCELADA',
] as const;

export const RC_VALID_TRANSITIONS: Record<string, string[]> = {
  RASCUNHO: ['PENDENTE'],
  PENDENTE: ['APROVADA', 'REJEITADA', 'DEVOLVIDA'],
  DEVOLVIDA: ['PENDENTE'],
  APROVADA: ['CANCELADA'],
  REJEITADA: [],
  CANCELADA: [],
};
```

### Approval Action — resolveApprover function

```typescript
// Pattern: check delegation before routing to primary approver
async function resolveApprover(
  tx: TxClient,
  primaryApproverId: string,
  organizationId: string,
): Promise<string> {
  const now = new Date();
  const delegation = await tx.delegation.findFirst({
    where: {
      organizationId,
      delegatorId: primaryApproverId,
      startDate: { lte: now },
      endDate: { gte: now },
      active: true,
    },
  });
  return delegation?.delegateId ?? primaryApproverId;
}
```

### Notification Row Creation (inside transaction, dispatch after)

```typescript
// Pattern: create rows in tx, dispatch push AFTER commit
const [rc, notification] = await withRlsContext(ctx, async (tx) => {
  const updated = await tx.purchaseRequest.update({ ... });
  const notif = await tx.notification.create({ data: { recipientId, type, ... } });
  return [updated, notif];
});

// After commit — fire and forget, never await inside tx
void dispatchPushNotification(notification).catch((err) =>
  logger.warn({ err }, 'Push notification failed'),
);
```

### Mobile: Adding purchase_requests to OperationEntity

```typescript
// File: apps/mobile/services/db/pending-operations-repository.ts
export type OperationEntity =
  | 'animals'
  // ... existing entities ...
  | 'mastitis_cases'
  | 'purchase_requests'; // ADD THIS
```

---

## Prisma Schema — New Models

```prisma
// ─── Enums ───────────────────────────────────────────────────────────────────

enum PurchaseRequestStatus {
  RASCUNHO
  PENDENTE
  APROVADA
  REJEITADA
  DEVOLVIDA
  CANCELADA
}

enum PurchaseRequestUrgency {
  NORMAL
  URGENTE
  EMERGENCIAL
}

// ─── Models ──────────────────────────────────────────────────────────────────

model PurchaseRequest {
  id               String                  @id @default(cuid())
  organizationId   String
  farmId           String
  sequentialNumber String                  // "RC-2026/0001"
  requestType      String                  // SUPPLIER_CATEGORIES enum value
  urgency          PurchaseRequestUrgency
  status           PurchaseRequestStatus   @default(RASCUNHO)
  justification    String?
  costCenterId     String?
  neededBy         DateTime?
  geolat           Float?
  geolon           Float?
  photoUrl         String?                 // mobile RC photo
  createdBy        String
  submittedAt      DateTime?
  slaDeadline      DateTime?               // computed on PENDENTE transition
  cancelledAt      DateTime?
  deletedAt        DateTime?
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt

  organization     Organization            @relation(fields: [organizationId], references: [id])
  farm             Farm                    @relation(fields: [farmId], references: [id])
  creator          User                    @relation("RCCreator", fields: [createdBy], references: [id])
  costCenter       CostCenter?             @relation(fields: [costCenterId], references: [id])
  items            PurchaseRequestItem[]
  attachments      PurchaseRequestAttachment[]
  approvalActions  ApprovalAction[]
  notifications    Notification[]

  @@unique([organizationId, sequentialNumber])
  @@index([organizationId, status])
  @@index([farmId, status])
}

model PurchaseRequestItem {
  id                  String          @id @default(cuid())
  purchaseRequestId   String
  productId           String?         // null for free-text items
  productName         String          // snapshot or free-text
  quantity            Decimal
  unitId              String?         // null for free-text items
  unitName            String          // snapshot or manual
  estimatedUnitPrice  Decimal?
  notes               String?

  purchaseRequest     PurchaseRequest @relation(fields: [purchaseRequestId], references: [id], onDelete: Cascade)
}

model PurchaseRequestAttachment {
  id                String          @id @default(cuid())
  purchaseRequestId String
  fileName          String
  filePath          String
  mimeType          String
  sizeBytes         Int
  uploadedBy        String
  createdAt         DateTime        @default(now())

  purchaseRequest   PurchaseRequest @relation(fields: [purchaseRequestId], references: [id], onDelete: Cascade)
}

model ApprovalRule {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  requestType    String?  // null = all types
  minAmount      Decimal  @default(0)
  maxAmount      Decimal? // null = no upper bound
  approverCount  Int      @default(1)  // 1 or 2
  approver1Id    String
  approver2Id    String?  // only when approverCount = 2
  priority       Int      @default(0)  // lower = higher priority
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  approver1      User         @relation("ApprovalRule1", fields: [approver1Id], references: [id])
  approver2      User?        @relation("ApprovalRule2", fields: [approver2Id], references: [id])

  @@index([organizationId, active])
}

model ApprovalAction {
  id                String          @id @default(cuid())
  purchaseRequestId String
  organizationId    String
  step              Int             // 1 or 2 for double-approval
  assignedTo        String          // resolved approver (may be delegate)
  originalAssignee  String?         // set when delegated
  status            String          @default("PENDING")  // PENDING | APPROVED | REJECTED | RETURNED
  comment           String?
  decidedAt         DateTime?
  createdAt         DateTime        @default(now())

  purchaseRequest   PurchaseRequest @relation(fields: [purchaseRequestId], references: [id])
  assignee          User            @relation("ApprovalAssignee", fields: [assignedTo], references: [id])

  @@index([purchaseRequestId, step])
  @@index([assignedTo, status])
}

model Delegation {
  id             String   @id @default(cuid())
  organizationId String
  delegatorId    String
  delegateId     String
  startDate      DateTime
  endDate        DateTime
  active         Boolean  @default(true)
  notes          String?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  delegator      User         @relation("DelegationFrom", fields: [delegatorId], references: [id])
  delegate       User         @relation("DelegationTo", fields: [delegateId], references: [id])

  @@index([delegatorId, active])
}

model Notification {
  id             String    @id @default(cuid())
  organizationId String
  recipientId    String
  type           String    // RC_APPROVED | RC_REJECTED | RC_RETURNED | RC_PENDING | SLA_REMINDER
  title          String
  body           String
  referenceId    String?   // purchaseRequestId
  referenceType  String?   // "purchase_request"
  readAt         DateTime?
  createdAt      DateTime  @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  recipient      User         @relation("NotificationRecipient", fields: [recipientId], references: [id])

  @@index([recipientId, readAt])
  @@index([organizationId, recipientId])
}
```

---

## State of the Art

| Old Approach                 | Current Approach                        | When Changed                                      | Impact                                                                                                             |
| ---------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| BullMQ for async jobs        | Redis EXPIRE/direct for SLA             | BullMQ not installed                              | Use Redis EXPIRE to schedule SLA reminders; store `slaDeadline` on RC row and poll or use background job if needed |
| Custom state if/else         | VALID_TRANSITIONS map                   | Already established in codebase (checks.types.ts) | State changes are always validated through the map                                                                 |
| Inline notification dispatch | Notification row + post-commit dispatch | STATE.md decision                                 | Never await push inside Prisma transaction                                                                         |

**SLA reminder implementation:** Since BullMQ is not installed, the simplest approach is:

- Store `slaDeadline` on PurchaseRequest when it transitions to PENDENTE
- Backend cron / polling endpoint: query `WHERE status = 'PENDENTE' AND slaDeadline <= now() + 1h AND slaNotifiedAt IS NULL` and create SLA_REMINDER notifications
- Alternative: Redis key with TTL set to SLA interval; Redis EXPIRE callback via keyspace notifications (requires `notify-keyspace-events KEA` Redis config — complex setup, avoid for v1.1)
- **Recommendation:** Store `slaDeadline` + `slaNotifiedAt` on PurchaseRequest; add a `/org/purchase-requests/process-sla-reminders` endpoint or integrate into a scheduled check in the backend startup. Keep it simple for v1.1.

---

## Integration Points

### Backend `app.ts`

```typescript
// Register after suppliers router
import purchaseRequestsRouter from './modules/purchase-requests/purchase-requests.routes';
import approvalRulesRouter from './modules/approval-rules/approval-rules.routes';

app.use('/org/purchase-requests', purchaseRequestsRouter);
app.use('/org/approval-rules', approvalRulesRouter);
app.use('/org/notifications', notificationsRouter);
```

### Frontend `App.tsx`

```typescript
const PurchaseRequestsPage = lazy(() => import('./pages/PurchaseRequestsPage'));
const ApprovalRulesPage = lazy(() => import('./pages/ApprovalRulesPage'));

// Inside ProtectedRoute with purchases:read permission
<Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
<Route path="/approval-rules" element={<ApprovalRulesPage />} />
```

### Frontend Sidebar (`Sidebar.tsx`)

```typescript
// Add to existing COMPRAS group (currently only has Fornecedores)
{
  title: 'COMPRAS',
  items: [
    { to: '/suppliers', icon: Handshake, label: 'Fornecedores' },
    { to: '/purchase-requests', icon: ShoppingCart, label: 'Requisições' },  // ADD
    { to: '/approval-rules', icon: Settings2, label: 'Alçadas' },            // ADD (managers only)
  ],
}
```

### Frontend AppLayout.tsx — Notification Bell

Add `NotificationBell` component to `app-topbar__right` section before the separator, after `FarmLimitBadge`. The bell polls `GET /org/notifications?unread=true&limit=20` every 30 seconds using a `useInterval` hook.

### Mobile `(tabs)/_layout.tsx`

Current tabs: Início, Mapa, Registrar, Rebanho, Mais.
Maximum 5 tabs — tabs are full. RC access goes under "Mais" tab (more screen), which acts as overflow navigation. The "Registrar" tab or "Mais" screen should include a "Nova Requisição" entry point.

### Mobile `OperationEntity` (`pending-operations-repository.ts`)

Add `'purchase_requests'` to the `OperationEntity` union type.

### Mobile `ReferenceEntityType` (`reference-data-repository.ts`)

`'products'` is already in the `ReferenceEntityType` union — no change needed. The mobile RC form reads products from the existing `reference_data` SQLite table.

---

## Open Questions

1. **SLA reminder delivery mechanism**
   - What we know: `slaDeadline` stored on PurchaseRequest; Notification table for in-app; push via expo-notifications
   - What's unclear: How to trigger SLA reminders without BullMQ. Options: (a) cron endpoint called by a health-check ping, (b) middleware check on every request, (c) setInterval in backend startup
   - Recommendation: Add `processSlaReminders()` function called in a `setInterval(fn, 60_000)` in `main.ts` startup. Simple, no extra infra.

2. **Attachment storage**
   - What we know: multer memoryStorage is established; no S3/cloud storage in current stack
   - What's unclear: Whether files should go to disk or stay in memory only
   - Recommendation: `multer.diskStorage` to `uploads/purchase-requests/{orgId}/{rcId}/`. Add to `.gitignore`. Acceptable for v1.1; refactor to S3 in v1.2.

3. **Notification bell polling vs WebSocket**
   - What we know: No WebSocket infrastructure exists
   - What's unclear: Polling interval acceptable for UX
   - Recommendation: 30-second polling interval. Unread count appears in bell badge. No real-time requirement for v1.1.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Framework          | Jest 29 (backend), Vitest (frontend)                                  |
| Config file        | `apps/backend/jest.config.js`                                         |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern=purchase-requests` |
| Full suite command | `cd apps/backend && pnpm test`                                        |

### Phase Requirements → Test Map

| Req ID  | Behavior                           | Test Type | Automated Command                                                                | File Exists? |
| ------- | ---------------------------------- | --------- | -------------------------------------------------------------------------------- | ------------ |
| REQC-01 | RC creation with sequential number | unit      | `pnpm test -- purchase-requests.routes.spec.ts -t "POST /org/purchase-requests"` | ❌ Wave 0    |
| REQC-01 | RC item validation (min 1 item)    | unit      | `pnpm test -- purchase-requests.routes.spec.ts -t "validates items"`             | ❌ Wave 0    |
| REQC-01 | Sequential number uniqueness       | unit      | `pnpm test -- purchase-requests.routes.spec.ts -t "sequential number"`           | ❌ Wave 0    |
| REQC-02 | Mobile RC offline queue enqueue    | unit      | Mobile Jest — `pnpm test -- purchase-request-repository.spec.ts`                 | ❌ Wave 0    |
| REQC-03 | State machine transitions (valid)  | unit      | `pnpm test -- purchase-requests.routes.spec.ts -t "status transition"`           | ❌ Wave 0    |
| REQC-03 | Approval rule matching             | unit      | `pnpm test -- approval-rules.routes.spec.ts -t "match rule"`                     | ❌ Wave 0    |
| REQC-03 | Delegation routing                 | unit      | `pnpm test -- purchase-requests.routes.spec.ts -t "delegation"`                  | ❌ Wave 0    |
| REQC-03 | Notification creation on approve   | unit      | `pnpm test -- purchase-requests.routes.spec.ts -t "notification"`                | ❌ Wave 0    |

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/purchase-requests/purchase-requests.routes.spec.ts` — covers REQC-01, REQC-03
- [ ] `apps/backend/src/modules/approval-rules/approval-rules.routes.spec.ts` — covers REQC-03

_(Mobile test files are out of scope for backend test runs; mobile tests use Jest via Expo's jest-expo preset)_

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `checks.types.ts`, `pesticide-prescriptions.service.ts`, `offline-queue.ts`, `reference-data-repository.ts`, `pending-operations-repository.ts`, `suppliers.types.ts`, `AppLayout.tsx`, `Sidebar.tsx`, `(tabs)/_layout.tsx`
- `apps/backend/package.json` — confirmed installed dependencies (ioredis, multer, prisma versions)
- `apps/mobile/package.json` — confirmed expo-image-picker, expo-location present; expo-notifications absent
- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — all locked decisions
- `.planning/STATE.md` — BullMQ decision, VALID_TRANSITIONS decision

### Secondary (MEDIUM confidence)

- Expo SDK 54 compatibility: expo-notifications ~0.31.x — based on Expo SDK 54 release notes pattern (SDK 54 = Expo Router 6 confirmed in package.json)

### Tertiary (LOW confidence)

- Redis keyspace notifications for SLA — mentioned as alternative but explicitly deprioritized; not verified in current Redis config

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified via direct package.json inspection
- Architecture: HIGH — all patterns directly traced to existing codebase files
- Prisma schema: HIGH — modeled on existing schema patterns; column types consistent with codebase
- Pitfalls: HIGH — sourced from STATE.md decisions and direct code inspection
- expo-notifications version: MEDIUM — inferred from Expo SDK 54 compatibility matrix, not directly verified

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack)
