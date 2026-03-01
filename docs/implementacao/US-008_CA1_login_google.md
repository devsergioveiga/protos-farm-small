# US-008 CA1 — Botão "Entrar com Google" funcional na tela de login

## O que foi implementado

### Backend

1. **Env vars para Google OAuth** (`apps/backend/src/config/env.ts`)
   - Adicionadas `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
   - Defaults vazios em dev/test — Google OAuth é opcional, funciona sem configurar

2. **Refatoração do auth.service.ts** — `createSessionForUser()`
   - Extraída lógica comum de criação de sessão (tokens, Redis, lastLoginAt)
   - Reutilizada em `login()`, `acceptInvite()` e Google OAuth
   - Inclui verificação de org ativa e política de sessão única/múltipla

3. **Google OAuth service** (`apps/backend/src/modules/auth/google-oauth.service.ts`)
   - `buildGoogleAuthUrl()` — gera URL com state CSRF (Redis, 10min TTL)
   - `handleGoogleCallback()` — valida state, troca code, busca user por email, gera one-time code
   - `exchangeGoogleCode()` — consome one-time code (60s TTL), retorna JWT tokens
   - Usa `google-auth-library` (pacote oficial do Google)

4. **Rotas Google OAuth** (`apps/backend/src/modules/auth/auth.routes.ts`)
   - `GET /auth/google` — redireciona para Google (503 se não configurado)
   - `GET /auth/google/callback` — recebe callback, redireciona frontend com code ou error
   - `POST /auth/google/exchange` — troca one-time code por JWT tokens

5. **Testes** — 12 novos testes para as 3 rotas Google (total: 165 testes passando)

### Frontend

1. **API client** (`apps/frontend/src/services/api.ts`)
   - Wrapper fetch com auth headers, auto-refresh em 401, redirect para /login
   - Gerencia tokens no localStorage

2. **AuthContext** (`apps/frontend/src/stores/AuthContext.tsx`)
   - Estado global de autenticação (user, isAuthenticated, isLoading)
   - Decodifica JWT no client para extrair user info
   - `login()`, `loginWithTokens()`, `logout()`

3. **ProtectedRoute** (`apps/frontend/src/components/auth/ProtectedRoute.tsx`)
   - Redireciona para /login se não autenticado

4. **Router** (`apps/frontend/src/App.tsx`)
   - BrowserRouter + AuthProvider + code splitting (React.lazy)
   - Rotas: /login, /auth/callback, /dashboard (protegida), \* → /login

5. **Tela de Login** (`apps/frontend/src/pages/LoginPage.tsx` + `.css`)
   - Formulário email/senha com labels visíveis
   - Botão primário "Entrar" (único na tela)
   - Botão outlined "Entrar com Google" com ícone G colorido
   - Mensagens de erro com `role="alert"` e ícone AlertCircle
   - Tratamento de erros do Google OAuth via query params
   - HTML semântico, tokens CSS, acessibilidade WCAG

6. **Auth Callback** (`apps/frontend/src/pages/AuthCallbackPage.tsx`)
   - Troca one-time code por tokens via POST /auth/google/exchange
   - Redireciona para /dashboard ou /login com erro

7. **Dashboard placeholder** (`apps/frontend/src/pages/DashboardPage.tsx`)
   - Exibe email do usuário + botão "Sair"

## Por que essas decisões

### One-time code pattern (backend → frontend)

Tokens JWT nunca aparecem em URLs ou logs. O callback do Google redireciona para `/auth/callback?code={uuid}`, e o frontend troca esse UUID por tokens via POST. O code expira em 60s e é single-use.

### createSessionForUser() refactor

Centraliza a lógica de criação de sessão (tokens, Redis, org check, multiple sessions) em um único ponto. Evita duplicação entre login(), acceptInvite() e Google OAuth.

### localStorage para tokens

Persiste entre abas e refresh do browser. O accessToken tem vida curta (15min) e o refreshToken é rotacionado a cada uso.

### Sem auto-cadastro via Google

Respeita constraint de segurança (CA2): email deve existir no sistema. Se o email do Google não estiver cadastrado, retorna erro amigável.

## Arquivos criados/modificados

| Ação    | Arquivo                                                 |
| ------- | ------------------------------------------------------- |
| Editado | `apps/backend/src/config/env.ts`                        |
| Editado | `apps/backend/src/modules/auth/auth.service.ts`         |
| Criado  | `apps/backend/src/modules/auth/google-oauth.service.ts` |
| Editado | `apps/backend/src/modules/auth/auth.routes.ts`          |
| Editado | `apps/backend/src/modules/auth/auth.routes.spec.ts`     |
| Editado | `infra/env/.env.dev`                                    |
| Editado | `apps/frontend/src/App.tsx`                             |
| Editado | `apps/frontend/src/App.spec.tsx`                        |
| Criado  | `apps/frontend/src/services/api.ts`                     |
| Criado  | `apps/frontend/src/stores/AuthContext.tsx`              |
| Criado  | `apps/frontend/src/components/auth/ProtectedRoute.tsx`  |
| Criado  | `apps/frontend/src/pages/LoginPage.tsx`                 |
| Criado  | `apps/frontend/src/pages/LoginPage.css`                 |
| Criado  | `apps/frontend/src/pages/AuthCallbackPage.tsx`          |
| Criado  | `apps/frontend/src/pages/DashboardPage.tsx`             |

## Verificação

- `pnpm --filter backend test` — 165 testes passando (14 suites)
- `pnpm --filter frontend test` — 1 teste passando
- `pnpm --filter backend build` — compila sem erros
- `pnpm --filter frontend build` — compila sem erros, code splitting funcionando
