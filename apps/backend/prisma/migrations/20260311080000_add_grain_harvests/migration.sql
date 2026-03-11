-- CreateTable
CREATE TABLE "grain_harvests" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "cultivarId" TEXT,
    "crop" TEXT NOT NULL,
    "harvestDate" DATE NOT NULL,
    "harvestedAreaHa" DECIMAL(12,4) NOT NULL,
    "grossProductionKg" DECIMAL(14,2) NOT NULL,
    "moisturePct" DECIMAL(5,2) NOT NULL,
    "impurityPct" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grain_harvests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grain_harvests_farmId_idx" ON "grain_harvests"("farmId");

-- CreateIndex
CREATE INDEX "grain_harvests_fieldPlotId_idx" ON "grain_harvests"("fieldPlotId");

-- CreateIndex
CREATE INDEX "grain_harvests_cultivarId_idx" ON "grain_harvests"("cultivarId");

-- CreateIndex
CREATE INDEX "grain_harvests_harvestDate_idx" ON "grain_harvests"("harvestDate");

-- AddForeignKey
ALTER TABLE "grain_harvests" ADD CONSTRAINT "grain_harvests_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grain_harvests" ADD CONSTRAINT "grain_harvests_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grain_harvests" ADD CONSTRAINT "grain_harvests_cultivarId_fkey" FOREIGN KEY ("cultivarId") REFERENCES "cultivars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grain_harvests" ADD CONSTRAINT "grain_harvests_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
