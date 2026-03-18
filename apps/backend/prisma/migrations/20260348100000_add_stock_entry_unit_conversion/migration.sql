-- US-097: Conversão automática em compras e NF de entrada
-- Adiciona campos de unidade de compra e quantidade convertida ao StockEntryItem

ALTER TABLE "stock_entry_items" ADD COLUMN "purchaseUnitId" TEXT;
ALTER TABLE "stock_entry_items" ADD COLUMN "stockQuantity" DECIMAL(14, 4);
ALTER TABLE "stock_entry_items" ADD COLUMN "stockUnitId" TEXT;
ALTER TABLE "stock_entry_items" ADD COLUMN "conversionFactor" DECIMAL(20, 10);

-- Foreign keys para MeasurementUnit
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_purchaseUnitId_fkey"
  FOREIGN KEY ("purchaseUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_stockUnitId_fkey"
  FOREIGN KEY ("stockUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
