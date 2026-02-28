# US-008 CA3 — Vinculação de conta Google a conta existente no primeiro login social

## O que foi implementado

### Schema Prisma

- Campo `googleId` (String? @unique) adicionado ao modelo `User`
- Migration `20260228120000_add_google_id_to_users`
- Índice único garante que um `sub` do Google só pode ser vinculado a um usuário

### Backend — `google-oauth.service.ts`

No `handleGoogleCallback`, após encontrar o usuário por email:

1. **Primeiro login Google** (`user.googleId === null`): salva o `sub` do Google no campo `googleId`
2. **Logins subsequentes** (`user.googleId === googleSub`): prossegue normalmente
3. **Google sub diferente** (`user.googleId !== googleSub`): rejeita com erro 403

Isso previne que alguém com acesso a outra conta Google (mesmo email em outro provedor) faça login indevido após a vinculação inicial.

### Rotas — mapeamento de erro

Novo error code `google_account_mismatch` mapeado no callback para redirecionar o frontend com mensagem específica.

### Frontend — `LoginPage.tsx`

Nova mensagem de erro:

> "Esta conta já está vinculada a outra conta Google. Entre em contato com o administrador."

### Testes

1 novo teste adicionado:

- `should redirect to login with google_account_mismatch when Google sub does not match`
- Total: 44 testes no auth.routes.spec.ts

## Arquivos criados/modificados

| Ação    | Arquivo                                                                     |
| ------- | --------------------------------------------------------------------------- |
| Editado | `apps/backend/prisma/schema.prisma` — campo `googleId` no User              |
| Criado  | `apps/backend/prisma/migrations/20260228120000_add_google_id_to_users/`     |
| Editado | `apps/backend/src/modules/auth/google-oauth.service.ts` — vinculação Google |
| Editado | `apps/backend/src/modules/auth/auth.routes.ts` — error code mismatch        |
| Editado | `apps/backend/src/modules/auth/auth.routes.spec.ts` — teste mismatch        |
| Editado | `apps/frontend/src/pages/LoginPage.tsx` — mensagem mismatch                 |

## Verificação

- `pnpm --filter backend test` (auth.routes.spec) — 44 testes passando
- `pnpm --filter backend build` — compila sem erros
- `pnpm --filter frontend build` — compila sem erros
