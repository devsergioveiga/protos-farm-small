-- CreateEnum
CREATE TYPE "ProductNature" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable: manufacturers
CREATE TABLE "manufacturers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manufacturers_organizationId_name_key" ON "manufacturers"("organizationId", "name");
CREATE INDEX "manufacturers_organizationId_idx" ON "manufacturers"("organizationId");

ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: products
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nature" "ProductNature" NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "commercialName" TEXT,
    "manufacturerId" TEXT,
    "measurementUnitId" TEXT,
    "barcode" TEXT,
    "photoUrl" TEXT,
    "technicalSheetUrl" TEXT,
    "chargeUnit" TEXT,
    "unitCost" DECIMAL(12,2),
    "typicalFrequency" TEXT,
    "requiresScheduling" BOOLEAN NOT NULL DEFAULT false,
    "linkedActivity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_organizationId_name_nature_key" ON "products"("organizationId", "name", "nature");
CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");
CREATE INDEX "products_organizationId_nature_idx" ON "products"("organizationId", "nature");
CREATE INDEX "products_organizationId_type_idx" ON "products"("organizationId", "type");
CREATE INDEX "products_organizationId_status_idx" ON "products"("organizationId", "status");
CREATE INDEX "products_manufacturerId_idx" ON "products"("manufacturerId");

ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_manufacturerId_fkey"
    FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_measurementUnitId_fkey"
    FOREIGN KEY ("measurementUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: product_compositions (CA7)
CREATE TABLE "product_compositions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "concentration" TEXT,
    "function" TEXT,

    CONSTRAINT "product_compositions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_compositions_productId_idx" ON "product_compositions"("productId");

ALTER TABLE "product_compositions" ADD CONSTRAINT "product_compositions_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
