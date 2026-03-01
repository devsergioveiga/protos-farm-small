# US-010 CA4 — Contexto de Fazenda e Organização no Audit Log

## O que foi implementado

### Novos campos no `AuditLog`

Migration adicionou:

- `farmId` (String, opcional) — ID da fazenda associada à ação
- `organizationId` (String, opcional) — ID da organização do ator
- Índice composto `(organizationId, createdAt)` para consultas por org
- Índice `(farmId, createdAt)` para consultas por fazenda

### `logAudit` atualizado

Assinatura expandida com campos opcionais `farmId` e `organizationId`:

```typescript
logAudit({
  actorId, actorEmail, actorRole, action,
  targetType, targetId, metadata, ipAddress,
  farmId?,         // novo
  organizationId?, // novo
})
```

- Todas as chamadas existentes em `organizations.routes.ts` agora incluem `organizationId`
- Chamadas em `org-users.routes.ts` incluem `organizationId` do JWT
- Ações futuras no contexto de fazenda preencherão `farmId`

### Filtros no endpoint `GET /admin/audit-logs`

Novos query params disponíveis:

- `organizationId` — filtra logs por organização
- `farmId` — filtra logs por fazenda
- Combinável com filtros existentes (`actorId`, `action`, `startDate`, `endDate`)

### Política de retenção

- Documentada retenção de 2 anos para audit logs
- Campo `createdAt` indexado para facilitar limpeza periódica
- Job de limpeza pode ser implementado futuramente via cron (não incluso neste CA)

## Por que

- Audit logs sem contexto de org/farm são difíceis de filtrar em sistema multi-tenant
- ORG_ADMIN precisa ver apenas logs da sua organização, não do sistema inteiro
- Índices compostos com `createdAt` otimizam queries paginadas com filtro temporal
- Retenção de 2 anos atende requisitos de compliance agrícola (rastreabilidade)
- Campos opcionais mantêm retrocompatibilidade com logs anteriores
