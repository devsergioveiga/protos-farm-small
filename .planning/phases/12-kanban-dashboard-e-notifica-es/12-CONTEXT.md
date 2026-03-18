# Phase 12: Kanban, Dashboard e Notificações - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprador e gerente têm visibilidade total do fluxo de compras via kanban operacional com DnD que executa transições reais, dashboard executivo com KPIs e gráficos Recharts, e notificações expandidas (badge in-app + email) com preferências por canal e digest diário. Push mobile está FORA DE ESCOPO (mobile financeiro fora de escopo).

</domain>

<decisions>
## Implementation Decisions

### Kanban board

- Fluxo unificado — um único board com 7 colunas: RC Pendente | RC Aprovada | Em Cotação | OC Emitida | Aguardando Entrega | Recebido | Pago
- Drag-and-drop com ação real — arrastar executa transição de estado. Biblioteca: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Todas as transições DnD exigem ConfirmModal** — cada drop mostra modal com título/mensagem específico por transição (ver tabela na UI-SPEC). Evita transições acidentais
- Cards compactos: número sequencial + tipo/urgência (badge) + solicitante + valor total + dias no estágio
- Filtros essenciais: Fazenda + Urgência + Busca por número
- Contadores por coluna (badge com quantidade)
- Alertas visuais: borda vermelha para itens vencidos/acima do SLA
- Transições válidas: DnD só permite soltar em colunas válidas; inválidas ficam desabilitadas durante drag (opacity 0.4 + aria-disabled)
- **Coluna PAGO: últimos 30 dias** — counter badge exibe total histórico, link "Ver todos" abre listagem filtrada. Evita sobrecarga de cards
- **EM_COTAÇÃO: sem sub-status** — card mostra apenas "Em Cotação", sem diferenciar Aguardando Proposta vs Em Análise. Sub-status seria ruído no kanban compacto
- **RECEBIDO → PAGO: automático** — quando Payable muda para PAID, card migra para PAGO no próximo refresh. Sem DnD nessa transição — é consequência do pagamento no financeiro

### Dashboard executivo

- 4 KPIs com YoyBadge: RCs pendentes de aprovação, OCs em atraso, Prazo médio do ciclo, Entregas atrasadas
- **KPIs clicáveis apenas os problemáticos:** "OCs em atraso" e "Entregas atrasadas" navegam para kanban com filtro. "RCs pendentes" navega para /purchase-requests. "Prazo médio" NÃO é clicável (não é acionável)
- 4 gráficos Recharts (lazy-loaded): volume por etapa (bar), compras por categoria (pie/donut), evolução mensal 12 meses (line), urgentes vs planejadas (stacked bar)
- **Alertas como contadores com link** — "4 OCs vencidas" como link para kanban filtrado. Padrão FinancialDashboard — dashboard é visão geral, detalhes no kanban
- **Presets de período: Mês, Trimestre, Safra, Custom** — Safra alinha com ciclo agrícola (ex: jul-jun). Custom permite date picker. Sem "Ano" separado — custom cobre
- Filtro de fazenda (FarmSelector existente)
- **Saving acumulado NÃO aparece no dashboard** — manter exclusivo na SavingAnalysisPage (Phase 11). Evita duplicar dados e manter dois locais sincronizados

### Notificações e preferências

- 2 canais: Badge in-app (NotificationBell existente) + Email (nodemailer existente). Push mobile FORA DE ESCOPO
- 5 novos tipos de evento: QUOTATION_RECEIVED, PO_OVERDUE, PO_GOODS_RECEIVED, BUDGET_EXCEEDED, RETURN_REGISTERED, RETURN_RESOLVED
- **DAILY_DIGEST como tipo separado** — usuário pode desativar digest independentemente. Na tabela de preferências: coluna Email habilitada, coluna Badge desabilitada (cinza)
- Tela de preferências: tabela tipo × canal (badge/email), toggle on/off por célula. Auto-save sem botão submit
- **Digest diário: MANAGER + OWNER por padrão** — outros roles podem optar via preferências. FINANCIAL recebe apenas se habilitar
- **BUDGET_EXCEEDED: disparo duplo** — alerta na aprovação da RC (orçamento requisitado) E na emissão da OC (orçamento comprometido). Captura ambos os momentos de decisão
- **Email templates: HTML simples com header** — header com logo Protos Farm + nome da org. Body com conteúdo. Footer com link de preferências. Sem template engine complexa (mjml/react-email)
- Digest: email resumo matinal via cron job (node-cron + Redis lock)

### Integração entre telas

- Dashboard KPI → Kanban via query params (ex: /purchasing-kanban?filter=overdue_po)
- Notificação → Entidade direta (padrão existente /purchase-requests?highlight=RC-001, NÃO para kanban)
- 2 novos itens no TOPO do grupo COMPRAS na Sidebar: "Dashboard Compras" (/purchasing-dashboard) e "Kanban" (/purchasing-kanban)
- Preferências em /notification-preferences (grupo CONFIGURAÇÃO)

### Claude's Discretion

- @dnd-kit/sortable ou @dnd-kit/core puro (depende da complexidade de reorder)
- Design exato dos cards do kanban (cores, sombras, hover states) — seguir UI-SPEC
- Layout responsivo do kanban (scroll horizontal em telas menores)
- Design exato dos gráficos Recharts (cores, tooltips, legends)
- Skeleton loading e empty states
- Implementação do cron job para digest (node-cron com Redis lock)
- Ordem exata dos alertas na seção de alertas do dashboard
- Layout interno da tela de preferências de notificação

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Design Contract

- `.planning/phases/12-kanban-dashboard-e-notifica-es/12-UI-SPEC.md` — Contrato visual completo: component inventory, kanban card anatomy, dashboard layout, animation contract, accessibility contract, copywriting contract, responsive contract

### Technical Research

- `.planning/phases/12-kanban-dashboard-e-notifica-es/12-RESEARCH.md` — Architecture patterns, dnd-kit setup, node-cron digest, NotificationPreference schema, kanban endpoint aggregation strategy, pitfalls

### Requirements

- `.planning/REQUIREMENTS.md` — DASH-01 (kanban), DASH-02 (dashboard executivo), DASH-03 (notificações + preferências)

### Design System

- `docs/design-system/04-componentes.md` — Specs de modal, botões, tabela, badges, empty state
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validação inline

### Existing Patterns

- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — Padrão dashboard reutilizável (KPI cards + YoyBadge + Recharts lazy + alertas)
- `apps/frontend/src/components/notifications/NotificationBell.tsx` — Bell existente para expandir com novos tipos
- `apps/frontend/src/hooks/useNotifications.ts` — Polling 30s, markAsRead
- `apps/backend/src/modules/notifications/notifications.types.ts` — NOTIFICATION_TYPES existentes
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification, shouldNotify pattern
- `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — RC_VALID_TRANSITIONS
- `apps/backend/src/shared/mail/mail.service.ts` — nodemailer configurado
- `apps/backend/src/database/redis.ts` — ioredis disponível

### Prior Phase Context

- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — NotificationBell criado, padrão VALID_TRANSITIONS, central de notificações
- `.planning/phases/11-devolu-o-or-amento-e-saving/11-CONTEXT.md` — Budget model, saving analysis, return flow

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `FinancialDashboardPage.tsx` + `.css`: Padrão completo de dashboard — KPI cards, YoyBadge, Recharts lazy com Suspense, seção de alertas, skeleton loading. Reutilizar estrutura inteira
- `NotificationBell.tsx`: Sino com contador, dropdown, markAsRead — expandir switch para novos tipos
- `useNotifications.ts`: Hook com polling 30s — reutilizar, adicionar novos tipos ao mapping
- `ConfirmModal`: Componente para ações destrutivas — reutilizar para drag confirm no kanban
- `FarmSelector`: Componente de seleção de fazenda — reutilizar nos filtros de kanban e dashboard
- `VALID_TRANSITIONS` pattern: 5 state machines existentes — fonte de verdade para validação de drops no kanban

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + hook (ex: FinancialDashboardPage + useFinancialDashboard)
- RLS context: todas as queries via ctx (organizationId)
- `purchases:manage` e `purchases:read` permissions já criadas (Phase 7)
- Sidebar grupo COMPRAS já existe — adicionar itens no topo

### Integration Points

- `app.ts`: registrar routers de purchasing-kanban, purchasing-dashboard, notification-preferences
- `App.tsx`: registrar rotas /purchasing-dashboard, /purchasing-kanban, /notification-preferences com lazy load + ProtectedRoute
- Sidebar: adicionar "Dashboard Compras" e "Kanban" no topo do grupo COMPRAS
- Prisma schema: novo modelo NotificationPreference
- Notifications: expandir NOTIFICATION_TYPES com 5+1 novos tipos (+ DAILY_DIGEST)
- main.ts: iniciar cron job para digest após DB e Redis prontos

</code_context>

<specifics>
## Specific Ideas

- Dashboard segue EXATAMENTE o padrão FinancialDashboardPage — KPI cards, YoyBadge, Recharts lazy, alertas section, skeleton loading. Não reinventar
- Kanban é a única feature genuinamente nova em termos de padrão UI — dnd-kit nunca usado no projeto
- NotificationType deve ser importado de um único lugar (backend types) — sincronizar frontend manualmente até mover para @protos-farm/shared
- Opt-out model para preferências: ausência de registro = habilitado. Usuário desabilita explicitamente
- Email de digest: resumo matinal com seções (RCs pendentes, OCs em atraso, entregas atrasadas, devoluções pendentes)

</specifics>

<deferred>
## Deferred Ideas

- Push notifications mobile — mobile financeiro fora de escopo
- WebSocket para notificações real-time (substituir polling 30s) — v1.2
- Kanban customizável (usuário escolhe colunas) — complexidade alta, pouco ROI
- Notificação por WhatsApp — requer integração externa
- Mover NotificationType para @protos-farm/shared — refactor futuro
- Escalação automática de SLA (se não aprovar em X horas, escalar para superior) — v1.2

</deferred>

---

_Phase: 12-kanban-dashboard-e-notifica-es_
_Context gathered: 2026-03-18_
