# US-095 CA8 — Histórico de conversões (auditoria)

## O que foi feito

Tela dedicada de auditoria que agrega todas as conversões dose→quantidade realizadas nas operações de campo, com filtros, estatísticas e exportação CSV.

## Backend

### Novo módulo: `modules/conversion-history/`

- **conversion-history.types.ts** — tipos compartilhados (`ConversionHistoryItem`, `OperationType`, query)
- **conversion-history.service.ts** — serviço que consulta PesticideApplication, FertilizerApplication e SoilPrepOperation, unificando os dados de conversão
- **conversion-history.routes.ts** — 2 endpoints:
  - `GET /api/org/conversion-history` — listagem paginada com filtros (farmId, operationType, productName, dateFrom, dateTo)
  - `GET /api/org/conversion-history/export` — exportação CSV com mesmos filtros

### Fontes de dados

| Modelo                | Campos de conversão                                         |
| --------------------- | ----------------------------------------------------------- |
| PesticideApplication  | dose, doseUnit, totalQuantityUsed, productId, stockOutputId |
| FertilizerApplication | dose, doseUnit, totalQuantityUsed, productId, stockOutputId |
| SoilPrepOperation     | inputs (JSON), stockOutputId → StockOutputItems             |

### Testes

- 7 testes unitários (routes spec): listagem, filtros, auth, erros, CSV export

## Frontend

### Novos arquivos

- **pages/ConversionHistoryPage.tsx** + **.css** — página com:
  - Filtros: busca por produto, tipo de operação, período (date range)
  - Estatísticas: total de conversões, breakdown por tipo
  - Cards: produto, talhão, data, área, fórmula de conversão, badge de baixa no estoque
  - Paginação
  - Export CSV
- **hooks/useConversionHistory.ts** — hook de dados
- **types/conversion-history.ts** — tipos e constantes

### Integração

- Rota: `/conversion-history`
- Sidebar: grupo ESTOQUE → "Conversões" (ícone ArrowRightLeft)

### Testes

- 11 testes (vitest): título, empty state, skeleton, erro, cards, badges, filtros, paginação, export

## Decisões

- Não foi necessária migration — os dados já estão armazenados nas tabelas existentes
- A agregação é feita no serviço (in-memory sort + pagination) pois o volume esperado é moderado
- SoilPrepOperation usa JSON inputs como fallback quando não há StockOutput vinculado
