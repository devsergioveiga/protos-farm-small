# US-040 CA1 — Tipos Configuráveis de Operações de Trato Cultural

## O que

Modelo `CulturalOperation` com 7 tipos de operação configuráveis:

- Capina manual, Roçagem mecânica, Irrigação, Poda, Desbrota, Raleio, Quebra-vento

Backend CRUD completo com endpoint dedicado para listar tipos disponíveis.

## Por quê

Operações de trato cultural além de defensivos e adubação precisam ser rastreáveis. Os tipos são definidos como enum no banco para garantir consistência, com labels em pt-BR para a interface.

## Arquitetura

- **Schema:** `CulturalOperationType` enum + `PruningType` enum + `CulturalOperation` model
- **Módulo:** `modules/cultural-operations/` (types + service + routes + spec)
- **Rota base:** `/api/org/farms/:farmId/cultural-operations`
- **Endpoint de tipos:** `GET .../cultural-operations/types` retorna `[{value, label}]`

## Campos do modelo

O modelo já inclui campos para todos os CAs da US-040:

- CA1: `operationType` (enum com 7 valores)
- CA2: `durationHours`, `machineName`, `laborCount`, `laborHours`
- CA3: `irrigationDepthMm`, `irrigationTimeMin`, `irrigationSystem`
- CA4: `pruningType` (enum), `pruningPercentage`
- CA5: `machineHourCost`, `laborHourCost`, `supplyCost` (+ totalCost calculado)
- CA6: `photoUrl`, `latitude`, `longitude`

## Testes

14 testes cobrindo: tipos, CRUD, permissões, erros, filtros.
