# US-011: Multitenancy e Isolamento de Dados (Row-Level Security)

## Resumo

Implementação de **Row-Level Security (RLS) no PostgreSQL** como defesa em profundidade para isolamento multi-tenant. Antes desta US, o isolamento era feito apenas na camada de aplicação (filtro manual por `organizationId`). Com RLS, o banco de dados bloqueia acesso cross-tenant mesmo que a aplicação falhe.

## O que foi implementado

### Etapa 1 — Migration RLS + Helper + Seed

#### Migration SQL (`prisma/migrations/20260302100000_add_rls/migration.sql`)

- **Funções helper PostgreSQL:**
  - `current_org_id()` — retorna o `organizationId` da sessão via `current_setting('app.current_org_id')`
  - `is_rls_bypassed()` — retorna `true` se `app.bypass_rls = 'true'` (para auth, admin, audit)

- **RLS habilitado + forçado** em 7 tabelas:
  - `organizations`, `users`, `farms`, `user_farm_access`, `custom_roles`, `role_permissions`, `audit_logs`
  - `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` em cada tabela

- **Policies de isolamento:** cada tabela tem uma policy `tenant_isolation_policy` que permite acesso quando:
  - `is_rls_bypassed()` retorna `true` (bypass para rotas cross-tenant), OU
  - O campo `organizationId` (ou relação equivalente) corresponde ao `current_org_id()`

#### Helper RLS (`src/database/rls.ts`)

- **`withRlsContext(ctx, fn)`** — abre `$transaction`, executa `SET LOCAL app.current_org_id`, e roda a callback. Todas as queries dentro da callback ficam filtradas pela org.
- **`withRlsBypass(fn)`** — abre `$transaction` com `SET LOCAL app.bypass_rls = 'true'`. Usado por rotas que precisam acesso cross-tenant.
- **`RlsContext`** — tipo com `{ organizationId: string }`

#### Seed atualizado (`prisma/seed.ts`)

- Adicionado `set_config('app.bypass_rls', 'true', false)` no início do seed para que upserts cross-org funcionem com RLS ativo.

### Etapa 2 — Refatoração dos Services

| Arquivo                                          | Mudança                                                            | Wrapper          |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---------------- |
| `modules/org-users/org-users.service.ts`         | Todas as funções recebem `RlsContext` ao invés de `orgId`          | `withRlsContext` |
| `modules/org-users/org-users.routes.ts`          | `buildRlsContext(req)` constrói o contexto do `req.user`           | —                |
| `modules/roles/roles.service.ts`                 | Todas as funções recebem `RlsContext` ao invés de `organizationId` | `withRlsContext` |
| `modules/roles/roles.routes.ts`                  | `buildRlsContext(req)` constrói o contexto                         | —                |
| `modules/auth/auth.service.ts`                   | Login, refresh, reset, accept-invite                               | `withRlsBypass`  |
| `modules/auth/google-oauth.service.ts`           | Callback Google OAuth                                              | `withRlsBypass`  |
| `modules/organizations/organizations.service.ts` | CRUD de organizações (SUPER_ADMIN)                                 | `withRlsBypass`  |
| `modules/admin/admin.service.ts`                 | Dashboard stats, audit logs                                        | `withRlsBypass`  |
| `shared/audit/audit.service.ts`                  | `logAudit` fire-and-forget                                         | `withRlsBypass`  |
| `shared/rbac/rbac.service.ts`                    | `getUserPermissions`, `hasPermission`, cache invalidation          | `withRlsBypass`  |
| `middleware/check-farm-access.ts`                | Query de `userFarmAccess`                                          | `withRlsBypass`  |

### Etapa 3 — Testes

- **12 testes** em `src/__tests__/rls-isolation.spec.ts`:
  - `withRlsContext` seta `app.current_org_id` corretamente
  - `withRlsBypass` seta `app.bypass_rls` corretamente
  - Transações separadas têm contextos independentes
  - Contextos concorrentes não se interferem
- **Testes existentes atualizados** (266 testes, todos verdes):
  - `check-farm-access.spec.ts` — mock atualizado para `withRlsBypass`
  - `audit.service.spec.ts` — mock atualizado para `withRlsBypass`
  - `org-users.routes.spec.ts` — assertions atualizadas para `RlsContext`
  - `roles.routes.spec.ts` — assertions atualizadas para `RlsContext`

## Decisões de Design

### Por que SET LOCAL + $transaction?

`SET LOCAL` garante que a variável de sessão é **scoped à transação** — quando a transação termina (commit ou rollback), o valor é descartado automaticamente. Isso impede vazamento de contexto entre requests no pool de conexões.

### Por que FORCE ROW LEVEL SECURITY?

Sem `FORCE`, o owner do banco (role que criou as tabelas) escapa as policies. Com `FORCE`, nem o owner bypassa — o bypass só acontece via `app.bypass_rls = 'true'` setado explicitamente pela aplicação.

### Por que manter filtros aplicativos?

Os filtros por `organizationId` nos services foram mantidos como segunda camada de defesa. RLS é a barreira no banco; os filtros aplicativos são a barreira na aplicação. Se um falhar, o outro protege.

### Por que bypass no audit?

O `logAudit` é fire-and-forget e nunca deve falhar por RLS. Se um audit log de uma ação cross-org falhasse, perderíamos rastreabilidade. Por isso usa `withRlsBypass`.

## Verificação

1. `pnpm --filter @protos-farm/backend test` — 19 suites, 266 testes passando
2. `tsc --noEmit` — compilação limpa
3. Seed roda com RLS ativo (bypass setado no início)
4. Login funciona (usa `withRlsBypass`)
5. Rotas org-scoped (`/org/users`, `/org/roles`) usam `withRlsContext`
