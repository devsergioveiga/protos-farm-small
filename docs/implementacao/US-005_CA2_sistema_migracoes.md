# US-005 CA2 — Sistema de Migrações

**Status:** ✅ Concluído
**Data:** 2026-02-27

## Critério de Aceite

> O sistema deve possuir um mecanismo de migrações versionadas para evolução do schema do banco de dados.

## Implementação

### Ferramenta: Prisma Migrate

O Prisma ORM (v7.4.1) foi escolhido como ORM e sistema de migrações pelos seguintes motivos:

- Schema declarativo em `schema.prisma` — fonte única de verdade
- Migrações SQL geradas automaticamente a partir do diff do schema
- Histórico versionado em `prisma/migrations/`
- Suporte nativo a PostgreSQL e PostGIS
- Cliente TypeScript type-safe gerado automaticamente

### Configuração (Prisma 7)

O Prisma 7 introduziu o `prisma.config.ts` como ponto central de configuração para o CLI:

```typescript
// apps/backend/prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl },
});
```

A URL do banco é construída a partir das variáveis de ambiente individuais (`POSTGRES_HOST`, `POSTGRES_PORT`, etc.) com defaults para desenvolvimento local.

O PrismaClient usa o adapter pattern (`@prisma/adapter-pg`) para conexão runtime:

```typescript
// apps/backend/src/database/prisma.ts
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
```

### Comandos Disponíveis

| Comando                                                 | Uso                            | Quando usar                      |
| ------------------------------------------------------- | ------------------------------ | -------------------------------- |
| `pnpm --filter @protos-farm/backend prisma:migrate:dev` | Cria e aplica migrações em dev | Após alterar `schema.prisma`     |
| `pnpm --filter @protos-farm/backend prisma:generate`    | Gera o Prisma Client           | Após qualquer mudança no schema  |
| `pnpm --filter @protos-farm/backend prisma:studio`      | Abre UI para explorar dados    | Debug e inspeção de dados        |
| `npx prisma migrate deploy`                             | Aplica migrações pendentes     | Em staging/production (CI/CD)    |
| `npx prisma migrate reset --force`                      | Reset completo do banco        | Apenas em dev, quando necessário |

### Workflow de Desenvolvimento

1. Editar `apps/backend/prisma/schema.prisma`
2. Rodar `pnpm --filter @protos-farm/backend prisma:migrate:dev` (com nome descritivo)
3. Prisma gera SQL em `prisma/migrations/<timestamp>_<nome>/migration.sql`
4. Prisma aplica a migration ao banco local
5. Prisma regenera o client automaticamente
6. Commitar o schema + migration SQL no Git

### Estrutura de Diretórios

```
apps/backend/
├── prisma.config.ts              # Configuração do Prisma CLI (v7)
├── prisma/
│   ├── schema.prisma             # Schema declarativo (fonte de verdade)
│   └── migrations/
│       ├── migration_lock.toml   # Lock do provider (postgresql)
│       └── <timestamp>_<nome>/
│           └── migration.sql     # SQL gerado (versionado no Git)
└── src/
    └── database/
        └── prisma.ts             # Singleton do PrismaClient
```

## Arquivos Relevantes

| Arquivo                               | Função                     |
| ------------------------------------- | -------------------------- |
| `apps/backend/prisma.config.ts`       | Configuração do Prisma CLI |
| `apps/backend/prisma/schema.prisma`   | Schema declarativo         |
| `apps/backend/prisma/migrations/`     | Migrações SQL versionadas  |
| `apps/backend/src/database/prisma.ts` | Singleton do PrismaClient  |
| `apps/backend/package.json`           | Scripts npm para Prisma    |
