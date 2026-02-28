# US-007 CA3 — Rate Limiting, Força de Senha e Logout

## Critérios de Aceite Implementados

- **Critério 3:** Rate limiting em tentativas de login (máx 5/min por IP, bloqueio 15min por email após 10 falhas)
- **Critério 5:** Força de senha mínima (8 chars, 1 maiúscula, 1 número, 1 especial)
- **Critério 6:** Logout encerra sessão e invalida refresh token

---

## Decisões Técnicas

### Validação de Força de Senha

Implementada como utilitário puro (`password-validator.ts`) sem dependências externas. Regras:

| Regra       | Requisito                               |
| ----------- | --------------------------------------- |
| Comprimento | Mínimo 8 caracteres                     |
| Maiúscula   | Pelo menos 1 letra maiúscula            |
| Número      | Pelo menos 1 dígito                     |
| Especial    | Pelo menos 1 caractere não-alfanumérico |

A validação retorna uma lista de erros específicos, permitindo feedback granular ao usuário. É aplicada nas rotas `POST /auth/reset-password` e `POST /auth/accept-invite` — os dois pontos onde o usuário define uma nova senha.

### Rate Limiting com Redis

Usamos Redis diretamente (sem pacote extra como `express-rate-limit`) para manter consistência com o stack existente. Duas camadas:

1. **Por IP** — Máximo 5 tentativas por minuto. Key: `login_rate:ip:{ip}` com TTL de 60s. Protege contra ataques de força bruta distribuídos.

2. **Por email** — Após 10 falhas acumuladas, bloqueia o email por 15 minutos. Key: `login_block:{email}` com TTL de 900s. Protege contas individuais contra ataques direcionados.

O middleware adota fail-open: se o Redis estiver indisponível, a request é permitida (para não bloquear login legítimo). Após login bem-sucedido, o contador de falhas é limpo.

### Logout

Endpoint `POST /api/auth/logout` protegido por `authenticate` middleware. Invalida o refresh token no Redis (`redis.del`). O access token continua válido até expirar (stateless JWT), mas sem refresh token o usuário não consegue renovar a sessão.

---

## Arquivos Criados/Modificados

| Ação    | Arquivo                                       | Descrição                                                                |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Criado  | `src/shared/utils/password-validator.ts`      | Validação de força de senha                                              |
| Criado  | `src/shared/utils/password-validator.spec.ts` | 8 testes unitários                                                       |
| Criado  | `src/middleware/rate-limit.ts`                | Middleware de rate limiting com Redis                                    |
| Criado  | `src/middleware/rate-limit.spec.ts`           | 10 testes unitários                                                      |
| Editado | `src/modules/auth/auth.service.ts`            | Adicionada função `logout()`                                             |
| Editado | `src/modules/auth/auth.routes.ts`             | Rate limit no login, validação de senha no reset/invite, endpoint logout |
| Editado | `src/modules/auth/auth.routes.spec.ts`        | 6 novos testes (logout + validação de senha)                             |

---

## Endpoints

### POST /api/auth/login (atualizado)

- Rate limit: 5 tentativas/min por IP
- Bloqueio: 15min após 10 falhas por email
- Respostas adicionais: `429 Too Many Requests`

### POST /api/auth/reset-password (atualizado)

- Validação de força de senha antes de processar
- Resposta adicional: `400` com `details` (lista de erros)

### POST /api/auth/accept-invite (atualizado)

- Validação de força de senha antes de processar
- Resposta adicional: `400` com `details` (lista de erros)

### POST /api/auth/logout (novo)

- **Autenticação:** Bearer token obrigatório
- **Body:** `{ refreshToken: string }`
- **200:** `{ message: 'Sessão encerrada com sucesso' }`
- **400:** Refresh token ausente
- **401:** Sem autenticação

---

## Verificação

```bash
pnpm --filter backend test   # 14 suites, 149 testes ✓
pnpm --filter backend build  # compila sem erros ✓
```
