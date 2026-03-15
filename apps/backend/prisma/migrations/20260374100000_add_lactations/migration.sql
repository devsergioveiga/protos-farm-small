-- CreateEnum
CREATE TYPE "LactationOrigin" AS ENUM ('BIRTH', 'INDUCTION');

-- CreateEnum
CREATE TYPE "LactationStatus" AS ENUM ('IN_PROGRESS', 'DRIED');

-- CreateEnum
CREATE TYPE "DryingReason" AS ENUM ('SCHEDULED', 'LOW_PRODUCTION', 'TREATMENT', 'ADVANCED_GESTATION');

-- CreateTable
CREATE TABLE "lactations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "lactationNumber" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "origin" "LactationOrigin" NOT NULL,
    "status" "LactationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "inductionProtocol" TEXT,
    "inductionReason" TEXT,
    "inductionVet" TEXT,
    "firstMilkingDate" DATE,
    "dryingReason" "DryingReason",
    "dryingProtocol" TEXT,
    "dryingVet" TEXT,
    "peakLiters" DOUBLE PRECISION,
    "peakDel" INTEGER,
    "accumulated305" DOUBLE PRECISION,
    "totalAccumulated" DOUBLE PRECISION,
    "durationDays" INTEGER,
    "calvingEventId" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lactations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lactations_organizationId_idx" ON "lactations"("organizationId");

-- CreateIndex
CREATE INDEX "lactations_farmId_idx" ON "lactations"("farmId");

-- CreateIndex
CREATE INDEX "lactations_animalId_idx" ON "lactations"("animalId");

-- CreateIndex
CREATE INDEX "lactations_status_idx" ON "lactations"("status");

-- CreateIndex
CREATE INDEX "lactations_startDate_idx" ON "lactations"("startDate");

-- AddForeignKey
ALTER TABLE "lactations" ADD CONSTRAINT "lactations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lactations" ADD CONSTRAINT "lactations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lactations" ADD CONSTRAINT "lactations_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lactations" ADD CONSTRAINT "lactations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS policy
ALTER TABLE "lactations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lactations_org_isolation" ON "lactations"
  USING ("organizationId" = current_setting('app.current_org_id', true));
