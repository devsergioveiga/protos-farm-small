# US-003 CA3 — Dados Seed Realistas

## Objetivo

Fornecer dados seed realistas para desenvolvimento local, permitindo que a equipe trabalhe com um banco populado ao rodar `reset-dev.sh` ou `prisma db seed`.

## Implementação

### Arquivo: `apps/backend/prisma/seed.ts`

Script de seed **idempotente** usando `prisma.upsert` — seguro para execução múltipla.

### Dados Inseridos

#### 2 Organizações

| Nome                         | Tipo | Documento          | Plano   | Limites             |
| ---------------------------- | ---- | ------------------ | ------- | ------------------- |
| Agropecuária Bom Futuro Ltda | PJ   | 12.345.678/0001-90 | premium | 20 users / 10 farms |
| João Carlos Mendes           | PF   | 123.456.789-09     | basic   | 10 users / 5 farms  |

#### 8 Usuários

| Nome                   | Role        | Organização       |
| ---------------------- | ----------- | ----------------- |
| Carlos Eduardo Silva   | SUPER_ADMIN | Bom Futuro        |
| Maria Fernanda Costa   | ADMIN       | Bom Futuro        |
| Pedro Henrique Almeida | MANAGER     | Bom Futuro        |
| Ana Beatriz Oliveira   | AGRONOMIST  | Bom Futuro        |
| Roberto Nascimento     | FINANCIAL   | Bom Futuro        |
| José Aparecido Santos  | OPERATOR    | Bom Futuro        |
| Antônio Ribeiro        | COWBOY      | Bom Futuro        |
| João Carlos Mendes     | ADMIN       | PF (próprio dono) |

> `passwordHash` é `null` — autenticação será implementada em US futura.

#### 4 Fazendas

| Nome                  | Estado         | Área (ha) | Organização |
| --------------------- | -------------- | --------- | ----------- |
| Fazenda Santa Helena  | MT (Sorriso)   | 5.200     | Bom Futuro  |
| Fazenda Três Irmãos   | GO (Rio Verde) | 1.800,5   | Bom Futuro  |
| Fazenda Lagoa Dourada | MG (Uberaba)   | 520,75    | Bom Futuro  |
| Sítio Recanto do Sol  | SP (Jaú)       | 185,3     | João Carlos |

Todas possuem coordenadas geográficas reais (PostGIS Point SRID 4326), códigos CIB, INCRA e CAR fictícios mas verossímeis.

#### 19 Vínculos Usuário-Fazenda

- **SUPER_ADMIN, ADMIN, MANAGER, AGRONOMIST, FINANCIAL** → acesso a todas as fazendas da org
- **OPERATOR, COWBOY** → acesso apenas à fazenda onde atuam (Santa Helena)
- **PF (João)** → acesso à sua única fazenda

### Decisões Técnicas

1. **PrismaClient próprio no seed**: Não importa o singleton de `src/database/prisma.ts` pois depende de `loadEnv()` que pode falhar fora do contexto da aplicação. O `prisma.config.ts` já define a DATABASE_URL.

2. **Upsert para idempotência**: Cada registro usa `upsert` com `where` no campo único (document para org, email para user, id para farm, composite key para user_farm_access).

3. **PostGIS via raw SQL**: Campos `Unsupported("geometry(Point, 4326)")` não são manipuláveis pelo Prisma Client. Coordenadas são inseridas via `$executeRawUnsafe` com `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`.

4. **IDs fixos (UUIDs determinísticos)**: Facilita referências cruzadas no seed e permite verificação consistente.

## Como Executar

```bash
# Seed isolado (requer PostgreSQL rodando e migrations aplicadas)
cd apps/backend
npx prisma db seed

# Ou via reset completo do ambiente
pnpm infra:reset
```

## Configuração

### `prisma.config.ts`

Adicionada propriedade `seed` para que `prisma db seed` saiba qual comando executar:

```typescript
seed: 'npx tsx prisma/seed.ts',
```

### `package.json`

Adicionado script:

```json
"prisma:seed": "prisma db seed"
```

### `reset-dev.sh`

Adicionado passo 6 (migrations + seed) após healthchecks passarem:

```bash
npx prisma migrate deploy
npx prisma db seed
```

## Verificação

```bash
# 1. Subir PostgreSQL
docker compose up -d postgres

# 2. Aplicar migrations
cd apps/backend && npx prisma migrate deploy

# 3. Executar seed
npx prisma db seed

# 4. Verificar idempotência (rodar novamente)
npx prisma db seed

# 5. Verificar dados
docker exec protos-postgres psql -U protos -d protos_farm \
  -c "SELECT name, type, document FROM organizations"

docker exec protos-postgres psql -U protos -d protos_farm \
  -c "SELECT name, email, role FROM users"

docker exec protos-postgres psql -U protos -d protos_farm \
  -c "SELECT name, state, \"totalAreaHa\" FROM farms"

# 6. Verificar PostGIS
docker exec protos-postgres psql -U protos -d protos_farm \
  -c "SELECT name, ST_AsText(location) FROM farms WHERE location IS NOT NULL"
```
