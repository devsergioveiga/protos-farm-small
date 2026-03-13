# US-088 CA3-CA4, CA6-CA8 — Conversões por Produto, Sementes, Café, Validação

## O que foi feito

### CA3 — Conversões por produto

- Modelo `ProductConversion` para override das conversões globais por produto
- Ex: café com rendimento específico (L cereja → sacas) diferente do padrão
- Conversões bidirecionais automáticas (mesma lógica do global)
- CRUD: POST/DELETE `/api/org/product-conversions`

### CA4 — Unidade de compra/estoque/aplicação por produto

- Modelo `ProductUnitConfig` com `purchaseUnitId`, `stockUnitId`, `applicationUnitId`
- Cada produto pode ter unidades diferentes para cada contexto
- Densidade (g/mL) configurável para converter peso↔volume
- CRUD: POST/GET/PATCH/DELETE `/api/org/product-unit-configs/:productId`
- Endpoint de conversão product-aware: GET `/api/org/product-unit-configs/:productId/convert`
  - Prioridade: conversão por produto → densidade → conversão global

### CA6 — Conversões especiais para sementes

- POST `/api/org/unit-conversions/seed`
- Fórmula: seeds/ha = seedsPerLinearM × (10000 / rowSpacingM)
- Opcional: kg/ha = (seeds/ha × weightPerSeedG) / 1000000

### CA7 — Conversões especiais para café

- POST `/api/org/unit-conversions/coffee`
- Fórmula: sacsBenefited = volumeLiters / yieldLitersPerSac
- Default: 480 L cereja = 1 saca beneficiada (configurável)

### CA8 — Validação de conversão

- GET `/api/org/unit-conversions/validate`
- Verifica se conversão existe (produto → densidade → global → 2-hop)
- Retorna `{valid, fromUnit, toUnit, message}` para bloquear operações sem conversão

## Arquivos

### Criados

- `apps/backend/prisma/migrations/20260338200000_add_product_unit_configs/migration.sql`

### Modificados

- `apps/backend/prisma/schema.prisma` — modelos ProductUnitConfig, ProductConversion
- `apps/backend/src/modules/measurement-units/measurement-units.types.ts`
- `apps/backend/src/modules/measurement-units/measurement-units.service.ts`
- `apps/backend/src/modules/measurement-units/measurement-units.routes.ts`
- `apps/backend/src/modules/measurement-units/measurement-units.routes.spec.ts` (52 testes total)

## Testes

52 testes passando (32 anteriores + 20 novos).
