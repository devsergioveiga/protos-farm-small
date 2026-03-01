# US-011 — Etapa 2: Refatoração dos Services para RLS

## O que foi implementado

Todos os services do backend foram refatorados para usar os wrappers RLS (`withRlsContext` ou `withRlsBypass`), garantindo que toda query ao banco passe pelo contexto de isolamento multi-tenant.

## Services refatorados

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

## Decisões

### Por que manter filtros aplicativos?

Os filtros por `organizationId` nos services foram mantidos como segunda camada de defesa. RLS é a barreira no banco; os filtros aplicativos são a barreira na aplicação. Se um falhar, o outro protege.

### Por que bypass no audit?

O `logAudit` é fire-and-forget e nunca deve falhar por RLS. Se um audit log de uma ação cross-org falhasse, perderíamos rastreabilidade. Por isso usa `withRlsBypass`.
