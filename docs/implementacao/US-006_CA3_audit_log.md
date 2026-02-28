# US-006 CA3 — Log de Auditoria do Super Admin

## O que foi feito

Toda ação de mutação executada pelo Super Admin agora é registrada com timestamp, IP e detalhes da ação.

## Decisões técnicas

### Tabela `audit_logs`

- Campos: `actorId`, `actorEmail`, `actorRole`, `action`, `targetType`, `targetId`, `metadata` (JSON), `ipAddress`, `createdAt`
- **Sem FK para User** — logs são preservados mesmo se o usuário for deletado
- Índices em `actorId`, `action` e `createdAt` para consultas eficientes
- Campo `metadata` como JSON para flexibilidade (cada ação pode ter dados diferentes)

### Audit Service (`shared/audit/audit.service.ts`)

- Função `logAudit()` com catch silencioso — nunca falha a request principal
- Erros de escrita são logados via pino para observabilidade
- Fire-and-forget nas rotas (`void logAudit(...)`) — não bloqueia a resposta

### Ações auditadas

| Rota                                                         | Action                       | targetType   |
| ------------------------------------------------------------ | ---------------------------- | ------------ |
| POST `/admin/organizations`                                  | `CREATE_ORGANIZATION`        | organization |
| PATCH `/admin/organizations/:id/status`                      | `UPDATE_ORGANIZATION_STATUS` | organization |
| PATCH `/admin/organizations/:id/plan`                        | `UPDATE_ORGANIZATION_PLAN`   | organization |
| POST `/admin/organizations/:id/users`                        | `CREATE_ORG_ADMIN`           | user         |
| POST `/admin/organizations/:id/users/:userId/reset-password` | `RESET_USER_PASSWORD`        | user         |
| PATCH `/admin/organizations/:id/users/:userId/unlock`        | `UNLOCK_USER`                | user         |

### Extração de IP

- `x-forwarded-for` (primeiro IP) → `req.ip` → fallback `'unknown'`
- Compatível com reverse proxies (nginx, load balancers)

## Arquivos criados/modificados

| Ação   | Arquivo                                                                       |
| ------ | ----------------------------------------------------------------------------- |
| Criar  | `prisma/migrations/20260227200000_add_audit_logs/migration.sql`               |
| Criar  | `src/shared/audit/audit.service.ts`                                           |
| Criar  | `src/shared/audit/audit.service.spec.ts`                                      |
| Editar | `prisma/schema.prisma` (model AuditLog)                                       |
| Editar | `src/modules/organizations/organizations.routes.ts` (6 logAudit calls)        |
| Editar | `src/modules/organizations/organizations.routes.spec.ts` (mock + verificação) |

## Testes

- `audit.service.spec.ts`: 3 testes (criação, erro silencioso, campos opcionais)
- `organizations.routes.spec.ts`: verificação de audit call no POST create (existente + audit assertion)
