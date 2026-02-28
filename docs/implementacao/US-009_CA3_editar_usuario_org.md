# US-009 CA3 — Editar usuário (dados, role, fazendas) + self-protection

## O que foi implementado

### `updateOrgUser(orgId, userId, actorId, { name?, phone?, role?, farmIds? })`

Fluxo:

1. Busca user, valida que pertence à org → 404
2. **Self-protection:** se `actorId === userId` e `role` está sendo alterada → 422 (admin não pode rebaixar a si mesmo)
3. Valida role em `ASSIGNABLE_ROLES` se fornecida
4. Valida `farmIds` na org se fornecidos
5. Transaction: update user + replace farmAccess (delete all + createMany)
6. Se role mudou → `invalidateAllUserSessions(userId)` (força re-login com novo JWT)
7. Audit log: `UPDATE_ORG_USER`

### Farm access: full-replacement

Quando `farmIds` é enviado no PATCH, **substitui todos** os acessos existentes:

- `farmIds: ['farm-1', 'farm-2']` → remove tudo e adiciona farm-1 e farm-2
- `farmIds: []` → remove todos os acessos
- `farmIds` omitido → não altera acessos

### Rota

`PATCH /org/users/:userId` — atualização parcial (apenas campos enviados)

## Por que

- Self-protection impede que o admin acidentalmente altere sua própria role, ficando sem acesso admin
- Full-replacement de farm access é mais simples e previsível que operações incrementais (add/remove)
- Invalidação de sessão ao mudar role garante que o JWT reflita o novo cargo imediatamente
