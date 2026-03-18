# CAs Residuais — Baixa Automática de Estoque

**Data:** 2026-03-12
**Status:** Implementado

## O que foi feito

Integração entre operações de campo e módulo de estoque para baixa automática de insumos.

### CAs atendidos

| US     | CA  | Descrição                                  | Status |
| ------ | --- | ------------------------------------------ | ------ |
| US-038 | CA8 | Baixa automática defensivos na aplicação   | ✅     |
| US-034 | CA4 | Baixa automática insumos no preparo solo   | ✅     |
| US-039 | —   | Baixa automática fertilizantes na adubação | ✅     |

### Banco de dados

- **Migration `20260345100000_add_stock_deduction_fields`:**
  - `pesticide_applications`: +`product_id` (FK→products), +`stock_output_id` (FK→stock_outputs), +`total_quantity_used`
  - `fertilizer_applications`: +`product_id` (FK→products), +`stock_output_id` (FK→stock_outputs), +`total_quantity_used`
  - `soil_prep_operations`: +`stock_output_id` (FK→stock_outputs)
  - Índices em todas as novas FKs

### Backend — módulo `stock-deduction`

- **Novo módulo:** `modules/stock-deduction/stock-deduction.ts`
  - `doseToAbsoluteQuantity()` — converte dose/ha para quantidade absoluta (L_HA→L, KG_HA→kg, ML_HA→L, G_HA→kg, T_HA→kg, G_PLANTA→kg)
  - `createConsumptionOutput(tx, input)` — cria StockOutput tipo CONSUMPTION dentro de transação existente (check saldo, FEFO, custo médio, dedução)
  - `cancelConsumptionOutput(tx, orgId, stockOutputId)` — reverte saldos ao cancelar
- **10 testes** em `stock-deduction.spec.ts` (conversão de unidades)

### Serviços modificados

1. **pesticide-applications.service.ts:**
   - `createPesticideApplication`: se `productId` informado, calcula quantidade (dose × área talhão) e cria saída automática
   - `deletePesticideApplication`: cancela saída vinculada (reverte saldo)

2. **fertilizer-applications.service.ts:**
   - `createFertilizerApplication`: se `productId` informado, calcula quantidade (dose × área, com suporte G_PLANTA) e cria saída automática
   - `deleteFertilizerApplication`: cancela saída vinculada

3. **soil-prep-operations.service.ts:**
   - `createSoilPrepOperation`: para inputs com `productId`, agrupa e cria saída automática (quantidade já calculada como `totalQuantity`)
   - `deleteSoilPrepOperation`: cancela saída vinculada

### Frontend

- Tipos atualizados: `PesticideApplicationItem`, `FertilizerApplicationItem`, `SoilPrepItem`, `SoilPrepInputItem`
- Campos `productId`, `stockOutputId`, `totalQuantityUsed` adicionados

## Por que assim

- `productId` é **opcional** — retrocompatível com dados existentes e sync mobile offline
- Quantidade auto-calculada no servidor (dose × área), com override via `totalQuantityUsed`
- Saída criada na **mesma transação** (atomicidade) — se falhar, nada é commitado
- Soft delete reverte saldo automaticamente via `cancelConsumptionOutput`
- Referência `fieldOperationRef` no StockOutput permite rastreabilidade bidirecional

## Arquivos criados/modificados

- `apps/backend/prisma/migrations/20260345100000_add_stock_deduction_fields/migration.sql`
- `apps/backend/prisma/schema.prisma` — 3 models + 2 reverse relations
- `apps/backend/src/modules/stock-deduction/stock-deduction.ts` (NOVO)
- `apps/backend/src/modules/stock-deduction/stock-deduction.spec.ts` (NOVO)
- `apps/backend/src/modules/pesticide-applications/pesticide-applications.service.ts`
- `apps/backend/src/modules/pesticide-applications/pesticide-applications.types.ts`
- `apps/backend/src/modules/fertilizer-applications/fertilizer-applications.service.ts`
- `apps/backend/src/modules/fertilizer-applications/fertilizer-applications.types.ts`
- `apps/backend/src/modules/soil-prep-operations/soil-prep-operations.service.ts`
- `apps/backend/src/modules/soil-prep-operations/soil-prep-operations.types.ts`
- `apps/frontend/src/types/pesticide-application.ts`
- `apps/frontend/src/types/fertilizer-application.ts`
- `apps/frontend/src/types/soil-prep.ts`
- Specs atualizados (3 backend + 2 frontend)
