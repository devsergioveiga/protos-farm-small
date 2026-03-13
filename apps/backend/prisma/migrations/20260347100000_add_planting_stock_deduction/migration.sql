-- US-096 CA3: Add stock deduction fields to planting_operations
-- Allows linking seed product for automatic stock deduction during planting

ALTER TABLE "planting_operations" ADD COLUMN "seed_product_id" TEXT;
ALTER TABLE "planting_operations" ADD COLUMN "stock_output_id" TEXT;
ALTER TABLE "planting_operations" ADD COLUMN "total_seed_quantity_used" DECIMAL(14, 4);

-- Foreign keys
ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_seed_product_id_fkey" FOREIGN KEY ("seed_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_stock_output_id_fkey" FOREIGN KEY ("stock_output_id") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "planting_operations_seed_product_id_idx" ON "planting_operations"("seed_product_id");
CREATE INDEX "planting_operations_stock_output_id_idx" ON "planting_operations"("stock_output_id");
