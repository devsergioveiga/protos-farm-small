# US-095 — Conversão automática em operações de campo

**Data:** 2026-03-12
**CAs implementados:** CA4, CA7, CA9, CA10, CA11 (frontend)
**CAs já atendidos pelo backend:** CA1, CA2, CA3, CA5 (stock-deduction + measurement-units)
**CA8:** Já parcialmente atendido (totalQuantityUsed + doseUnit armazenados em cada operação)

## O que foi implementado

### Utility: `apps/frontend/src/utils/dose-conversion.ts`

- `doseToAbsoluteQuantity()` — espelho do backend, converte dose/ha → quantidade absoluta
- `calculateSprayMix()` — CA7: calcula volume total de calda, tanques necessários, produto por tanque
- `getBaseUnit()`, `getDoseUnitLabel()`, `formatQuantity()` — helpers de formatação

### Componente: `apps/frontend/src/components/shared/ConversionPreviewCard.tsx`

- Card inline (CA4/CA9) mostrando conversão calculada em tempo real
- Ex: "2,5 L/ha × 50 ha = 125 L de Roundup"
- Seção de calda (CA7): volume total, tanques necessários, produto por tanque, calda por tanque
- Atualiza automaticamente conforme usuário preenche dose, talhão e volume de calda

### Integração nos modais (CA4/CA9)

- **PesticideApplicationModal** — preview + cálculo de calda (CA7)
- **FertilizerApplicationModal** — preview com suporte a g/planta (plantsPerHa)
- **SoilPrepModal** — preview por insumo (lista de insumos aplicados)

### Colunas nas listagens (CA11)

- **PesticideApplicationsPage** — dose original → quantidade convertida (ex: "2,5 L/ha → 125 L")
- **FertilizerApplicationsPage** — idem

## Arquivos criados

- `apps/frontend/src/utils/dose-conversion.ts`
- `apps/frontend/src/components/shared/ConversionPreviewCard.tsx`
- `apps/frontend/src/components/shared/ConversionPreviewCard.css`

## Arquivos modificados

- `apps/frontend/src/components/pesticide-applications/PesticideApplicationModal.tsx`
- `apps/frontend/src/components/fertilizer-applications/FertilizerApplicationModal.tsx`
- `apps/frontend/src/components/soil-prep/SoilPrepModal.tsx`
- `apps/frontend/src/pages/PesticideApplicationsPage.tsx`
- `apps/frontend/src/pages/PesticideApplicationsPage.css`
- `apps/frontend/src/pages/FertilizerApplicationsPage.tsx`
- `apps/frontend/src/pages/FertilizerApplicationsPage.css`

## CAs pendentes

- **CA6** (sugestão de unidade por tipo de produto) — requer integração com catálogo de produtos (Product.category)
- **CA8** (histórico completo de conversões) — backend já armazena doseUnit + totalQuantityUsed; falta tela dedicada de auditoria
