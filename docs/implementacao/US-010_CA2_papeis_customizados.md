# US-010 CA2 — CRUD de Papéis Customizados

## O que foi implementado

### Módulo `modules/roles/`

Criado com 4 arquivos:

- `roles.types.ts` — interfaces `CreateRoleInput`, `UpdateRoleInput`, `RolesError`
- `roles.service.ts` — lógica de negócio (CRUD + validações)
- `roles.routes.ts` — 5 endpoints com guards `[authenticate, checkPermission('ROLE_MANAGE')]`
- `roles.controller.ts` — handlers HTTP separados da lógica

### Endpoints

| Método | Rota                 | Descrição                          |
| ------ | -------------------- | ---------------------------------- |
| POST   | `/api/org/roles`     | Criar role customizado             |
| GET    | `/api/org/roles`     | Listar roles da organização        |
| GET    | `/api/org/roles/:id` | Detalhar role com suas permissões  |
| PATCH  | `/api/org/roles/:id` | Editar nome, descrição, permissões |
| DELETE | `/api/org/roles/:id` | Soft-delete do role                |

### `createCustomRole`

1. Recebe `name`, `description`, `baseRole` e opcionalmente `permissions[]`
2. Se `permissions` omitido, clona `DEFAULT_ROLE_PERMISSIONS[baseRole]` como ponto de partida
3. **Anti-escalation:** `baseRole` não pode ser superior ao role do criador (compara via `ROLE_HIERARCHY`)
4. Permissões fornecidas não podem exceder as do `baseRole` — só pode remover, nunca adicionar além do teto
5. Transaction: cria `CustomRole` + `RolePermission` entries
6. Audit log: `CREATE_CUSTOM_ROLE`

### Soft-delete

- DELETE seta `deletedAt = now()` em vez de remover o registro
- Usuários com esse `customRoleId` voltam a usar `DEFAULT_ROLE_PERMISSIONS[user.role]`
- Queries de listagem filtram `deletedAt IS NULL`
- Invalidação de cache RBAC para todos os usuários afetados

## Por que

- Orgs precisam de flexibilidade para criar perfis como "Gerente Financeiro" (MANAGER com apenas permissões financeiras)
- Anti-escalation é crítico para segurança — um MANAGER não pode criar um role com permissões de ADMIN
- Soft-delete preserva histórico em audit logs e evita FK orphans
- Clone do base role como default facilita a criação (remover o que não precisa é mais intuitivo que adicionar do zero)
