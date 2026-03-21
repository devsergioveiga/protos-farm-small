-- CreateEnum
CREATE TYPE "ActiveIngredientType" AS ENUM ('VETERINARY', 'AGROCHEMICAL', 'FERTILIZER', 'OTHER');

-- CreateTable
CREATE TABLE "active_ingredients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ActiveIngredientType" NOT NULL DEFAULT 'OTHER',
    "casNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_active_ingredients" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "activeIngredientId" TEXT NOT NULL,
    "concentration" TEXT,
    "function" TEXT,

    CONSTRAINT "product_active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "assetId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add storageLocationId to stock_entries
ALTER TABLE "stock_entries" ADD COLUMN "storageLocationId" TEXT;

-- CreateIndex
CREATE INDEX "active_ingredients_organizationId_idx" ON "active_ingredients"("organizationId");
CREATE INDEX "active_ingredients_organizationId_type_idx" ON "active_ingredients"("organizationId", "type");
CREATE UNIQUE INDEX "active_ingredients_organizationId_name_key" ON "active_ingredients"("organizationId", "name");

CREATE INDEX "product_active_ingredients_productId_idx" ON "product_active_ingredients"("productId");
CREATE INDEX "product_active_ingredients_activeIngredientId_idx" ON "product_active_ingredients"("activeIngredientId");
CREATE UNIQUE INDEX "product_active_ingredients_productId_activeIngredientId_key" ON "product_active_ingredients"("productId", "activeIngredientId");

CREATE INDEX "storage_locations_organizationId_idx" ON "storage_locations"("organizationId");
CREATE UNIQUE INDEX "storage_locations_organizationId_name_key" ON "storage_locations"("organizationId", "name");
CREATE UNIQUE INDEX "storage_locations_organizationId_code_key" ON "storage_locations"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "active_ingredients" ADD CONSTRAINT "active_ingredients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "product_active_ingredients_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "product_active_ingredients_activeIngredientId_fkey" FOREIGN KEY ("activeIngredientId") REFERENCES "active_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
