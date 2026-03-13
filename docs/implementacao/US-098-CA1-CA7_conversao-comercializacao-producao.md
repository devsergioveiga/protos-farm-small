# US-098 — Conversão em comercialização e produção

## Resumo

Permite converter e exibir produção de colheitas em qualquer unidade comercial (sacas, arrobas, toneladas, caixas, litros). Inclui relatório de produção unificado e geração de romaneio de entrega.

## CAs Implementados

### CA1 — Grãos: conversão comercial automática

- `GrainHarvestItem` agora retorna `commercialUnits: { kg, sc, arroba, t }`
- Calculado a partir de `correctedProductionKg` (já descontada umidade e impureza)
- Constante `ARROBA_KG = 15` adicionada

### CA2 — Café: conversão comercial automática

- `CoffeeHarvestItem` agora retorna `commercialUnits: { L, sc, kg, arroba, t }`
- Calculado a partir de `estimatedSacs` (litros cereja / rendimento) × 60 kg
- Conversões: L → sc → kg → arroba/t

### CA3 — Laranja: conversão comercial automática

- `OrangeHarvestItem` agora retorna `commercialUnits: { cx, kg, t }`
- Calculado a partir de `numberOfBoxes × 40.8 kg/cx`
- Conversão principal: caixas → toneladas (para contratos com indústria)

### CA4 — Leite (POSTERGADO)

- Depende do EPIC-13 (módulo de produção de leite não existe ainda)

### CA5 — Conversão entre unidades comerciais

- Endpoint: `GET /api/org/farms/:farmId/harvest-conversion/convert`
- Query params: `harvestType`, `quantity`, `fromUnit`, `toUnit`, `yieldLitersPerSac`
- Suporta todas as conversões weight-based via kg como intermediário
- Conversões especiais para café (litros ↔ sacas via rendimento)
- Retorna: quantidade, fator, fórmula legível

### CA6 — Relatório de produção multi-unidade

- Endpoint: `GET /api/org/farms/:farmId/harvest-conversion/production-report`
- Query params: `dateFrom`, `dateTo`, `fieldPlotId`, `crop`, `unit`
- Agrega todas as colheitas (grãos + café + laranja) por talhão/cultura
- Normaliza para kg internamente, converte para unidade alvo
- Retorna: items por talhão, totais, produtividade/ha

### CA7 — Romaneio de entrega

- Endpoint: `POST /api/org/farms/:farmId/harvest-conversion/delivery-manifest`
- Body: `harvestType`, `harvestIds[]`, `targetUnit`, `deliveryDate`, `recipient`, `transporterName`, `vehiclePlate`, `notes`
- Busca colheitas, converte para unidade alvo
- Gera número de romaneio `ROM-YYYYMMDD-NNN`
- Retorna: manifest com items, totais, dados de transporte

## Arquivos Criados

### Backend

- `modules/harvest-commercial-conversion/harvest-commercial-conversion.types.ts`
- `modules/harvest-commercial-conversion/harvest-commercial-conversion.service.ts`
- `modules/harvest-commercial-conversion/harvest-commercial-conversion.routes.ts`
- `modules/harvest-commercial-conversion/harvest-commercial-conversion.spec.ts` (21 testes)

## Arquivos Modificados

### Backend

- `grain-harvests/grain-harvests.types.ts` — `CommercialUnits`, `ARROBA_KG`
- `grain-harvests/grain-harvests.service.ts` — `computeCommercialUnits()`, `toItem()`
- `grain-harvests/grain-harvests.routes.spec.ts` — fixture atualizada
- `coffee-harvests/coffee-harvests.types.ts` — `CoffeeCommercialUnits`, `ARROBA_KG`
- `coffee-harvests/coffee-harvests.service.ts` — `computeCoffeeCommercialUnits()`, `toItem()`
- `coffee-harvests/coffee-harvests.routes.spec.ts` — fixture atualizada
- `orange-harvests/orange-harvests.types.ts` — `OrangeCommercialUnits`
- `orange-harvests/orange-harvests.service.ts` — `computeOrangeCommercialUnits()`, `toItem()`
- `orange-harvests/orange-harvests.routes.spec.ts` — fixture atualizada
- `app.ts` — registro do `harvestConversionRouter`

### Frontend

- `types/coffee-harvest.ts` — `commercialUnits?` no `CoffeeHarvestItem`
- `types/orange-harvest.ts` — `commercialUnits?` no `OrangeHarvestItem`
- `pages/CoffeeHarvestsPage.tsx` — exibição comercial nos cards
- `pages/CoffeeHarvestsPage.css` — estilo para linha comercial
- `pages/OrangeHarvestsPage.tsx` — toneladas nos cards

## Fatores de Conversão

| De       | Para | Fator                      |
| -------- | ---- | -------------------------- |
| kg       | sc   | ÷ 60                       |
| kg       | @    | ÷ 15                       |
| kg       | t    | ÷ 1000                     |
| cx       | kg   | × 40.8                     |
| L cereja | sc   | ÷ rendimento (default 480) |

## Testes

- 21 testes unitários novos (harvest-commercial-conversion)
- 103 testes existentes (grain/coffee/orange) passando sem regressão
