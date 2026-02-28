# US-009 CA5 — Limite de usuários (80%/100%) + reenvio convite + link WhatsApp

## O que foi implementado

### `getOrgUserLimit(orgId)`

Retorna:

```json
{
  "current": 8,
  "max": 10,
  "percentage": 80,
  "warning": true,
  "blocked": false
}
```

- `warning: true` quando `percentage >= 80%`
- `blocked: true` quando `percentage >= 100%`
- Frontend pode usar para mostrar avisos antes de atingir o limite

### `resendInvite(orgId, userId)`

- Valida user na org
- Valida `passwordHash === null` (user ainda não definiu senha) → 422 se já definiu
- Gera novo token `org_invite_token:` com TTL 7 dias
- Envia email com novo link
- Retorna `{ message, inviteUrl }`

### `generateInviteLink(orgId, userId)`

- Mesma validação de `resendInvite`
- Gera token mas **NÃO envia email**
- Retorna `{ inviteUrl }` para admin compartilhar via WhatsApp ou outro meio

### Rotas

- `GET /org/users/limit` — registrada ANTES de `/:userId` para não conflitar
- `POST /org/users/:userId/resend-invite` — reenvio com email
- `POST /org/users/:userId/invite-link` — gera link sem email

## Por que

- Endpoint de limite permite ao frontend alertar proativamente (80%) e bloquear criação (100%)
- Reenvio de convite é necessário quando token de 7 dias expirou
- Link sem email (invite-link) atende cenários rurais onde WhatsApp é mais comum que email
- Validação `passwordHash === null` previne reenvio para users que já aceitaram o convite

## Testes

49 testes cobrindo todos os 9 endpoints, incluindo auth guard, validações, erros de serviço e erros 500.
