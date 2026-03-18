# Phase 12: Kanban, Dashboard e Notificacoes - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprador e gerente tem visibilidade total do fluxo de compras via kanban unificado do ciclo P2P e dashboard executivo operacional, com notificacoes por badge (in-app) e email em cada etapa relevante do processo. Inclui tela de preferencias de notificacao por canal e digest diario. Nao inclui push mobile (mobile financeiro fora de escopo) nem novas funcionalidades de compras.

</domain>

<decisions>
## Implementation Decisions

### Kanban board

- **Fluxo unificado** — um unico board com colunas representando etapas do ciclo P2P: RC Pendente | RC Aprovada | Em Cotacao | OC Emitida | Aguardando Entrega | Recebido | Pago
- **Drag-and-drop com acao real** — arrastar card entre colunas executa a transicao de estado (com modal de confirmacao quando necessario, ex: aprovar RC exige justificativa). Instalar `@dnd-kit/core` + `@dnd-kit/sortable`
- **Cards compactos** — cada card mostra: numero sequencial + tipo/urgencia (badge) + solicitante + valor total + dias no estagio. Sem itens detalhados no card
- **Filtros essenciais** — Fazenda + Urgencia + Busca por numero. Sem filtros avancados nesta fase
- **Contadores por coluna** — badge com quantidade de cards em cada coluna
- **Alertas visuais** — cards com borda vermelha para itens vencidos/acima do SLA
- **Transicoes validas** — DnD so permite soltar em colunas que sao transicoes validas (baseado nos VALID_TRANSITIONS de cada entidade). Colunas invalidas ficam desabilitadas durante o drag

### Dashboard executivo

- **Foco operacional** — voltado para quem gerencia o dia a dia de compras (comprador, gerente)
- **4 KPIs principais** com badge YoY (comparativo periodo anterior, reutilizando YoyBadge existente):
  - RCs pendentes de aprovacao
  - OCs em atraso (prazo de entrega vencido)
  - Prazo medio do ciclo (RC -> Recebimento, em dias)
  - Entregas atrasadas (GoodsReceipts pendentes com OC vencida)
- **4 graficos Recharts** (lazy-loaded com Suspense, padrao existente):
  - Volume por etapa do ciclo P2P (bar chart)
  - Compras por categoria de produto (pie/donut chart)
  - Evolucao mensal de compras (line chart, ultimos 12 meses)
  - Urgentes vs planejadas por mes (stacked bar chart)
- **Secao de alertas** (padrao FinancialDashboard): OCs vencidas, RCs acima do SLA, orcamento estourado, entregas atrasadas
- **Filtros** — Fazenda + Periodo (com presets: mes, trimestre, safra, ano)
- **Drill-down** — KPIs clicaveis navegam para kanban com filtro aplicado (ex: clicar "OCs em atraso" abre /purchasing-kanban?filter=overdue_po)

### Notificacoes e preferencias

- **2 canais** — Badge in-app (NotificationBell existente) + Email (nodemailer existente). Push mobile fora de escopo
- **Novos tipos de evento** (alem dos existentes RC_APPROVED, RC_REJECTED, SLA_REMINDER):
  - QUOTATION_RECEIVED — comprador notificado quando proposta de fornecedor e registrada
  - QUOTATION_APPROVED — comprador notificado quando gerente aprova cotacao
  - PO_OVERDUE — comprador notificado quando prazo de entrega da OC vence
  - GOODS_RECEIVED — financeiro notificado quando recebimento e confirmado
  - BUDGET_EXCEEDED — gerente financeiro notificado quando RC/OC ultrapassa orcamento
  - RETURN_REGISTERED — gerente notificado quando devolucao e registrada
  - RETURN_RESOLVED — estoquista notificado quando resolucao da devolucao e concluida
- **Tela de preferencias** — tabela com tipos de evento (linhas) x canais badge/email (colunas). Toggle on/off por celula. Acessivel via menu do usuario ou sidebar Configuracoes
- **Digest diario** — email resumo matinal para gerente: RCs pendentes, OCs em atraso, entregas previstas, orcamento estourado. Requer cron job (node-cron ou similar)
- **Email templates** — templates HTML para cada tipo de notificacao + template de digest. Voz em pt-BR coloquial (per design system)

### Integracao entre telas

- **Dashboard KPI -> Kanban** — KPIs sao clicaveis, navegam para /purchasing-kanban com query param de filtro
- **Notificacao -> Entidade** — clicar na notificacao navega direto para a pagina da entidade (padrao existente: /purchase-requests?highlight=RC-001). Nao navega para kanban
- **Paginas separadas no sidebar** — 2 novos itens: "Dashboard Compras" e "Kanban" como primeiros itens do grupo COMPRAS (antes de Fornecedores)
- **Rotas** — /purchasing-dashboard e /purchasing-kanban
- **Preferencias de notificacao** — acessivel via rota /notification-preferences (pode ficar em Configuracoes ou link no dropdown do NotificationBell)

### Claude's Discretion

- Biblioteca dnd-kit: escolha entre @dnd-kit/core puro ou @dnd-kit/sortable (dependendo da complexidade)
- Design exato dos cards do kanban (cores, sombras, hover states)
- Layout responsivo do kanban (scroll horizontal em telas menores)
- Design exato dos graficos Recharts (cores, tooltips, legends)
- Skeleton loading e empty states
- Implementacao do cron job para digest (node-cron, BullMQ scheduler, ou outra abordagem)
- Ordem exata dos alertas na secao de alertas do dashboard
- Layout interno da tela de preferencias de notificacao

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — DASH-01 (kanban fluxo compras), DASH-02 (dashboard executivo), DASH-03 (notificacoes push/email/badge + preferencias)

### Prior phase context

- `.planning/phases/09-cota-o-e-pedido-de-compra/09-CONTEXT.md` — Quotation state machine, PurchaseOrder state machine (OC_VALID_TRANSITIONS), numeracao SC/OC, mapa comparativo
- `.planning/phases/10-recebimento-de-mercadorias/10-CONTEXT.md` — GoodsReceipt state machine (6 cenarios), integracao atomica StockEntry+Payable, conferencia
- `.planning/phases/11-devolu-o-or-amento-e-saving/11-CONTEXT.md` — GoodsReturn state machine, PurchaseBudget model, saving analysis, alertas de orcamento
- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — PurchaseRequest state machine, NotificationBell, ApprovalAction, numeracao RC

### Architecture decisions

- `.planning/PROJECT.md` §Key Decisions — "GoodsReceipt is integration hub", "BullMQ for async email"

### Existing modules (integration points)

- `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — RC_VALID_TRANSITIONS, RC_STATUSES, PurchaseRequestStatus
- `apps/backend/src/modules/quotations/quotations.types.ts` — SC_VALID_TRANSITIONS, QuotationStatus
- `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — OC_VALID_TRANSITIONS, OcStatus
- `apps/backend/src/modules/goods-receipts/goods-receipts.types.ts` — GR_VALID_TRANSITIONS, ReceivingStatus
- `apps/backend/src/modules/goods-returns/goods-returns.types.ts` — RETURN_VALID_TRANSITIONS, ReturnStatus
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification, listNotifications, markAsRead, getUnreadCount
- `apps/backend/src/modules/notifications/notifications.types.ts` — NOTIFICATION_TYPES, CreateNotificationInput
- `apps/backend/src/shared/mail/mail.service.ts` — sendMail (nodemailer), MailOptions
- `apps/backend/src/modules/payables/payables.service.ts` — Payable queries for "Pago" column tracking

### Frontend patterns

- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — KPI cards, YoyBadge, Recharts lazy loading, alerts section, skeleton, filters
- `apps/frontend/src/components/notifications/NotificationBell.tsx` — Bell icon, dropdown, unread badge, navigation on click
- `apps/frontend/src/hooks/useNotifications.ts` — 30s polling, markAsRead, markAllAsRead
- `apps/frontend/src/components/layout/Sidebar.tsx` — NavGroup structure, COMPRAS group (lines ~203-215)

### Design system

- `docs/design-system/04-componentes.md` — Specs de modal, botoes, tabela, badges, empty state
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validacao inline, breadcrumb
- `docs/design-system/08-animacoes-micro-interacoes.md` — Duracoes de animacao (200ms dropdown, 300ms modal)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `NotificationBell.tsx` + `useNotifications.ts`: sistema de notificacoes in-app completo (badge, dropdown, polling 30s, mark as read, navegacao)
- `FinancialDashboardPage.tsx`: padrao completo de dashboard (KPI cards, YoyBadge, Recharts lazy, alerts section, skeleton loading, farm/period filters)
- `mail.service.ts`: nodemailer configurado e funcional (SMTP via env vars)
- `notifications.service.ts`: CRUD de notificacoes + createNotification + dispatchPushNotification (placeholder)
- `VALID_TRANSITIONS` maps: 5 maquinas de estado completas (RC, SC, OC, GR, GR Return) — base para kanban columns e DnD validation
- `getNextSequentialNumber()`: padrao de numeracao sequencial reutilizavel
- `ConfirmModal`: modal de confirmacao para acoes de transicao no kanban
- Recharts: ja instalado e usado em dashboards existentes
- Status badges com icones: padrao existente em PurchaseRequestsPage, QuotationsPage, PurchaseOrdersPage

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + hook (ex: DashboardPage + useDashboard)
- RLS context: todas as queries via ctx (organizationId)
- `purchases:manage` e `purchases:read` permissions ja criadas
- Sidebar grupo COMPRAS ja existe com 9 itens
- Lazy loading de componentes pesados (graficos) com React.lazy + Suspense
- Skeleton loading com `aria-busy="true"` e `aria-live="polite"`

### Integration Points

- `app.ts`: registrar purchasingDashboardRouter, purchasingKanbanRouter, notificationPreferencesRouter
- `App.tsx`: registrar rotas /purchasing-dashboard, /purchasing-kanban, /notification-preferences
- Sidebar: adicionar "Dashboard Compras" e "Kanban" no TOPO do grupo COMPRAS
- Prisma schema: novo modelo NotificationPreference (userId, eventType, channel, enabled)
- notifications.types.ts: expandir NOTIFICATION_TYPES com 7 novos tipos
- notifications.service.ts: adicionar logica de verificacao de preferencias antes de enviar
- mail.service.ts: usar para envio de emails de notificacao + digest

</code_context>

<specifics>
## Specific Ideas

- Kanban unificado e o principal diferencial — usuario ve o fluxo P2P completo sem trocar de pagina
- DnD com validacao de transicao evita erros (nao deixa arrastar para coluna invalida)
- Cards compactos permitem ver muitos itens por coluna sem scroll excessivo
- Dashboard drill-down para kanban cria fluxo natural: "vejo o problema no dashboard, clico e vejo os itens no kanban"
- Digest diario funciona como "briefing matinal" para o gerente — resume tudo que precisa de atencao
- Preferencias por tipo x canal da controle granular sem overload (email so para o importante, badge para tudo)

</specifics>

<deferred>
## Deferred Ideas

- Push notifications mobile — mobile financeiro fora de escopo per REQUIREMENTS.md
- Websocket para notificacoes real-time (substituir polling 30s) — melhoria de performance futura
- Kanban customizavel (usuario escolhe colunas) — complexidade alta para ROI baixo no contexto rural
- Dashboard estrategico (saving acumulado, comparativo com periodo anterior detalhado) — SavingAnalysisPage ja cobre parte disso
- Notificacao por WhatsApp — integracao externa, alto custo

</deferred>

---

_Phase: 12-kanban-dashboard-e-notifica-es_
_Context gathered: 2026-03-18_
