# US-009-FE: Interface de Gestão de Usuários da Organização

## O quê

Página frontend para gerenciar usuários da organização, consumindo os 9 endpoints do backend US-009 (`/org/users/*`). Inclui listagem com filtros, criação, edição, ativação/desativação, reset de senha, reenvio de convite e link WhatsApp.

## Por quê

Permitir que ADMIN/MANAGER gerenciem os usuários da organização diretamente pela interface web, sem necessidade de acesso direto à API.

## Arquivos criados

| Arquivo                           | Descrição                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/types/org-user.ts`           | Tipos: OrgUserListItem, OrgUserDetail, CreateOrgUserPayload, UpdateOrgUserPayload, UserLimitInfo |
| `src/hooks/useOrgUsers.ts`        | Hook paginado com filtros (search, role, status, farmId)                                         |
| `src/hooks/useUserLimit.ts`       | Hook para GET /org/users/limit                                                                   |
| `src/pages/OrgUsersPage.tsx`      | Página completa CRUD com modais                                                                  |
| `src/pages/OrgUsersPage.css`      | Estilos BEM (design system compliant)                                                            |
| `src/hooks/useOrgUsers.spec.ts`   | 3 testes                                                                                         |
| `src/hooks/useUserLimit.spec.ts`  | 3 testes                                                                                         |
| `src/pages/OrgUsersPage.spec.tsx` | 10 testes                                                                                        |

## Arquivos modificados

| Arquivo                               | Alteração                                                    |
| ------------------------------------- | ------------------------------------------------------------ |
| `src/App.tsx`                         | Lazy import + rota `/users`                                  |
| `src/components/layout/AppLayout.tsx` | Link "Usuários" (ícone Users) na nav entre Fazendas e Papéis |

## Funcionalidades

### Lista (FE1)

- Barra de limite com progress bar (verde <80%, amarelo ≥80%, vermelho =100%)
- Toolbar: search debounce 300ms + filtro papel + filtro status + botão criar
- Tabela desktop (≥768px): nome, email, papel (badge), fazendas (chips, max 2 + "+N"), status, último acesso
- Cards mobile (<768px): empilhados
- Paginação: Anterior/Próxima + "Página X de Y"
- Empty state com ícone Users + CTA

### Criar Usuário (FE2)

- Campos: nome*, email*, telefone, papel\* (ASSIGNABLE_ROLES), fazendas (checkboxes via useFarms)
- Aviso visual quando limite bloqueado
- PermissionGate em `users:create`

### Detalhes / Editar (FE3)

- Modal com info grid (email, telefone, papel, status, fazendas, criado em, último acesso)
- Modo edição com nome, telefone, papel, fazendas (full replacement)
- PermissionGate em `users:update`

### Ações (FE4 + FE5 + FE7)

1. Ativar/Desativar com toggle (danger style para desativar)
2. Resetar senha → feedback "Email enviado"
3. Reenviar convite (visível se sem lastLogin)
4. Link WhatsApp (visível se sem lastLogin) → clipboard + window.open wa.me

## Verificação

- `pnpm --filter @protos-farm/frontend lint` — 0 erros
- `pnpm --filter @protos-farm/frontend test -- --run` — 190 testes (16 novos)
- `pnpm --filter @protos-farm/frontend exec tsc -b --noEmit` — 0 erros
