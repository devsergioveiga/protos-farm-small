# US-041 CA7 — Add/remove membros na edição

## O quê

Permitir adicionar e remover membros individualmente ao editar uma equipe de campo, usando checkboxes (mesmo padrão da criação).

## Por quê

Antes, a edição mostrava membros em modo readonly. O gestor precisava recriar a equipe para mudar membros. Agora o PATCH aceita `memberIds` e sincroniza: adiciona novos, marca `leftAt` nos removidos (preservando histórico).

## Backend

- `updateFieldTeam` (field-teams.service.ts): quando `input.memberIds` é fornecido, compara com membros ativos atuais. Novos recebem `createMany`, removidos recebem `leftAt = now`. Re-fetch final garante resposta atualizada.

## Frontend

- `FieldTeamModal.tsx`: seção de membros com checkboxes agora aparece tanto na criação quanto na edição. No modo edição, `memberIds` sempre é enviado (inclusive `[]` para remover todos).

## Testes

- Backend: 2 novos testes (update members via memberIds, remove all members)
- Frontend: testes existentes passam sem alteração
