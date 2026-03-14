-- AlterTable: add composite product fields to products
ALTER TABLE "products" ADD COLUMN "isComposite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "compositeType" TEXT;
ALTER TABLE "products" ADD COLUMN "batchSize" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "batchUnit" TEXT;

-- CreateTable
CREATE TABLE "composite_ingredients" (
    "id" TEXT NOT NULL,
    "compositeProductId" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "quantityPerBatch" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "composite_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composite_productions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "compositeProductId" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "batchNumber" TEXT,
    "quantityProduced" DOUBLE PRECISION NOT NULL,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "responsibleName" TEXT NOT NULL,
    "notes" TEXT,
    "stockEntryId" TEXT,
    "stockOutputId" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composite_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composite_production_items" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "ingredientProductId" TEXT NOT NULL,
    "ingredientProductName" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "sourceBatchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "composite_production_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "composite_ingredients_compositeProductId_idx" ON "composite_ingredients"("compositeProductId");
CREATE INDEX "composite_ingredients_ingredientProductId_idx" ON "composite_ingredients"("ingredientProductId");
CREATE INDEX "composite_productions_organizationId_idx" ON "composite_productions"("organizationId");
CREATE INDEX "composite_productions_compositeProductId_idx" ON "composite_productions"("compositeProductId");
CREATE INDEX "composite_productions_productionDate_idx" ON "composite_productions"("productionDate");
CREATE INDEX "composite_production_items_productionId_idx" ON "composite_production_items"("productionId");

-- AddForeignKey
ALTER TABLE "composite_ingredients" ADD CONSTRAINT "composite_ingredients_compositeProductId_fkey" FOREIGN KEY ("compositeProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "composite_ingredients" ADD CONSTRAINT "composite_ingredients_ingredientProductId_fkey" FOREIGN KEY ("ingredientProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "composite_productions" ADD CONSTRAINT "composite_productions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "composite_productions" ADD CONSTRAINT "composite_productions_compositeProductId_fkey" FOREIGN KEY ("compositeProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "composite_productions" ADD CONSTRAINT "composite_productions_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "composite_production_items" ADD CONSTRAINT "composite_production_items_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "composite_productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "composite_production_items" ADD CONSTRAINT "composite_production_items_ingredientProductId_fkey" FOREIGN KEY ("ingredientProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
