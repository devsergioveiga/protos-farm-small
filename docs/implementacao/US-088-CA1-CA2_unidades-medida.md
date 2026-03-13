# US-088 CA1-CA2 — Unidades de Medida e Conversões Globais

## O que foi feito

### CA1 — Cadastro de unidades base com categorias

- Modelo `MeasurementUnit` com campos: name, abbreviation, category (WEIGHT/VOLUME/COUNT/AREA), isSystem, isActive
- CRUD completo: POST/GET/PATCH/DELETE em `/api/org/measurement-units`
- Unidades do sistema (isSystem=true) não podem ser deletadas nem ter nome/abreviação alterados
- Unique constraint: (organizationId, abbreviation)
- 11 unidades base pré-configuradas: kg, g, t, @, sc, L, mL, un, cx, ha, alq

### CA2 — Conversões globais pré-configuradas

- Modelo `UnitConversion` com campos: fromUnitId, toUnitId, factor (Decimal 20,10), isSystem, isActive
- CRUD completo: POST/GET/PATCH/DELETE em `/api/org/unit-conversions`
- Seed automático na primeira listagem (ensureSystemUnits, idempotente)
- 7 conversões globais + suas reversas (14 total):
  - 1 t = 1.000 kg, 1 kg = 1.000 g, 1 sc = 60 kg, 1 @ = 15 kg
  - 1 L = 1.000 mL, 1 cx = 40,8 kg, 1 alq = 2,42 ha

### CA5 — Fator de conversão bidirecional

- Toda conversão criada gera automaticamente a conversão reversa (1/fator)
- Atualizar fator de uma conversão atualiza automaticamente a reversa
- Endpoint GET `/api/org/unit-conversions/convert` com suporte a conversão direta e 2-hop

### CA9 — Importação via CSV

- POST `/api/org/unit-conversions/import` aceita array de {fromAbbreviation, toAbbreviation, factor}
- Máximo 500 linhas por importação, skip de duplicatas

## Por que

Pré-requisito para todo o módulo de Estoque (EPIC-10). As unidades de medida são usadas em:

- Cadastro de produtos/insumos (US-089)
- Entrada/saída de estoque (US-090/US-091)
- Conversão automática em operações de campo (US-094)

## Arquivos

### Criados

- `apps/backend/prisma/migrations/20260338100000_add_measurement_units/migration.sql`
- `apps/backend/src/modules/measurement-units/measurement-units.types.ts`
- `apps/backend/src/modules/measurement-units/measurement-units.service.ts`
- `apps/backend/src/modules/measurement-units/measurement-units.routes.ts`
- `apps/backend/src/modules/measurement-units/measurement-units.routes.spec.ts` (32 testes)

### Modificados

- `apps/backend/prisma/schema.prisma` — modelos MeasurementUnit, UnitConversion, enum UnitCategory
- `apps/backend/src/app.ts` — registro do measurementUnitsRouter

## Testes

32 testes passando cobrindo CRUD de unidades, CRUD de conversões, conversão direta/2-hop, importação CSV, constantes do sistema.
