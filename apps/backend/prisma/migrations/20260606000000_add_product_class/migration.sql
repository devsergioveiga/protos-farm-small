-- CreateTable
CREATE TABLE "product_classes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_classes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_classes_organizationId_idx" ON "product_classes"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "product_classes_organizationId_name_key" ON "product_classes"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "product_classes" ADD CONSTRAINT "product_classes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "productClassId" TEXT;

-- CreateIndex
CREATE INDEX "products_productClassId_idx" ON "products"("productClassId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_productClassId_fkey" FOREIGN KEY ("productClassId") REFERENCES "product_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
