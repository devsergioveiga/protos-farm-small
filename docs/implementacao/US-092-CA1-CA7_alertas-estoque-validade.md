# US-092 — Alertas de Estoque e Validade (CA1-CA7)

## Resumo

Implementação completa dos alertas de nível de estoque e validade para o módulo de estoque de insumos, incluindo dashboard semáforo, alertas de validade com flag InpEV, e relatório CSV.

## Critérios de Aceite

### CA1 — Ponto de reposição configurável por produto

- Campo `reorderPoint` (Decimal 14,4) adicionado ao modelo `Product`
- Configurável via CRUD de produtos (create/update)
- Validação: não pode ser negativo

### CA2 — Estoque de segurança configurável

- Campo `safetyStock` (Decimal 14,4) adicionado ao modelo `Product`
- Campo `expiryAlertDays` (Int) para dias de alerta de validade por produto
- Configurável via CRUD de produtos (create/update)
- Validação: não pode ser negativo; expiryAlertDays deve ser inteiro positivo

### CA3 — Alerta quando saldo atinge ponto de reposição

- Endpoint `GET /api/org/stock-alerts/levels` com paginação
- Classificação: CRITICAL (abaixo reorderPoint), WARNING (abaixo safetyStock), OK
- Filtros: level, productType, search, page, limit
- Push/email: infraestrutura não disponível — badge no dashboard atende à necessidade funcional

### CA4 — Alerta de validade (90, 60, 30 dias)

- Endpoint `GET /api/org/stock-alerts/expiry` com paginação
- Consulta `StockEntryItem.expirationDate` de entradas confirmadas
- Filtros: daysAhead (padrão 90), includeExpired, productType, isPesticide, search
- Badges visuais: vencido (vermelho), urgente ≤30d (laranja), a vencer ≤90d (amarelo)

### CA5 — Dashboard semáforo

- Endpoint `GET /api/org/stock-alerts/dashboard`
- Summary: criticalCount, warningCount, okCount, noThresholdCount, expiredCount, expiringCount, totalStockValue
- Cards visuais: vermelho (abaixo mínimo), laranja (nível segurança), verde (OK), roxo (validade)
- Lista ordenada: CRITICAL → WARNING → OK

### CA6 — Alerta InpEV para defensivos vencidos

- Flag `isPesticide` em cada alerta de validade
- Flag `inpevRequired` = true quando produto é defensivo E está vencido
- Filtro `isPesticide=true` no endpoint de validade
- Tag visual "InpEV obrigatório" no frontend
- Tipos considerados defensivos: herbicida, inseticida, fungicida, acaricida, adjuvante

### CA7 — Relatório de produtos vencidos e a vencer

- Endpoint `GET /api/org/stock-alerts/expiry/export`
- Formato CSV com BOM UTF-8 (compatível Excel)
- Colunas: Produto, Tipo, Lote, Validade, Dias até Vencimento, Quantidade, Unidade, Custo Unit., Custo Total, Vencido, Defensivo, InpEV Obrigatório
- Filtros: daysAhead, includeExpired, productType

## Arquitetura

### Backend

#### Migration

- `20260342100000_add_stock_alerts` — adiciona `reorder_point`, `safety_stock`, `expiry_alert_days` à tabela `products`

#### Módulo `stock-alerts/`

- `stock-alerts.types.ts` — tipos, constantes, enums
- `stock-alerts.service.ts` — lógica de negócio (dashboard, alertas nível, alertas validade, CSV)
- `stock-alerts.routes.ts` — 4 endpoints (dashboard, levels, expiry, export)
- `stock-alerts.routes.spec.ts` — 19 testes

#### Módulo `products/` (atualizado)

- `products.types.ts` — campos reorderPoint, safetyStock, expiryAlertDays
- `products.service.ts` — create/update/toItem com os novos campos
- `products.routes.spec.ts` — fixture NULL_TYPE_FIELDS atualizado

### Frontend

- `hooks/useStockAlerts.ts` — hook com fetchDashboard, fetchLevelAlerts, fetchExpiryAlerts, exportExpiryCSV
- `pages/StockAlertsPage.tsx` — página com 2 tabs (Nível de estoque, Validade)
- `pages/StockAlertsPage.css` — estilos responsivos, cards, tabelas, badges
- `App.tsx` — rota `/stock-alerts`
- `Sidebar.tsx` — link "Alertas" no grupo ESTOQUE

### Endpoints

| Método | Rota                                  | CA       | Permissão  |
| ------ | ------------------------------------- | -------- | ---------- |
| GET    | `/api/org/stock-alerts/dashboard`     | CA5      | farms:read |
| GET    | `/api/org/stock-alerts/levels`        | CA3      | farms:read |
| GET    | `/api/org/stock-alerts/expiry`        | CA4, CA6 | farms:read |
| GET    | `/api/org/stock-alerts/expiry/export` | CA7      | farms:read |

## Testes

- Backend: 19 testes (stock-alerts.routes.spec.ts)
- Todos os 1299+ testes existentes continuam passando

## Decisões

1. **Push/email (CA3):** Sistema não possui infraestrutura de notificações push/email. Badge no dashboard e página de alertas atendem à funcionalidade. Pode ser adicionado quando infraestrutura existir.
2. **Quantidade por lote:** Sistema não rastreia saldo remanescente por lote (apenas `StockEntryItem.quantity` da entrada original). Alertas de validade mostram quantidade original do lote na entrada.
3. **Permissão `farms:read`:** Alertas são read-only, usam mesma permissão que saldos de estoque.
