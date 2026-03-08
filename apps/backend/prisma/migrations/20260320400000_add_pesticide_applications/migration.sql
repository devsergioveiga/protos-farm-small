-- CreateEnum
CREATE TYPE "PesticideTarget" AS ENUM ('PRAGA', 'DOENCA', 'PLANTA_DANINHA');

-- CreateEnum
CREATE TYPE "DoseUnit" AS ENUM ('L_HA', 'KG_HA', 'ML_HA', 'G_HA');

-- CreateTable
CREATE TABLE "pesticide_applications" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "productName" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "dose" DECIMAL(10,4) NOT NULL,
    "doseUnit" "DoseUnit" NOT NULL DEFAULT 'L_HA',
    "sprayVolume" DECIMAL(10,2) NOT NULL,
    "target" "PesticideTarget" NOT NULL,
    "targetDescription" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesticide_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pesticide_applications_farmId_idx" ON "pesticide_applications"("farmId");

-- CreateIndex
CREATE INDEX "pesticide_applications_fieldPlotId_idx" ON "pesticide_applications"("fieldPlotId");

-- CreateIndex
CREATE INDEX "pesticide_applications_appliedAt_idx" ON "pesticide_applications"("appliedAt");

-- AddForeignKey
ALTER TABLE "pesticide_applications" ADD CONSTRAINT "pesticide_applications_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesticide_applications" ADD CONSTRAINT "pesticide_applications_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesticide_applications" ADD CONSTRAINT "pesticide_applications_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
