-- AlterTable: Add productId and stockOutputId to pesticide_applications
ALTER TABLE "pesticide_applications" ADD COLUMN "product_id" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "stock_output_id" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "total_quantity_used" DECIMAL(14, 4);

-- AlterTable: Add productId and stockOutputId to fertilizer_applications
ALTER TABLE "fertilizer_applications" ADD COLUMN "product_id" TEXT;
ALTER TABLE "fertilizer_applications" ADD COLUMN "stock_output_id" TEXT;
ALTER TABLE "fertilizer_applications" ADD COLUMN "total_quantity_used" DECIMAL(14, 4);

-- AlterTable: Add stockOutputId to soil_prep_operations
ALTER TABLE "soil_prep_operations" ADD COLUMN "stock_output_id" TEXT;

-- Foreign keys
ALTER TABLE "pesticide_applications" ADD CONSTRAINT "pesticide_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pesticide_applications" ADD CONSTRAINT "pesticide_applications_stock_output_id_fkey" FOREIGN KEY ("stock_output_id") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_stock_output_id_fkey" FOREIGN KEY ("stock_output_id") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "soil_prep_operations" ADD CONSTRAINT "soil_prep_operations_stock_output_id_fkey" FOREIGN KEY ("stock_output_id") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for the new foreign keys
CREATE INDEX "pesticide_applications_product_id_idx" ON "pesticide_applications"("product_id");
CREATE INDEX "pesticide_applications_stock_output_id_idx" ON "pesticide_applications"("stock_output_id");
CREATE INDEX "fertilizer_applications_product_id_idx" ON "fertilizer_applications"("product_id");
CREATE INDEX "fertilizer_applications_stock_output_id_idx" ON "fertilizer_applications"("stock_output_id");
CREATE INDEX "soil_prep_operations_stock_output_id_idx" ON "soil_prep_operations"("stock_output_id");
