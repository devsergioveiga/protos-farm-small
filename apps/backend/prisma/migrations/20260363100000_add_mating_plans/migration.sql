-- CreateEnum
CREATE TYPE "MatingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatingPairStatus" AS ENUM ('PLANNED', 'EXECUTED', 'CONFIRMED_PREGNANT', 'EMPTY', 'CANCELLED');

-- CreateTable
CREATE TABLE "mating_plans" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT,
    "objective" TEXT,
    "status" "MatingPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE,
    "endDate" DATE,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mating_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mating_pairs" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "primaryBullId" TEXT,
    "secondaryBullId" TEXT,
    "tertiaryBullId" TEXT,
    "status" "MatingPairStatus" NOT NULL DEFAULT 'PLANNED',
    "executedBullId" TEXT,
    "executionDate" DATE,
    "substitutionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mating_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mating_plans_organizationId_idx" ON "mating_plans"("organizationId");
CREATE INDEX "mating_plans_farmId_idx" ON "mating_plans"("farmId");
CREATE INDEX "mating_plans_status_idx" ON "mating_plans"("status");

CREATE INDEX "mating_pairs_planId_idx" ON "mating_pairs"("planId");
CREATE INDEX "mating_pairs_animalId_idx" ON "mating_pairs"("animalId");
CREATE INDEX "mating_pairs_status_idx" ON "mating_pairs"("status");

-- AddForeignKey
ALTER TABLE "mating_plans" ADD CONSTRAINT "mating_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mating_plans" ADD CONSTRAINT "mating_plans_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mating_plans" ADD CONSTRAINT "mating_plans_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mating_pairs" ADD CONSTRAINT "mating_pairs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "mating_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mating_pairs" ADD CONSTRAINT "mating_pairs_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mating_pairs" ADD CONSTRAINT "mating_pairs_primaryBullId_fkey" FOREIGN KEY ("primaryBullId") REFERENCES "bulls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mating_pairs" ADD CONSTRAINT "mating_pairs_secondaryBullId_fkey" FOREIGN KEY ("secondaryBullId") REFERENCES "bulls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mating_pairs" ADD CONSTRAINT "mating_pairs_tertiaryBullId_fkey" FOREIGN KEY ("tertiaryBullId") REFERENCES "bulls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mating_pairs" ADD CONSTRAINT "mating_pairs_executedBullId_fkey" FOREIGN KEY ("executedBullId") REFERENCES "bulls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "mating_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mating_plans_org_isolation" ON "mating_plans"
  USING ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "mating_pairs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mating_pairs_org_isolation" ON "mating_pairs"
  USING ("planId" IN (
    SELECT "id" FROM "mating_plans"
    WHERE "organizationId" = current_setting('app.current_org_id', true)
  ));
