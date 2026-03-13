-- CreateEnum
CREATE TYPE "StockInventoryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RECONCILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('INVENTORY_SURPLUS', 'INVENTORY_SHORTAGE');

-- CreateTable
CREATE TABLE "stock_inventories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "inventoryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StockInventoryStatus" NOT NULL DEFAULT 'OPEN',
    "storageFarmId" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "stock_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_inventory_items" (
    "id" TEXT NOT NULL,
    "stockInventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "systemQuantity" DECIMAL(14,4) NOT NULL,
    "countedQuantity" DECIMAL(14,4),
    "variance" DECIMAL(14,4),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockInventoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "adjustmentType" "AdjustmentType" NOT NULL,
    "previousQuantity" DECIMAL(14,4) NOT NULL,
    "newQuantity" DECIMAL(14,4) NOT NULL,
    "adjustmentQty" DECIMAL(14,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_inventories_organizationId_idx" ON "stock_inventories"("organizationId");
CREATE INDEX "stock_inventories_organizationId_status_idx" ON "stock_inventories"("organizationId", "status");
CREATE INDEX "stock_inventories_organizationId_inventoryDate_idx" ON "stock_inventories"("organizationId", "inventoryDate");

-- CreateIndex
CREATE UNIQUE INDEX "stock_inventory_items_stockInventoryId_productId_batchNumber_key" ON "stock_inventory_items"("stockInventoryId", "productId", "batchNumber");
CREATE INDEX "stock_inventory_items_stockInventoryId_idx" ON "stock_inventory_items"("stockInventoryId");
CREATE INDEX "stock_inventory_items_productId_idx" ON "stock_inventory_items"("productId");

-- CreateIndex
CREATE INDEX "stock_adjustments_organizationId_idx" ON "stock_adjustments"("organizationId");
CREATE INDEX "stock_adjustments_stockInventoryId_idx" ON "stock_adjustments"("stockInventoryId");
CREATE INDEX "stock_adjustments_productId_idx" ON "stock_adjustments"("productId");

-- AddForeignKey
ALTER TABLE "stock_inventories" ADD CONSTRAINT "stock_inventories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_inventories" ADD CONSTRAINT "stock_inventories_storageFarmId_fkey" FOREIGN KEY ("storageFarmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inventory_items" ADD CONSTRAINT "stock_inventory_items_stockInventoryId_fkey" FOREIGN KEY ("stockInventoryId") REFERENCES "stock_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_inventory_items" ADD CONSTRAINT "stock_inventory_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stockInventoryId_fkey" FOREIGN KEY ("stockInventoryId") REFERENCES "stock_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
