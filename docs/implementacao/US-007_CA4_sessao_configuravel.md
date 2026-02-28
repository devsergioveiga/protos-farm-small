# US-007 CA4 — Sessão única ou múltiplas (configurável pelo Super Admin)

## Critério de Aceite

> O sistema deve permitir configurar se uma organização aceita múltiplas sessões simultâneas ou apenas sessão única por usuário.

## O que foi implementado

### 1. Campo `allowMultipleSessions` na tabela `organizations`

- **Migration:** `20260228100000_add_allow_multiple_sessions`
- Coluna `BOOLEAN NOT NULL DEFAULT true` adicionada à tabela `organizations`
- Default `true` preserva comportamento atual (múltiplas sessões permitidas)
- `false` = sessão única (login invalida todas as sessões anteriores do usuário)

### 2. Tracking de sessões por usuário no Redis

Adicionado Redis Set `user_sessions:{userId}` que mapeia todos os refresh tokens ativos de um usuário.

- `saveRefreshToken()` — além de `SET refresh_token:{token}`, faz `SADD user_sessions:{userId} {token}`
- `consumeRefreshToken()` — além de `DEL refresh_token:{token}`, faz `SREM user_sessions:{userId} {token}`
- `logout()` — busca o userId do token antes de deletar, faz `SREM` do set
- `invalidateAllUserSessions(userId)` — lê todos os tokens do set, deleta cada `refresh_token:{token}`, deleta o set

### 3. Sessão única no login

No `login()`, após validação de senha e antes de criar novo token:

- Se `org.allowMultipleSessions === false`, chama `invalidateAllUserSessions(userId)` para invalidar todas as sessões anteriores
- SUPER_ADMIN (sem org) sempre permite múltiplas sessões

### 4. Endpoint de configuração

```
PATCH /api/admin/organizations/:id/session-policy
Body: { allowMultipleSessions: boolean }
```

- Protegido com `authenticate + authorize('SUPER_ADMIN')`
- Valida que `allowMultipleSessions` é booleano (400 se ausente ou tipo inválido)
- Retorna 404 se organização não existe
- Registra audit log com action `UPDATE_SESSION_POLICY`

### 5. Seed

- Organização "João Carlos Mendes" (PF) configurada com `allowMultipleSessions: false` para ilustrar o cenário de sessão única

## Arquivos modificados

| Ação   | Arquivo                                                                                   |
| ------ | ----------------------------------------------------------------------------------------- |
| Criar  | `apps/backend/prisma/migrations/20260228100000_add_allow_multiple_sessions/migration.sql` |
| Editar | `apps/backend/prisma/schema.prisma`                                                       |
| Editar | `apps/backend/prisma/seed.ts`                                                             |
| Editar | `apps/backend/src/modules/auth/auth.service.ts`                                           |
| Editar | `apps/backend/src/modules/organizations/organizations.service.ts`                         |
| Editar | `apps/backend/src/modules/organizations/organizations.routes.ts`                          |
| Editar | `apps/backend/src/modules/organizations/organizations.routes.spec.ts`                     |
| Criar  | `docs/implementacao/US-007_CA4_sessao_configuravel.md`                                    |

## Testes

5 testes adicionados para o endpoint `PATCH /api/admin/organizations/:id/session-policy`:

- 200 — atualização bem-sucedida + audit log
- 400 — campo ausente
- 400 — campo com tipo inválido (string em vez de boolean)
- 404 — organização não encontrada
- 500 — erro inesperado

Total: **154 testes passando**, build sem erros.

## Decisões técnicas

1. **Default `true`**: preserva compatibilidade — organizações existentes continuam com múltiplas sessões
2. **Redis Set para tracking**: permite invalidação eficiente de todas as sessões sem scan de keys
3. **SUPER_ADMIN sem restrição**: SUPER_ADMIN não pertence logicamente a uma org, então sempre permite múltiplas sessões
4. **Invalidação antes do novo token**: garante que ao fazer login com sessão única, o novo token é o único válido
