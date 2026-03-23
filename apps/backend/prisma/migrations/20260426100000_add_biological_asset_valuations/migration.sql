-- CreateTable
CREATE TABLE "biological_asset_valuations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "valuationDate" DATE NOT NULL,
    "assetGroup" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "headCount" INTEGER,
    "areaHa" DECIMAL(12,4),
    "pricePerUnit" DECIMAL(15,4) NOT NULL,
    "totalFairValue" DECIMAL(15,2) NOT NULL,
    "previousValue" DECIMAL(15,2),
    "fairValueChange" DECIMAL(15,2),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biological_asset_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "biological_asset_valuations_organizationId_valuationDate_idx" ON "biological_asset_valuations"("organizationId", "valuationDate");

-- CreateIndex
CREATE INDEX "biological_asset_valuations_organizationId_assetGroup_idx" ON "biological_asset_valuations"("organizationId", "assetGroup");

-- AddForeignKey
ALTER TABLE "biological_asset_valuations" ADD CONSTRAINT "biological_asset_valuations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biological_asset_valuations" ADD CONSTRAINT "biological_asset_valuations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biological_asset_valuations" ADD CONSTRAINT "biological_asset_valuations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
