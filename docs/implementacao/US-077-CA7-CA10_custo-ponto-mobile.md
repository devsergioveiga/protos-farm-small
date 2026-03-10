# US-077 CA7-CA10 — Custo MO, Espelho de Ponto, Custo por Talhão, Mobile Offline

## CA7 — Cálculo de custo de mão de obra

**O quê:** Campo `hourlyRate` no modelo User, cálculo automático de `laborCost` por entry e `totalLaborCost` por operação.

**Por quê:** Permite saber quanto custa cada operação de campo em termos de mão de obra, essencial para gestão de custos.

**Implementação:**

- Migration `20260328100000`: `ALTER TABLE users ADD COLUMN hourly_rate DECIMAL(10,2)`
- Prisma: `hourlyRate Decimal? @db.Decimal(10, 2)` no model User
- Service: `toEntryItem()` calcula `laborCost = effectiveHours × hourlyRate` (usa hoursWorked individual ou durationHours da operação)
- `toItem()` agrega `totalLaborCost` somando os laborCost de todas as entries
- `INCLUDE_RELATIONS` inclui `hourlyRate` na query do user
- Org-users: `UpdateOrgUserInput.hourlyRate` para definir custo/hora do colaborador
- Frontend: exibe custo no card (DollarSign icon), no painel de detalhes e por membro

**Arquivos:**

- `apps/backend/prisma/migrations/20260328100000_add_user_hourly_rate/`
- `apps/backend/src/modules/team-operations/team-operations.service.ts`
- `apps/backend/src/modules/team-operations/team-operations.types.ts`
- `apps/backend/src/modules/org-users/org-users.types.ts`
- `apps/backend/src/modules/org-users/org-users.service.ts`
- `apps/frontend/src/types/team-operation.ts`
- `apps/frontend/src/pages/TeamOperationsPage.tsx`
- `apps/frontend/src/pages/TeamOperationsPage.css`

---

## CA8 — Espelho de ponto

**O quê:** Endpoint `GET /org/farms/:farmId/team-operations/timesheet` que retorna horas trabalhadas por colaborador por dia, com detalhamento de operações. Frontend com aba "Espelho de ponto" com filtro de período e linhas expansíveis.

**Por quê:** Gera relatório de horas equivalente ao espelho de ponto, sem depender de módulo RH externo. Baseado nos dados reais de team_operations.

**Endpoint:**

| Método | Rota                                           | Query params                   |
| ------ | ---------------------------------------------- | ------------------------------ |
| GET    | `/org/farms/:farmId/team-operations/timesheet` | `dateFrom`, `dateTo`, `userId` |

**Response:** Array de `TimesheetEntry` agrupado por (date + userId), com operações detalhadas, totalHours e totalLaborCost.

**Arquivos:**

- `apps/backend/src/modules/team-operations/team-operations.service.ts` (getTimesheet)
- `apps/frontend/src/components/team-operations/TimesheetTab.tsx` + `.css`

---

## CA9 — Custo por talhão

**O quê:** Endpoint `GET /org/farms/:farmId/team-operations/cost-by-plot` que agrega custo de MO por talhão. Frontend com aba "Custo por talhão" e tabela com totais.

**Por quê:** Permite comparar custos de mão de obra entre talhões e identificar áreas de maior gasto operacional.

**Endpoint:**

| Método | Rota                                              | Query params         |
| ------ | ------------------------------------------------- | -------------------- |
| GET    | `/org/farms/:farmId/team-operations/cost-by-plot` | `dateFrom`, `dateTo` |

**Response:** Array de `PlotLaborCostItem` ordenado por custo decrescente.

**Arquivos:**

- `apps/backend/src/modules/team-operations/team-operations.service.ts` (getCostByPlot)
- `apps/frontend/src/components/team-operations/CostByPlotTab.tsx` + `.css`

---

## CA10 — Lançamento mobile offline

**O quê:** Tela mobile para registrar operações em bloco offline, com SQLite local e sync via offline queue.

**Por quê:** Equipes de campo frequentemente trabalham sem internet. O registro deve funcionar offline e sincronizar automaticamente ao reconectar.

**Implementação:**

- SQLite migration V9: tabela `team_operations` (id, farm_id, field_plot_id/name, team_id/name, operation_type, performed_at, time_start/end, member_ids JSON, entry_data JSON, notes, synced, timestamps)
- Repository: `createTeamOperationsRepository` (create, getByFarmId, getUnsynced, markSynced, deleteById)
- Tela: `app/team-operation.tsx` — chips para tipo/talhão/equipe, toggle de membros, horário, notas
- Offline queue: enfileira como `field_operations` CREATE, flush imediato se online, mark synced

**Arquivos:**

- `apps/mobile/services/database.ts` (migrationV9, DATABASE_VERSION=9)
- `apps/mobile/types/offline.ts` (OfflineTeamOperation)
- `apps/mobile/services/db/team-operations-repository.ts`
- `apps/mobile/services/db/index.ts` (export)
- `apps/mobile/app/team-operation.tsx`

## Testes

- **Backend:** 13 testes de rota (10 existentes + 3 novos: cost-by-plot, timesheet, timesheet com userId)
- **Frontend:** 8 testes existentes do modal passando
