# Phase 10: Recebimento de Mercadorias - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Conferente pode registrar o recebimento de mercadorias em 6 cenarios distintos (NF+mercadoria simultanea, NF antecipada, mercadoria antecipada, parcial, NF fracionada, emergencial sem pedido). A confirmacao do recebimento cria automaticamente entrada no estoque (para insumos) e conta a pagar — de forma atomica e sem dupla entrada. Devolucao e troca sao Phase 11. Dashboard e kanban sao Phase 12.

</domain>

<decisions>
## Implementation Decisions

### Maquina de estados e 6 cenarios

- Status do recebimento: PENDENTE -> EM_CONFERENCIA -> CONFERIDO -> CONFIRMADO / REJEITADO — seguindo padrao VALID_TRANSITIONS (como RC e OC)
- Campo `receivingType` enum para diferenciar os 6 cenarios: STANDARD (NF+mercadoria simultanea), NF_ANTECIPADA (NF chegou antes da mercadoria), MERCADORIA_ANTECIPADA (mercadoria chegou antes da NF — entrada provisoria/bloqueada), PARCIAL (entrega parcial com saldo pendente), NF_FRACIONADA (multiplas NFs de fornecedores diferentes para mesmo pedido), EMERGENCIAL (compra sem pedido formal)
- Numeracao sequencial: REC-YYYY/NNNN por organizacao (consistente com SC-YYYY/NNNN e OC-YYYY/NNNN)
- Recebimento parcial: tracking de qty recebida vs qty pedida no PurchaseOrder, saldo pendente permite novos recebimentos ate completar
- PurchaseOrder transiciona para ENTREGUE somente quando 100% dos itens foram recebidos

### NF e conferencia fisica

- Campos da NF por digitacao manual: numero, serie, CFOP, data de emissao, valor total, chave de acesso (opcional, 44 digitos) — sem import XML (fora de escopo)
- Conferencia item a item: tabela com colunas qty pedida, qty NF, qty recebida, com acao por item (aceitar, registrar divergencia)
- Conferencia de qualidade: campos opcionais por item (visual OK/NOK, lote, validade, observacoes)
- Alerta de divergencia >5% entre qty pedida e qty recebida: badge visual na linha do item + alerta amarelo no topo do formulario
- Somente web nesta fase — mobile financeiro esta fora de escopo (REQUIREMENTS.md Out of Scope)

### Tratamento de divergencias

- 5 tipos de divergencia: A_MAIS, A_MENOS, SUBSTITUIDO, DANIFICADO, ERRADO — com campo de observacao e upload de foto
- 3 acoes por divergencia: DEVOLVER (gera pendencia para Phase 11), ACEITAR_COM_DESCONTO (ajusta valor do item), REGISTRAR_PENDENCIA (fica como nota sem acao imediata)
- Upload de foto por divergencia: vinculada ao item divergente, usando padrao multer existente
- Divergencia >5% gera alerta visual mas nao bloqueia a confirmacao (decisao do conferente)

### Integracao atomica (Estoque + CP)

- Na transicao CONFERIDO -> CONFIRMADO: criar StockEntry + Payable dentro de uma UNICA transacao Prisma (atomicidade — per decision "GoodsReceipt is integration hub")
- CP nunca criado na aprovacao do OC — somente no recebimento confirmado (evita duplicidade em entregas parciais)
- StockEntry usa o modulo existente `stock-entries` — reusa createStockEntry com items mapeados do recebimento
- Payable usa o modulo existente `payables` — reusa createPayable com fornecedor, valor da NF, vencimentos da condicao de pagamento do OC
- Parcelas automaticas: se OC tem condicao 30/60/90, CP gerado com 3 parcelas (installmentCount=3)
- Centro de custo: herdado do PurchaseRequest original (rastreabilidade RC->cotacao->OC->recebimento->CP)
- NF antecipada: CP criado com status PENDENTE normal + flag provisional, mercadoria quando chega confirma o recebimento e remove flag
- Mercadoria antecipada: StockEntry criado em status DRAFT (bloqueado para consumo), confirmado automaticamente quando NF eh registrada
- Despesas acessorias de fornecedores diferentes: geram CPs separados por fornecedor de despesa, todos vinculados ao mesmo recebimento (referenceId/referenceType)
- Referencia cruzada completa: CP armazena goodsReceiptId -> que tem purchaseOrderId -> que tem quotationId -> que tem purchaseRequestId (drill-down navegavel)

### Frontend

- Pagina GoodsReceiptsPage com tabs: Recebimentos (lista) + Pendencias (OCs aguardando entrega)
- Modal GoodsReceiptModal para criacao/edicao com wizard-like steps: (1) selecionar OC ou criar emergencial, (2) dados da NF, (3) conferencia item a item, (4) resumo e confirmacao
- Detalhe inline ou modal expandido para visualizar recebimento ja confirmado com drill-down para OC, cotacao, RC
- Sidebar: adicionar "Recebimentos" ao grupo COMPRAS (apos "Pedidos")
- Dashboard de pendencias: badge com contagem de OCs vencidas/proximas da entrega

### Claude's Discretion

- Design exato do wizard de recebimento (steps visuais vs sections em scroll)
- Layout da tabela de conferencia (responsividade, scroll horizontal)
- Skeleton loading e empty states
- Espacamento e tipografia (seguindo design system)
- Tratamento de erros de upload de foto
- Ordem e agrupamento de campos no formulario da NF
- Implementacao tecnica do mapeamento StockEntry items (conversao de unidades se aplicavel)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — RECE-01 (6 cenarios recebimento), RECE-02 (conferencia fisica), RECE-03 (integracao estoque/ativo), FINC-01 (geracao automatica CP)

### Prior phase context

- `.planning/phases/09-cota-o-e-pedido-de-compra/09-CONTEXT.md` — PurchaseOrder state machine (OC_VALID_TRANSITIONS), numeracao OC-YYYY/NNNN, snapshot de precos, split de fornecedores
- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — PurchaseRequest state machine, numeracao RC, NotificationBell, centro de custo
- `.planning/phases/07-cadastro-de-fornecedores/07-CONTEXT.md` — Supplier model, categorias, padrao modal/exportacao

### Architecture decisions

- `.planning/PROJECT.md` §Key Decisions — "GoodsReceipt is integration hub: CP creation fires only from ReceivingConfirmed event"
- `.planning/PROJECT.md` §Key Decisions — "Price snapshot on PO: PurchaseOrder snapshots unitPrice/quantity/total at issuance"

### Existing modules (integration points)

- `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — OC_VALID_TRANSITIONS, OcStatus, CreateEmergencyPOInput
- `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` — transitionPurchaseOrder, PO queries
- `apps/backend/src/modules/stock-entries/stock-entries.types.ts` — CreateStockEntryInput, StockEntryItemInput, expense types
- `apps/backend/src/modules/stock-entries/stock-entries.service.ts` — createStockEntry, confirmStockEntry
- `apps/backend/src/modules/payables/payables.types.ts` — CreatePayableInput, CostCenterItemInput, PayableCategory
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification pattern

### Design system

- `docs/design-system/04-componentes.md` — Specs de modal, wizard, tabela, badges, formularios
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validacao inline, breadcrumb

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `purchase-orders.types.ts`: OC_VALID_TRANSITIONS + canOcTransition() — reutilizar padrao para GoodsReceipt state machine
- `stock-entries.service.ts`: createStockEntry() — chamar diretamente para criar entrada de estoque a partir do recebimento confirmado
- `payables.service.ts`: createPayable() — chamar para criar CP automatico com dados do recebimento + NF
- `getNextSequentialNumber()`: reutilizar para REC-YYYY/NNNN
- `notifications.service.ts`: createNotification + dispatchPushNotification — alertas de recebimento pendente/confirmado
- `ConfirmModal`: acoes destrutivas (rejeitar recebimento)
- Padrao multer upload: reutilizar para foto de divergencia
- `StockEntryExpenseInput`: modelo de despesas acessorias ja existente — reutilizar para despesas do recebimento

### Established Patterns

- Backend module: `modules/goods-receipts/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + Modal + hook (GoodsReceiptsPage + GoodsReceiptModal + useGoodsReceipts)
- RLS context: todas as queries via ctx (organizationId)
- `purchases:manage` e `purchases:read` permissions ja criadas (Phase 7)
- Sidebar grupo COMPRAS ja existe — adicionar item "Recebimentos"
- Maquina de estados com VALID_TRANSITIONS map + canTransition() function
- Prisma transaction pattern para operacoes atomicas multi-modelo

### Integration Points

- `app.ts`: registrar goodsReceiptsRouter
- `App.tsx`: registrar rota /goods-receipts com lazy load + ProtectedRoute
- Sidebar: adicionar "Recebimentos" ao grupo COMPRAS
- Prisma schema: novos modelos GoodsReceipt, GoodsReceiptItem, GoodsReceiptDivergence
- PurchaseOrder: campo receivedQuantity ou relacao com GoodsReceipt para tracking parcial
- StockEntry: novo campo opcional goodsReceiptId para rastreabilidade
- Payable: novo campo opcional goodsReceiptId para rastreabilidade (drill-down)
- Notifications: novos tipos (GOODS_RECEIVED, GOODS_RECEIPT_DIVERGENCE, etc.)

</code_context>

<specifics>
## Specific Ideas

- Confirmacao do recebimento eh o "trigger" central — tudo acontece nesse momento (estoque + CP) dentro de uma transacao
- Recebimento parcial: cada entrega gera seu proprio StockEntry e CP separados, PO so vai para ENTREGUE quando 100% recebido
- NF antecipada: CP provisorio criado com flag, goods receipt fica em PENDENTE ate mercadoria chegar
- Mercadoria antecipada: StockEntry em DRAFT impede consumo ate NF ser registrada (seguranca fiscal)
- Cenario emergencial: recebimento sem OC vinculado — requer justificativa (como pedido emergencial da Phase 9)
- NF fracionada: um OC pode ter multiplos recebimentos de fornecedores de despesa diferentes (frete de um, seguro de outro)
- Referencia cruzada completa permite drill-down: CP -> Recebimento -> OC -> Cotacao -> RC (4 niveis)

</specifics>

<deferred>
## Deferred Ideas

- Import XML da NF-e (SEFAZ schema) — fora de escopo per REQUIREMENTS.md (requer modulo fiscal separado)
- Recebimento via mobile — mobile financeiro fora de escopo per REQUIREMENTS.md
- Cadastro de ativo (equipamentos) no recebimento — Phase 11 ou futuro (RECE-03 menciona mas foco eh insumos)
- CTE (Conhecimento de Transporte Eletronico) import — futuro, complexidade fiscal

</deferred>

---

_Phase: 10-recebimento-de-mercadorias_
_Context gathered: 2026-03-17_
