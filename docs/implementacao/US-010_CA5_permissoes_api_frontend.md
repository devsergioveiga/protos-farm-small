# US-010 CA5 — API de Permissões e Frontend de Gerenciamento

## O que foi implementado

### Endpoints de consulta

| Método | Rota                          | Descrição                                          |
| ------ | ----------------------------- | -------------------------------------------------- |
| GET    | `/api/org/permissions/matrix` | Matriz completa: roles × permissões da organização |
| GET    | `/api/org/permissions/me`     | Permissões efetivas do usuário autenticado         |

- `/matrix` retorna roles padrão + custom roles da org, cada um com seu array de permissões
- `/me` retorna as permissões resolvidas (custom role se houver, senão default do role base)

### Migração de rotas para `checkPermission`

Rotas que usavam `authorize('ADMIN')` foram migradas para `checkPermission`:

- `org-users.routes.ts` → `checkPermission('USER_MANAGE')` ou `checkPermission('USER_READ')`
- `roles.routes.ts` → `checkPermission('ROLE_MANAGE')`
- Rotas de admin (`/admin/*`) mantêm `authorize('SUPER_ADMIN')` — não usam RBAC granular

### Frontend — `RolesPage`

- Tabela/matriz visual de permissões por role
- Linhas = permissões agrupadas por domínio (Fazenda, Usuário, Relatório, etc.)
- Colunas = roles (padrão + customizados)
- Checkboxes desabilitados para roles padrão, editáveis para custom roles
- Botão "Criar papel" abre formulário com seleção de base role

### Hook `usePermissions`

- Chama `GET /api/org/permissions/me` no mount
- Retorna `{ permissions, hasPermission(p), loading }`
- Cache local em memória — revalida ao detectar mudança de role no JWT

### Componente `PermissionGate`

```tsx
<PermissionGate permission="USER_MANAGE">
  <BotaoEditarUsuario />
</PermissionGate>
```

- Renderiza children apenas se o usuário tem a permissão
- Prop `fallback` opcional para conteúdo alternativo
- Usa `usePermissions` internamente

### `AuthContext` atualizado

- Armazena `permissions: Permission[]` no estado
- Popula via `usePermissions` após login
- Invalida ao fazer logout ou trocar de organização

## Por que

- `/permissions/me` permite ao frontend esconder/mostrar elementos sem hardcode de roles
- `PermissionGate` centraliza a lógica de exibição condicional, evitando `if` espalhados
- Migração para `checkPermission` desacopla endpoints de roles fixos — custom roles funcionam automaticamente
- Matriz visual dá ao ORG_ADMIN visibilidade clara do que cada papel pode fazer
