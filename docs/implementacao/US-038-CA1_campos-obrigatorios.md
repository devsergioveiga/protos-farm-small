# US-038 CA1 — Campos Obrigatórios de Aplicação de Defensivos

## O que foi implementado

Registro de aplicação de defensivos com campos obrigatórios: talhão, data/hora, produto comercial, ingrediente ativo, dose (L ou kg/ha), volume de calda (L/ha), alvo (praga/doença/planta daninha).

## Por quê

Rastreabilidade completa de cada aplicação de defensivo é requisito legal e operacional. Os campos obrigatórios garantem que toda aplicação tenha informações mínimas para auditoria e controle fitossanitário.

## Decisões técnicas

- **Modelo `PesticideApplication`** com FK para `Farm`, `FieldPlot` e `User` (recorder)
- **Soft delete** (`deletedAt`) para preservar histórico de rastreabilidade
- **Enums `PesticideTarget`** (PRAGA, DOENCA, PLANTA_DANINHA) e **`DoseUnit`** (L_HA, KG_HA, ML_HA, G_HA)
- **Rota farm-scoped**: `/org/farms/:farmId/pesticide-applications` (consistente com field-operations)
- **Modal para criação/edição** (padrão do projeto, não página dedicada)
- **Campo `targetDescription`** opcional para especificar a praga/doença/daninha específica

## Arquivos criados/modificados

### Backend

- `prisma/schema.prisma` — modelo PesticideApplication + enums + relações
- `prisma/migrations/20260320400000_add_pesticide_applications/migration.sql`
- `src/modules/pesticide-applications/pesticide-applications.types.ts`
- `src/modules/pesticide-applications/pesticide-applications.service.ts`
- `src/modules/pesticide-applications/pesticide-applications.routes.ts`
- `src/modules/pesticide-applications/pesticide-applications.routes.spec.ts` (13 testes)
- `src/app.ts` — registro do router

### Frontend

- `src/types/pesticide-application.ts`
- `src/hooks/usePesticideApplications.ts`
- `src/components/pesticide-applications/PesticideApplicationModal.tsx`
- `src/components/pesticide-applications/PesticideApplicationModal.css`
- `src/pages/PesticideApplicationsPage.tsx`
- `src/pages/PesticideApplicationsPage.css`
- `src/pages/PesticideApplicationsPage.spec.tsx` (9 testes)
- `src/App.tsx` — rota `/pesticide-applications`
- `src/components/layout/AppLayout.tsx` — nav link "Defensivos"

## Endpoints

| Método | Rota                                            | Descrição                  |
| ------ | ----------------------------------------------- | -------------------------- |
| POST   | `/org/farms/:farmId/pesticide-applications`     | Criar aplicação            |
| GET    | `/org/farms/:farmId/pesticide-applications`     | Listar (paginado, filtros) |
| GET    | `/org/farms/:farmId/pesticide-applications/:id` | Detalhe                    |
| PATCH  | `/org/farms/:farmId/pesticide-applications/:id` | Atualizar                  |
| DELETE | `/org/farms/:farmId/pesticide-applications/:id` | Soft delete                |
