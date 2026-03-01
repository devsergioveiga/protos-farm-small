# US-010 CA1 — Hierarquia de Permissões e Middleware RBAC

## O que foi implementado

### Schema Prisma

- Modelo `CustomRole` — nome, descrição, `baseRole` (enum Role), `organizationId`, soft-delete (`deletedAt`)
- Modelo `RolePermission` — liga `CustomRole` a uma lista de `Permission` (enum)
- Campo `customRoleId` opcional no `User` — quando preenchido, sobrescreve as permissões do role base

### `permissions.ts` — tipos e constantes

- Enum `Permission` com ~30 permissões granulares (ex: `FARM_CREATE`, `FARM_READ`, `USER_MANAGE`, `REPORT_VIEW`)
- `ROLE_HIERARCHY` — define nível numérico de cada role (SUPER_ADMIN=100, ADMIN=80, MANAGER=60, etc.)
- `DEFAULT_ROLE_PERMISSIONS` — mapa de cada `Role` para seu array de `Permission` padrão
- Exporta tipo `PermissionCheck` para uso no middleware

### `rbac.service.ts`

- `getUserPermissions(userId)` — busca permissões do custom role (se houver) ou fallback para `DEFAULT_ROLE_PERMISSIONS[user.role]`
- Cache Redis com TTL 5 min (`rbac:permissions:{userId}`), serializado como JSON
- `hasPermission(userId, permission)` — retorna boolean, consome cache
- `invalidatePermissionsCache(userId)` — chamado ao editar role ou custom role do usuário

### Middleware `checkPermission(...permissions)`

- Recebe uma ou mais `Permission` como argumento
- Extrai `userId` do `req.user` (pós-authenticate)
- Chama `hasPermission` para cada permissão — exige **todas** (AND lógico)
- Retorna 403 com mensagem clara se faltar qualquer permissão

## Por que

- O sistema precisa de controle granular além dos roles fixos — custom roles permitem que cada organização ajuste permissões sem alterar o enum global
- Cache Redis evita queries repetidas a cada request (5 min é tempo seguro para propagação de mudanças)
- `ROLE_HIERARCHY` permite validações de anti-escalation no CA2 (ninguém cria role superior ao seu)
- Middleware `checkPermission` substitui o `authorize()` genérico, dando controle por endpoint
