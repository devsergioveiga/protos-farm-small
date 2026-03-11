# US-086 — Registro de Colheita de Laranja (CA1-CA7,CA9)

**Branch:** `feature/US-086-colheita-laranja`
**Doc original:** EPIC-09 / US-079 (ProtosFarm_Fase2_Operacoes_Core_UserStories.docx)

## Critérios de Aceite

| CA  | Descrição                                                              | Status   |
| --- | ---------------------------------------------------------------------- | -------- |
| CA1 | Campos: talhão, data, variedade, nº caixas (40,8kg), peso, árvores     | OK       |
| CA2 | Cálculo: caixas/pé, produtividade (cx/ha ou t/ha)                      | OK       |
| CA3 | Qualidade: ratio (sólidos solúveis), acidez, % refugo                  | OK       |
| CA4 | Destino: indústria (contrato), mercado in natura, descarte             | OK       |
| CA5 | Equipe: nº colhedores, rendimento (caixas/pessoa/dia)                  | OK       |
| CA6 | Vinculação a contrato de venda (referência textual)                    | OK       |
| CA7 | Formulário web: talhão, caixas, ratio, destino, equipe                 | OK       |
| CA8 | App mobile: registro rápido offline, contagem por carga/caminhão       | PENDENTE |
| CA9 | Tabela de colheitas com filtros por talhão, período, destino, contrato | OK       |

## Arquitetura

### Backend

**Modelo Prisma:** `OrangeHarvest`

**Módulo:** `apps/backend/src/modules/orange-harvests/`

- `orange-harvests.types.ts` — tipos, constantes, interfaces
- `orange-harvests.service.ts` — lógica de negócio (CRUD + daily summary)
- `orange-harvests.routes.ts` — endpoints REST
- `orange-harvests.routes.spec.ts` — 31 testes

**Endpoints:**

- `POST /api/org/farms/:farmId/orange-harvests` — criar colheita
- `GET /api/org/farms/:farmId/orange-harvests` — listar (paginação, filtros)
- `GET /api/org/farms/:farmId/orange-harvests/daily-summary` — totalizador diário
- `GET /api/org/farms/:farmId/orange-harvests/:harvestId` — detalhe
- `PATCH /api/org/farms/:farmId/orange-harvests/:harvestId` — atualizar
- `DELETE /api/org/farms/:farmId/orange-harvests/:harvestId` — soft delete

**Migration:** `20260312090000_add_orange_harvests`

### Campos Específicos de Laranja

| Campo                  | Tipo           | CA  | Descrição                                 |
| ---------------------- | -------------- | --- | ----------------------------------------- |
| variety                | TEXT?          | CA1 | Variedade (Pera, Valência, Natal, Hamlin) |
| numberOfBoxes          | DECIMAL(12,2)  | CA1 | Nº de caixas (40,8 kg cada)               |
| totalWeightKg          | DECIMAL(14,2)? | CA1 | Peso total em kg (auto: boxes × 40.8)     |
| treesHarvested         | INT?           | CA1 | Nº de árvores colhidas                    |
| boxesPerTree           | DECIMAL(8,2)?  | CA2 | Caixas/pé (calculado)                     |
| boxesPerHa             | DECIMAL(10,2)? | CA2 | Caixas/ha (calculado)                     |
| tonsPerHa              | DECIMAL(10,2)? | CA2 | Toneladas/ha (calculado)                  |
| ratioSS                | DECIMAL(5,2)?  | CA3 | Ratio sólidos solúveis (°Brix/acidez)     |
| acidityPct             | DECIMAL(5,2)?  | CA3 | Acidez (%)                                |
| refusalPct             | DECIMAL(5,2)?  | CA3 | Refugo (%)                                |
| destination            | TEXT?          | CA4 | INDUSTRIA, IN_NATURA, DESCARTE            |
| numberOfHarvesters     | INT?           | CA5 | Nº de colhedores                          |
| harvestersProductivity | DECIMAL(10,2)? | CA5 | Caixas/pessoa/dia                         |
| saleContractRef        | TEXT?          | CA6 | Referência ao contrato de venda           |

### Cálculos Automáticos

- **boxesPerTree** (CA2): `numberOfBoxes / treesHarvested`
- **boxesPerHa** (CA2): `numberOfBoxes / fieldPlot.boundaryAreaHa`
- **tonsPerHa** (CA2): `totalWeightKg / 1000 / fieldPlot.boundaryAreaHa`
- **totalWeightKg** (CA1): `numberOfBoxes × 40.8` quando não informado
- **harvestersProductivity** (CA5): `numberOfBoxes / numberOfHarvesters` quando não informado

### Frontend (CA7, CA9)

**Arquivos:**

- `apps/frontend/src/types/orange-harvest.ts` — tipos e constantes
- `apps/frontend/src/hooks/useOrangeHarvests.ts` — hook de listagem
- `apps/frontend/src/components/orange-harvests/OrangeHarvestModal.tsx` — modal criação/edição
- `apps/frontend/src/components/orange-harvests/OrangeHarvestModal.css` — estilos do modal
- `apps/frontend/src/pages/OrangeHarvestsPage.tsx` — página com cards e filtros
- `apps/frontend/src/pages/OrangeHarvestsPage.css` — estilos da página

**Rota:** `/orange-harvests`
**Nav:** Sidebar → LAVOURA → "Colheita de laranja" (ícone Citrus)
