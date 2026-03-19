# Phase 12: Kanban, Dashboard e Notificacoes - Research

**Researched:** 2026-03-18
**Domain:** Kanban DnD, Dashboard executivo Recharts, Notificacoes badge+email, Preferencias de notificacao, Digest cron
**Confidence:** HIGH

## Summary

Esta fase encerra o ciclo P2P com visibilidade e observabilidade: um board kanban unificado, um dashboard executivo operacional e um sistema de notificacoes expandido com preferencias por canal. A infraestrutura existente e madura — Recharts ja instalado, NotificationBell + useNotifications funcionais, nodemailer configurado, Redis disponivel via ioredis, 5 state machines com `VALID_TRANSITIONS` mapeados. O principal desafio novo e o kanban com DnD (requer instalar `@dnd-kit/core` + `@dnd-kit/sortable`) e o digest diario (cron job, sem BullMQ no projeto — usar `node-cron` ou setInterval robusto com Redis para single-instance lock).

A estrategia de implementacao e quase toda de integracao e composicao: o dashboard segue exatamente o padrao `FinancialDashboardPage` (KPI cards + YoyBadge + Recharts lazy + alertas), as notificacoes expandem `NOTIFICATION_TYPES` e adicionam `NotificationPreference` no schema, e o kanban e a unica feature genuinamente nova em termos de padrao de UI.

**Primary recommendation:** Implementar em 3 trilhas paralelas — (1) backend endpoints kanban+dashboard, (2) frontend kanban board com dnd-kit, (3) backend notificacoes+preferencias+digest — pois as dependencias entre trilhas sao minimas apos o schema estar definido.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Kanban board:**

- Fluxo unificado — um unico board com colunas: RC Pendente | RC Aprovada | Em Cotacao | OC Emitida | Aguardando Entrega | Recebido | Pago
- Drag-and-drop com acao real — arrastar executa transicao de estado (com ConfirmModal quando necessario). Biblioteca: `@dnd-kit/core` + `@dnd-kit/sortable`
- Cards compactos: numero sequencial + tipo/urgencia (badge) + solicitante + valor total + dias no estagio
- Filtros essenciais: Fazenda + Urgencia + Busca por numero
- Contadores por coluna (badge com quantidade)
- Alertas visuais: borda vermelha para itens vencidos/acima do SLA
- Transicoes validas: DnD so permite soltar em colunas validas; invalidas ficam desabilitadas durante drag

**Dashboard executivo:**

- 4 KPIs com YoyBadge: RCs pendentes de aprovacao, OCs em atraso, Prazo medio do ciclo, Entregas atrasadas
- 4 graficos Recharts (lazy-loaded): volume por etapa (bar), compras por categoria (pie/donut), evolucao mensal 12 meses (line), urgentes vs planejadas (stacked bar)
- Secao de alertas (padrao FinancialDashboard): OCs vencidas, RCs acima do SLA, orcamento estourado, entregas atrasadas
- Filtros: Fazenda + Periodo (presets: mes, trimestre, safra, ano)
- Drill-down: KPIs clicaveis navegam para kanban com query param (ex: /purchasing-kanban?filter=overdue_po)

**Notificacoes e preferencias:**

- 2 canais: Badge in-app (NotificationBell existente) + Email (nodemailer existente). Push mobile FORA DE ESCOPO
- Novos tipos de evento: QUOTATION_RECEIVED, QUOTATION_APPROVED, PO_OVERDUE, GOODS_RECEIVED, BUDGET_EXCEEDED, RETURN_REGISTERED, RETURN_RESOLVED
- Tela de preferencias: tabela tipo x canal (badge/email), toggle on/off por celula
- Digest diario: email resumo matinal via cron job
- Email templates HTML para cada tipo + digest

**Integracao entre telas:**

- Dashboard KPI -> Kanban via query params
- Notificacao -> Entidade (padrao existente /purchase-requests?highlight=RC-001, NAO para kanban)
- 2 novos itens no TOPO do grupo COMPRAS na Sidebar: "Dashboard Compras" (/purchasing-dashboard) e "Kanban" (/purchasing-kanban)
- Preferencias em /notification-preferences

### Claude's Discretion

- Biblioteca dnd-kit: @dnd-kit/core puro ou @dnd-kit/sortable (depende da complexidade)
- Design exato dos cards do kanban (cores, sombras, hover states)
- Layout responsivo do kanban (scroll horizontal em telas menores)
- Design exato dos graficos Recharts (cores, tooltips, legends)
- Skeleton loading e empty states
- Implementacao do cron job para digest (node-cron, BullMQ scheduler, ou outra abordagem)
- Ordem exata dos alertas na secao de alertas do dashboard
- Layout interno da tela de preferencias de notificacao

### Deferred Ideas (OUT OF SCOPE)

- Push notifications mobile — mobile financeiro fora de escopo
- Websocket para notificacoes real-time (substituir polling 30s)
- Kanban customizavel (usuario escolhe colunas)
- Dashboard estrategico (saving acumulado, comparativo detalhado) — SavingAnalysisPage ja cobre
- Notificacao por WhatsApp
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                        | Research Support                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DASH-01 | Kanban do fluxo de compras com colunas por etapa, cards com dados essenciais, DnD com acoes reais, filtros, alertas visuais, contadores por coluna | dnd-kit instalado via npm; 5 VALID_TRANSITIONS maps ja existem para validar drops; endpoint GET /org/purchasing/kanban agrega entidades por coluna          |
| DASH-02 | Dashboard executivo com 4 KPIs, 4 graficos Recharts, secao de alertas, filtros fazenda/periodo, drill-down para kanban                             | Padrao FinancialDashboardPage totalmente reutilizavel; Recharts ja instalado; YoyBadge existente; endpoint GET /org/purchasing/dashboard                    |
| DASH-03 | Notificacoes push/email/badge com preferencias por canal e digest diario                                                                           | NotificationBell+useNotifications funcionais; nodemailer configurado; Redis disponivel; node-cron para digest; novo modelo NotificationPreference no schema |

</phase_requirements>

---

## Standard Stack

### Core

| Library           | Version | Purpose                                                             | Why Standard                                                                                 |
| ----------------- | ------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| @dnd-kit/core     | ^6.x    | DnD engine — sensores touch/mouse/teclado, colisoes, acessibilidade | Padrao moderno para React DnD; melhor acessibilidade que react-beautiful-dnd (descontinuado) |
| @dnd-kit/sortable | ^8.x    | Abstracoes de sortable sobre @dnd-kit/core                          | Simplifica lista reordenavel; necesario para cards dentro de coluna                          |
| recharts          | ^3.7.0  | Graficos (bar, line, pie, stacked bar)                              | Ja instalado e em uso no projeto                                                             |
| node-cron         | ^3.x    | Cron job para digest diario                                         | Leve, sem dependencia externa; Redis ja disponivel para lock single-instance                 |
| nodemailer        | ^8.0.1  | Envio de email                                                      | Ja instalado e configurado (mail.service.ts)                                                 |
| ioredis           | ^5.9.3  | Redis (lock cron, rate limiting)                                    | Ja instalado e em uso no projeto                                                             |

### Supporting

| Library            | Version | Purpose                                                    | When to Use                                  |
| ------------------ | ------- | ---------------------------------------------------------- | -------------------------------------------- |
| @dnd-kit/utilities | ^3.x    | CSS transforms, helpers para DnD                           | Necessario junto com dnd-kit/core            |
| @dnd-kit/modifiers | ^7.x    | Restringir movimento (ex: apenas horizontal entre colunas) | Util para restringir drag a eixo x no kanban |

### Alternatives Considered

| Instead of | Could Use                        | Tradeoff                                                                          |
| ---------- | -------------------------------- | --------------------------------------------------------------------------------- |
| @dnd-kit   | react-beautiful-dnd              | rbd esta descontinuado desde 2023 — nao usar                                      |
| @dnd-kit   | dnd-kit/core puro (sem sortable) | Sortable adiciona ~2kb mas simplifica muito a implementacao de cards reordenaveis |
| node-cron  | BullMQ scheduler                 | BullMQ nao esta no projeto; adiciona Redis Bull queues — overkill para 1 cron job |
| node-cron  | setInterval no main.ts           | Menos confiavel, sem expressao cron, mais difícil de testar                       |

**Installation:**

```bash
# Frontend
pnpm --filter @protos-farm/frontend add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers

# Backend
pnpm --filter @protos-farm/backend add node-cron
pnpm --filter @protos-farm/backend add -D @types/node-cron
```

---

## Architecture Patterns

### Recommended Project Structure

**Backend — novos modulos:**

```
apps/backend/src/modules/
├── purchasing-kanban/         # GET /org/purchasing/kanban
│   ├── purchasing-kanban.routes.ts
│   ├── purchasing-kanban.service.ts
│   └── purchasing-kanban.types.ts
├── purchasing-dashboard/      # GET /org/purchasing/dashboard
│   ├── purchasing-dashboard.routes.ts
│   ├── purchasing-dashboard.service.ts
│   └── purchasing-dashboard.types.ts
└── notification-preferences/  # CRUD /org/notification-preferences
    ├── notification-preferences.routes.ts
    ├── notification-preferences.service.ts
    └── notification-preferences.types.ts

apps/backend/src/shared/
└── cron/
    └── digest.cron.ts          # node-cron, iniciado em main.ts
```

**Frontend — novas paginas:**

```
apps/frontend/src/
├── pages/
│   ├── PurchasingDashboardPage.tsx    # /purchasing-dashboard
│   ├── PurchasingKanbanPage.tsx       # /purchasing-kanban
│   └── NotificationPreferencesPage.tsx # /notification-preferences
├── components/kanban/
│   ├── KanbanBoard.tsx                # DndContext + colunas
│   ├── KanbanColumn.tsx               # coluna individual com SortableContext
│   ├── KanbanCard.tsx                 # card draggable
│   └── KanbanCard.css
├── components/purchasing-dashboard/
│   ├── VolumeByStageChart.tsx         # bar chart
│   ├── PurchasesByCategoryChart.tsx   # pie/donut chart
│   ├── MonthlyEvolutionChart.tsx      # line chart
│   └── UrgentVsPlannedChart.tsx       # stacked bar chart
└── hooks/
    ├── usePurchasingDashboard.ts
    ├── usePurchasingKanban.ts
    └── useNotificationPreferences.ts
```

### Pattern 1: Kanban Board com dnd-kit

**What:** `DndContext` envolve o board inteiro. Cada coluna e um `droppable`. Cada card e um `useSortable`. `onDragEnd` chama endpoint de transicao e faz otimistic update.

**When to use:** Sempre que arrastar entre containers distintos com validacao de transicao.

**Estrutura de dados do endpoint GET /org/purchasing/kanban:**

```typescript
// Endpoint agrega 5 entidades em 7 colunas semanticas
interface KanbanColumn {
  id: KanbanColumnId;
  label: string;
  count: number;
  cards: KanbanCard[];
}

type KanbanColumnId =
  | 'RC_PENDENTE'
  | 'RC_APROVADA'
  | 'EM_COTACAO'
  | 'OC_EMITIDA'
  | 'AGUARDANDO_ENTREGA'
  | 'RECEBIDO'
  | 'PAGO';

interface KanbanCard {
  id: string; // entityId
  entityType: 'RC' | 'SC' | 'OC' | 'GR' | 'PAYABLE';
  sequentialNumber: string; // RC-001, SC-001, OC-001
  urgency?: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  requesterName: string;
  totalValue: number;
  daysInStage: number;
  isOverdue: boolean; // true se acima do SLA ou prazo vencido
  farmId: string;
  farmName: string;
}
```

**Mapeamento de colunas para entidades (HIGH confidence — baseado em VALID_TRANSITIONS existentes):**

```
RC_PENDENTE      -> PurchaseRequest WHERE status IN ('RASCUNHO', 'PENDENTE', 'DEVOLVIDA')
RC_APROVADA      -> PurchaseRequest WHERE status = 'APROVADA' AND sem SC aberta
EM_COTACAO       -> Quotation WHERE status IN ('AGUARDANDO_PROPOSTA', 'EM_ANALISE')
OC_EMITIDA       -> PurchaseOrder WHERE status IN ('EMITIDA', 'CONFIRMADA')
AGUARDANDO_ENTREGA -> PurchaseOrder WHERE status = 'EM_TRANSITO'
RECEBIDO         -> GoodsReceipt WHERE status = 'CONFIRMADO' AND payable nao pago
PAGO             -> Payable WHERE status = 'PAID' (ultimos 30 dias, paginado)
```

**DnD com validacao de transicao:**

```typescript
// Colunas de destino validas por tipo de card
const KANBAN_VALID_DROPS: Record<string, KanbanColumnId[]> = {
  RC_PENDENTE: ['RC_APROVADA'], // aprovar RC
  RC_APROVADA: ['EM_COTACAO'], // criar SC
  EM_COTACAO: ['OC_EMITIDA'], // aprovar SC -> OC
  OC_EMITIDA: ['AGUARDANDO_ENTREGA'], // confirmar OC em transito
  AGUARDANDO_ENTREGA: ['RECEBIDO'], // registrar recebimento
  // RECEBIDO -> PAGO: automatico apos pagamento (nao via DnD)
};

// Durante onDragOver: colunas invalidas recebem aria-disabled + estilo visual desabilitado
// Durante onDragEnd: chamar endpoint especifico da entidade para executar transicao
```

**Pattern dnd-kit (baseado em documentacao oficial):**

```typescript
// KanbanBoard.tsx
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';

function KanbanBoard({ columns, onCardMove }) {
  const [activeCard, setActiveCard] = useState(null);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const targetColumn = over.id as KanbanColumnId;
    const card = findCard(active.id);

    if (!isValidDrop(card, targetColumn)) return;

    // Otimistic update + chamada API
    onCardMove(card, targetColumn);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {columns.map(col => <KanbanColumn key={col.id} column={col} />)}
      <DragOverlay>{activeCard && <KanbanCard card={activeCard} isOverlay />}</DragOverlay>
    </DndContext>
  );
}
```

### Pattern 2: Dashboard com padrao FinancialDashboardPage

**What:** Reutilizar EXATAMENTE o padrao de FinancialDashboardPage — filtros farm+periodo, KPI cards com YoyBadge, graficos lazy-loaded com Suspense, alertas section, skeleton loading.

**Endpoint GET /org/purchasing/dashboard:**

```typescript
interface PurchasingDashboardData {
  // 4 KPIs
  pendingApprovalCount: number;
  pendingApprovalCountPrev: number;
  overduePoCount: number;
  overduePoCountPrev: number;
  avgCycleDays: number; // RC_createdAt -> GR_confirmedAt media
  avgCycleDaysPrev: number;
  lateDeliveriesCount: number;
  lateDeliveriesCountPrev: number;

  // 4 graficos
  volumeByStage: { stage: string; count: number; totalValue: number }[];
  purchasesByCategory: { category: string; totalValue: number }[];
  monthlyEvolution: { month: string; totalValue: number }[]; // 12 meses
  urgentVsPlanned: { month: string; urgent: number; planned: number }[];

  // Alertas
  alerts: {
    overduePoCount: number;
    rcAboveSlaCount: number;
    budgetExceededCount: number;
    lateDeliveriesCount: number;
  };
}
```

**Drill-down via query params:**

```typescript
// Dashboard -> Kanban
navigate('/purchasing-kanban?filter=overdue_po');
navigate('/purchasing-kanban?filter=pending_approval');

// KanbanPage le o query param e aplica filtro automaticamente
const [searchParams] = useSearchParams();
const filterPreset = searchParams.get('filter');
```

### Pattern 3: NotificationPreference model + preferencias por canal

**Schema Prisma — novo modelo:**

```prisma
model NotificationPreference {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  eventType      String   // NotificationType value
  channel        String   // 'BADGE' | 'EMAIL'
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId, eventType, channel])
  @@index([userId, organizationId])
  @@map("notification_preferences")
}
```

**Logica de verificacao antes de enviar:**

```typescript
// Em notifications.service.ts — expandir createNotification
async function shouldNotify(
  tx: TxClient,
  userId: string,
  organizationId: string,
  type: NotificationType,
  channel: 'BADGE' | 'EMAIL',
): Promise<boolean> {
  const pref = await tx.notificationPreference.findFirst({
    where: { userId, organizationId, eventType: type, channel },
  });
  // Se nao existe preferencia = habilitado por padrao (opt-out model)
  return pref === null ? true : pref.enabled;
}
```

### Pattern 4: Digest diario com node-cron + Redis lock

**What:** Cron job rodando diariamente as 07:00 (horario Brasil). Redis lock evita execucao duplicada se o processo reiniciar ou em futuro multi-instancia.

**Implementacao:**

```typescript
// apps/backend/src/shared/cron/digest.cron.ts
import cron from 'node-cron';
import { redis } from '../../database/redis';
import { sendDigestEmail } from '../mail/digest-mail.service';

export function startDigestCron() {
  // Roda as 07:00 horario local do servidor (ajustar TZ via env)
  cron.schedule('0 7 * * *', async () => {
    const lockKey = 'cron:daily-digest';
    const lockTtl = 60; // segundos

    // Redis SETNX para garantir execucao unica
    const locked = await redis.set(lockKey, '1', 'EX', lockTtl, 'NX');
    if (!locked) return; // ja esta rodando

    try {
      await sendDigestEmail();
    } finally {
      await redis.del(lockKey);
    }
  });
}

// Iniciar em main.ts apos DB e Redis prontos
```

### Anti-Patterns to Avoid

- **await emailService.send() dentro de transacao Prisma:** Decisao arquitetural existente (BullMQ for async email). Para email de notificacao direta: disparar apos commit com void pattern. Para digest: cron job separado.
- **DnD sem feedback de transicao invalida:** Colunas invalidas DEVEM ficar visivelmente desabilitadas durante drag (aria-disabled + CSS opacity). Nao deixar o usuario tentar e falhar.
- **Agregar kanban com N+1 queries:** O endpoint kanban deve executar no maximo 6 queries paralelas (uma por entidade/coluna), nao 7 queries sequenciais.
- **Hardcodar tipos de notificacao no frontend:** `NotificationType` deve ser importado de `@protos-farm/shared` ou definido em um unico lugar.
- **NotificationPreference com opt-in por padrao:** Usar opt-out (ausencia de registro = habilitado). Caso contrario usuarios novos nao recebem nada ate configurar.

---

## Don't Hand-Roll

| Problem                     | Don't Build                       | Use Instead                         | Why                                                                                                                |
| --------------------------- | --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Drag and drop entre colunas | HTML5 drag events customizados    | @dnd-kit/core                       | Acessibilidade (teclado, screen reader), touch events, sensors configurables — HTML5 DnD nao funciona bem em touch |
| Cron scheduling             | setInterval ou setTimeout em loop | node-cron                           | Expressao cron padrao, restart-safe, facil de testar                                                               |
| Email HTML templates        | String concatenation manual       | Template literals com funcao helper | pdfkit nao serve para email; nodemailer aceita html: string — usar funcoes que retornam HTML string estruturado    |
| Collision detection DnD     | Calcular coordenadas manualmente  | closestCenter de @dnd-kit           | Algoritmo battle-tested, funciona com scroll                                                                       |

**Key insight:** O kanban parece simples mas drag-and-drop acessivel (teclado, screen reader, touch mobile) e extremamente difícil de implementar corretamente — dnd-kit resolve isso.

---

## Common Pitfalls

### Pitfall 1: Coluna "Pago" com volume ilimitado de cards

**What goes wrong:** A coluna PAGO pode ter centenas de payables pagos, tornando o kanban inutilizavel.

**Why it happens:** Payables pagos acumulam ao longo do tempo sem fim.

**How to avoid:** Filtrar coluna PAGO com janela temporal (padrao: ultimos 30 dias). Mostrar contador total mas paginar os cards. Alternativa: mostrar apenas os pagos na semana atual.

**Warning signs:** Query sem WHERE dueDate retorna milhares de registros.

### Pitfall 2: Mapeamento ambiguo de entidades para colunas kanban

**What goes wrong:** Um PurchaseRequest APROVADA que ja tem SC aberta aparece tanto em RC_APROVADA quanto em EM_COTACAO.

**Why it happens:** As entidades do P2P sao independentes com FKs opcionais — uma RC pode existir sem SC correspondente.

**How to avoid:** Implementar logica de "posicao no funil" que prioriza o estado mais avancado. RC APROVADA com SC existente deve aparecer na coluna da SC. Usar subquery EXISTS para determinar a coluna correta.

**Warning signs:** O mesmo numero sequencial aparece em 2 colunas simultaneamente.

### Pitfall 3: Otimistic update no kanban sem rollback

**What goes wrong:** Card e movido visivelmente mas a API falha (transicao invalida, erro de rede). O estado da UI fica inconsistente com o servidor.

**Why it happens:** O otimistic update e feito antes da confirmacao da API.

**How to avoid:** Guardar o estado anterior antes do otimistic update. No catch do fetch, reverter para o estado anterior + mostrar toast de erro. Fazer refetch completo apos falha para garantir consistencia.

### Pitfall 4: NotificationType nao sincronizado entre backend e frontend

**What goes wrong:** Frontend usa string literal que nao existe no backend, ou vice-versa. NotificationBell exibe icone errado ou cai no `default`.

**Why it happens:** `NotificationType` esta duplicado em `notifications.types.ts` (backend) e `useNotifications.ts` (frontend).

**How to avoid:** Ao adicionar os 7 novos tipos, atualizar AMBOS os arquivos simultaneamente. Considerar mover para `packages/shared` em refactor futuro. Atualizar tambem o `switch` em `NotificationBell.tsx` e o `NotificationIcon` component.

### Pitfall 5: node-cron nao respeita timezone

**What goes wrong:** Digest enviado as 10:00 UTC em vez das 07:00 horario de Brasilia (UTC-3).

**Why it happens:** node-cron usa timezone do processo por padrao (UTC em containers).

**How to avoid:** Usar a opcao `timezone` do node-cron: `cron.schedule('0 7 * * *', handler, { timezone: 'America/Sao_Paulo' })`.

### Pitfall 6: Preferencias de notificacao sem migration correta

**What goes wrong:** Migration tenta criar FK para User sem cascade correto, ou unique constraint falha no upsert.

**Why it happens:** `@@unique([userId, organizationId, eventType, channel])` — upsert precisa usar todos os campos do unique.

**How to avoid:** Usar `upsert` do Prisma com `where: { userId_organizationId_eventType_channel: { ... } }`. Gerar o cliente apos a migration: `prisma generate`.

---

## Code Examples

### Kanban endpoint — query de agregacao

```typescript
// purchasing-kanban.service.ts
// Source: padrao de listagem com withRlsContext do projeto
export async function getKanbanBoard(
  ctx: RlsContext,
  filters: KanbanFilters,
): Promise<KanbanBoard> {
  return withRlsContext(ctx, async (tx) => {
    const [rcCards, scCards, ocCards, grCards, payableCards] = await Promise.all([
      getPurchaseRequestCards(tx, ctx.organizationId, filters),
      getQuotationCards(tx, ctx.organizationId, filters),
      getPurchaseOrderCards(tx, ctx.organizationId, filters),
      getGoodsReceiptCards(tx, ctx.organizationId, filters),
      getPaidPayableCards(tx, ctx.organizationId, filters),
    ]);

    return buildKanbanColumns(rcCards, scCards, ocCards, grCards, payableCards);
  });
}
```

### Preferencia de notificacao — toggle endpoint

```typescript
// notification-preferences.service.ts
export async function upsertPreference(
  ctx: RlsContext & { userId: string },
  eventType: NotificationType,
  channel: 'BADGE' | 'EMAIL',
  enabled: boolean,
) {
  return withRlsContext(ctx, async (tx) => {
    return tx.notificationPreference.upsert({
      where: {
        userId_organizationId_eventType_channel: {
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          eventType,
          channel,
        },
      },
      update: { enabled },
      create: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        eventType,
        channel,
        enabled,
      },
    });
  });
}
```

### Expandir NOTIFICATION_TYPES

```typescript
// notifications.types.ts — adicionar aos 9 existentes
export const NOTIFICATION_TYPES = [
  // Existentes (Phase 8+9)
  'RC_APPROVED',
  'RC_REJECTED',
  'RC_RETURNED',
  'RC_PENDING',
  'SLA_REMINDER',
  'QUOTATION_PENDING_APPROVAL',
  'QUOTATION_APPROVED',
  'PO_OVERDUE',
  'QUOTATION_DEADLINE_NEAR',
  // Novos (Phase 12)
  'QUOTATION_RECEIVED', // proposta de fornecedor registrada
  'PO_GOODS_RECEIVED', // recebimento confirmado (financeiro)
  'BUDGET_EXCEEDED', // RC/OC ultrapassa orcamento
  'RETURN_REGISTERED', // devolucao registrada
  'RETURN_RESOLVED', // resolucao de devolucao concluida
] as const;
```

### KanbanCard com DragOverlay

```typescript
// KanbanCard.tsx — usando useSortable de @dnd-kit/sortable
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function KanbanCard({ card, isOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card }, // payload acessivel no onDragEnd
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card${card.isOverdue ? ' kanban-card--overdue' : ''}${isOverlay ? ' kanban-card--overlay' : ''}`}
      aria-label={`${card.sequentialNumber} — ${card.requesterName}`}
    >
      {/* numero + badges urgencia */}
      {/* solicitante + valor */}
      {/* dias no estagio */}
    </article>
  );
}
```

### Digest email — funcao geradora

```typescript
// digest-mail.service.ts
export async function sendDigestEmail(): Promise<void> {
  // 1. Buscar todos os gerentes de todas as orgs ativas
  const managers = await getDigestRecipients();

  // 2. Para cada gerente, gerar resumo personalizado por org
  for (const manager of managers) {
    const summary = await buildDigestSummary(manager.organizationId);
    const html = renderDigestTemplate(summary);

    // Verificar preferencia antes de enviar
    const wantsEmail = await checkEmailPreference(manager.userId, manager.organizationId, 'DIGEST');
    if (!wantsEmail) continue;

    await sendMail({
      to: manager.email,
      subject: `Resumo de compras — ${new Date().toLocaleDateString('pt-BR')}`,
      text: renderDigestPlainText(summary),
      html,
    });
  }
}
```

---

## State of the Art

| Old Approach               | Current Approach         | When Changed                    | Impact                                                  |
| -------------------------- | ------------------------ | ------------------------------- | ------------------------------------------------------- |
| react-beautiful-dnd        | @dnd-kit                 | 2023 (rbd descontinuado)        | dnd-kit e mais leve, acessivel, sem wrapper obrigatorio |
| HTML5 drag events          | @dnd-kit sensors         | 2022+                           | Funciona em touch, teclado, screen readers              |
| BullMQ para emails simples | nodemailer direto + cron | N/A — projeto nunca teve BullMQ | Mais simples; BullMQ seria overkill para volume baixo   |

**Deprecated/outdated:**

- `react-beautiful-dnd`: Descontinuado desde 2023, nao usar em novos projetos
- `react-dnd`: Mais verboso, exige backend customizado — dnd-kit e a escolha atual do ecossistema React

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Jest 29 (backend) + Vitest (frontend)                                                                                       |
| Config file        | apps/backend/jest.config.js / apps/frontend/vite.config.ts                                                                  |
| Quick run command  | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban\|purchasing-dashboard\|notification-pref"` |
| Full suite command | `pnpm --filter @protos-farm/backend test`                                                                                   |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                                           | Test Type   | Automated Command                                                                     | File Exists? |
| ------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------- | ------------ |
| DASH-01 | GET /org/purchasing/kanban retorna 7 colunas com cards corretos    | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban"`    | Wave 0       |
| DASH-01 | DnD drop em coluna invalida e rejeitado pelo endpoint de transicao | integration | Coberto pelo teste de kanban (testa o endpoint de transicao, nao o DnD em si)         | Wave 0       |
| DASH-01 | Filtros fazenda e urgencia funcionam no endpoint                   | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban"`    | Wave 0       |
| DASH-02 | GET /org/purchasing/dashboard retorna KPIs e dados de graficos     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-dashboard"` | Wave 0       |
| DASH-02 | avgCycleDays calcula corretamente RC_createdAt -> GR_confirmedAt   | unit        | Incluido nos testes do service                                                        | Wave 0       |
| DASH-03 | upsertPreference cria e atualiza preferencia corretamente          | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="notification-pref"`    | Wave 0       |
| DASH-03 | shouldNotify retorna false quando preferencia disabled             | unit        | Incluido nos testes do service                                                        | Wave 0       |
| DASH-03 | createNotification respeita preferencia de canal                   | unit        | Expandir testes de notifications.service                                              | Wave 0       |

### Sampling Rate

- **Por task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban\|purchasing-dashboard\|notification-pref" --passWithNoTests`
- **Por wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Suite completa verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/purchasing-kanban/purchasing-kanban.routes.spec.ts` — cobre DASH-01
- [ ] `apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.routes.spec.ts` — cobre DASH-02
- [ ] `apps/backend/src/modules/notification-preferences/notification-preferences.routes.spec.ts` — cobre DASH-03
- [ ] Migration para `NotificationPreference` model — necessaria antes dos testes de preferencias
- [ ] `@dnd-kit/*` install — antes de implementar KanbanBoard.tsx
- [ ] `node-cron` install — antes de implementar digest.cron.ts

---

## Open Questions

1. **Coluna "PAGO" — janela temporal**
   - What we know: Payables pagos acumulam ilimitadamente
   - What's unclear: Limite ideal — 30 dias? Semana atual? Safra?
   - Recommendation: Usar 30 dias como padrao com opcao de filtro de periodo no kanban

2. **Digest — roles que recebem**
   - What we know: CONTEXT.md diz "digest diario para gerente"
   - What's unclear: E o OWNER? E o FINANCIAL? Quais roles exatamente?
   - Recommendation: Enviar para roles MANAGER e OWNER por padrao; respeitar preferencia de canal

3. **Notificacao de BUDGET_EXCEEDED — timing**
   - What we know: Deve notificar quando RC/OC ultrapassa orcamento
   - What's unclear: Onde exatamente disparar — no endpoint de aprovacao de RC? Na criacao de OC?
   - Recommendation: Disparar na transicao RC -> APROVADA (verificar budget), e na emissao de OC (verificar budget acumulado)

4. **Coluna "EM_COTACAO" — SC em AGUARDANDO_PROPOSTA vs EM_ANALISE**
   - What we know: Ambos os status de SC sao "em cotacao" semanticamente
   - What's unclear: Devo mostrar sub-status visualmente no card?
   - Recommendation: Nao — card mostra apenas "Em Cotacao". Sub-status seria ruido no kanban compacto

---

## Sources

### Primary (HIGH confidence)

- Codigo existente do projeto (leitura direta):
  - `apps/backend/src/modules/notifications/notifications.types.ts` — NOTIFICATION_TYPES existentes
  - `apps/backend/src/modules/notifications/notifications.service.ts` — padrao createNotification, withRlsContext
  - `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — RC_VALID_TRANSITIONS
  - `apps/backend/src/modules/quotations/quotations.types.ts` — SC_VALID_TRANSITIONS
  - `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — OC_VALID_TRANSITIONS
  - `apps/backend/src/modules/goods-receipts/goods-receipts.types.ts` — GR_VALID_TRANSITIONS
  - `apps/backend/src/modules/goods-returns/goods-returns.types.ts` — GR_RETURN_VALID_TRANSITIONS
  - `apps/backend/src/shared/mail/mail.service.ts` — nodemailer configurado
  - `apps/backend/src/database/redis.ts` — ioredis disponivel
  - `apps/frontend/src/pages/FinancialDashboardPage.tsx` — padrao dashboard reutilizavel
  - `apps/frontend/src/components/notifications/NotificationBell.tsx` — bell existente
  - `apps/frontend/src/hooks/useNotifications.ts` — polling 30s, markAsRead
  - `apps/frontend/src/components/layout/Sidebar.tsx` — grupo COMPRAS, posicao de insercao
  - `apps/backend/package.json` — dependencias confirmadas (ioredis, nodemailer, sem BullMQ, sem node-cron)
  - `apps/frontend/package.json` — recharts ^3.7.0, sem @dnd-kit
  - Schema Prisma: modelo Notification existente, enum PayableStatus (PENDING/PAID)
- `.planning/phases/12-kanban-dashboard-e-notifica-es/12-CONTEXT.md` — decisoes de implementacao

### Secondary (MEDIUM confidence)

- Documentacao @dnd-kit (conhecimento do modelo de programacao): DndContext, useSortable, DragOverlay, modifiers — API estavel desde v6
- node-cron: opcao timezone com 'America/Sao_Paulo' — padrao da biblioteca

### Tertiary (LOW confidence)

- Nenhuma fonte LOW confidence utilizada

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — dependencias verificadas diretamente no package.json
- Architecture: HIGH — baseado nos modulos existentes e padroes estabelecidos do projeto
- Pitfalls: HIGH — derivados da analise das state machines existentes e decisoes do STATE.md
- dnd-kit API: MEDIUM — biblioteca estavel mas nao verificada via Context7 nesta sessao

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (bibliotecas estaveis; recharts, dnd-kit, node-cron nao tem breaking changes frequentes)
