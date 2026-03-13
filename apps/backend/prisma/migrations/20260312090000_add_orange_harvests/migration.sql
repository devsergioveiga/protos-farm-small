-- CreateTable
CREATE TABLE "orange_harvests" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "cultivarId" TEXT,

    -- CA1 campos básicos
    "harvestDate" DATE NOT NULL,
    "variety" TEXT,

    -- CA1 produção
    "numberOfBoxes" DECIMAL(12,2) NOT NULL,
    "totalWeightKg" DECIMAL(14,2),
    "treesHarvested" INTEGER,

    -- CA2 produtividade (calculados)
    "boxesPerTree" DECIMAL(8,2),
    "boxesPerHa" DECIMAL(10,2),
    "tonsPerHa" DECIMAL(10,2),

    -- CA3 qualidade
    "ratioSS" DECIMAL(5,2),
    "acidityPct" DECIMAL(5,2),
    "refusalPct" DECIMAL(5,2),

    -- CA4 destino
    "destination" TEXT,
    "destinationName" TEXT,

    -- CA5 equipe
    "numberOfHarvesters" INTEGER,
    "harvestersProductivity" DECIMAL(10,2),

    -- CA6 contrato
    "saleContractRef" TEXT,

    -- common
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orange_harvests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orange_harvests_farmId_idx" ON "orange_harvests"("farmId");
CREATE INDEX "orange_harvests_fieldPlotId_idx" ON "orange_harvests"("fieldPlotId");
CREATE INDEX "orange_harvests_cultivarId_idx" ON "orange_harvests"("cultivarId");
CREATE INDEX "orange_harvests_harvestDate_idx" ON "orange_harvests"("harvestDate");
CREATE INDEX "orange_harvests_saleContractRef_idx" ON "orange_harvests"("saleContractRef");

-- AddForeignKey
ALTER TABLE "orange_harvests" ADD CONSTRAINT "orange_harvests_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orange_harvests" ADD CONSTRAINT "orange_harvests_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orange_harvests" ADD CONSTRAINT "orange_harvests_cultivarId_fkey" FOREIGN KEY ("cultivarId") REFERENCES "cultivars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orange_harvests" ADD CONSTRAINT "orange_harvests_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
