# US-009 CA1 — Criar usuário na organização com role, farm access e convite 7 dias

## O que foi implementado

### Novo módulo `org-users`

Criado `modules/org-users/` com 3 arquivos:

- `org-users.types.ts` — Interfaces, `OrgUserError`, `ASSIGNABLE_ROLES`, `ORG_INVITE_PREFIX`
- `org-users.service.ts` — Lógica de negócio para todas as operações
- `org-users.routes.ts` — Endpoints Express com auth guard `[authenticate, authorize('ADMIN')]`

### Separação do módulo `organizations`

O módulo `organizations` é voltado para SUPER_ADMIN com org explícita na URL (`/admin/organizations/:id/...`). O novo módulo `org-users` é para ORG_ADMIN com org inferida do JWT (`req.user.organizationId`), usando prefixo `/org/users`.

### `createOrgUser(orgId, { name, email, phone?, role, farmIds? })`

Fluxo:

1. Valida role em `ASSIGNABLE_ROLES` (MANAGER, AGRONOMIST, FINANCIAL, OPERATOR, COWBOY, CONSULTANT) — nunca SUPER_ADMIN ou ADMIN
2. Verifica org existe, está ACTIVE, e não atingiu `maxUsers`
3. Verifica email único
4. Se `farmIds` fornecido, valida que todas pertencem à org
5. Transaction: cria user + createMany `UserFarmAccess`
6. Redis: `org_invite_token:{uuid}` com TTL 604800s (7 dias)
7. Envia email com link `/accept-invite?token={token}`
8. Audit log: `CREATE_ORG_USER`

### Env: `ORG_INVITE_TOKEN_EXPIRES_IN`

Adicionado à interface `Env` e defaults (604800 = 7 dias), separado do `INVITE_TOKEN_EXPIRES_IN` (172800 = 48h) usado pelo SUPER_ADMIN para criar admins.

### `acceptInvite` — suporte a `org_invite_token:`

Em `auth.service.ts`, `acceptInvite()` agora tenta `invite_token:{token}` primeiro; se não encontrar, tenta `org_invite_token:{token}`. Mesmo fluxo: consume token, define senha, cria sessão.

## Por que

- ORG_ADMIN precisa gerenciar seus próprios usuários sem depender do SUPER_ADMIN
- TTL 7 dias (vs 48h do admin) porque usuários de campo podem demorar para acessar email
- Farm access na criação evita etapa extra de vincular fazendas depois
- Prefixo Redis separado (`org_invite_token:`) mantém isolamento entre convites SUPER_ADMIN e ORG_ADMIN
