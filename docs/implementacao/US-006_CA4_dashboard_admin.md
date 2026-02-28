# US-006 CA4 — Dashboard Super Admin

## O que foi feito

Dashboard com estatísticas agregadas (orgs ativas, usuários totais, orgs por plano) e listagem paginada de audit logs.

## Decisões técnicas

### Módulo Admin (`modules/admin/`)

Novo módulo separado do módulo `organizations` para responsabilidade clara:

- `admin.service.ts` — lógica de negócio (dashboard stats + listagem de logs)
- `admin.routes.ts` — 2 endpoints REST
- `admin.routes.spec.ts` — testes de integração com mocks

### Endpoints

| Method | Path                    | Descrição                       |
| ------ | ----------------------- | ------------------------------- |
| GET    | `/api/admin/dashboard`  | Estatísticas agregadas          |
| GET    | `/api/admin/audit-logs` | Listagem paginada de audit logs |

Ambos protegidos com `authenticate + authorize('SUPER_ADMIN')`.

### GET `/api/admin/dashboard`

Retorna:

```json
{
  "organizations": {
    "total": 10,
    "active": 7,
    "suspended": 2,
    "cancelled": 1,
    "byPlan": [
      { "plan": "basic", "count": 5 },
      { "plan": "professional", "count": 3 }
    ]
  },
  "users": { "total": 50 },
  "farms": { "total": 20 }
}
```

- 7 queries paralelas com `Promise.all` para performance
- `groupBy` no campo `plan` para distribuição por plano

### GET `/api/admin/audit-logs`

Query params:

- `page`, `limit` — paginação (default 1/20, max 100)
- `action` — filtrar por tipo de ação (ex: `CREATE_ORGANIZATION`)
- `actorId` — filtrar por ator
- `dateFrom`, `dateTo` — intervalo de datas

Retorna lista paginada com `data` + `meta` (page, limit, total, totalPages).

### Seed

4 registros de audit log de exemplo no seed para visualização em dev.

## Arquivos criados/modificados

| Ação   | Arquivo                                  |
| ------ | ---------------------------------------- |
| Criar  | `src/modules/admin/admin.service.ts`     |
| Criar  | `src/modules/admin/admin.routes.ts`      |
| Criar  | `src/modules/admin/admin.routes.spec.ts` |
| Editar | `src/app.ts` (registrar adminRouter)     |
| Editar | `prisma/seed.ts` (dados de audit log)    |

## Testes

- `admin.routes.spec.ts`: 8 testes
  - Auth guard: 401 sem token, 403 sem SUPER_ADMIN
  - Dashboard: 200 com stats, 500 em erro
  - Audit logs: 200 paginado, query params repassados, 500 em erro
