# US-103 — Catálogo de Doenças (EPIC-11)

**Data:** 2026-03-13
**Branch:** `feature/US-103-disease-catalog`

## Critérios de Aceite

| CA  | Descrição                                               | Status |
| --- | ------------------------------------------------------- | ------ |
| CA1 | CRUD de doenças com nome, científico, código, categoria | FEITO  |
| CA2 | Doenças pré-carregadas (seed) comuns pecuária leite     | FEITO  |
| CA3 | Gravidade padrão, sistema afetado, sinais clínicos      | FEITO  |
| CA4 | Vinculação protocolo tratamento (preparado para US-104) | FEITO  |
| CA5 | Período de quarentena recomendado                       | FEITO  |
| CA6 | Fotos de referência (campo photoUrl)                    | FEITO  |
| CA7 | Doenças editáveis pelo admin                            | FEITO  |

## Modelo de Dados

```prisma
model Disease {
  id, organizationId, name, scientificName, code,
  category (DiseaseCategory enum), severity (DiseaseSeverity enum),
  affectedSystem (AffectedSystem enum), symptoms, quarantineDays,
  isNotifiable, photoUrl, notes, deletedAt, createdAt, updatedAt
}
```

- **Enums:** DiseaseCategory (7), DiseaseSeverity (3), AffectedSystem (6)
- **Migration:** `20260350100000_add_disease_catalog`

## Backend

- **Módulo:** `modules/diseases/` (types + service + routes + spec)
- **Endpoints:** 8 (CRUD + categories + severity-levels + affected-systems + seed)
- **Testes:** 21 passando
- **Seed:** 21 doenças comuns (mastite, pneumonia, cetose, brucelose, tuberculose, raiva, etc.)

## Frontend

- **Página:** `DiseasesPage.tsx` com grid de cards, busca, filtro por categoria
- **Modal:** `DiseaseModal.tsx` para criação/edição
- **Hook:** `useDiseases.ts`
- **Sidebar:** link "Doenças" no grupo REBANHO (ícone HeartPulse)
- **Rota:** `/diseases`

## Arquivos Criados/Modificados

### Criados

- `apps/backend/prisma/migrations/20260350100000_add_disease_catalog/migration.sql`
- `apps/backend/src/modules/diseases/diseases.types.ts`
- `apps/backend/src/modules/diseases/diseases.service.ts`
- `apps/backend/src/modules/diseases/diseases.routes.ts`
- `apps/backend/src/modules/diseases/diseases.routes.spec.ts`
- `apps/frontend/src/types/disease.ts`
- `apps/frontend/src/hooks/useDiseases.ts`
- `apps/frontend/src/components/diseases/DiseaseModal.tsx`
- `apps/frontend/src/components/diseases/DiseaseModal.css`
- `apps/frontend/src/pages/DiseasesPage.tsx`
- `apps/frontend/src/pages/DiseasesPage.css`

### Modificados

- `apps/backend/prisma/schema.prisma` — enums + model Disease + relation Organization
- `apps/backend/src/app.ts` — import + registro diseasesRouter
- `apps/frontend/src/App.tsx` — lazy import + rota /diseases
- `apps/frontend/src/components/layout/Sidebar.tsx` — link Doenças no grupo REBANHO
