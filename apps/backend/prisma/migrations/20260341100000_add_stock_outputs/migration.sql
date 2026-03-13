-- CreateEnum
CREATE TYPE "StockOutputType" AS ENUM ('CONSUMPTION', 'MANUAL_CONSUMPTION', 'TRANSFER', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "StockOutputStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisposalReason" AS ENUM ('EXPIRED', 'DAMAGED', 'CONTAMINATED', 'OTHER');

-- CreateTable
CREATE TABLE "stock_outputs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outputDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "StockOutputType" NOT NULL,
    "status" "StockOutputStatus" NOT NULL DEFAULT 'DRAFT',
    "fieldOperationRef" TEXT,
    "fieldPlotId" TEXT,
    "sourceFarmId" TEXT,
    "sourceLocation" TEXT,
    "destinationFarmId" TEXT,
    "destinationLocation" TEXT,
    "disposalReason" "DisposalReason",
    "disposalJustification" TEXT,
    "authorizedBy" TEXT,
    "responsibleName" TEXT,
    "notes" TEXT,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "stock_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_output_items" (
    "id" TEXT NOT NULL,
    "stockOutputId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "batchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_output_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_outputs_organizationId_idx" ON "stock_outputs"("organizationId");
CREATE INDEX "stock_outputs_organizationId_type_idx" ON "stock_outputs"("organizationId", "type");
CREATE INDEX "stock_outputs_organizationId_status_idx" ON "stock_outputs"("organizationId", "status");
CREATE INDEX "stock_outputs_organizationId_outputDate_idx" ON "stock_outputs"("organizationId", "outputDate");

CREATE INDEX "stock_output_items_stockOutputId_idx" ON "stock_output_items"("stockOutputId");
CREATE INDEX "stock_output_items_productId_idx" ON "stock_output_items"("productId");

-- AddForeignKey
ALTER TABLE "stock_outputs" ADD CONSTRAINT "stock_outputs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_outputs" ADD CONSTRAINT "stock_outputs_sourceFarmId_fkey" FOREIGN KEY ("sourceFarmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_outputs" ADD CONSTRAINT "stock_outputs_destinationFarmId_fkey" FOREIGN KEY ("destinationFarmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_output_items" ADD CONSTRAINT "stock_output_items_stockOutputId_fkey" FOREIGN KEY ("stockOutputId") REFERENCES "stock_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_output_items" ADD CONSTRAINT "stock_output_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "stock_outputs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_output_items" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "stock_outputs_org_isolation" ON "stock_outputs"
    USING ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY "stock_output_items_org_isolation" ON "stock_output_items"
    USING ("stockOutputId" IN (
        SELECT id FROM "stock_outputs"
        WHERE "organizationId" = current_setting('app.organization_id', true)
    ));
