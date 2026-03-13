# US-099 — Tabela de Umidade e Classificação de Grãos

## Resumo

Sistema completo de tabelas de desconto e classificação de grãos, com defaults ANEC/MAPA e customização por organização. Inclui cálculo de breakdown de descontos com classificação automática.

## O que foi implementado

### CA1 — Tabela de descontos de umidade (backend)

- **Modelo:** `GrainDiscountTable` (migration `20260349100000`)
  - Campos: `crop`, `discountType` (MOISTURE/IMPURITY/DAMAGED), `thresholdPct`, `discountPctPerPoint`, `maxPct`
  - Unique por `[organizationId, crop, discountType]`
- **Defaults ANEC** para 6 culturas: SOJA, MILHO, FEIJÃO, TRIGO, SORGO, ARROZ
- **Endpoints:**
  - `GET /api/org/grain-discount-tables` — lista customizações + defaults
  - `PUT /api/org/grain-discount-tables` — upsert por crop+type
  - `DELETE /api/org/grain-discount-tables/:tableId` — remove customização

### CA2 — Tabela de descontos de impureza/avariados (backend)

- Mesmo modelo `GrainDiscountTable` com `discountType = IMPURITY | DAMAGED`
- Cada tipo tem threshold (tolerância), desconto por ponto excedente, e maxPct (limite de rejeição)
- Defaults ANEC incluídos para cada crop × tipo

### CA3 — Classificação de grãos (backend)

- **Modelo:** `GrainClassification` (migration `20260349100000`)
  - Campos: `crop`, `gradeType` (TIPO_1/TIPO_2/TIPO_3/FORA_DE_TIPO), limites de umidade/impureza/avariados/quebrados
  - Unique por `[organizationId, crop, gradeType]`
- **Defaults MAPA** para SOJA e MILHO (IN 11/2007 e IN 60/2011)
- **Endpoints:**
  - `GET /api/org/grain-classifications` — lista + defaults
  - `PUT /api/org/grain-classifications` — upsert
  - `DELETE /api/org/grain-classifications/:classificationId` — remove

### CA4 — Cálculo de desconto integrado (backend)

- **Endpoint:** `POST /api/org/grain-discounts/calculate`
- Input: `crop`, `grossProductionKg`, `moisturePct`, `impurityPct`, `damagedPct?`, `brokenPct?`
- Output: `DiscountBreakdown` com:
  - Desconto detalhado por tipo (excess points, % desconto, kg descontado)
  - Peso líquido final após todos os descontos
  - Classificação automática (TIPO_1 a FORA_DE_TIPO)
  - Warnings quando valores excedem limites máximos

## Arquivos criados/modificados

### Criados

- `apps/backend/src/modules/grain-discounts/grain-discounts.types.ts`
- `apps/backend/src/modules/grain-discounts/grain-discounts.service.ts`
- `apps/backend/src/modules/grain-discounts/grain-discounts.routes.ts`
- `apps/backend/src/modules/grain-discounts/grain-discounts.routes.spec.ts`
- `apps/backend/prisma/migrations/20260349100000_add_grain_discount_classification/migration.sql`

### Modificados

- `apps/backend/prisma/schema.prisma` — modelos GrainDiscountTable + GrainClassification
- `apps/backend/src/app.ts` — registro do grainDiscountsRouter

## Testes

- 19 testes novos (1 suite)
- Cobertura: CRUD discount tables, CRUD classifications, calculate discount, permissões, validações
