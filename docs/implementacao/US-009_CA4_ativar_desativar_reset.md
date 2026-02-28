# US-009 CA4 — Ativar/desativar usuário + resetar senha

## O que foi implementado

### `toggleOrgUserStatus(orgId, userId, actorId, status)`

- Busca user, valida que pertence à org → 404
- **Self-protection:** `actorId === userId` e `status === 'INACTIVE'` → 422 (não pode se desativar)
- Atualiza status para ACTIVE ou INACTIVE
- Se desativando → `invalidateAllUserSessions(userId)` (encerra sessões ativas imediatamente)
- Audit log: `UPDATE_ORG_USER_STATUS`

### `resetOrgUserPasswordByAdmin(orgId, userId)`

- Busca user, valida que pertence à org → 404
- Gera token Redis `password_reset:{uuid}` com TTL 3600s (1h)
- Envia email com link de reset
- Audit log: `RESET_ORG_USER_PASSWORD`

### Rotas

- `PATCH /org/users/:userId/status` — toggle ativo/inativo (validação de status na rota)
- `POST /org/users/:userId/reset-password` — dispara email de reset

## Por que

- Desativação com invalidação de sessão garante que o user perde acesso imediatamente
- Self-protection impede que admin se tranque fora do sistema
- Reset de senha pelo admin atende cenário onde user esqueceu senha e não consegue usar o fluxo self-service
- Usa o mesmo `password_reset:` prefix do fluxo existente, compatível com `resetPassword()` em auth.service
