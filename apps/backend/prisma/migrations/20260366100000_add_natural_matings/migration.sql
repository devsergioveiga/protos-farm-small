-- CreateEnum
CREATE TYPE "NaturalMatingReason" AS ENUM ('POST_IATF_REPASSE', 'DIRECT_COVERAGE');

-- CreateEnum
CREATE TYPE "PaternityType" AS ENUM ('PROBABLE_NATURAL', 'UNKNOWN_BREED_ONLY');

-- CreateTable
CREATE TABLE "natural_matings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "bullId" TEXT,
    "bullBreedName" TEXT,
    "reason" "NaturalMatingReason" NOT NULL,
    "entryDate" DATE NOT NULL,
    "exitDate" DATE,
    "maxStayDays" INTEGER DEFAULT 60,
    "isOverstay" BOOLEAN NOT NULL DEFAULT false,
    "paternityType" "PaternityType" NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "natural_matings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "natural_mating_animals" (
    "id" TEXT NOT NULL,
    "matingId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "natural_mating_animals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "natural_matings_organizationId_idx" ON "natural_matings"("organizationId");

-- CreateIndex
CREATE INDEX "natural_matings_farmId_idx" ON "natural_matings"("farmId");

-- CreateIndex
CREATE INDEX "natural_matings_bullId_idx" ON "natural_matings"("bullId");

-- CreateIndex
CREATE INDEX "natural_matings_entryDate_idx" ON "natural_matings"("entryDate");

-- CreateIndex
CREATE INDEX "natural_mating_animals_matingId_idx" ON "natural_mating_animals"("matingId");

-- CreateIndex
CREATE INDEX "natural_mating_animals_animalId_idx" ON "natural_mating_animals"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "natural_mating_animals_matingId_animalId_key" ON "natural_mating_animals"("matingId", "animalId");

-- AddForeignKey
ALTER TABLE "natural_matings" ADD CONSTRAINT "natural_matings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natural_matings" ADD CONSTRAINT "natural_matings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natural_matings" ADD CONSTRAINT "natural_matings_bullId_fkey" FOREIGN KEY ("bullId") REFERENCES "bulls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natural_matings" ADD CONSTRAINT "natural_matings_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natural_mating_animals" ADD CONSTRAINT "natural_mating_animals_matingId_fkey" FOREIGN KEY ("matingId") REFERENCES "natural_matings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natural_mating_animals" ADD CONSTRAINT "natural_mating_animals_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "natural_matings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "natural_mating_animals" ENABLE ROW LEVEL SECURITY;

-- RLS policies for natural_matings
CREATE POLICY "natural_matings_org_isolation" ON "natural_matings"
  USING ("organizationId" = current_setting('app.current_org_id', true));

-- RLS policies for natural_mating_animals (via join)
CREATE POLICY "natural_mating_animals_org_isolation" ON "natural_mating_animals"
  USING ("matingId" IN (
    SELECT id FROM "natural_matings"
    WHERE "organizationId" = current_setting('app.current_org_id', true)
  ));
