# US-008 CA5 — Admin pode habilitar/desabilitar login social para a organização

## O que foi implementado

### Schema Prisma

- Campo `allowSocialLogin` (Boolean, default `true`) adicionado ao modelo `Organization`
- Migration `20260228130000_add_allow_social_login`
- Segue o mesmo padrão de `allowMultipleSessions` (US-007 CA4)

### Backend — Service

`updateSocialLoginPolicy(id, allowSocialLogin)` em `organizations.service.ts`:

- Busca org, atualiza o campo, retorna org atualizada

### Backend — Rota

`PATCH /admin/organizations/:id/social-login-policy` em `organizations.routes.ts`:

- Apenas SUPER_ADMIN pode alterar
- Validação: `allowSocialLogin` deve ser booleano
- Audit log com action `UPDATE_SOCIAL_LOGIN_POLICY`

### Backend — Verificação no Google OAuth

Em `google-oauth.service.ts`, no `handleGoogleCallback`:

- Após encontrar o user e verificar status, busca a org
- Se `org.allowSocialLogin === false`, rejeita com erro 403
- SUPER_ADMIN não é afetado (pode sempre usar Google login)

### Mapeamento de erro

- Backend: erro mapeado para `google_social_disabled`
- Frontend: "Login com Google está desabilitado para sua organização. Use email e senha."

### Testes

- 1 teste no `auth.routes.spec.ts` — callback com social login desabilitado (total: 45)
- 6 testes no `organizations.routes.spec.ts` — rota social-login-policy (total: 52)

## Arquivos criados/modificados

| Ação    | Arquivo                                                                 |
| ------- | ----------------------------------------------------------------------- |
| Editado | `apps/backend/prisma/schema.prisma` — campo `allowSocialLogin`          |
| Criado  | `apps/backend/prisma/migrations/20260228130000_add_allow_social_login/` |
| Editado | `apps/backend/src/modules/organizations/organizations.service.ts`       |
| Editado | `apps/backend/src/modules/organizations/organizations.routes.ts`        |
| Editado | `apps/backend/src/modules/organizations/organizations.routes.spec.ts`   |
| Editado | `apps/backend/src/modules/auth/google-oauth.service.ts`                 |
| Editado | `apps/backend/src/modules/auth/auth.routes.ts`                          |
| Editado | `apps/backend/src/modules/auth/auth.routes.spec.ts`                     |
| Editado | `apps/frontend/src/pages/LoginPage.tsx`                                 |

## Verificação

- `pnpm --filter backend test` — auth 45 + orgs 52 testes passando
- `pnpm --filter backend build` — compila sem erros
- `pnpm --filter frontend build` — compila sem erros
