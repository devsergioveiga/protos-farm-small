-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'HOURS_OF_USE', 'UNITS_OF_PRODUCTION', 'ACCELERATED');

-- CreateEnum
CREATE TYPE "DepreciationTrack" AS ENUM ('FISCAL', 'MANAGERIAL');

-- CreateTable
CREATE TABLE "depreciation_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "fiscalAnnualRate" DECIMAL(7,4),
    "managerialAnnualRate" DECIMAL(7,4),
    "usefulLifeMonths" INTEGER,
    "residualValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalHours" DECIMAL(12,2),
    "totalUnits" DECIMAL(14,2),
    "accelerationFactor" DECIMAL(5,2),
    "activeTrack" "DepreciationTrack" NOT NULL DEFAULT 'FISCAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depreciation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "track" "DepreciationTrack" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalAssets" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "triggeredBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "depreciation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "track" "DepreciationTrack" NOT NULL,
    "openingBookValue" DECIMAL(15,2) NOT NULL,
    "depreciationAmount" DECIMAL(15,2) NOT NULL,
    "closingBookValue" DECIMAL(15,2) NOT NULL,
    "proRataDays" INTEGER,
    "daysInMonth" INTEGER NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_entry_cc_items" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "depreciation_entry_cc_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_configs_assetId_key" ON "depreciation_configs"("assetId");

-- CreateIndex
CREATE INDEX "depreciation_configs_organizationId_idx" ON "depreciation_configs"("organizationId");

-- CreateIndex
CREATE INDEX "depreciation_runs_organizationId_periodYear_periodMonth_idx" ON "depreciation_runs"("organizationId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_entries_assetId_periodYear_periodMonth_track_key" ON "depreciation_entries"("assetId", "periodYear", "periodMonth", "track");

-- CreateIndex
CREATE INDEX "depreciation_entries_organizationId_periodYear_periodMonth_idx" ON "depreciation_entries"("organizationId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "depreciation_entries_assetId_idx" ON "depreciation_entries"("assetId");

-- CreateIndex
CREATE INDEX "depreciation_entry_cc_items_entryId_idx" ON "depreciation_entry_cc_items"("entryId");

-- AddForeignKey
ALTER TABLE "depreciation_configs" ADD CONSTRAINT "depreciation_configs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_configs" ADD CONSTRAINT "depreciation_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_runId_fkey" FOREIGN KEY ("runId") REFERENCES "depreciation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entry_cc_items" ADD CONSTRAINT "depreciation_entry_cc_items_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "depreciation_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entry_cc_items" ADD CONSTRAINT "depreciation_entry_cc_items_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
