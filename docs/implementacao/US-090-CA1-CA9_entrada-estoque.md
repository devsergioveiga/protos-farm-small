# US-090 — Entrada de insumos no estoque (CA1-CA9)

## Resumo

Registro de entrada de insumos ao receber uma compra, incluindo despesas acessórias de fornecedores diferentes, com rateio automático e custo médio ponderado.

## Critérios de Aceite Implementados

### CA1 — Registro de entrada

- Produto, quantidade, lote do fabricante, data fabricação, data validade, fornecedor, NF (número)
- Modelo: `StockEntry` + `StockEntryItem`

### CA2 — Custo da mercadoria

- Valor unitário e valor total (quantidade × unitário) calculado automaticamente

### CA3 — Despesas acessórias

- 10 tipos de despesa: FREIGHT, INSURANCE, UNLOADING, TOLL, TEMPORARY_STORAGE, PACKAGING, PORT_FEE, ICMS_ST, IPI, OTHER
- Cada despesa com fornecedor e NF próprios (diferentes do fornecedor da mercadoria)
- Modelo: `StockEntryExpense`

### CA4 — Rateio automático

- 4 métodos: BY_VALUE (proporcional ao valor), BY_QUANTITY, BY_WEIGHT, FIXED (igualmente dividido)
- Rateio recalculado ao adicionar despesas retroativas

### CA5 — Custo médio ponderado

- Recalculado a cada entrada: `(saldo_ant × custo_medio_ant + entrada × custo_entrada) / (saldo_ant + entrada)`
- Modelo: `StockBalance` (saldo por produto por organização)
- Revertido ao cancelar entrada

### CA6 — Despesas acessórias posteriores

- Endpoint `POST /org/stock-entries/:id/expenses` para adicionar despesa retroativa
- Reverte saldo, recalcula rateio de todas as despesas, atualiza custo médio

### CA7 — Múltiplos itens na mesma entrada

- Array de items no create, cada um com rateio proporcional individual

### CA8 — Local de armazenamento

- `storageFarmId` (FK para Farm), `storageLocation` (depósito/galpão), `storageSublocation` (prateleira)

### CA9 — Validação

- Produto deve existir e ser natureza PRODUCT (não SERVICE)
- Quantidade > 0
- Alerta se custo unitário divergir >20% do custo médio atual (retornado em `costAlerts`)

## Critérios Postergados

- **CA10** — Geração de CP (depende módulo financeiro)
- **CA11** — Integração NF-e XML (depende módulo fiscal)

## Endpoints

| Método | Rota                                  | Permissão    | Descrição                    |
| ------ | ------------------------------------- | ------------ | ---------------------------- |
| POST   | `/api/org/stock-entries`              | farms:update | Criar entrada                |
| GET    | `/api/org/stock-entries`              | farms:read   | Listar entradas              |
| GET    | `/api/org/stock-entries/:id`          | farms:read   | Detalhar entrada             |
| POST   | `/api/org/stock-entries/:id/expenses` | farms:update | Adicionar despesa retroativa |
| POST   | `/api/org/stock-entries/:id/cancel`   | farms:update | Cancelar entrada             |
| GET    | `/api/org/stock-balances`             | farms:read   | Listar saldos de estoque     |

## Modelos de Dados

- `StockEntry` — cabeçalho da entrada (RLS por organização)
- `StockEntryItem` — itens (produto, qtd, custo, lote, validade)
- `StockEntryExpense` — despesas acessórias
- `StockBalance` — saldo + custo médio por produto (RLS por organização)

## Testes

- 42 testes de rota (mock de service)
- Cobertura: create, list, get, cancel, retroactive expenses, balances, auth/permissions, validações, todos os tipos de despesa e rateio
