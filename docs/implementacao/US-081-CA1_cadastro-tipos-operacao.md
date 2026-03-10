# US-081 CA1 — CRUD de tipos de operação com estrutura hierárquica

**Data:** 2026-03-10
**Status:** Implementado

## O que foi feito

### Banco de dados

- **Migration `20260329100000_add_operation_types`:** tabela `operation_types` com auto-referência para hierarquia
- Campos: `id`, `organization_id`, `name`, `description`, `parent_id`, `level` (1-3), `sort_order`, `is_system`, `is_active`, `created_at`, `updated_at`, `deleted_at`
- Unique constraint: `(name, parent_id, organization_id)` com filtro `WHERE deleted_at IS NULL`
- Índices: `(organization_id, parent_id)` e `(organization_id, level)`
- FK para `organizations` e auto-referência `parent_id → operation_types(id)` com `ON DELETE SET NULL`

### Backend — módulo `operation-types`

- **Types:** `OperationTypeItem`, `OperationTypeTreeNode`, `CreateOperationTypeInput`, `UpdateOperationTypeInput`
- **Service:** CRUD completo + `getOperationTypeTree()` (3 níveis aninhados) + `toggleOperationTypeActive()`
- **Routes:** 7 endpoints sob `/org/operation-types`
  - `POST /` — criar
  - `GET /` — listar (flat, com filtros: parentId, level, search, includeInactive)
  - `GET /tree` — árvore completa (3 níveis)
  - `GET /:id` — detalhe
  - `PATCH /:id` — atualizar
  - `PATCH /:id/toggle-active` — ativar/desativar
  - `DELETE /:id` — soft delete (bloqueia se tem filhos)
- **Validações:** max 3 níveis, nome único por nível+pai, self-parent check, filhos impedem delete
- **Testes:** 17/17 passando

### Frontend

- **Types:** `operation-type.ts` com tipos espelhados
- **Hook:** `useOperationTypes.ts` — `useOperationTypeTree()` e `useOperationTypeChildren()`
- **Página:** `OperationTypesPage.tsx` — tree view com expand/collapse, ações inline (editar, excluir, ativar/desativar, adicionar sub-operação)
- **Modal:** `OperationTypeModal.tsx` — formulário para criar/editar tipo de operação
- **CSS:** responsive, skeleton loading, empty state, indentação por nível
- **Rota:** `/operation-types`
- **Sidebar:** item "Tipos de operação" com ícone FolderTree na seção LAVOURA

## Níveis hierárquicos

| Nível | Exemplo                                      | Uso                          |
| ----- | -------------------------------------------- | ---------------------------- |
| 1     | Preparo de Solo, Plantio, Tratos Culturais   | Categoria base (agrupamento) |
| 2     | Aração, Gradagem leve, Adubação de cobertura | Operação específica          |
| 3     | Adubação foliar, Fertirrigação               | Sub-tipo (quando necessário) |

- Registros de operação são feitos no nível mais específico (folha)
- Níveis intermediários servem para agrupamento e relatórios

## Decisões de design

1. **Soft delete** com `deleted_at` — mantém histórico
2. **isSystem** — preparado para seed de operações pré-carregadas (CA4)
3. **isActive** — atende CA10 (operações inativas não aparecem para seleção)
4. **sortOrder** — permite reordenação manual
5. **Unique por nome+pai+org** — permite nomes iguais em categorias diferentes
