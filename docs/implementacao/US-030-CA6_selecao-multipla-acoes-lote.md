# US-030 CA6 — Seleção múltipla para ações em lote (mover, registrar evento)

## Critério de Aceite

> Seleção múltipla para ações em lote (mover, registrar evento)

## O que foi feito

### Backend

- **`animal-health.service.ts`**: Nova função `bulkCreateHealthRecords(ctx, farmId, animalIds, userId, input)`:
  - Valida input uma vez, busca todos os animais válidos via `findMany`, cria registros via `createMany`
  - Retorna `{ created, failed, errors[] }` para feedback granular
  - Limite de 200 animais por chamada
- **`animal-health.routes.ts`**: Novo endpoint `POST /org/farms/:farmId/animals/bulk-health`:
  - Body: `{ animalIds: string[], type, eventDate, productName?, dosage?, ... }`
  - Permissão: `animals:update` + `checkFarmAccess`
  - Audit log com action `BULK_CREATE_HEALTH_RECORD`
- **Mover para lote**: Já existia suporte bulk via `POST /org/farms/:farmId/lots/:lotId/move` — sem alteração necessária

### Frontend

- **`AnimalsPage.tsx`**: Estado de seleção múltipla:
  - `selectedIds: Set<string>` — seleção persiste entre páginas
  - Checkbox "selecionar todos" na header da tabela (com estado indeterminate)
  - Checkbox individual em cada linha (desktop) e card (mobile)
  - Linhas/cards selecionados destacados com fundo verde claro
  - Seleção é limpa ao mudar de fazenda

- **`BulkActionsBar`** (`components/bulk-actions/`):
  - Barra fixa no rodapé, aparece quando `selectedIds.size > 0`
  - Mostra contagem, botão "Limpar", e ações: "Mover para lote" e "Registrar evento sanitário"
  - Animação slide-up, responsivo (empilha em mobile)

- **`BulkMoveToLotModal`**:
  - Select de lote com contagem atual/capacidade
  - Campo opcional de motivo da movimentação
  - Feedback de sucesso com contagem + warning de capacidade

- **`BulkHealthEventModal`**:
  - Campos: tipo (vacinação/vermifugação/tratamento/exame), data, produto, dosagem, método, lote do produto, veterinário, observações
  - Campos de produto aparecem condicionalmente (VACCINATION, DEWORMING, TREATMENT)
  - Feedback de sucesso com created/failed

- **`AnimalsPage.css`**: Estilos para checkbox, linhas selecionadas, wrapper do card header

### Testes

- Backend: 4 novos testes (bulk success, empty array, missing array, partial failures) — 20 total no spec
- Frontend: 6 novos testes (checkboxes render, selection bar, select all, clear, move modal, health modal) — 37 total no spec
- **695 backend + 737 frontend = 1432 testes total**

## Decisões técnicas

- Usou `createMany` no backend para performance — uma transação em vez de N inserts individuais
- Seleção por `Set<string>` permite operação O(1) para check/add/remove
- Checkpoint indeterminate do "select all" via ref callback (DOM API direta, não controlado via React)
- Ações em lote protegidas por `PermissionGate` — só usuários com `animals:update` veem a barra
- Move para lote reutiliza endpoint existente, sem duplicação de lógica
- Evento reprodutivo em lote não foi incluído — cenário de uso mais raro e os campos são muito específicos por animal (touro, sêmen, bezerro); faz mais sentido registro individual
