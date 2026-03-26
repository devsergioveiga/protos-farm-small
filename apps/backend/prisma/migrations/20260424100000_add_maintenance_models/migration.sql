-- CreateEnum
CREATE TYPE "MaintenanceTriggerType" AS ENUM ('HOURMETER', 'ODOMETER', 'CALENDAR');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('PREVENTIVA', 'CORRETIVA', 'SOLICITACAO');

-- CreateEnum
CREATE TYPE "WorkOrderAccountingTreatment" AS ENUM ('DESPESA', 'CAPITALIZACAO', 'DIFERIMENTO');

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "MaintenanceTriggerType" NOT NULL,
    "intervalValue" DECIMAL(12,2) NOT NULL,
    "alertBeforeValue" DECIMAL(12,2) NOT NULL,
    "lastExecutedAt" TIMESTAMP(3),
    "lastMeterValue" DECIMAL(12,2),
    "nextDueAt" TIMESTAMP(3),
    "nextDueMeter" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sequentialNumber" INTEGER NOT NULL,
    "type" "WorkOrderType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'ABERTA',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maintenancePlanId" TEXT,
    "requestedBy" TEXT,
    "assignedTo" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "hourmeterAtOpen" DECIMAL(12,2),
    "odometerAtOpen" DECIMAL(12,2),
    "externalCost" DECIMAL(15,2),
    "externalSupplier" TEXT,
    "laborHours" DECIMAL(8,2),
    "laborCostPerHour" DECIMAL(10,2),
    "totalPartsCost" DECIMAL(15,2),
    "totalLaborCost" DECIMAL(15,2),
    "totalCost" DECIMAL(15,2),
    "accountingTreatment" "WorkOrderAccountingTreatment",
    "accountingThreshold" DECIMAL(15,2),
    "photoUrls" JSONB DEFAULT '[]',
    "geoLat" DECIMAL(9,6),
    "geoLon" DECIMAL(9,6),
    "stockOutputId" TEXT,
    "costCenterId" TEXT,
    "costCenterMode" TEXT NOT NULL DEFAULT 'INHERITED',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_parts" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitCost" DECIMAL(10,4) NOT NULL,
    "totalCost" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_cc_items" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "work_order_cc_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deferred_maintenances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "monthlyAmortization" DECIMAL(15,2) NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "amortizedToDate" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "isFullyAmortized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deferred_maintenances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_provisions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT,
    "monthlyAmount" DECIMAL(15,2) NOT NULL,
    "costCenterId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_provisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_part_asset_compat" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spare_part_asset_compat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_plans_organizationId_assetId_idx" ON "maintenance_plans"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "maintenance_plans_nextDueAt_idx" ON "maintenance_plans"("nextDueAt");

-- CreateIndex
CREATE INDEX "work_orders_organizationId_status_idx" ON "work_orders"("organizationId", "status");

-- CreateIndex
CREATE INDEX "work_orders_assetId_idx" ON "work_orders"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_organizationId_sequentialNumber_key" ON "work_orders"("organizationId", "sequentialNumber");

-- CreateIndex
CREATE INDEX "work_order_parts_workOrderId_idx" ON "work_order_parts"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_cc_items_workOrderId_idx" ON "work_order_cc_items"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "deferred_maintenances_workOrderId_key" ON "deferred_maintenances"("workOrderId");

-- CreateIndex
CREATE INDEX "deferred_maintenances_organizationId_isFullyAmortized_idx" ON "deferred_maintenances"("organizationId", "isFullyAmortized");

-- CreateIndex
CREATE INDEX "maintenance_provisions_organizationId_isActive_idx" ON "maintenance_provisions"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "spare_part_asset_compat_assetId_idx" ON "spare_part_asset_compat"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "spare_part_asset_compat_productId_assetId_key" ON "spare_part_asset_compat"("productId", "assetId");

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_maintenancePlanId_fkey" FOREIGN KEY ("maintenancePlanId") REFERENCES "maintenance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_cc_items" ADD CONSTRAINT "work_order_cc_items_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_cc_items" ADD CONSTRAINT "work_order_cc_items_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deferred_maintenances" ADD CONSTRAINT "deferred_maintenances_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deferred_maintenances" ADD CONSTRAINT "deferred_maintenances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_provisions" ADD CONSTRAINT "maintenance_provisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_provisions" ADD CONSTRAINT "maintenance_provisions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spare_part_asset_compat" ADD CONSTRAINT "spare_part_asset_compat_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
