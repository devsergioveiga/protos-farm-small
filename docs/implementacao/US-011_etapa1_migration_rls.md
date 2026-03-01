# US-011 — Etapa 1: Migration RLS + Helper + Seed

## O que foi implementado

Implementação de **Row-Level Security (RLS) no PostgreSQL** como defesa em profundidade para isolamento multi-tenant. Antes desta US, o isolamento era feito apenas na camada de aplicação (filtro manual por `organizationId`). Com RLS, o banco de dados bloqueia acesso cross-tenant mesmo que a aplicação falhe.

## Migration SQL (`prisma/migrations/20260302100000_add_rls/migration.sql`)

### Funções helper PostgreSQL

- `current_org_id()` — retorna o `organizationId` da sessão via `current_setting('app.current_org_id')`
- `is_rls_bypassed()` — retorna `true` se `app.bypass_rls = 'true'` (para auth, admin, audit)

### RLS habilitado + forçado em 7 tabelas

- `organizations`, `users`, `farms`, `user_farm_access`, `custom_roles`, `role_permissions`, `audit_logs`
- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` em cada tabela

### Policies de isolamento

Cada tabela tem uma policy `tenant_isolation_policy` que permite acesso quando:

- `is_rls_bypassed()` retorna `true` (bypass para rotas cross-tenant), OU
- O campo `organizationId` (ou relação equivalente) corresponde ao `current_org_id()`

## Helper RLS (`src/database/rls.ts`)

- **`withRlsContext(ctx, fn)`** — abre `$transaction`, executa `SET LOCAL app.current_org_id`, e roda a callback. Todas as queries dentro da callback ficam filtradas pela org.
- **`withRlsBypass(fn)`** — abre `$transaction` com `SET LOCAL app.bypass_rls = 'true'`. Usado por rotas que precisam acesso cross-tenant.
- **`RlsContext`** — tipo com `{ organizationId: string }`

## Seed atualizado (`prisma/seed.ts`)

Adicionado `set_config('app.bypass_rls', 'true', false)` no início do seed para que upserts cross-org funcionem com RLS ativo.

## Decisões de Design

### Por que SET LOCAL + $transaction?

`SET LOCAL` garante que a variável de sessão é **scoped à transação** — quando a transação termina (commit ou rollback), o valor é descartado automaticamente. Isso impede vazamento de contexto entre requests no pool de conexões.

### Por que FORCE ROW LEVEL SECURITY?

Sem `FORCE`, o owner do banco (role que criou as tabelas) escapa as policies. Com `FORCE`, nem o owner bypassa — o bypass só acontece via `app.bypass_rls = 'true'` setado explicitamente pela aplicação.

## Arquivos

### Novos

- `prisma/migrations/20260302100000_add_rls/migration.sql`
- `src/database/rls.ts`

### Modificados

- `prisma/seed.ts` — bypass RLS no início
