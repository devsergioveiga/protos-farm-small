-- CreateEnum
CREATE TYPE "FertilizerApplicationType" AS ENUM ('COBERTURA_SOLIDA', 'COBERTURA_SULCO', 'COBERTURA_LANCO', 'FOLIAR', 'FERTIRRIGACAO');

-- CreateEnum
CREATE TYPE "FertilizerDoseUnit" AS ENUM ('KG_HA', 'L_HA', 'G_HA', 'ML_HA', 'G_PLANTA');

-- CreateTable
CREATE TABLE "fertilizer_applications" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "applicationType" "FertilizerApplicationType" NOT NULL,
    "productName" TEXT NOT NULL,
    "formulation" TEXT,
    "dose" DECIMAL(10,4) NOT NULL,
    "doseUnit" "FertilizerDoseUnit" NOT NULL DEFAULT 'KG_HA',
    "nutrientSource" TEXT,
    "phenologicalStage" TEXT,
    "nitrogenN" DECIMAL(10,2),
    "phosphorusP" DECIMAL(10,2),
    "potassiumK" DECIMAL(10,2),
    "machineName" TEXT,
    "operatorName" TEXT,
    "areaAppliedHa" DECIMAL(10,4),
    "plantsPerHa" INTEGER,
    "dosePerPlantG" DECIMAL(10,4),
    "photoUrl" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fertilizer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fertilizer_applications_farmId_idx" ON "fertilizer_applications"("farmId");

-- CreateIndex
CREATE INDEX "fertilizer_applications_fieldPlotId_idx" ON "fertilizer_applications"("fieldPlotId");

-- CreateIndex
CREATE INDEX "fertilizer_applications_appliedAt_idx" ON "fertilizer_applications"("appliedAt");

-- AddForeignKey
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fertilizer_applications" ADD CONSTRAINT "fertilizer_applications_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
