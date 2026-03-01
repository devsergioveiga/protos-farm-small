# US-010 CA3 — Middleware de Acesso por Fazenda

## O que foi implementado

### Middleware `checkFarmAccess`

Criado em `src/shared/middleware/checkFarmAccess.ts`:

1. Extrai `farmId` de `req.params.farmId` → `req.body.farmId` → `req.query.farmId` (nesta ordem de prioridade)
2. Se não encontrar `farmId`, passa adiante (endpoint não requer contexto de fazenda)
3. **Bypass para SUPER_ADMIN e ADMIN** — têm acesso implícito a todas as fazendas da org
4. Para demais roles, consulta `UserFarmAccess` onde `userId` + `farmId` + fazenda pertence à org do usuário
5. Retorna 403 se o vínculo não existir

### Validações adicionais

- Verifica se a fazenda pertence à organização do usuário (`farm.organizationId === req.user.organizationId`)
- Previne acesso cross-org mesmo que o `farmId` seja válido
- Popula `req.farmId` para uso nos controllers downstream

### Integração nas rotas

- Aplicado em rotas que operam no contexto de fazenda (futuro: talhões, culturas, manejos)
- Composição com `checkPermission`: `[authenticate, checkPermission('FARM_READ'), checkFarmAccess]`
- Ordem importa: autenticação → permissão global → acesso à fazenda específica

### Cache

- Não usa cache próprio — `UserFarmAccess` é uma tabela leve com índice composto `(userId, farmId)`
- Mudanças em farm access (CA3 da US-009) já invalidam cache de permissões RBAC

## Por que

- Permissões globais não bastam: um OPERATOR pode ter `FARM_READ` mas só para as fazendas onde trabalha
- Extração automática do `farmId` de múltiplas fontes evita código repetitivo nos controllers
- Bypass para ADMIN/SUPER_ADMIN simplifica a lógica — esses roles administram a org inteira
- Validação cross-org é crítica em sistema multi-tenant para evitar vazamento de dados
