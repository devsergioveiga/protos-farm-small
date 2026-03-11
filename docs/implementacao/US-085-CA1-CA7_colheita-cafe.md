# US-085 — Registro de Colheita de Café (CA1-CA7)

**Branch:** `feature/US-085-colheita-cafe`
**Doc original:** EPIC-09 / US-078 (ProtosFarm_Fase2_Operacoes_Core_UserStories.docx)

## Critérios de Aceite

| CA   | Descrição                                                                | Status   |
| ---- | ------------------------------------------------------------------------ | -------- |
| CA1  | Campos: talhão/quadra, data, tipo colheita (mecanizada/derriça/seletiva) | OK       |
| CA2  | Volume: litros colhidos, conversão sacas 60kg (café beneficiado)         | OK       |
| CA3  | Rendimento: litros → sacas (estimativa, ajustável pós-beneficiamento)    | OK       |
| CA4  | Classificação: cereja, verde, boia, seco (% de cada)                     | OK       |
| CA5  | Destino: terreiro, secador mecânico, lavador/separador                   | OK       |
| CA6  | Equipe: nº colhedores, produtividade (litros/pessoa/dia)                 | OK       |
| CA7  | Café especial: separação por lote com rastreabilidade microlotes         | OK       |
| CA8  | Formulário web e mobile                                                  | OK (web) |
| CA9  | App mobile: registro rápido offline, totalizador diário                  | PENDENTE |
| CA10 | Tabela de colheitas com filtros e totalização                            | OK       |

## Arquitetura

### Backend

**Modelo Prisma:** `CoffeeHarvest`

**Módulo:** `apps/backend/src/modules/coffee-harvests/`

- `coffee-harvests.types.ts` — tipos, constantes, interfaces
- `coffee-harvests.service.ts` — lógica de negócio (CRUD + daily summary)
- `coffee-harvests.routes.ts` — endpoints REST
- `coffee-harvests.routes.spec.ts` — 30 testes

**Endpoints:**

- `POST /api/org/farms/:farmId/coffee-harvests` — criar colheita
- `GET /api/org/farms/:farmId/coffee-harvests` — listar (paginação, filtros)
- `GET /api/org/farms/:farmId/coffee-harvests/daily-summary` — totalizador diário por talhão
- `GET /api/org/farms/:farmId/coffee-harvests/:harvestId` — detalhe
- `PATCH /api/org/farms/:farmId/coffee-harvests/:harvestId` — atualizar
- `DELETE /api/org/farms/:farmId/coffee-harvests/:harvestId` — soft delete

**Migration:** `20260312080000_add_coffee_harvests`

### Campos Específicos de Café

| Campo                                | Tipo           | CA  | Descrição                                     |
| ------------------------------------ | -------------- | --- | --------------------------------------------- |
| harvestType                          | TEXT           | CA1 | MECANIZADA, DERRICA_MANUAL, SELETIVA_CATACAO  |
| volumeLiters                         | DECIMAL(14,2)  | CA2 | Litros de café colhido                        |
| sacsBenefited                        | DECIMAL(12,2)? | CA3 | Sacas reais pós-beneficiamento                |
| yieldLitersPerSac                    | DECIMAL(8,2)?  | CA3 | Rendimento litros/saca (default 480)          |
| cherryPct/greenPct/floaterPct/dryPct | DECIMAL(5,2)   | CA4 | Classificação (soma = 100%)                   |
| destination                          | TEXT?          | CA5 | TERREIRO, SECADOR_MECANICO, LAVADOR_SEPARADOR |
| numberOfHarvesters                   | INT?           | CA6 | Nº colhedores na equipe                       |
| harvestersProductivity               | DECIMAL(10,2)? | CA6 | Litros/pessoa/dia                             |
| isSpecialLot                         | BOOLEAN        | CA7 | Flag café especial                            |
| microlotCode                         | TEXT?          | CA7 | Código rastreabilidade microlote              |

### Cálculos Automáticos

- **estimatedSacs** (CA2/CA3): `volumeLiters / yieldLitersPerSac` (default 480 litros/saca)
- **harvestersProductivity** (CA6): `volumeLiters / numberOfHarvesters` quando não informado
- **Rendimento padrão** (CA3): 480 litros de café cereja = 1 saca de 60kg beneficiada

### Frontend (CA8, CA10)

**Arquivos:**

- `apps/frontend/src/types/coffee-harvest.ts` — tipos e constantes
- `apps/frontend/src/hooks/useCoffeeHarvests.ts` — hook de listagem
- `apps/frontend/src/components/coffee-harvests/CoffeeHarvestModal.tsx` — modal criação/edição
- `apps/frontend/src/components/coffee-harvests/CoffeeHarvestModal.css` — estilos do modal
- `apps/frontend/src/pages/CoffeeHarvestsPage.tsx` — página com cards e filtros
- `apps/frontend/src/pages/CoffeeHarvestsPage.css` — estilos da página

**Rota:** `/coffee-harvests`
**Nav:** Sidebar → LAVOURA → "Colheita de café" (ícone Coffee)

**Funcionalidades:**

- Cards com talhão, data, tipo colheita, volume, sacas, classificação, equipe, destino
- Filtro por tipo de colheita e busca textual
- Modal com seções: Local/tipo, Volume/rendimento, Classificação, Destino, Equipe, Café especial
- Valores computados: sacas estimadas, produtividade calculada
- Validação visual: total da classificação deve somar 100%
- Edição e exclusão (soft delete) no modal

### Daily Summary (CA6/CA9)

Endpoint de totalizador diário por talhão que agrega:

- Volume total em litros
- Sacas estimadas
- Total de colhedores
- Produtividade média
- Nº de registros
