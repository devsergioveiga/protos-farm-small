# US-009 CA2 — Listar usuários com paginação, busca e filtros

## O que foi implementado

### `listOrgUsers(orgId, { page?, limit?, search?, role?, farmId?, status? })`

- `where.organizationId = orgId` sempre (escopo automático via JWT)
- `search` → OR `name`/`email` case-insensitive
- Filtros opcionais: `role`, `status`, `farmId` (via `farmAccess.some`)
- Include: `farmAccess` com `farm { id, name }`
- Select exclui `passwordHash` por segurança
- Retorna `{ data[], meta: { page, limit, total, totalPages } }`

### `getOrgUser(orgId, userId)`

- Busca user por ID com farms vinculadas
- Valida que pertence à org → 404 se não

### Rotas

- `GET /org/users` — lista paginada com query params
- `GET /org/users/:userId` — detalhe do usuário

## Por que

- Admin precisa visualizar todos os membros da sua org de forma eficiente
- Filtros por role, status e fazenda atendem os cenários mais comuns de busca
- Excluir `passwordHash` do select evita vazamento de dados sensíveis
- Paginação segue o mesmo padrão de `listOrganizations` (consistência)
