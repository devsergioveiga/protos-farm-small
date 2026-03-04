# SUPER_ADMIN desacoplado de organização

## Contexto

O SUPER_ADMIN era vinculado a uma organização cliente, mas semanticamente é um admin de **plataforma** (Protos Farm). Com `User.organizationId` nullable, o SUPER_ADMIN não pertence a nenhuma organização.

## Mudanças

### Migration

- `20260312100000_super_admin_nullable_org`: `ALTER TABLE "users" ALTER COLUMN "organizationId" DROP NOT NULL`

### Schema Prisma

- `User.organizationId`: `String` → `String?`
- `User.organization`: `Organization` → `Organization?`

### TypeScript

- `express.d.ts`: `organizationId: string` → `string | null`
- `auth.service.ts`: `TokenPayload.organizationId` e `UserForSession.organizationId` → `string | null`
- `auth.service.ts`: guards `createSessionForUser` e `refreshTokens` — adicionada verificação `&& user.organizationId` antes de buscar org
- `google-oauth.service.ts`: mesma verificação no check de `allowSocialLogin`
- `AuthContext.tsx` (frontend): `organizationId: string` → `string | null`

### Guards em rotas `/org/*`

Todas as 6 funções `buildRlsContext()` agora verificam se `organizationId` é null e lançam erro 403 com a mensagem "Acesso negado: usuário sem organização vinculada":

- `farms.routes.ts` (FarmError)
- `plot-history.routes.ts` (FarmError)
- `org-users.routes.ts` (OrgUserError)
- `roles.routes.ts` (RoleError)
- `producers.routes.ts` (ProducerError)
- `car.routes.ts` (CarError)

### Seed

- SUPER_ADMIN: `organizationId: null`, email `admin@protosfarm.com.br`, nome `Admin Protos Farm`
- Removidos 3 vínculos `userFarmAccess` do SUPER_ADMIN (não precisa de farm access explícito)

## Por que é seguro

- Rotas `/admin/*` usam `withRlsBypass()` — não precisam de organizationId
- Middlewares `checkPermission`/`checkFarmAccess` já fazem bypass para SUPER_ADMIN via `ROLE_HIERARCHY`
- `buildRlsContext()` agora rejeita explicitamente requests sem org, impedindo SUPER_ADMIN de acessar rotas `/org/*` sem contexto

## Testes

- 523 backend + 441 frontend = 964 testes passando
