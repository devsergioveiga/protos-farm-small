# US-081 CA10 — Ativar/Desativar tipos de operação

**Data:** 2026-03-10
**Status:** Implementado

## O que foi feito

### Backend

- **Endpoint:** `PATCH /org/operation-types/:id/toggle-active` — inverte `isActive` do tipo de operação
- **Service:** `toggleOperationTypeActive()` busca o registro, inverte `isActive` e retorna o item atualizado
- **Auditoria:** log com `TOGGLE_OPERATION_TYPE_ACTIVE`, registrando id, nome e novo estado
- **Permissão:** `farms:update`
- **Erro:** retorna 404 se tipo não encontrado ou soft-deleted
- **Teste:** cenário de toggle cobrindo retorno com `isActive: false`

### Frontend — OperationTypesPage

- **Botão toggle:** ícone `Power` em cada nó da árvore, com `aria-label` dinâmico ("Ativar X" ou "Desativar X")
- **Visual inativo:** linha com `opacity: 0.55` + badge "Inativo" (fundo neutro)
- **Filtro "Mostrar inativos":** checkbox no toolbar que passa `includeInactive` para o hook `useOperationTypeTree`
- **Feedback de erro:** alerta `role="alert"` exibido em caso de falha na API
- **Refetch automático:** lista recarregada após toggle bem-sucedido

### Banco de dados

- Campo `is_active` (Boolean, default true) já criado na migration de CA1
- Tipos inativos são excluídos por padrão do `getOperationTypeTree()` (filtro `isActive: true` quando `includeInactive` não é passado)

## Por que assim

- Toggle é mais seguro que exclusão — preserva histórico de operações já registradas com aquele tipo
- Checkbox "Mostrar inativos" permite ao gestor visualizar e reativar operações quando necessário
- O filtro de inatividade já é aplicado na query do backend, evitando filtragem no client

## Arquivos modificados

- `apps/backend/src/modules/operation-types/operation-types.service.ts` — `toggleOperationTypeActive()`
- `apps/backend/src/modules/operation-types/operation-types.routes.ts` — endpoint PATCH toggle-active
- `apps/backend/src/modules/operation-types/operation-types.routes.spec.ts` — teste do toggle
- `apps/frontend/src/pages/OperationTypesPage.tsx` — botão toggle + filtro inativos
- `apps/frontend/src/pages/OperationTypesPage.css` — estilos `.optype-tree__row--inactive` e `.optype-tree__badge--inactive`
