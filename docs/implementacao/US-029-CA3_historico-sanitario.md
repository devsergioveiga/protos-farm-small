# US-029 CA3 — Histórico Sanitário

## Resumo

Implementação completa do histórico sanitário na ficha individual do animal. Suporta 4 tipos de eventos: vacinações, vermifugações, tratamentos e exames laboratoriais/de campo.

## Design: Tabela única com discriminador de tipo

Uma tabela `animal_health_records` com enum `HealthEventType` (VACCINATION, DEWORMING, TREATMENT, EXAM) e colunas type-specific nullable. Mesmo padrão usado em `farm_locations`.

## Backend

### Migration `20260317100000_animal_health_records`

- Enums: `HealthEventType`, `ApplicationMethod`
- Tabela com campos comuns (eventDate, productName, dosage, applicationMethod, veterinaryName, notes) e campos type-specific:
  - `batchNumber` — vacinações (lote/série)
  - `diagnosis`, `durationDays` — tratamentos
  - `examResult`, `labName`, `isFieldExam` — exames
- 4 índices (animalId, farmId, eventDate, type) + RLS tenant isolation

### Módulo `animal-health`

| Arquivo                    | Responsabilidade                                           |
| -------------------------- | ---------------------------------------------------------- |
| `animal-health.types.ts`   | Error class, enums, input/output types, validation helpers |
| `animal-health.service.ts` | CRUD + stats + CSV export com withRlsContext               |
| `animal-health.routes.ts`  | 6 endpoints com RBAC e audit log                           |

### Endpoints

| Método | Rota                | Permissão      | Descrição                          |
| ------ | ------------------- | -------------- | ---------------------------------- |
| GET    | `/health/stats`     | animals:read   | Contagem por tipo + última data    |
| GET    | `/health/export`    | animals:read   | CSV com BOM UTF-8 e separador `;`  |
| GET    | `/health?type=X`    | animals:read   | Lista com filtro opcional por tipo |
| POST   | `/health`           | animals:update | Criar registro                     |
| PATCH  | `/health/:recordId` | animals:update | Atualizar registro                 |
| DELETE | `/health/:recordId` | animals:update | Excluir registro                   |

### Testes: 16 testes em `animal-health.routes.spec.ts`

## Frontend

### Tipos (`types/animal.ts`)

- `HealthEventType`, `ApplicationMethod` — union types
- `HealthRecordItem`, `HealthStats` — interfaces de resposta
- `HEALTH_EVENT_TYPE_LABELS`, `APPLICATION_METHOD_LABELS` — labels pt-BR

### Hook `useAnimalHealth`

- Fetch paralelo records + stats
- CRUD com auto-refetch
- Filtro por tipo via query parameter

### Componentes

| Componente            | Descrição                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `SanitaryTab`         | Tab principal: header com filtro + export + botão adicionar, stats, lista, modal                   |
| `SanitaryStatsCards`  | 4 cards coloridos: vacinações, vermifugações, tratamentos, exames (com ícones e última data)       |
| `SanitaryRecordsList` | Tabela desktop / cards mobile, badge colorido por tipo, ações editar/excluir                       |
| `CreateSanitaryModal` | Dialog nativo, campos condicionais por tipo (lote vacina, diagnóstico tratamento, resultado exame) |

### AnimalDetailPage

- Tab Sanitário habilitada (`disabled: false`)
- Renderiza `<SanitaryTab>` no tabpanel

### Testes: 12 testes em `SanitaryTab.spec.tsx`

## Seed

12 registros sanitários para animais da Fazenda Santa Helena:

- Mimosa (SH-001): 2 vacinações aftosa + 1 vermifugação
- Trovão (SH-004): 1 vacinação + 1 exame brucelose/tuberculose + 1 vermifugação
- Flor (SH-007): 2 vacinações + 1 tratamento infecção
- Estrela (SH-002): 1 vacinação + 1 tratamento mastite + 1 exame cultura microbiológica

## Arquivos

### Novos (14)

- `apps/backend/prisma/migrations/20260317100000_animal_health_records/migration.sql`
- `apps/backend/src/modules/animals/animal-health.types.ts`
- `apps/backend/src/modules/animals/animal-health.service.ts`
- `apps/backend/src/modules/animals/animal-health.routes.ts`
- `apps/backend/src/modules/animals/animal-health.routes.spec.ts`
- `apps/frontend/src/hooks/useAnimalHealth.ts`
- `apps/frontend/src/components/animals/SanitaryTab.tsx` + `.css`
- `apps/frontend/src/components/animals/SanitaryStatsCards.tsx` + `.css`
- `apps/frontend/src/components/animals/SanitaryRecordsList.tsx` + `.css`
- `apps/frontend/src/components/animals/CreateSanitaryModal.tsx` + `.css`
- `docs/implementacao/US-029-CA3_historico-sanitario.md`

### Modificados (5)

- `apps/backend/prisma/schema.prisma` — enums + model + relações
- `apps/backend/src/app.ts` — registrar animalHealthRouter
- `apps/backend/prisma/seed.ts` — seed registros sanitários
- `apps/frontend/src/pages/AnimalDetailPage.tsx` — habilitar tab + render SanitaryTab
- `apps/frontend/src/types/animal.ts` — tipos e labels sanitários
