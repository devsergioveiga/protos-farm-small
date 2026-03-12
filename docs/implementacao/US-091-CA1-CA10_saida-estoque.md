# US-091 — Saída de Insumos (Consumo e Transferência)

**EPIC:** 10 — Estoque de Insumos
**Doc Original:** EPIC-10/US-078 (1º)
**Prioridade:** Alta | **Story Points:** 5

## Critérios de Aceite Implementados

### CA1 — Saída por consumo (operação de campo)

- Tipo `CONSUMPTION` vinculado a operação de campo via `fieldOperationRef`
- Permite indicar talhão destino (`fieldPlotId`)
- Custo unitário = custo médio ponderado do saldo atual

### CA2 — Saída manual

- Tipo `MANUAL_CONSUMPTION` para consumos não vinculados a operações
- Mesmo fluxo, sem referência a operação de campo

### CA3 — Transferência entre depósitos/fazendas

- Tipo `TRANSFER` com origem (`sourceFarmId`, `sourceLocation`) e destino (`destinationFarmId`, `destinationLocation`)
- Validação: origem e destino obrigatórios

### CA4 — Descarte

- Tipo `DISPOSAL` com motivos: EXPIRED, DAMAGED, CONTAMINATED, OTHER
- Campos obrigatórios: `disposalReason`, `authorizedBy`
- `disposalJustification` para detalhamento

### CA5 — Rastreabilidade de lote (FEFO)

- First Expiring First Out: quando lote não informado, sistema seleciona automaticamente o lote com validade mais próxima
- Busca em `stock_entry_items` confirmados, ordenados por `expirationDate ASC`
- Lote pode ser informado explicitamente pelo usuário

### CA6 — Alerta de saldo insuficiente

- Verificação de `StockBalance.currentQuantity` antes da saída
- Retorna erro 422 com detalhes (produto, disponível, solicitado)
- Permite forçar com `forceInsufficientStock: true` (com justificativa)
- Frontend: banner inline bloqueando confirmação

### CA7 — Histórico de movimentações

- Endpoint `GET /api/org/stock-movements?productId=...`
- Consolida entradas (stock_entry_items) e saídas (stock_output_items) em timeline unificada
- Filtros: movementType, dateFrom, dateTo, responsibleName
- Ordenação por data decrescente

### CA8 — Formulário de saída

- Modal com campos dinâmicos por tipo
- Campos comuns: tipo, produto, quantidade, lote, responsável, data, notas
- Validação inline onBlur

### CA9 — Alerta visual saldo insuficiente

- Banner inline no formulário exibindo saldo atual
- Bloqueia confirmação até checkbox "Forçar saída" com justificativa

### CA10 — Lista de movimentações com filtros e CSV

- Filtros: produto, tipo de movimentação, período, responsável
- Exportação CSV: `GET /api/org/stock-movements/export`
- Colunas: Data, Tipo Mov., Tipo, Quantidade, Custo Unit., Custo Total, Lote, Responsável, Observações

### CA10 (postergado) — Baixa automática vinculada a operação

- Saída automática quando operação de campo é registrada (requer refactor em field-operations)
- Será implementado junto com CAs residuais de US-038 CA8, US-039 CA5

### CA11 (postergado) — NF-e XML

- Leitura de dados de NF-e XML permanece fora do escopo

## Arquitetura

### Migration

- `20260341100000_add_stock_outputs`
- Tabelas: `stock_outputs`, `stock_output_items`
- Enums: `StockOutputType`, `StockOutputStatus`, `DisposalReason`
- RLS habilitado com policies de isolamento por organização

### Backend

- Módulo: `modules/stock-outputs/`
- Arquivos: `types.ts`, `service.ts`, `routes.ts`, `routes.spec.ts`
- 6 endpoints:
  - `POST /api/org/stock-outputs` — criar saída
  - `GET /api/org/stock-outputs` — listar saídas
  - `GET /api/org/stock-outputs/:id` — detalhe
  - `PATCH /api/org/stock-outputs/:id/cancel` — cancelar (reverte saldo)
  - `GET /api/org/stock-movements` — histórico movimentações
  - `GET /api/org/stock-movements/export` — export CSV

### Frontend

- Rota: `/stock-outputs`
- Página: `StockOutputsPage` (3 tabs: Saídas, Movimentações, Saldos)
- Modal: `StockOutputModal` (formulário dinâmico por tipo)
- Hook: `useStockOutputs`
- Sidebar: item "Saídas" no grupo ESTOQUE
