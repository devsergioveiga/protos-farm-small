# US-029 CA4 — Histórico Reprodutivo

## Resumo

Implementação da aba "Reprodutivo" na ficha individual do animal, permitindo registrar e consultar o histórico reprodutivo completo: liberação para reprodução, cios observados (com intervalo entre cios), planos de acasalamento, inseminações artificiais, gestações e partos.

## Decisões Técnicas

### Tabela única com discriminador de tipo

Mesmo padrão adotado no CA3 (sanitário): uma tabela `animal_reproductive_records` com enum `ReproductiveEventType` (CLEARANCE, HEAT, BREEDING_PLAN, AI, PREGNANCY, CALVING) e colunas type-specific nullable.

### Enums criados

- **ReproductiveEventType** — CLEARANCE, HEAT, BREEDING_PLAN, AI, PREGNANCY, CALVING
- **HeatIntensity** — WEAK, MODERATE, STRONG
- **BreedingMethod** — NATURAL, AI, ET
- **CalvingType** — NORMAL, ASSISTED, CESAREAN, DYSTOCIC
- **PregnancyConfirmation** — PALPATION, ULTRASOUND, BLOOD_TEST, OBSERVATION

### Referência a touros (sireId + sireName)

- `sireId` (FK para animals) — referencia touro interno da fazenda
- `sireName` (texto livre) — permite registrar sêmen de touro externo comprado
- Ambos podem coexistir: sireId para rastreabilidade interna, sireName para exibição

### Cálculo automático de intervalo entre cios

No service, ao criar registro HEAT, busca-se o último cio do animal e calcula-se `intervalDays` automaticamente. O valor é armazenado no registro para consulta rápida.

### isPregnant derivado

Nas stats, `isPregnant` é determinado verificando se existe um registro PREGNANCY sem CALVING subsequente (pela ordenação cronológica dos registros).

### Datas futuras permitidas

`plannedDate` (BREEDING_PLAN) e `expectedDueDate` (PREGNANCY) aceitam datas futuras, diferente de `eventDate` que é restrito a passado/hoje.

## Arquivos

### Novos (14)

| Arquivo                                                                | Descrição                                                 |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `prisma/migrations/20260318100000_.../migration.sql`                   | 5 enums + tabela + índices + RLS                          |
| `modules/animals/animal-reproductive.types.ts`                         | Tipos, validadores, interfaces                            |
| `modules/animals/animal-reproductive.service.ts`                       | 6 funções: list, create, update, delete, stats, exportCsv |
| `modules/animals/animal-reproductive.routes.ts`                        | 6 endpoints REST                                          |
| `modules/animals/animal-reproductive.routes.spec.ts`                   | 16 testes backend                                         |
| `frontend/src/hooks/useAnimalReproductive.ts`                          | Hook com CRUD + auto-refetch                              |
| `frontend/src/components/animals/ReproductiveTab.tsx` + `.css`         | Componente principal da aba                               |
| `frontend/src/components/animals/ReproductiveStatsCards.tsx` + `.css`  | 4 cards de estatísticas                                   |
| `frontend/src/components/animals/ReproductiveRecordsList.tsx` + `.css` | Lista/tabela de registros                                 |
| `frontend/src/components/animals/CreateReproductiveModal.tsx` + `.css` | Modal de criação/edição                                   |

### Modificados (5)

| Arquivo                                   | Alteração                              |
| ----------------------------------------- | -------------------------------------- |
| `prisma/schema.prisma`                    | 5 enums + model + relações reversas    |
| `backend/src/app.ts`                      | Registro do animalReproductiveRouter   |
| `backend/prisma/seed.ts`                  | 17 registros reprodutivos + cleanup    |
| `frontend/src/pages/AnimalDetailPage.tsx` | Habilitar tab + render ReproductiveTab |
| `frontend/src/types/animal.ts`            | 5 union types + labels + interfaces    |

## Endpoints

| Método | Rota                                                              | Permissão      |
| ------ | ----------------------------------------------------------------- | -------------- |
| GET    | `/api/org/farms/:farmId/animals/:animalId/reproductive/stats`     | animals:read   |
| GET    | `/api/org/farms/:farmId/animals/:animalId/reproductive/export`    | animals:read   |
| GET    | `/api/org/farms/:farmId/animals/:animalId/reproductive?type=X`    | animals:read   |
| POST   | `/api/org/farms/:farmId/animals/:animalId/reproductive`           | animals:update |
| PATCH  | `/api/org/farms/:farmId/animals/:animalId/reproductive/:recordId` | animals:update |
| DELETE | `/api/org/farms/:farmId/animals/:animalId/reproductive/:recordId` | animals:update |

## Seed

17 registros reprodutivos distribuídos em 3 animais:

- **Mimosa (SH-001):** clearance → 3 heats (intervalos 21d) → AI (Trovão) → pregnancy (ultrassom) → calving (SH-005, fêmea, 32kg) = 7 registros
- **Estrela (SH-003):** clearance → 2 heats → AI (touro externo Tornado FIV) → pregnancy → calving (SH-006, macho, 35kg) = 6 registros
- **Princesa (SH-007):** clearance → 2 heats → breeding plan (Trovão) = 4 registros

## Testes

- **Backend:** 16 testes em `animal-reproductive.routes.spec.ts`
- **Frontend:** 12 testes em `ReproductiveTab.spec.tsx`
