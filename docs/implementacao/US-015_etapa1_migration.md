# US-015 Etapa 1 — Migration: Suporte a Perímetro Georreferenciado

## O que foi feito

Migration `20260306100000_add_farm_boundary_support`:

1. **`farm_registrations.boundary`** — coluna `geometry(Polygon, 4326)` para armazenar perímetro da matrícula (farms já possuía a coluna)
2. **`farms.boundaryAreaHa`** — `DECIMAL(12,4)` cache da área calculada por PostGIS (em hectares)
3. **`farm_registrations.boundaryAreaHa`** — idem para matrículas
4. **Índices GiST** — `idx_farms_boundary_gist` e `idx_farm_registrations_boundary_gist` para consultas espaciais performáticas

## Schema Prisma

- `Farm.boundaryAreaHa` — `Decimal? @db.Decimal(12, 4)`
- `FarmRegistration.boundary` — `Unsupported("geometry(Polygon, 4326)")?`
- `FarmRegistration.boundaryAreaHa` — `Decimal? @db.Decimal(12, 4)`

## Por que

- A coluna `boundary` em `farms` já existia mas nunca era populada; agora temos a infraestrutura completa para armazenar perímetros tanto em fazendas quanto matrículas
- O cache `boundaryAreaHa` evita recalcular `ST_Area()` a cada consulta
- Índices GiST são necessários para consultas espaciais eficientes (ST_Contains, ST_Intersects etc.)
- Sem nova RLS — as colunas adicionadas são cobertas pelas policies existentes nas tabelas `farms` e `farm_registrations`

## Arquivos

| Arquivo                                                                    | Ação       |
| -------------------------------------------------------------------------- | ---------- |
| `prisma/migrations/20260306100000_add_farm_boundary_support/migration.sql` | Novo       |
| `prisma/schema.prisma`                                                     | Modificado |
