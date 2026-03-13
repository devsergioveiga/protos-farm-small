# US-089 CA8-CA12 — Campos Específicos por Tipo de Produto

## O quê

Campos adicionais no modelo Product para cada tipo de produto: defensivos, fertilizantes, foliares, medicamentos veterinários e sementes. Dados estruturados (JSON) para listas variáveis (carência por cultura, composição nutricional, compatibilidade de calda).

## Por quê

Cada tipo de insumo agrícola/pecuário tem informações técnicas obrigatórias para rastreabilidade, compliance (MAPA) e decisão operacional. Sem esses campos, o sistema não atende requisitos legais e agronômicos.

## Campos adicionados ao Product

### CA8: Defensivos

- `toxicityClass` — classe toxicológica (I a V)
- `mapaRegistration` — nº registro MAPA
- `environmentalClass` — classe ambiental (I a IV)
- `actionMode` — modo de ação (contato, sistêmico, etc.)
- `chemicalGroup` — grupo químico (para rotação/resistência)
- `withdrawalPeriods` — JSON array `[{ crop, days }]`

### CA9: Fertilizantes

- `npkFormulation` — ex: "04-14-08"
- `nutrientForm` — granulado, líquido, foliar, fertirrigação
- `solubility` — alta, média, baixa, lenta liberação
- `nutrientComposition` — JSON `{ N: 4, P2O5: 14, K2O: 8, ... }`

### CA10: Foliares

- `nutritionalComposition` — JSON `{ N: 10, K: 5, Ca: 2, B: 0.5, ... }`
- `sprayCompatibility` — JSON `{ compatible: [...], incompatible: [...] }`

### CA11: Medicamentos Veterinários

- `therapeuticClass` — antibiótico, anti-inflamatório, etc.
- `administrationRoute` — IM, SC, IV, oral, intramamária, etc.
- `milkWithdrawalHours` — carência leite (horas)
- `slaughterWithdrawalDays` — carência abate (dias)
- `vetMapaRegistration` — registro MAPA vet
- `requiresPrescription` — receituário obrigatório
- `storageCondition` — ambiente, refrigerado 2-8°C, congelado

### CA12: Sementes

- `cultivarId` — FK para Cultivar (cadastro existente)
- `sieveSize` — peneira
- `industrialTreatment` — tratamento industrial de semente
- `germinationPct` — germinação % (0-100)
- `purityPct` — pureza % (0-100)

## Migration

- `20260339200000_add_product_type_fields`

## Validações

- Enums validados: toxicityClass, environmentalClass, nutrientForm, solubility, therapeuticClass, administrationRoute, storageCondition
- Ranges: germinationPct/purityPct 0-100, withdrawalPeriods.days >= 0, milkWithdrawalHours >= 0, slaughterWithdrawalDays >= 0

## Testes

- 48 testes total (13 novos para CA8-CA12)
