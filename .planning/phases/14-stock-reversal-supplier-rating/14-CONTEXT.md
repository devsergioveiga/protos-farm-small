# Phase 14: Stock Reversal + Supplier Rating Completion - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete stock reversal on goods return conclusion and wire supplier rating alert in quotation flow plus performance report. Closes remaining data integrity gaps (stock reversal fires on wrong transition) and UX gaps (no rating alert, no performance report). No new capabilities — fixes and completions of Phase 7, 9, and 11 features.

</domain>

<decisions>
## Implementation Decisions

### Stock reversal timing (data integrity fix)

- Move ALL side-effects from APROVADA to CONCLUIDA transition in goods-returns.service.ts:
  - StockOutput type RETURN creation
  - StockBalance decrement
  - Financial effect (credit Payable / estorno on original Payable)
- APROVADA transition becomes status-only change (no side-effects)
- CANCELADA after APROVADA becomes status-only change (no rollback needed since APROVADA has no side-effects)
- RETURN_RESOLVED notification already fires on CONCLUIDA — keep as-is
- This aligns with business reality: APROVADA = devolucao autorizada (mercadoria pode estar em transito de volta), CONCLUIDA = resolucao confirmada (mercadoria devolvida de fato, ai sim baixa estoque e ajuste financeiro)

### Rating alert in QuotationModal

- Badge inline ao lado do nome do fornecedor na lista de selecao dentro do QuotationModal
- Dois niveis de alerta:
  - Rating < 2: badge vermelho "Avaliacao critica" + tooltip com nota media e numero de avaliacoes
  - Rating >= 2 e < 3: badge amarelo "Avaliacao baixa" + tooltip com nota media e numero de avaliacoes
  - Rating >= 3: sem badge (apenas estrelas normais ja existentes)
- NAO bloqueia selecao — apenas informativo (consistente com decisao Phase 7)
- Escopo: APENAS QuotationModal — nao adicionar em PurchaseOrderModal, GoodsReceiptModal ou SuppliersPage

### Performance report (FORN-03 completion)

- Nova aba "Performance" na ficha do fornecedor (SupplierDetail ou modal expandido)
- Conteudo:
  - Grafico de linha Recharts: evolucao da media geral ao longo do tempo (eixo X = data, eixo Y = nota 1-5)
  - Barras horizontais: breakdown por criterio (prazo, qualidade, preco, atendimento) com nota media de cada
  - Filtro por periodo com presets (ultimo mes, trimestre, ano, todos)
- Backend: novo endpoint GET /org/suppliers/:id/performance?startDate=&endDate= retornando rating history + aggregated breakdown
- Recharts ja instalado e usado nos dashboards anteriores

### Notification wiring

- Manter RETURN_RESOLVED existente (notifica FINANCIAL na CONCLUIDA) — sem notificacoes adicionais
- Nao adicionar notificacao de rating baixo na cotacao (badge visual e suficiente)
- Nao notificar estoquista sobre ajuste de saldo por devolucao (side-effect interno)

### Claude's Discretion

- Layout exato da aba Performance (disposicao grafico + barras)
- Cores dos graficos Recharts (seguindo design system)
- Skeleton loading e empty states
- Posicionamento do badge de rating no QuotationModal
- Tooltip styling e conteudo exato
- Tratamento de fornecedor sem avaliacoes no QuotationModal

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — DEVO-01 (devolucao, especificamente stock reversal), FORN-03 (avaliacao/ranking, especificamente performance report e alert)

### Prior phase context

- `.planning/phases/11-devolu-o-or-amento-e-saving/11-CONTEXT.md` — Devolucao state machine, tipos de acao (TROCA/CREDITO/ESTORNO), StockOutput RETURN, efeitos financeiros
- `.planning/phases/07-cadastro-de-fornecedores/07-CONTEXT.md` — Rating 4 criterios pesos iguais, escala 1-5, Top 3, alerta < 3 na cotacao
- `.planning/phases/09-cota-o-e-pedido-de-compra/09-CONTEXT.md` — QuotationModal com supplier selection e rating display

### Architecture decisions

- `.planning/PROJECT.md` §Key Decisions — "GoodsReceipt is integration hub: CP creation fires only from ReceivingConfirmed event"

### Existing modules (must read before implementing)

- `apps/backend/src/modules/goods-returns/goods-returns.service.ts` — transitionGoodsReturn() lines 302-531, current APROVADA side-effects to move to CONCLUIDA
- `apps/backend/src/modules/goods-returns/goods-returns.types.ts` — GoodsReturnStatus enum, VALID_TRANSITIONS map
- `apps/backend/src/modules/stock-outputs/stock-outputs.types.ts` — STOCK_OUTPUT_TYPES (RETURN already exists)
- `apps/backend/src/modules/suppliers/suppliers.service.ts` — createRating(), listRatings(), computeAverageRating(), getTop3ByCategory()
- `apps/frontend/src/components/quotations/QuotationModal.tsx` — supplier selection with existing star display (lines 290-297)
- `apps/backend/src/modules/notifications/notifications.types.ts` — RETURN_RESOLVED already defined

### Design system

- `docs/design-system/04-componentes.md` — Specs de badges, tooltips, tabs
- `docs/design-system/05-padroes-ux.md` — Voz pt-BR, feedback visual

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `goods-returns.service.ts`: transitionGoodsReturn() — codigo de side-effects ja existe, precisa mover de APROVADA para CONCLUIDA branch
- `stock-outputs.service.ts`: createStockOutput com FEFO — ja usado para tipo RETURN
- `payables.service.ts`: createPayable/updatePayable — ja usado para credito/estorno na devolucao
- `suppliers.service.ts`: computeAverageRating() — reutilizar para calculo no endpoint de performance
- `QuotationModal.tsx`: supplier.rating ja disponivel no frontend — adicionar logica de badge condicional
- Recharts: ja instalado — LineChart para trend, BarChart para breakdown

### Established Patterns

- Backend module: `modules/{domain}/` com service.ts + routes.ts + types.ts
- VALID_TRANSITIONS map + canTransition() para state machine
- Recharts com ResponsiveContainer + Tooltip customizado (ver dashboards existentes)
- Badge component com variantes (warning, danger) no design system
- Tabs component para abas na ficha do fornecedor

### Integration Points

- `goods-returns.service.ts`: mover bloco de side-effects de APROVADA para CONCLUIDA
- `QuotationModal.tsx`: adicionar badge condicional na lista de fornecedores
- `suppliers.routes.ts`: novo endpoint GET /:id/performance
- `suppliers.service.ts`: novo metodo getPerformanceReport()
- Frontend: adicionar aba Performance no componente de detalhe do fornecedor

</code_context>

<specifics>
## Specific Ideas

- Stock reversal e um fix de data integrity — APROVADA nao deveria ter side-effects porque a mercadoria pode nao ter sido devolvida ainda
- Badge de rating segue pattern visual ja definido na Phase 7 (badge amarelo/vermelho), agora implementado de fato no QuotationModal
- Performance report e a conclusao de FORN-03 que foi explicitamente postergado na Phase 7 ("Relatorio de performance completo com graficos e filtro por periodo — Phase 12")
- Barras horizontais para breakdown por criterio — simples e claro, evitar radar chart

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 14-stock-reversal-supplier-rating_
_Context gathered: 2026-03-19_
