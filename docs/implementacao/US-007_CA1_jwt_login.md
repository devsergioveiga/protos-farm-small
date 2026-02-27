# US-007 CA1 — Login seguro com JWT (access + refresh token)

## Resumo

Implementação da autenticação por JWT com access token (15 min) e refresh token opaco (7 dias no Redis), incluindo middleware de proteção de rotas.

## Decisões Técnicas

| Decisão       | Escolha              | Motivo                                              |
| ------------- | -------------------- | --------------------------------------------------- |
| Lib JWT       | `jsonwebtoken`       | Padrão de mercado, amplamente auditada              |
| Hashing       | `bcrypt` (native)    | Performance com binding C++, cost factor 12         |
| Redis client  | `ioredis`            | Feature-complete, lazyConnect, reconnect automático |
| Refresh token | Opaque UUID no Redis | Revogável a qualquer momento, sem estado no client  |
| Rotação       | Single-use refresh   | Cada refresh gera novo par de tokens, mitiga replay |

## Arquivos Criados

| Arquivo                                | Descrição                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `src/types/express.d.ts`               | Type augmentation — `req.user` com userId, email, role, organizationId           |
| `src/database/redis.ts`                | Singleton ioredis com lazyConnect e global cache (padrão prisma.ts)              |
| `src/modules/auth/auth.service.ts`     | Lógica de login, refresh, geração/verificação de tokens                          |
| `src/modules/auth/auth.routes.ts`      | `POST /api/auth/login` e `POST /api/auth/refresh`                                |
| `src/middleware/auth.ts`               | Middleware `authenticate` — extrai Bearer token, verifica JWT, injeta `req.user` |
| `src/modules/auth/auth.routes.spec.ts` | Testes de rota (supertest + jest.mock)                                           |
| `src/middleware/auth.spec.ts`          | Testes do middleware authenticate                                                |

## Arquivos Modificados

| Arquivo               | Alteração                                                      |
| --------------------- | -------------------------------------------------------------- |
| `src/config/env.ts`   | Adicionou JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN |
| `src/app.ts`          | Registrou `authRouter` em `/api`                               |
| `prisma/seed.ts`      | Adicionou `bcrypt.hashSync('Test@1234', 12)` nos usuários      |
| `.env.example`        | Adicionou variáveis JWT                                        |
| `infra/env/.env.dev`  | Adicionou variáveis JWT                                        |
| `package.json` (raiz) | `pnpm.onlyBuiltDependencies` para bcrypt                       |

## Endpoints

### POST /api/auth/login

**Body:** `{ "email": string, "password": string }`

**Sucesso (200):**

```json
{ "accessToken": "eyJhbG...", "refreshToken": "uuid-opaque" }
```

**Erros:**

- `400` — Email ou senha ausentes
- `401` — Credenciais inválidas (user não existe, senha errada, sem passwordHash)
- `403` — Conta inativa
- `500` — Erro interno

### POST /api/auth/refresh

**Body:** `{ "refreshToken": string }`

**Sucesso (200):**

```json
{ "accessToken": "eyJhbG...", "refreshToken": "novo-uuid" }
```

**Erros:**

- `400` — Refresh token ausente
- `401` — Token inválido ou expirado
- `500` — Erro interno

## Middleware authenticate

Não registrado globalmente — será aplicado por rota em CAs futuros.

```typescript
import { authenticate } from '../middleware/auth';
router.get('/protected', authenticate, handler);
```

Fluxo:

1. Extrai `Authorization: Bearer <token>` do header
2. `verifyAccessToken()` → injeta `req.user`
3. Retorna 401 se ausente/inválido

## Fluxo de Login

1. `prisma.user.findUnique({ where: { email } })`
2. Valida: user existe, passwordHash não é null
3. Valida: `user.status === 'ACTIVE'`
4. `bcrypt.compare(password, user.passwordHash)`
5. Gera access token JWT com payload `{ userId, email, role, organizationId }`
6. Gera refresh token `crypto.randomUUID()` (opaque)
7. Salva no Redis: `refresh_token:<uuid>` → userId, TTL 7 dias
8. Atualiza `user.lastLoginAt`
9. Retorna `{ accessToken, refreshToken }`

## Fluxo de Refresh

1. Busca `refresh_token:<token>` no Redis
2. Deleta token antigo (rotação — single-use)
3. Busca user por userId, valida status ACTIVE
4. Gera novo par de tokens
5. Retorna `{ accessToken, refreshToken }`

## Variáveis de Ambiente

| Variável                   | Default (dev/test)                        | Obrigatória em prod |
| -------------------------- | ----------------------------------------- | ------------------- |
| `JWT_SECRET`               | `dev-jwt-secret-do-not-use-in-production` | Sim                 |
| `JWT_EXPIRES_IN`           | `15m`                                     | Não                 |
| `REFRESH_TOKEN_EXPIRES_IN` | `604800` (7 dias em segundos)             | Não                 |

## Senha dos Usuários Seed

Todos os usuários do seed agora possuem `passwordHash` com a senha `Test@1234` (bcrypt cost 12).

## Testes

- `auth.routes.spec.ts` — 6 testes (login: 200, 400x2, 401, 403, 500 | refresh: 200, 400, 401, 500)
- `auth.spec.ts` — 4 testes (401 sem header, 401 sem Bearer, 401 token inválido, next() com token válido)
