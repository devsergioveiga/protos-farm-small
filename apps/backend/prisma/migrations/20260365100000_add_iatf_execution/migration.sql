-- CreateEnum
CREATE TYPE "ReproductiveLotStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LotStepStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "reproductive_lots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "d0Date" DATE NOT NULL,
    "status" "ReproductiveLotStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reproductive_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reproductive_lot_animals" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reproductive_lot_animals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reproductive_lot_steps" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "protocolStepId" TEXT,
    "dayNumber" INTEGER NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "isAiDay" BOOLEAN NOT NULL DEFAULT false,
    "status" "LotStepStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "responsibleName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reproductive_lot_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inseminations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "lotStepId" TEXT,
    "inseminationType" TEXT NOT NULL,
    "bullId" TEXT,
    "semenBatchId" TEXT,
    "dosesUsed" INTEGER NOT NULL DEFAULT 1,
    "inseminatorName" TEXT NOT NULL,
    "inseminationDate" DATE NOT NULL,
    "inseminationTime" TEXT,
    "cervicalMucus" TEXT,
    "heatRecordId" TEXT,
    "matingPairId" TEXT,
    "plannedBullId" TEXT,
    "wasPlannedBull" BOOLEAN,
    "substitutionReason" TEXT,
    "observations" TEXT,
    "stockOutputId" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inseminations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reproductive_lots_organizationId_idx" ON "reproductive_lots"("organizationId");
CREATE INDEX "reproductive_lots_farmId_idx" ON "reproductive_lots"("farmId");
CREATE INDEX "reproductive_lots_protocolId_idx" ON "reproductive_lots"("protocolId");
CREATE INDEX "reproductive_lots_status_idx" ON "reproductive_lots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reproductive_lot_animals_lotId_animalId_key" ON "reproductive_lot_animals"("lotId", "animalId");
CREATE INDEX "reproductive_lot_animals_lotId_idx" ON "reproductive_lot_animals"("lotId");
CREATE INDEX "reproductive_lot_animals_animalId_idx" ON "reproductive_lot_animals"("animalId");

-- CreateIndex
CREATE INDEX "reproductive_lot_steps_lotId_idx" ON "reproductive_lot_steps"("lotId");
CREATE INDEX "reproductive_lot_steps_scheduledDate_idx" ON "reproductive_lot_steps"("scheduledDate");

-- CreateIndex
CREATE INDEX "inseminations_organizationId_idx" ON "inseminations"("organizationId");
CREATE INDEX "inseminations_farmId_idx" ON "inseminations"("farmId");
CREATE INDEX "inseminations_animalId_idx" ON "inseminations"("animalId");
CREATE INDEX "inseminations_lotStepId_idx" ON "inseminations"("lotStepId");
CREATE INDEX "inseminations_inseminationDate_idx" ON "inseminations"("inseminationDate");

-- AddForeignKey
ALTER TABLE "reproductive_lots" ADD CONSTRAINT "reproductive_lots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reproductive_lots" ADD CONSTRAINT "reproductive_lots_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reproductive_lots" ADD CONSTRAINT "reproductive_lots_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "iatf_protocols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reproductive_lots" ADD CONSTRAINT "reproductive_lots_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reproductive_lot_animals" ADD CONSTRAINT "reproductive_lot_animals_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "reproductive_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reproductive_lot_animals" ADD CONSTRAINT "reproductive_lot_animals_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reproductive_lot_steps" ADD CONSTRAINT "reproductive_lot_steps_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "reproductive_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_lotStepId_fkey" FOREIGN KEY ("lotStepId") REFERENCES "reproductive_lot_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_bullId_fkey" FOREIGN KEY ("bullId") REFERENCES "bulls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_semenBatchId_fkey" FOREIGN KEY ("semenBatchId") REFERENCES "semen_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
