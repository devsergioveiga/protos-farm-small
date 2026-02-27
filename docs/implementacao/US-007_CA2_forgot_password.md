# US-007 CA2 — Fluxo de "Esqueci minha senha" com link por email

## Objetivo

Implementar o fluxo de recuperação de senha: o usuário solicita reset informando seu email, o sistema gera um token opaco (UUID) armazenado no Redis com TTL de 1h, envia um email com link contendo o token, e o usuário usa esse token para definir uma nova senha.

## Decisões Técnicas

| Decisão                | Escolha               | Motivo                                                  |
| ---------------------- | --------------------- | ------------------------------------------------------- |
| Lib de email           | Nodemailer + SMTP     | Padrão de mercado, flexível, suporta qualquer SMTP      |
| Armazenamento de token | Redis com TTL         | Já temos Redis na infra; TTL automático elimina cleanup |
| Formato do token       | `crypto.randomUUID()` | UUID v4 opaco, sem informação do usuário                |
| Escopo                 | Backend API only      | Frontend será implementado em CA futura                 |

## Endpoints Criados

### `POST /api/auth/forgot-password`

| Campo   | Valor                                                   |
| ------- | ------------------------------------------------------- |
| Body    | `{ "email": "user@example.com" }`                       |
| Sucesso | `200 { "message": "Se o email estiver cadastrado..." }` |
| Erros   | `400` (sem email), `500` (erro interno)                 |

**Segurança:** Sempre retorna 200, mesmo se o email não existir (previne enumeração de emails).

### `POST /api/auth/reset-password`

| Campo   | Valor                                                                                  |
| ------- | -------------------------------------------------------------------------------------- |
| Body    | `{ "token": "<uuid>", "password": "NovaSenha@123" }`                                   |
| Sucesso | `200 { "message": "Senha redefinida com sucesso" }`                                    |
| Erros   | `400` (campos faltando), `401` (token inválido/expirado), `403` (conta inativa), `500` |

## Fluxo Detalhado

### Solicitação de Reset

1. Usuário envia `POST /api/auth/forgot-password` com email
2. Backend busca usuário pelo email
3. Se não encontrado ou inativo → retorna silenciosamente (segurança)
4. Gera token UUID e salva no Redis: `password_reset:<token>` → userId (TTL 1h)
5. Monta URL de reset: `${FRONTEND_URL}/reset-password?token=<token>`
6. Envia email via Nodemailer com link
7. Retorna mensagem genérica

### Reset de Senha

1. Usuário envia `POST /api/auth/reset-password` com token e nova senha
2. Busca `password_reset:<token>` no Redis
3. Se não existe → 401 (token inválido ou expirado)
4. Deleta token (uso único)
5. Busca usuário e valida status ativo
6. Hash da nova senha com bcrypt → update no banco
7. Retorna sucesso

## Arquivos Criados/Modificados

| Arquivo                                             | Ação       | Descrição                                    |
| --------------------------------------------------- | ---------- | -------------------------------------------- |
| `apps/backend/src/config/env.ts`                    | Modificado | Adicionadas 7 variáveis SMTP/reset           |
| `apps/backend/src/shared/mail/mail.service.ts`      | Criado     | Serviço genérico de email com Nodemailer     |
| `apps/backend/src/modules/auth/auth.service.ts`     | Modificado | `requestPasswordReset()` e `resetPassword()` |
| `apps/backend/src/modules/auth/auth.routes.ts`      | Modificado | 2 novos endpoints                            |
| `apps/backend/src/shared/mail/mail.service.spec.ts` | Criado     | 5 testes do serviço de email                 |
| `apps/backend/src/modules/auth/auth.routes.spec.ts` | Modificado | 9 novos testes (forgot + reset)              |
| `apps/backend/src/config/env.spec.ts`               | Modificado | Testes atualizados com novas required vars   |
| `.env.example`                                      | Modificado | Novas variáveis documentadas                 |
| `infra/env/.env.dev`                                | Modificado | Defaults de desenvolvimento                  |

## Variáveis de Ambiente Adicionadas

| Variável                    | Default (dev)            | Obrigatória em staging/prod |
| --------------------------- | ------------------------ | --------------------------- |
| `SMTP_HOST`                 | `localhost`              | Sim                         |
| `SMTP_PORT`                 | `1025`                   | Não (default: 1025)         |
| `SMTP_USER`                 | `''` (vazio)             | Não                         |
| `SMTP_PASSWORD`             | `''` (vazio)             | Não                         |
| `SMTP_FROM`                 | `noreply@protosfarm.dev` | Não                         |
| `PASSWORD_RESET_EXPIRES_IN` | `3600` (1h)              | Não                         |
| `FRONTEND_URL`              | `http://localhost:5173`  | Sim                         |

## Testes

- **Mail Service:** 5 testes (criação transporter, campos corretos, sem html, singleton, erro)
- **Auth Routes (forgot):** 3 testes (200 ok, 400 sem email, 500 erro)
- **Auth Routes (reset):** 6 testes (200 ok, 400 sem token, 400 sem password, 401 token inválido, 403 conta inativa, 500 erro)
- **Env:** Testes atualizados para validar `SMTP_HOST` e `FRONTEND_URL` como required em staging/production

## Verificação

```bash
# Testes
pnpm --filter @protos-farm/backend test

# Build
pnpm --filter @protos-farm/backend build

# Teste manual (com infra rodando)
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"carlos.admin@bomfuturo.agro.br"}'

# Verificar token no Redis
docker compose exec redis redis-cli KEYS "password_reset:*"

# Reset com token obtido
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"token":"<token>","password":"NewPass@1234"}'
```
