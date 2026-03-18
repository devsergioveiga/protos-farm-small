# Phase 9: Cotacao e Pedido de Compra - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Comprador pode criar solicitacao de cotacao a partir de RCs aprovadas, registrar propostas de fornecedores, comparar no mapa comparativo, obter aprovacao da vencedora, e emitir pedido de compra formal (OC) com PDF e envio por email. A cotacao congela precos no momento da emissao do pedido. Recebimento, devolucao e integracao financeira sao fases separadas (Phases 10-11).

</domain>

<decisions>
## Implementation Decisions

### Criacao de cotacao e selecao de fornecedores

- Uma cotacao por RC aprovada — evita complexidade de merge de itens de multiplas RCs
- Selecao de fornecedores via multi-select com sugestao Top 3 por categoria (reusa ranking de Phase 7)
- Prazo de resposta como campo de data limite na solicitacao de cotacao
- Registro de cotacao recebida por WhatsApp/telefone: comprador registra manualmente no sistema (sem integracao externa)
- Fornecedor bloqueado nao aparece na selecao (decisao Phase 7); inativo aparece com aviso visual
- Numero sequencial: SC-YYYY/NNNN (Solicitacao de Cotacao) por organizacao

### Mapa comparativo e registro de propostas

- Layout tabela: fornecedores nas colunas x itens nas linhas — padrao de mapa comparativo
- Destaque visual: menor preco por item em verde, maior em vermelho, diferenca percentual
- Split de fornecedores: comprador pode selecionar fornecedor diferente por item (checkbox por celula)
- Total por fornecedor inclui frete e impostos declarados na proposta
- Historico de precos: badge com ultimo preco pago no mapa comparativo (consulta StockEntry/Payable)
- Calculo de custo financeiro avancado (a vista vs parcelado) postergado — exibir apenas totais
- Campos por proposta: preco unitario, prazo entrega, condicao pagamento, frete, validade da proposta, upload da proposta original (PDF/imagem)

### Aprovacao e geracao do pedido

- Aprovacao simples pelo gerente — justificativa obrigatoria se cotacao vencedora NAO for o menor preco
- Aprovar cotacao gera OC automaticamente em status EMITIDA
- Pedido emergencial: botao que cria OC sem cotacao, com justificativa obrigatoria
- Clone de pedido recorrente: botao "Duplicar" na ficha do OC cria nova OC em RASCUNHO com mesmos itens
- Aprovacao via mobile: comprador/gerente pode aprovar cotacao na tela de pendencias existente (reusa ApprovalAction)

### PDF do pedido e tracking de status

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

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — COTA-01 (solicitacao cotacao), COTA-02 (registro e mapa comparativo), COTA-03 (aprovacao vencedora), PEDI-01 (pedido de compra)

### Prior phase context

- `.planning/phases/07-cadastro-de-fornecedores/07-CONTEXT.md` — Enum categorias compartilhado, rating/ranking, status bloqueado/inativo, padrao de modal e exportacao PDF
- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — Maquina de estados (VALID_TRANSITIONS), numeracao sequencial, NotificationBell, ApprovalAction, notificacoes in-app

### Design system

- `docs/design-system/04-componentes.md` — Specs de modal, botoes, tabela, badges, empty state, formularios
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validacao inline, breadcrumb

### Existing patterns

- `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — RC_VALID_TRANSITIONS, RC_STATUSES, canTransition pattern
- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` — getNextSequentialNumber, transitionPurchaseRequest
- `apps/backend/src/modules/suppliers/suppliers.service.ts` — getTopSuppliersByCategory, supplier rating queries
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification, dispatchPushNotification pattern
- `apps/backend/src/modules/pesticide-prescriptions/pesticide-prescriptions.service.ts` — PDF generation with PDFKit

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `purchase-requests.types.ts`: RC_VALID_TRANSITIONS pattern — reutilizar para maquinas de estados de Quotation e PurchaseOrder
- `getNextSequentialNumber()`: numeracao sequencial em transacao Prisma — reutilizar para SC-YYYY/NNNN e OC-YYYY/NNNN
- `suppliers.service.ts`: getTopSuppliersByCategory — usar para sugestao Top 3 ao criar cotacao
- `notifications.service.ts`: createNotification + NotificationBell — reutilizar para alertas de prazo e aprovacao
- PDFKit: ja instalado e usado em pesticide-prescriptions — reutilizar para PDF da OC
- `ConfirmModal`: componente para acoes destrutivas (cancelar OC, rejeitar cotacao)
- Padrao multer upload: ja usado em varios modulos — reutilizar para upload de proposta

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + Modal + hook (ex: PurchaseRequestsPage + PurchaseRequestModal + usePurchaseRequests)
- RLS context: todas as queries via ctx (organizationId)
- `purchases:manage` e `purchases:read` permissions ja criadas (Phase 7)
- Sidebar grupo COMPRAS ja existe — adicionar itens "Cotacoes" e "Pedidos"
- Maquina de estados com VALID_TRANSITIONS map + canTransition() function

### Integration Points

- `app.ts`: registrar routers de quotations e purchase-orders
- `App.tsx`: registrar rotas /quotations e /purchase-orders com lazy load + ProtectedRoute
- Sidebar: adicionar "Cotacoes" e "Pedidos" ao grupo COMPRAS
- Prisma schema: novos modelos Quotation, QuotationItem, QuotationSupplier, QuotationProposal, QuotationProposalItem, PurchaseOrder, PurchaseOrderItem
- PurchaseRequest: status APROVADA e a entrada — cotacao referencia purchaseRequestId
- PurchaseOrder: referencia quotationId (ou null para emergencial)
- Notifications: novos tipos (QUOTATION_APPROVED, PO_OVERDUE, etc.)

</code_context>

<specifics>
## Specific Ideas

- Cotacao sempre nasce de RC aprovada — exceto pedido emergencial que pula cotacao
- Snapshot de precos no OC: PurchaseOrderItem armazena unitPrice/quantity/total congelados da cotacao aprovada
- Split de fornecedores no mapa comparativo permite selecao granular por item — gera multiplos OCs (um por fornecedor selecionado)
- Mapa comparativo e um dos componentes mais complexos da fase — tabela com scroll horizontal, celulas interativas, calculos de totais dinamicos
- Email de envio do OC pode ser placeholder nesta fase (log + notificacao in-app) — implementacao real de SMTP/SES pode vir em Phase 12 com as notificacoes avancadas

</specifics>

<deferred>
## Deferred Ideas

- Link para preenchimento online pelo fornecedor (portal de cotacao) — listado em v1.2 (NOTI-01), alto custo para ROI rural
- Envio automatico de RFQ por email com template configuravel — v1.2 (NOTI-01)
- Grafico de evolucao de precos por produto — Phase 12 (FINC-03 historico de precos)
- Calculo de custo financeiro avancado (taxa de desconto para a vista vs parcelado) — avaliar em v1.2
- Leilao reverso / bidding — explicitamente fora de escopo (REQUIREMENTS.md Out of Scope)

</deferred>

---

_Phase: 09-cota-o-e-pedido-de-compra_
_Context gathered: 2026-03-17_
