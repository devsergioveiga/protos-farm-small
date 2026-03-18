# Phase 11: Devolucao, Orcamento e Saving - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Tres capacidades distintas: (1) Gerente de estoque pode registrar devoluçoes totais ou parciais vinculadas ao recebimento, com reversao automatica de estoque e credito/estorno financeiro. (2) Gerente financeiro pode definir orcamento de compras por categoria e periodo, acompanhando execucao e recebendo alertas de estouro. (3) Gerente pode visualizar saving por cotacao, historico de precos e indicadores de ciclo de compras. Kanban e dashboard executivo sao Phase 12.

</domain>

<decisions>
## Implementation Decisions

### Devolucao de mercadorias (DEVO-01)

- Maquina de estados: PENDENTE -> EM_ANALISE -> APROVADA -> CONCLUIDA / CANCELADA — seguindo padrao VALID_TRANSITIONS
- Numeracao sequencial: DEV-YYYY/NNNN por organizacao (consistente com REC/OC/SC/RC)
- Vinculacao obrigatoria ao GoodsReceipt (goodsReceiptId) — devolucao sempre referencia um recebimento
- Motivo obrigatorio enum: DEFEITO, VALIDADE, PRODUTO_ERRADO, EXCEDENTE, ESPECIFICACAO_DIVERGENTE
- Upload de fotos/laudo: padrao multer existente (como foto de divergencia no recebimento)
- 3 acoes esperadas determinam o tratamento financeiro:
  - TROCA: mantem CP original, aguarda nova entrega (cria novo recebimento quando chegar)
  - CREDITO: cria nota de credito — Payable com valor negativo vinculado ao CP original (abatimento)
  - ESTORNO: cancela ou reduz o CP original (atualiza totalAmount e parcelas)
- Saida automatica de estoque na aprovacao: cria StockOutput tipo RETURN (novo tipo a adicionar ao enum existente) vinculado ao GoodsReceipt
- Notificacao ao fornecedor: notificacao in-app via NotificationBell (email real placeholder, como nas fases anteriores)
- Acompanhamento da resolucao: campo resolutionStatus (PENDING, RESOLVED, EXPIRED) com data limite
- Referencia de NF de devolucao: campos opcionais (numero NF devolucao, data emissao)
- Devolucao parcial: selecao de itens e quantidades a devolver (subset do recebimento)

### Orcamento de compras (FINC-02)

- Modelo PurchaseBudget: categoria (ProductCategory enum), periodo (MENSAL, TRIMESTRAL, SAFRA), centro de custo/fazenda, valor orcado
- Periodo safra: customizavel com data inicio/fim definida pelo gerente (nao fixo jan-dez)
- 4 colunas de acompanhamento: Orcado / Requisitado / Comprado / Pago — calculados em tempo real a partir de RC, OC e Payable
- Alerta de estouro: warning NAO-bloqueante ao aprovar RC ou emitir OC que ultrapassa orcamento — badge amarelo com % excedente
  - Nao bloqueia a operacao (contexto rural, operacoes urgentes nao podem travar)
  - Exibe alerta visual + registra flag budgetExceeded no RC/OC para auditoria
- Dashboard de execucao orcamentaria: barras de progresso por categoria, projecao de gasto (linear baseada no consumo atual)
- Relatorio de desvios: categorias acima de 100% do orcado, com drill-down para RCs/OCs que excederam

### Analise de saving e historico de precos (FINC-03)

- Saving por cotacao: (maior proposta - proposta vencedora) — calculado a partir de QuotationProposalItem
- Saving acumulado por periodo com filtro por categoria e fornecedor
- Historico de preco por produto: grafico de linha temporal com pontos de compra (data + preco unitario) extraidos de PurchaseOrderItem
- Indicadores de ciclo:
  - % compras com cotacao formal (OCs com quotationId vs total)
  - % emergenciais (OCs com isEmergency=true vs total)
  - Prazo medio do ciclo RC -> OC -> Recebimento (em dias)
  - Top 10 produtos por gasto total
  - Top 5 fornecedores por volume total
- Biblioteca de graficos: Recharts (ja usado nos dashboards anteriores)
- Periodo de analise: filtro por data com presets (ultimo mes, trimestre, safra, ano)

### Frontend

- 3 paginas separadas no grupo COMPRAS do sidebar:
  - DevolucoesPage: listagem com filtros + modal de registro + detalhe inline expansivel
  - OrcamentoComprasPage: tabela editavel (categoria x periodo) com barras de progresso por linha
  - SavingAnalysisPage: cards KPI no topo + graficos Recharts abaixo + tabelas de top 10/top 5
- Modal para registro de devolucao (consistente com padrao CLAUDE.md — formularios em modal)
- Sidebar: adicionar "Devoluções", "Orçamento" e "Análise de Saving" ao grupo COMPRAS

### Claude's Discretion

- Design exato dos graficos Recharts (cores, tooltips, responsividade)
- Layout interno da OrcamentoComprasPage (inline edit vs modal de edicao)
- Skeleton loading e empty states
- Espacamento e tipografia (seguindo design system)
- Implementacao tecnica do calculo de projecao de gasto
- Ordem dos cards KPI na SavingAnalysisPage
- Tratamento de periodos sem dados no historico de precos

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — DEVO-01 (devolucao), FINC-02 (orcamento compras), FINC-03 (saving e historico precos)

### Prior phase context

- `.planning/phases/10-recebimento-de-mercadorias/10-CONTEXT.md` — GoodsReceipt model, estado CONFIRMADO, integracao StockEntry+Payable, divergencias
- `.planning/phases/09-cota-o-e-pedido-de-compra/09-CONTEXT.md` — QuotationProposal com precos, PurchaseOrder com snapshot de precos, mapa comparativo
- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — PurchaseRequest com centro de custo, fluxo de aprovacao, NotificationBell

### Architecture decisions

- `.planning/PROJECT.md` §Key Decisions — "GoodsReceipt is integration hub: CP creation fires only from ReceivingConfirmed event"

### Existing modules (integration points)

- `apps/backend/src/modules/goods-receipts/goods-receipts.types.ts` — GoodsReceipt model, ReceivingStatus, GoodsReceiptItem
- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` — confirmGoodsReceipt, listGoodsReceipts
- `apps/backend/src/modules/stock-outputs/stock-outputs.types.ts` — STOCK_OUTPUT_TYPES (CONSUMPTION, MANUAL_CONSUMPTION, TRANSFER, DISPOSAL — adicionar RETURN)
- `apps/backend/src/modules/stock-outputs/stock-outputs.service.ts` — createStockOutput com FEFO automatico
- `apps/backend/src/modules/payables/payables.types.ts` — CreatePayableInput, PayableCategory, PayableOutput
- `apps/backend/src/modules/payables/payables.service.ts` — createPayable, updatePayable
- `apps/backend/src/modules/cost-centers/cost-centers.service.ts` — listCostCenters
- `apps/backend/src/modules/quotations/quotations.service.ts` — QuotationProposalItem com precos por fornecedor
- `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — PurchaseOrder com isEmergency, quotationId
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification pattern

### Design system

- `docs/design-system/04-componentes.md` — Specs de modal, tabela, badges, formularios
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, validacao inline, breadcrumb

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `goods-receipts.service.ts`: GoodsReceipt model com items — base para vinculacao da devolucao
- `stock-outputs.service.ts`: createStockOutput com FEFO — reutilizar para saida de devolucao (adicionar tipo RETURN ao enum)
- `payables.service.ts`: createPayable/updatePayable — reutilizar para credito (valor negativo) e estorno (update totalAmount)
- `cost-centers.service.ts`: listCostCenters — reutilizar para filtro de orcamento por CC
- `quotations.service.ts`: QuotationProposalItem — fonte de dados para calculo de saving
- `purchase-orders.types.ts`: PurchaseOrder com isEmergency/quotationId — fonte para indicadores de ciclo
- `getNextSequentialNumber()`: reutilizar para DEV-YYYY/NNNN
- `notifications.service.ts`: createNotification — reutilizar para alertas de devolucao e orcamento
- Padrao multer upload: reutilizar para fotos/laudo de devolucao
- Recharts: ja instalado — reutilizar para graficos de saving e historico de precos

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts + routes.spec.ts
- Frontend: Page + Modal + hook (ex: GoodsReceiptsPage + GoodsReceiptModal + useGoodsReceipts)
- RLS context: todas as queries via ctx (organizationId)
- `purchases:manage` e `purchases:read` permissions
- Sidebar grupo COMPRAS ja existe
- Maquina de estados com VALID_TRANSITIONS map + canTransition()

### Integration Points

- `app.ts`: registrar goodsReturnsRouter, purchaseBudgetsRouter, savingAnalysisRouter
- `App.tsx`: registrar rotas /goods-returns, /purchase-budgets, /saving-analysis
- Sidebar: adicionar 3 novos itens ao grupo COMPRAS
- Prisma schema: novos modelos GoodsReturn, GoodsReturnItem, PurchaseBudget, PurchaseBudgetLine
- StockOutput enum: adicionar RETURN ao STOCK_OUTPUT_TYPES
- Payable: campo opcional goodsReturnId para rastreabilidade de credito/estorno
- PurchaseRequest/PurchaseOrder: flag budgetExceeded para auditoria de estouro orcamentario

</code_context>

<specifics>
## Specific Ideas

- Devolucao eh vinculada ao recebimento, nao ao pedido — garante rastreabilidade completa (DEV -> REC -> OC -> SC -> RC)
- Orcamento NAO bloqueia operacao — apenas alerta. Contexto rural tem compras emergenciais que nao podem travar
- Saving so faz sentido quando existe cotacao formal — emergenciais sem cotacao nao entram no calculo
- Historico de precos considera todos os OCs (inclusive emergenciais) para dar visao completa de custo
- RETURN como novo tipo de StockOutput mantem separacao clara de saidas por devolucao vs consumo/descarte

</specifics>

<deferred>
## Deferred Ideas

- NF-e de devolucao emissao automatica — requer modulo fiscal separado (Out of Scope)
- Integracao com transportadora para logistica reversa — futuro
- Orcamento vinculado a planejamento de safra detalhado — requer modulo de planejamento agricola
- Barter (troca de producao por insumos) — complexidade contabil, explicitamente fora de escopo

</deferred>

---

_Phase: 11-devolu-o-or-amento-e-saving_
_Context gathered: 2026-03-18_
