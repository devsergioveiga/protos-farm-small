-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "TreatmentOutcome" AS ENUM ('CURED', 'PARTIAL_IMPROVEMENT', 'DEATH', 'CHRONIC', 'REFERRED_DISPOSAL');

-- CreateEnum
CREATE TYPE "EvolutionType" AS ENUM ('IMPROVEMENT', 'STABLE', 'WORSENING');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'DONE', 'NOT_DONE');

-- CreateTable
CREATE TABLE "therapeutic_treatments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "diseaseId" TEXT,
    "diseaseName" TEXT NOT NULL,
    "diagnosisDate" DATE NOT NULL,
    "observedSeverity" TEXT NOT NULL,
    "clinicalObservations" TEXT,
    "veterinaryName" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "treatmentProtocolId" TEXT,
    "treatmentProtocolName" TEXT,
    "withdrawalMeatDays" INTEGER,
    "withdrawalMilkDays" INTEGER,
    "withdrawalEndDate" DATE,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "TreatmentOutcome",
    "closedAt" TIMESTAMP(3),
    "closingNotes" TEXT,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "therapeutic_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_applications" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION NOT NULL,
    "dosageUnit" TEXT NOT NULL,
    "administrationRoute" "AdministrationRoute" NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "scheduledTime" TEXT,
    "applicationDate" DATE,
    "applicationTime" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "notDoneReason" TEXT,
    "responsibleName" TEXT,
    "stockOutputId" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_evolutions" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "evolutionDate" DATE NOT NULL,
    "evolutionType" "EvolutionType" NOT NULL,
    "temperature" DOUBLE PRECISION,
    "observations" TEXT,
    "veterinaryName" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "therapeutic_treatments_organizationId_idx" ON "therapeutic_treatments"("organizationId");
CREATE INDEX "therapeutic_treatments_farmId_idx" ON "therapeutic_treatments"("farmId");
CREATE INDEX "therapeutic_treatments_animalId_idx" ON "therapeutic_treatments"("animalId");
CREATE INDEX "therapeutic_treatments_status_idx" ON "therapeutic_treatments"("status");
CREATE INDEX "therapeutic_treatments_diagnosisDate_idx" ON "therapeutic_treatments"("diagnosisDate");
CREATE INDEX "therapeutic_treatments_diseaseId_idx" ON "therapeutic_treatments"("diseaseId");

CREATE INDEX "treatment_applications_treatmentId_idx" ON "treatment_applications"("treatmentId");
CREATE INDEX "treatment_applications_scheduledDate_idx" ON "treatment_applications"("scheduledDate");
CREATE INDEX "treatment_applications_status_idx" ON "treatment_applications"("status");

CREATE INDEX "clinical_evolutions_treatmentId_idx" ON "clinical_evolutions"("treatmentId");

-- AddForeignKey
ALTER TABLE "therapeutic_treatments" ADD CONSTRAINT "therapeutic_treatments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "therapeutic_treatments" ADD CONSTRAINT "therapeutic_treatments_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "therapeutic_treatments" ADD CONSTRAINT "therapeutic_treatments_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "therapeutic_treatments" ADD CONSTRAINT "therapeutic_treatments_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "diseases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "therapeutic_treatments" ADD CONSTRAINT "therapeutic_treatments_treatmentProtocolId_fkey" FOREIGN KEY ("treatmentProtocolId") REFERENCES "treatment_protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "therapeutic_treatments" ADD CONSTRAINT "therapeutic_treatments_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "therapeutic_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "treatment_applications" ADD CONSTRAINT "treatment_applications_stockOutputId_fkey" FOREIGN KEY ("stockOutputId") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "therapeutic_treatments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_evolutions" ADD CONSTRAINT "clinical_evolutions_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
