# US-096 CA1-CA3 — Conversão automática em operações de campo

**Data:** 2026-03-13
**Status:** Implementado

## O que foi feito

Integração do sistema de conversão de unidades (US-095) com todas as operações de campo, garantindo que a baixa no estoque use a unidade correta configurada para cada produto.

### CA1 — Aplicação de defensivos

- Após `doseToAbsoluteQuantity()`, usa `convertToStockUnit()` para converter para a unidade de estoque do produto
- Suporta: conversão por produto, densidade, global direta, global 2-hop

### CA2 — Adubação (cobertura/foliar)

- Mesmo padrão do CA1, integrado em `fertilizer-applications.service.ts`

### CA3 — Plantio (sementes)

- **Migration:** `20260347100000_add_planting_stock_deduction` — adiciona `seed_product_id`, `stock_output_id`, `total_seed_quantity_used`
- Calcula quantidade total de sementes: `seedRateKgHa × plantedAreaHa`
- Converte para unidade de estoque do produto (ex: kg → sacos)
- Cria `CONSUMPTION` stock output automático
- Reversão de estoque no soft-delete

### Arquivos criados

- `apps/backend/src/modules/stock-deduction/unit-conversion-bridge.ts` — ponte de conversão (12 testes)
- `apps/backend/src/modules/stock-deduction/unit-conversion-bridge.spec.ts`
- `apps/backend/prisma/migrations/20260347100000_add_planting_stock_deduction/migration.sql`

### Arquivos modificados

- `pesticide-applications.service.ts` — CA1
- `fertilizer-applications.service.ts` — CA2
- `soil-prep-operations.service.ts` — preparo de solo
- `planting-operations.service.ts` — CA3
- `planting-operations.types.ts` — novos campos
- `planting-operations.routes.spec.ts` — mock atualizado
- `prisma/schema.prisma` — PlantingOperation, Product, StockOutput

### Testes

- 12 testes unitários (unit-conversion-bridge)
- 86 testes de integração passando (59 + 27 sem regressão)
