# US-077 — Lançamento de operação em bloco para equipe

## Objetivo

Permitir que o encarregado registre uma operação de campo para toda a equipe de uma só vez, evitando lançamentos repetitivos pessoa a pessoa.

## Critérios de aceite implementados

### CA1 — Modelo de dados e API (backend)

**O quê:** Modelo `TeamOperation` (operação-mãe) + `TeamOperationEntry` (apontamento individual por membro). API REST completa.

**Por quê:** Uma única chamada POST cria registros para todos os membros selecionados.

**Modelo de dados:**

- `TeamOperation`: farmId, fieldPlotId, teamId, operationType (12 tipos), performedAt, timeStart, timeEnd, notes, photoUrl, latitude, longitude, recordedBy, deletedAt (soft delete)
- `TeamOperationEntry`: teamOperationId, userId (unique constraint), hoursWorked, productivity, productivityUnit, notes

**Endpoints:**

| Método | Rota                                       | Descrição                                                                |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| GET    | `/org/farms/:farmId/team-operations/types` | Lista 12 tipos de operação                                               |
| POST   | `/org/farms/:farmId/team-operations`       | Cria operação + entries em transação                                     |
| GET    | `/org/farms/:farmId/team-operations`       | Lista com filtros (teamId, fieldPlotId, operationType, dateFrom, dateTo) |
| GET    | `/org/farms/:farmId/team-operations/:id`   | Detalhe com entries                                                      |
| DELETE | `/org/farms/:farmId/team-operations/:id`   | Soft delete                                                              |

**Validações:** talhão e equipe pertencem à fazenda, tipo válido, timeEnd > timeStart, ao menos 1 membro, memberIds deduplicados.

**Arquivos:**

- `apps/backend/src/modules/team-operations/` (controller, service, routes, types)
- Migration `20260323` — tabelas `team_operations` + `team_operation_entries`

---

### CA2 — Frontend página e modal stepper

**O quê:** Página `/team-operations` com listagem de operações e modal stepper de 3 etapas para criação.

**Por quê:** Formulário complexo dividido em etapas facilita o preenchimento sem sobrecarregar o usuário.

**Stepper:**

1. **Operação** — tipo, talhão, data, hora início/fim, observações
2. **Equipe e membros** — seleção de equipe, checkbox por membro, selecionar todos
3. **Confirmar** — resumo visual de tudo antes de salvar

**Arquivos:**

- `apps/frontend/src/pages/TeamOperationsPage.tsx` + `.css`
- `apps/frontend/src/components/team-operations/TeamOperationModal.tsx` + `.css`
- `apps/frontend/src/hooks/useTeamOperations.ts`
- `apps/frontend/src/types/team-operation.ts`

---

### CA3 — Dados compartilhados da operação

**O quê:** Campos do step 1 (tipo, talhão, data, hora início, hora fim, observações) são dados compartilhados que se aplicam a todos os membros.

**Por quê:** Evitar repetição — a maioria das informações é igual para toda a equipe.

---

### CA4 — Campos individuais por membro

**O quê:** Seção expansível "Dados individuais (opcional)" no step 2, com campos por membro selecionado:

- Horas trabalhadas (number, step 0.1)
- Produtividade (number, step 0.01)
- Unidade (select: kg, litros, nº animais, hectares)
- Observação individual (text)

**Por quê:** Nem todos os membros trabalham o mesmo tempo ou produzem o mesmo volume. Campos opcionais permitem ajustar sem obrigar preenchimento.

**Decisões de design:**

- Seção colapsada por padrão para não poluir a interface
- Apenas membros selecionados aparecem na lista
- Dados individuais preenchidos aparecem no resumo do step 3
- Somente entries com algum dado preenchido são enviados no payload

---

### CA5 — Entry por membro no POST transacional

**O quê:** O POST cria a operação-mãe e um `TeamOperationEntry` para cada membro selecionado dentro de uma transação Prisma.

**Por quê:** Garante atomicidade — ou cria tudo ou não cria nada.

---

### CA6 — Cálculo de duração padrão

**O quê:** Duração padrão calculada automaticamente a partir de hora início e hora fim (ex: 08:00→16:00 = 8.0h). Exibida como hint e placeholder no campo de horas individuais.

**Por quê:** Na maioria dos casos todos trabalharam o mesmo período. O cálculo automático evita digitação repetitiva; o campo individual permite override quando necessário.

---

### CA7 — Cálculo custo mão de obra

**O quê:** Campo `hourlyRate` no User, cálculo `laborCost` por entry e `totalLaborCost` por operação. Exibido nos cards e painel de detalhes.

**Doc completa:** `US-077-CA7-CA10_custo-ponto-mobile.md`

---

### CA8 — Espelho de ponto

**O quê:** Endpoint `GET .../timesheet` gera relatório de horas por colaborador/dia. Frontend com aba "Espelho de ponto" com linhas expansíveis.

---

### CA9 — Custo por talhão

**O quê:** Endpoint `GET .../cost-by-plot` agrega custo MO por talhão. Frontend com aba "Custo por talhão" e tabela com totais.

---

### CA10 — Lançamento mobile offline

**O quê:** SQLite V9 + repository + tela mobile para registrar operações offline com sync via queue.

---

## Testes

- **Backend:** 13 testes de rota (create, validações, list, get, delete, auth, errors, cost-by-plot, timesheet, timesheet+userId)
- **Frontend:** 8 testes do modal (toggle, expand, campos individuais, payload com/sem entries, deselect, collapse, reset)
