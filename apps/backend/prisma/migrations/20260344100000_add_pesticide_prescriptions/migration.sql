-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "pesticide_prescriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "sequentialNumber" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "farmName" TEXT NOT NULL,
    "fieldPlotName" TEXT NOT NULL,
    "cultureName" TEXT NOT NULL,
    "areaHa" DECIMAL(12,4) NOT NULL,
    "targetPest" TEXT NOT NULL,
    "targetType" "PesticideTarget" NOT NULL,
    "sprayVolume" DECIMAL(10,2) NOT NULL,
    "numberOfApplications" INTEGER NOT NULL DEFAULT 1,
    "applicationInterval" INTEGER,
    "agronomistName" TEXT NOT NULL,
    "agronomistCrea" TEXT NOT NULL,
    "agronomistSignatureUrl" TEXT,
    "pesticideApplicationId" TEXT,
    "stockOutputId" TEXT,
    "technicalJustification" TEXT,
    "notes" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesticide_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesticide_prescription_products" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "dose" DECIMAL(10,4) NOT NULL,
    "doseUnit" "DoseUnit" NOT NULL DEFAULT 'L_HA',
    "withdrawalPeriodDays" INTEGER,
    "safetyIntervalDays" INTEGER,
    "toxicityClass" TEXT,
    "mapaRegistration" TEXT,
    "environmentalClass" TEXT,

    CONSTRAINT "pesticide_prescription_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pesticide_prescriptions_organizationId_idx" ON "pesticide_prescriptions"("organizationId");
CREATE INDEX "pesticide_prescriptions_farmId_idx" ON "pesticide_prescriptions"("farmId");
CREATE INDEX "pesticide_prescriptions_fieldPlotId_idx" ON "pesticide_prescriptions"("fieldPlotId");
CREATE UNIQUE INDEX "pesticide_prescriptions_farmId_sequentialNumber_key" ON "pesticide_prescriptions"("farmId", "sequentialNumber");

CREATE INDEX "pesticide_prescription_products_prescriptionId_idx" ON "pesticide_prescription_products"("prescriptionId");
CREATE INDEX "pesticide_prescription_products_productId_idx" ON "pesticide_prescription_products"("productId");

-- AddForeignKey
ALTER TABLE "pesticide_prescriptions" ADD CONSTRAINT "pesticide_prescriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pesticide_prescriptions" ADD CONSTRAINT "pesticide_prescriptions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pesticide_prescriptions" ADD CONSTRAINT "pesticide_prescriptions_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pesticide_prescriptions" ADD CONSTRAINT "pesticide_prescriptions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pesticide_prescription_products" ADD CONSTRAINT "pesticide_prescription_products_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "pesticide_prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pesticide_prescription_products" ADD CONSTRAINT "pesticide_prescription_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
