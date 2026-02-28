# US-006 CA2 — Criar Admin da Org + Email Convite 48h + Reset Senha + Desbloquear Conta

## Resumo

Implementação dos critérios 3, 7 e 8 do painel Super Admin: criação de administrador de organização com envio de email-convite (expiração 48h), reset de senha forçado pelo Super Admin, e desbloqueio de conta (INACTIVE → ACTIVE). Inclui rota pública para aceitar convite com login automático.

## Decisões Técnicas

| Decisão          | Escolha                          | Motivo                                                  |
| ---------------- | -------------------------------- | ------------------------------------------------------- |
| Token convite    | Redis com TTL 48h                | Mesmo padrão do password reset, expiração automática    |
| Prefixo Redis    | `invite_token:<uuid>`            | Separação clara de `password_reset:` e `refresh_token:` |
| Accept invite    | Rota pública em auth.routes      | Admin recém-criado não tem credenciais para autenticar  |
| Login automático | Retorna tokens no accept-invite  | Evita redirect extra para login após definir senha      |
| Password null    | `passwordHash: null` na criação  | User existe mas não pode logar até aceitar convite      |
| Config expiração | `INVITE_TOKEN_EXPIRES_IN` env    | Configurável por ambiente, default 172800s (48h)        |
| Reset forçado    | Reutiliza prefixo password_reset | Mesmo fluxo do forgot-password, sem duplicar lógica     |

## Critérios de Aceite Cobertos

| #   | Critério                                                       | Implementação                                        |
| --- | -------------------------------------------------------------- | ---------------------------------------------------- |
| 3   | Criar Admin da org (nome, email, telefone) + email convite 48h | `createOrgAdmin` + Redis token + `sendMail` com link |
| 7   | Reset de senha do admin (Super Admin força reenvio)            | `resetOrgUserPassword` + Redis token + email         |
| 8   | Desbloquear conta de usuário (INACTIVE → ACTIVE)               | `unlockOrgUser` com validação de status              |

## Arquivos Modificados

| Arquivo                                                  | Alteração                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/config/env.ts`                                      | +`INVITE_TOKEN_EXPIRES_IN` na interface Env e defaults (172800s)      |
| `src/modules/organizations/organizations.service.ts`     | +3 funções: `createOrgAdmin`, `resetOrgUserPassword`, `unlockOrgUser` |
| `src/modules/organizations/organizations.routes.ts`      | +3 endpoints REST protegidos por SUPER_ADMIN                          |
| `src/modules/auth/auth.service.ts`                       | +`INVITE_PREFIX` + `acceptInvite()` com login automático              |
| `src/modules/auth/auth.routes.ts`                        | +`POST /auth/accept-invite` (rota pública)                            |
| `src/modules/organizations/organizations.routes.spec.ts` | +13 testes para os 3 novos endpoints de org                           |
| `src/modules/auth/auth.routes.spec.ts`                   | +5 testes para accept-invite                                          |

## Endpoints Adicionados

| Método | Endpoint                                                | Auth        | Body                      | Sucesso | Erros              |
| ------ | ------------------------------------------------------- | ----------- | ------------------------- | ------- | ------------------ |
| POST   | `/admin/organizations/:id/users`                        | SUPER_ADMIN | `{ name, email, phone? }` | 201     | 400, 404, 409, 422 |
| POST   | `/admin/organizations/:id/users/:userId/reset-password` | SUPER_ADMIN | —                         | 200     | 404, 500           |
| PATCH  | `/admin/organizations/:id/users/:userId/unlock`         | SUPER_ADMIN | —                         | 200     | 404, 422, 500      |
| POST   | `/auth/accept-invite`                                   | Pública     | `{ token, password }`     | 200     | 400, 401, 500      |

## Fluxo de Convite

```
Super Admin → POST /admin/organizations/:id/users
  ↓
  Cria user (role=ADMIN, passwordHash=null, status=ACTIVE)
  ↓
  Redis: invite_token:<uuid> → userId (TTL 48h)
  ↓
  Email com link: FRONTEND_URL/accept-invite?token=<uuid>
  ↓
Admin clica no link → POST /auth/accept-invite { token, password }
  ↓
  Consome token Redis, faz hash da senha, atualiza user
  ↓
  Retorna { accessToken, refreshToken } (login automático)
```

## Funções Reutilizadas

| Função                  | Arquivo                       | Uso                               |
| ----------------------- | ----------------------------- | --------------------------------- |
| `sendMail()`            | `shared/mail/mail.service.ts` | Envio de emails (convite + reset) |
| `hashPassword()`        | `auth/auth.service.ts`        | Hash da senha no accept-invite    |
| `generateAccessToken()` | `auth/auth.service.ts`        | Login automático pós-convite      |
| `redis`                 | `database/redis.ts`           | Tokens temporários                |
| `loadEnv()`             | `config/env.ts`               | INVITE_TOKEN_EXPIRES_IN, etc.     |
| `OrgError`              | `organizations.service.ts`    | Erros HTTP tipados                |

## Validações de Negócio

### createOrgAdmin

- Organização deve existir (404)
- Organização deve estar ACTIVE (422)
- Limite de usuários (`maxUsers`) não pode ser excedido (422)
- Email não pode já estar cadastrado (409)

### resetOrgUserPassword

- Organização deve existir (404)
- Usuário deve existir e pertencer à organização (404)

### unlockOrgUser

- Organização deve existir (404)
- Usuário deve existir e pertencer à organização (404)
- Usuário deve estar INACTIVE, não já ACTIVE (422)

## Verificação

```bash
# Testes (114 passing)
pnpm --filter @protos-farm/backend test

# Build (sem erros)
pnpm --filter @protos-farm/backend build
```
