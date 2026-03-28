-- AlterEnum
ALTER TYPE "ReceivableCategory" ADD VALUE 'ASSET_SALE';

-- CreateEnum
CREATE TYPE "AssetDisposalType" AS ENUM ('VENDA', 'DESCARTE', 'SINISTRO', 'OBSOLESCENCIA');

-- CreateEnum
CREATE TYPE "AssetInventoryStatus" AS ENUM ('DRAFT', 'COUNTING', 'RECONCILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "disposalDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "asset_disposals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "disposalType" "AssetDisposalType" NOT NULL,
    "disposalDate" TIMESTAMP(3) NOT NULL,
    "saleValue" DECIMAL(15,2),
    "netBookValue" DECIMAL(15,2) NOT NULL,
    "gainLoss" DECIMAL(15,2) NOT NULL,
    "buyerName" TEXT,
    "motivation" TEXT,
    "documentUrl" TEXT,
    "receivableId" TEXT,
    "cancelledDepreciationCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_farm_transfers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromFarmId" TEXT NOT NULL,
    "toFarmId" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "fromCostCenterId" TEXT,
    "toCostCenterId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_farm_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_inventories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT,
    "status" "AssetInventoryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_inventory_items" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "registeredStatus" "AssetStatus" NOT NULL,
    "physicalStatus" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_disposals_assetId_key" ON "asset_disposals"("assetId");

-- CreateIndex
CREATE INDEX "asset_disposals_organizationId_disposalDate_idx" ON "asset_disposals"("organizationId", "disposalDate");

-- CreateIndex
CREATE INDEX "asset_farm_transfers_assetId_idx" ON "asset_farm_transfers"("assetId");

-- CreateIndex
CREATE INDEX "asset_farm_transfers_organizationId_transferDate_idx" ON "asset_farm_transfers"("organizationId", "transferDate");

-- CreateIndex
CREATE INDEX "asset_inventories_organizationId_status_idx" ON "asset_inventories"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_inventory_items_inventoryId_assetId_key" ON "asset_inventory_items"("inventoryId", "assetId");

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_farm_transfers" ADD CONSTRAINT "asset_farm_transfers_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_farm_transfers" ADD CONSTRAINT "asset_farm_transfers_fromFarmId_fkey" FOREIGN KEY ("fromFarmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_farm_transfers" ADD CONSTRAINT "asset_farm_transfers_toFarmId_fkey" FOREIGN KEY ("toFarmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_farm_transfers" ADD CONSTRAINT "asset_farm_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inventory_items" ADD CONSTRAINT "asset_inventory_items_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "asset_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_inventory_items" ADD CONSTRAINT "asset_inventory_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
