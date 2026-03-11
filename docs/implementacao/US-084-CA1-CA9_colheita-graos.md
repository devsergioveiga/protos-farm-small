# US-084 — Registro de Colheita de Grãos (CA1-CA9)

**Branch:** `feature/US-084-colheita-graos`
**Doc original:** EPIC-09 / US-077 (ProtosFarm_Fase2_Operacoes_Core_UserStories.docx)
**Global:** US-085 na renumeracao, US-084 na implementacao

## Critérios de Aceite

| CA  | Descrição                                                                      | Status |
| --- | ------------------------------------------------------------------------------ | ------ |
| CA1 | Campos: talhao, data, cultura, area colhida, producao bruta, umidade, impureza | OK     |
| CA2 | Calculo automatico: produtividade sc/ha (base 13% soja, 14% milho, etc.)       | OK     |
| CA3 | Tabela de conversao de umidade configuravel por cultura (MoistureStandard)     | OK     |
| CA4 | Colheitadeira e operador registrados                                           | OK     |
| CA5 | Destino da producao: silo proprio, armazem terceiro, venda direta (romaneio)   | OK     |
| CA6 | Pesagem: registro manual ou balanca (peso bruto, tara, liquido)                | OK     |
| CA7 | Multiplas cargas por talhao (cada carga e um registro, talhao acumula)         | OK     |
| CA8 | Talhao muda de status para 'Colhido' ao completar a colheita                   | OK     |
| CA9 | Custo de colheita: horas de colheitadeira + transbordo + transporte            | OK     |

## Arquitetura

### Backend

**Modelos Prisma:**

- `GrainHarvest` — registro de colheita por carga/talhao
- `MoistureStandard` — umidade padrao por cultura (configuravel por org)

**Modulo:** `apps/backend/src/modules/grain-harvests/`

- `grain-harvests.types.ts` — tipos, constantes, interfaces
- `grain-harvests.service.ts` — logica de negocio (CRUD + cost summary)
- `grain-harvests.routes.ts` — endpoints REST
- `grain-harvests.routes.spec.ts` — 42 testes
- `moisture-standards.service.ts` — resolucao de umidade padrao
- `moisture-standards.routes.ts` — CRUD endpoints para MoistureStandard
- `moisture-standards.routes.spec.ts` — testes moisture standards

**Endpoints:**

- `POST /api/org/farms/:farmId/grain-harvests` — criar colheita
- `GET /api/org/farms/:farmId/grain-harvests` — listar (paginacao, filtros)
- `GET /api/org/farms/:farmId/grain-harvests/cost-summary` — CA9: resumo de custos por talhao
- `GET /api/org/farms/:farmId/grain-harvests/:harvestId` — detalhe
- `PATCH /api/org/farms/:farmId/grain-harvests/:harvestId` — atualizar
- `DELETE /api/org/farms/:farmId/grain-harvests/:harvestId` — soft delete

**Migrations (7):**

1. `20260311080000` — tabela grain_harvests (CA1-CA3, CA7-CA8)
2. `20260311090000` — tabela moisture_standards (CA3)
3. `20260311100000` — CA4: harvester_name, operator_name
4. `20260311110000` — CA5: destination, destination_name, romaneio_number
5. `20260311120000` — CA6: gross_weight_kg, tare_weight_kg, net_weight_kg, weighing_method
6. `20260311130000` — CA7: load_number
7. `20260311140000` — CA9: harvester_hours, harvester_cost_per_hour, transhipment_cost, transport_cost

### CA9 — Custo de Colheita (Detalhes)

**Campos por registro:**

- `harvesterHours` — horas de colheitadeira usadas
- `harvesterCostPerHour` — R$/hora da colheitadeira
- `transhipmentCost` — custo total de transbordo (R$)
- `transportCost` — custo total de transporte (R$)
- `totalHarvestCost` — campo computado: (horas \* custo/hora) + transbordo + transporte

**Endpoint de resumo (`GET .../cost-summary`):**

- Agrega custos por talhao com filtro por periodo (dateFrom/dateTo)
- Retorna: totalHarvesterCost, totalTranshipmentCost, totalTransportCost, totalCost, costPerHa, costPerSc
- Ordena por totalCost decrescente
