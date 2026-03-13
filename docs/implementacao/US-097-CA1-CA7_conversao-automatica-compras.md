# US-097 — Conversão automática em compras e NF de entrada

## Resumo

Permite que o usuário registre entradas de estoque em unidades de compra diferentes da unidade de estoque. O sistema converte automaticamente a quantidade para a unidade de estoque configurada no `ProductUnitConfig`.

## CAs Implementados

### CA1 — Migration (campos no StockEntryItem)

- Migration `20260348100000_add_stock_entry_unit_conversion`
- Campos adicionados ao `StockEntryItem`:
  - `purchaseUnitId` (FK → MeasurementUnit) — unidade em que foi comprado
  - `stockQuantity` (Decimal 14,4) — quantidade convertida para estoque
  - `stockUnitId` (FK → MeasurementUnit) — unidade de estoque
  - `conversionFactor` (Decimal 20,10) — fator de conversão usado

### CA2 — Conversão automática na criação

- Função `convertPurchaseToStock()` no service
- Cadeia de conversão (mesma do unit-conversion-bridge):
  1. Conversão por produto (ProductConversion)
  2. Conversão por densidade (densityGPerMl)
  3. Conversão global direta (UnitConversion)
  4. Conversão global 2-hops
  5. Fallback: usa quantidade original
- `StockBalance` recebe `balanceQuantity` (convertida) em vez de `quantity` (compra)
- Custo médio ponderado calculado sobre quantidade de estoque

### CA3 — Auto-sugestão de unidade

- Frontend busca `GET /api/org/product-unit-configs/:productId` ao selecionar produto
- Pré-preenche o select de unidade com `purchaseUnitAbbreviation` do config

### CA4 — Cancelamento reverso correto

- `cancelStockEntry` e `revertStockBalances` usam `stockQuantity` (quando presente) em vez de `quantity`
- `addRetroactiveExpense` também usa `stockQuantity` para recálculo de saldos

### CA5 — Frontend: seletor de unidade no modal

- Campo `<select>` de unidade ao lado da quantidade em cada item
- Lista todas as MeasurementUnits ativas da organização
- Preview de conversão: "5 t será convertido para kg no estoque"
- Grid 4 colunas: Quantidade | Unidade | Custo | Peso

### CA6 — Frontend: exibição na listagem

- StockEntriesPage (detalhe da entrada): mostra "5 t × R$200 → 5.000 kg"
- Exibe unidade de compra + conversão para estoque quando aplicável

### CA7 — Testes

- 6 testes em `stock-entry-conversion.spec.ts`
- Cobre: input com/sem purchaseUnitAbbreviation, response fields, detail, cancel, list

## Arquivos Modificados

### Backend

- `prisma/schema.prisma` — StockEntryItem + MeasurementUnit relations
- `prisma/migrations/20260348100000_*/migration.sql`
- `modules/stock-entries/stock-entries.types.ts` — input/output types
- `modules/stock-entries/stock-entries.service.ts` — convertPurchaseToStock + integration
- `modules/stock-entries/stock-entries.routes.spec.ts` — fixture update
- `modules/stock-entries/stock-entry-conversion.spec.ts` — novo

### Frontend

- `hooks/useStockEntries.ts` — StockEntryItem type
- `components/stock-entries/StockEntryModal.tsx` — unit selector + preview
- `components/stock-entries/StockEntryModal.css` — row--4 + conversion preview
- `pages/StockEntriesPage.tsx` — conversion display in detail
