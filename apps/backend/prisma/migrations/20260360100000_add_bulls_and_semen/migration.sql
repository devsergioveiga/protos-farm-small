-- CreateEnum
CREATE TYPE "BullStatus" AS ENUM ('ACTIVE', 'RESTING', 'DISCARDED');

-- CreateEnum
CREATE TYPE "SemenEntryType" AS ENUM ('PURCHASE', 'DONATION', 'TRANSFER');

-- CreateTable
CREATE TABLE "bulls" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registryNumber" TEXT,
    "registryAssociation" TEXT,
    "breedName" TEXT NOT NULL,
    "breedComposition" JSONB,
    "isOwnAnimal" BOOLEAN NOT NULL DEFAULT false,
    "animalId" TEXT,
    "ownerName" TEXT,
    "ownerContact" TEXT,
    "stayStartDate" DATE,
    "stayEndDate" DATE,
    "status" "BullStatus" NOT NULL DEFAULT 'ACTIVE',
    "ptaMilkKg" DOUBLE PRECISION,
    "ptaFatKg" DOUBLE PRECISION,
    "ptaFatPct" DOUBLE PRECISION,
    "ptaProteinKg" DOUBLE PRECISION,
    "ptaProteinPct" DOUBLE PRECISION,
    "typeScore" DOUBLE PRECISION,
    "productiveLife" DOUBLE PRECISION,
    "calvingEase" DOUBLE PRECISION,
    "scc" DOUBLE PRECISION,
    "geneticProofs" JSONB,
    "photoUrl" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bulls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semen_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bullId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "centralName" TEXT,
    "entryType" "SemenEntryType" NOT NULL DEFAULT 'PURCHASE',
    "entryDate" DATE NOT NULL,
    "expiryDate" DATE,
    "initialDoses" INTEGER NOT NULL,
    "currentDoses" INTEGER NOT NULL,
    "costPerDose" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "semen_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulls_organizationId_idx" ON "bulls"("organizationId");
CREATE INDEX "bulls_farmId_idx" ON "bulls"("farmId");
CREATE INDEX "bulls_status_idx" ON "bulls"("status");
CREATE UNIQUE INDEX "bulls_organizationId_name_key" ON "bulls"("organizationId", "name");
CREATE UNIQUE INDEX "bulls_animalId_key" ON "bulls"("animalId");

CREATE INDEX "semen_batches_organizationId_idx" ON "semen_batches"("organizationId");
CREATE INDEX "semen_batches_bullId_idx" ON "semen_batches"("bullId");
CREATE INDEX "semen_batches_expiryDate_idx" ON "semen_batches"("expiryDate");

-- AddForeignKey
ALTER TABLE "bulls" ADD CONSTRAINT "bulls_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bulls" ADD CONSTRAINT "bulls_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bulls" ADD CONSTRAINT "bulls_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "semen_batches" ADD CONSTRAINT "semen_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "semen_batches" ADD CONSTRAINT "semen_batches_bullId_fkey" FOREIGN KEY ("bullId") REFERENCES "bulls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS policies
ALTER TABLE "bulls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bulls_org_isolation" ON "bulls"
    USING ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "semen_batches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "semen_batches_org_isolation" ON "semen_batches"
    USING ("organizationId" = current_setting('app.organization_id', true));
