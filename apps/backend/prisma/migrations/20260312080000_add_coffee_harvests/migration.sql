-- CreateTable
CREATE TABLE "coffee_harvests" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "cultivarId" TEXT,

    -- CA1: campos básicos
    "harvestDate" DATE NOT NULL,
    "harvestType" TEXT NOT NULL,

    -- CA2: volume
    "volumeLiters" DECIMAL(14,2) NOT NULL,
    "sacsBenefited" DECIMAL(12,2),

    -- CA3: rendimento
    "yieldLitersPerSac" DECIMAL(8,2),

    -- CA4: classificação (% de cada tipo)
    "cherryPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "greenPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "floaterPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "dryPct" DECIMAL(5,2) NOT NULL DEFAULT 0,

    -- CA5: destino
    "destination" TEXT,
    "destinationName" TEXT,

    -- CA6: equipe
    "numberOfHarvesters" INTEGER,
    "harvestersProductivity" DECIMAL(10,2),

    -- CA7: café especial / microlotes
    "isSpecialLot" BOOLEAN NOT NULL DEFAULT false,
    "microlotCode" TEXT,

    -- common
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coffee_harvests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coffee_harvests_farmId_idx" ON "coffee_harvests"("farmId");

-- CreateIndex
CREATE INDEX "coffee_harvests_fieldPlotId_idx" ON "coffee_harvests"("fieldPlotId");

-- CreateIndex
CREATE INDEX "coffee_harvests_cultivarId_idx" ON "coffee_harvests"("cultivarId");

-- CreateIndex
CREATE INDEX "coffee_harvests_harvestDate_idx" ON "coffee_harvests"("harvestDate");

-- CreateIndex
CREATE INDEX "coffee_harvests_microlotCode_idx" ON "coffee_harvests"("microlotCode");

-- AddForeignKey
ALTER TABLE "coffee_harvests" ADD CONSTRAINT "coffee_harvests_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_harvests" ADD CONSTRAINT "coffee_harvests_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_harvests" ADD CONSTRAINT "coffee_harvests_cultivarId_fkey" FOREIGN KEY ("cultivarId") REFERENCES "cultivars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_harvests" ADD CONSTRAINT "coffee_harvests_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
