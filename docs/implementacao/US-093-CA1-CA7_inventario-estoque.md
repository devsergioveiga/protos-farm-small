# US-093 — Inventário e Conciliação de Estoque (CA1-CA7)

Doc original: US-080 (EPIC-10, Fase 2)

## Critérios de Aceite Implementados

### CA1: Criação de inventário

- Endpoint `POST /api/org/stock-inventories`
- Carrega automaticamente todos os produtos com saldo no StockBalance
- Opção de filtrar por `productIds` específicos
- Campos: data, fazenda/depósito, observações
- Validação: impede criar inventário se já existe um ativo (OPEN/IN_PROGRESS)

### CA2: Registro de contagem

- Endpoint `POST /api/org/stock-inventories/:id/count`
- Quantidade contada por produto (e lote, quando aplicável)
- Status muda de OPEN → IN_PROGRESS na primeira contagem
- Validação: quantidade >= 0, produto deve fazer parte do inventário

### CA3: Comparativo automático

- Variância calculada automaticamente: `countedQuantity - systemQuantity`
- Positiva = sobra, Negativa = falta, Zero = confere
- Exibida na tabela com indicadores visuais (cores + sinal)

### CA4: Ajuste de estoque (aprovação + lançamento)

- Endpoint `POST /api/org/stock-inventories/:id/reconcile`
- Requer `farms:update` permission (gerente)
- Cria registros de `StockAdjustment` para cada divergência
- Atualiza `StockBalance.currentQuantity` com a contagem real
- Recalcula `totalValue` mantendo `averageCost` inalterado
- Tipos: INVENTORY_SURPLUS (sobra) e INVENTORY_SHORTAGE (falta)
- Confirmação em modal antes de aplicar (frontend)

### CA5: Motivo do ajuste obrigatório

- Campo `reason` obrigatório em itens com divergência
- Motivos sugeridos: perda, erro de registro, roubo, evaporação, quebra, erro de medição, etc.
- Validação no backend: rejeita conciliação se falta motivo em qualquer divergência

### CA6: Relatório de inventário

- Endpoint `GET /api/org/stock-inventories/:id/report` — JSON com resumo
- Endpoint `GET /api/org/stock-inventories/:id/report/export` — CSV com BOM UTF-8
- Resumo: total itens, conferem, sobras, faltas, valores
- Detalhamento: ajustes aplicados com tipo, quantidades, motivos
- Frontend: tab de detalhe mostra resumo + tabela de ajustes para inventários conciliados

### CA7: Bloqueio parcial durante inventário

- Endpoint `GET /api/org/stock-inventories/check-active?productId=xxx`
- Retorna `{ hasActiveInventory, inventoryId }` para movimentações alertarem
- Impede criação de inventário duplicado (HTTP 409)

## Modelos Prisma

- `StockInventory` — cabeçalho do inventário (status, data, depósito)
- `StockInventoryItem` — itens (saldo sistema, contagem, variância, motivo)
- `StockAdjustment` — ajustes aplicados na conciliação (auditoria)

## Migration

`20260343100000_add_stock_inventory`

## Endpoints (8)

| Método | Rota                                         | Permissão    | Descrição          |
| ------ | -------------------------------------------- | ------------ | ------------------ |
| POST   | /api/org/stock-inventories                   | farms:update | Criar inventário   |
| GET    | /api/org/stock-inventories                   | farms:read   | Listar inventários |
| GET    | /api/org/stock-inventories/check-active      | farms:read   | Verificar ativo    |
| GET    | /api/org/stock-inventories/:id               | farms:read   | Detalhe            |
| POST   | /api/org/stock-inventories/:id/count         | farms:update | Registrar contagem |
| POST   | /api/org/stock-inventories/:id/reconcile     | farms:update | Conciliar          |
| PATCH  | /api/org/stock-inventories/:id/cancel        | farms:update | Cancelar           |
| GET    | /api/org/stock-inventories/:id/report        | farms:read   | Relatório          |
| GET    | /api/org/stock-inventories/:id/report/export | farms:read   | Export CSV         |

## Frontend

- `StockInventoriesPage` — lista + detalhe (inline, sem modal para CRUD)
- `useStockInventories` hook — todas as operações
- Sidebar: item "Inventário" no grupo ESTOQUE
- Rota: `/stock-inventories`

## Testes

- 21 testes backend (routes spec com mocks)
- Cobertura: CRUD, permissões, estados, erros
