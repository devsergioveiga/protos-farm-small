# Phase 8: Requisição e Aprovação - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Criar requisições de compra (web + mobile) com fluxo de aprovação configurável por alçada de valor/tipo, notificações in-app/push, e histórico auditável. A RC é a porta de entrada do ciclo P2P — cotação (Phase 9), pedido (Phase 9), recebimento (Phase 10) e demais etapas são fases separadas.

</domain>

<decisions>
## Implementation Decisions

### Formulário da RC (web)

- Modal grande full-width com seções: Dados Gerais, Itens (tabela editável), Anexos
- Itens: autocomplete busca no catálogo de produtos (EPIC-10) com fallback para descrição livre. Itens do catálogo vêm com unidade de medida; descrição livre pede unidade manual
- Uma fazenda por RC — para comprar para 2 fazendas, criar 2 RCs. Simplifica rateio de centro de custo e aprovação
- Campos obrigatórios: tipo (enum compartilhado com categorias de fornecedor — Phase 7), fazenda, pelo menos 1 item, urgência
- Campos opcionais: justificativa, centro de custo, data de necessidade, anexos (drag & drop)
- Urgência com 3 níveis e SLA: Normal (sem SLA), Urgente (aprovação em 24h), Emergencial (aprovação em 4h). Emergencial exige justificativa obrigatória
- Número sequencial automático: RC-YYYY/NNNN por organização (padrão getNextSequentialNumber em transação Prisma)

### RC simplificada mobile

- Campos: produto (autocomplete ou texto livre), quantidade, urgência, foto (câmera), observação
- Fazenda vem do contexto do usuário logado
- Geolocalização automática capturada no momento da criação
- Centro de custo NÃO é preenchido pelo operador de campo — fica para o aprovador completar
- Funciona 100% offline: catálogo de produtos sincronizado como reference data (padrão existente). RC salva local, entra na fila de sync (offline-queue.ts). Sem cache de catálogo, fallback para texto livre
- Tela "Minhas Requisições" com lista de RCs, badge de status (Pendente/Aprovada/Rejeitada), filtro por status. Tap abre detalhe read-only

### Fluxo de aprovação

- Máquina de estados com 6 estados (padrão VALID_TRANSITIONS de checks.types.ts):
  - RASCUNHO → PENDENTE → APROVADA / REJEITADA / DEVOLVIDA
  - DEVOLVIDA → PENDENTE (resubmit com edição)
  - APROVADA → CANCELADA (antes de virar cotação na Phase 9)
- Configuração de alçadas por valor + tipo: tela de regras onde gerente define "RC de [tipo] até R$X → [aprovador]; acima → [outro aprovador]; acima de R$Y → aprovação dupla"
- Aprovação dupla é sequencial: primeiro aprovador aprova → RC vai para segundo → segundo aprova → APROVADA. Qualquer um rejeitar → REJEITADA. Ordem definida na regra de alçada
- Delegação temporária: aprovador configura período (de/até) + substituto. Durante o período, pendências vão para o delegado. Histórico registra "aprovado por X (delegado de Y)"
- Aprovação via mobile: tela de pendências no app com ações aprovar/rejeitar/devolver

### Notificações

- Canais: in-app (badge/sino no web) + push notification no mobile. Email postergado para fase futura
- Central de notificações: ícone de sino no header com contador de não-lidas. Click abre dropdown com últimas 20 notificações. Cada item: título, descrição curta, tempo relativo, link para RC. Marcar como lida ao clicar
- Eventos notificados:
  - Solicitante: RC aprovada, RC rejeitada (com motivo), RC devolvida (com motivo)
  - Aprovador: nova RC pendente, lembrete de SLA próximo do vencimento
- Push mobile: mesmos eventos, entregue via Expo Notifications

### Histórico de auditoria

- Timeline vertical de eventos na ficha da RC: criada por X, enviada para aprovação, aprovada por Y (com comentário), etc.
- Cada evento registra: ator, data/hora, ação, comentário opcional
- Comentário obrigatório ao rejeitar ou devolver (motivo). Opcional ao aprovar
- Comentário aparece na notificação enviada e na timeline da RC

### Claude's Discretion

- Design exato do skeleton loading
- Espaçamento e tipografia (seguindo design system)
- Empty state da listagem de RCs
- Layout exato da tela de configuração de alçadas
- Formato da timeline de auditoria (vertical left-aligned, etc.)
- Implementação técnica das push notifications (Expo Notifications setup)
- Modelo de dados da central de notificações (tabela Notification vs solução lightweight)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — REQC-01 (RC web), REQC-02 (RC mobile), REQC-03 (fluxo aprovação)

### Prior phase context

- `.planning/phases/07-cadastro-de-fornecedores/07-CONTEXT.md` — Enum compartilhado de categorias (tipos de RC = categorias de fornecedor), padrões de modal/formulário

### Design system

- `docs/design-system/04-componentes.md` — Specs de modal, botões, tabela, badges, empty state, formulários
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validação inline, breadcrumb

### Existing patterns

- `apps/backend/src/modules/checks/checks.types.ts` — VALID_TRANSITIONS pattern para máquina de estados
- `apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` — getNextSequentialNumber para numeração sequencial em transação
- `apps/mobile/services/offline-queue.ts` — Padrão de fila offline com retry + backoff
- `apps/mobile/services/db/reference-data-repository.ts` — Sync de dados de referência (catálogo de produtos)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `checks.types.ts`: VALID_TRANSITIONS pattern — reutilizar para máquina de estados da RC
- `getNextSequentialNumber()`: numeração sequencial dentro de transação Prisma — reutilizar para RC-YYYY/NNNN
- `offline-queue.ts`: fila de operações offline com retry, backoff, métricas — reutilizar para RC mobile
- `reference-data-repository.ts`: sync de dados de referência — reutilizar para cache de catálogo de produtos no mobile
- `ConfirmModal`: componente para ações destrutivas (rejeitar/cancelar RC)
- `document-validator.ts`: isValidCPF(), isValidCNPJ() — se necessário para validação
- Padrão CSV/XLSX import com multer: se necessário para import de RCs em massa

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + Modal + hook (ex: SuppliersPage + SupplierModal + useSuppliers)
- RLS context: todas as queries via ctx (organizationId) — RC segue mesmo padrão
- `purchases:manage` e `purchases:read` permissions já criadas (Phase 7)
- Sidebar grupo COMPRAS já existe (Phase 7) — adicionar item "Requisições"

### Integration Points

- `app.ts`: registrar router de purchase-requests e approval-rules
- `App.tsx`: registrar rotas /purchase-requests e /approval-rules com lazy load + ProtectedRoute
- Sidebar: adicionar "Requisições" ao grupo COMPRAS existente
- Prisma schema: novos modelos PurchaseRequest, PurchaseRequestItem, ApprovalRule, ApprovalAction, Delegation, Notification
- Mobile: nova tela de criação de RC + tela "Minhas Requisições" + tela de pendências de aprovação
- Header web: adicionar ícone de sino com central de notificações (dropdown)

</code_context>

<specifics>
## Specific Ideas

- Tipos de RC = mesmas categorias de fornecedor (enum compartilhado criado na Phase 7): Insumo Agrícola, Pecuário, Peças, Combustível, EPI, Serviços etc.
- Numeração RC-YYYY/NNNN segue padrão de receituário agronômico (sequencial por org)
- Operador de campo não preenche centro de custo — simplifica a RC mobile e o aprovador ajusta
- Rascunho permite salvar RC incompleta sem enviar para aprovação — útil para RCs complexas com muitos itens
- Central de notificações é componente genérico — pode ser reusado por fases futuras (cotação, pedido, recebimento)

</specifics>

<deferred>
## Deferred Ideas

- Notificação por email — requer configuração de infra SMTP/SES, fase futura
- Digest diário para aprovadores — agrupamento de pendências por email, fase futura (DASH-03)
- Configuração de preferências de notificação por canal — Phase 12 (DASH-03)
- SLA com escalação automática (se não aprovar em X horas, escalar para superior) — complexidade adicional, avaliar em v1.2

</deferred>

---

_Phase: 08-requisi-o-e-aprova-o_
_Context gathered: 2026-03-17_
