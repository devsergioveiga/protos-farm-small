-- CreateEnum
CREATE TYPE "MilkAnalysisType" AS ENUM ('INDIVIDUAL_CMT', 'INDIVIDUAL_LAB', 'TANK', 'OFFICIAL_RECORDING');

-- CreateTable
CREATE TABLE "milk_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "analysisType" "MilkAnalysisType" NOT NULL,
    "animalId" TEXT,
    "analysisDate" DATE NOT NULL,
    "laboratory" TEXT,
    "dairyCompany" TEXT,
    "cmtFrontLeft" TEXT,
    "cmtFrontRight" TEXT,
    "cmtRearLeft" TEXT,
    "cmtRearRight" TEXT,
    "cmtAlert" BOOLEAN NOT NULL DEFAULT false,
    "scc" DOUBLE PRECISION,
    "tbc" DOUBLE PRECISION,
    "fatPercent" DOUBLE PRECISION,
    "proteinPercent" DOUBLE PRECISION,
    "lactosePercent" DOUBLE PRECISION,
    "caseinPercent" DOUBLE PRECISION,
    "totalSolidsPercent" DOUBLE PRECISION,
    "snfPercent" DOUBLE PRECISION,
    "munMgDl" DOUBLE PRECISION,
    "fatProteinRatio" DOUBLE PRECISION,
    "antibioticResidue" BOOLEAN,
    "temperature" DOUBLE PRECISION,
    "acidityDornic" DOUBLE PRECISION,
    "cryoscopy" DOUBLE PRECISION,
    "productionAmLiters" DOUBLE PRECISION,
    "productionPmLiters" DOUBLE PRECISION,
    "projected305Liters" DOUBLE PRECISION,
    "sccAlert" TEXT,
    "tbcAlert" TEXT,
    "reportFileName" TEXT,
    "reportPath" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_quality_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sccLimit" DOUBLE PRECISION DEFAULT 500000,
    "sccWarning" DOUBLE PRECISION DEFAULT 400000,
    "tbcLimit" DOUBLE PRECISION DEFAULT 300000,
    "tbcWarning" DOUBLE PRECISION DEFAULT 200000,
    "individualSccLimit" DOUBLE PRECISION DEFAULT 200000,
    "bonusTable" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_quality_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milk_analyses_organizationId_idx" ON "milk_analyses"("organizationId");

-- CreateIndex
CREATE INDEX "milk_analyses_farmId_idx" ON "milk_analyses"("farmId");

-- CreateIndex
CREATE INDEX "milk_analyses_animalId_idx" ON "milk_analyses"("animalId");

-- CreateIndex
CREATE INDEX "milk_analyses_analysisDate_idx" ON "milk_analyses"("analysisDate");

-- CreateIndex
CREATE INDEX "milk_analyses_analysisType_idx" ON "milk_analyses"("analysisType");

-- CreateIndex
CREATE UNIQUE INDEX "milk_quality_configs_organizationId_key" ON "milk_quality_configs"("organizationId");

-- AddForeignKey
ALTER TABLE "milk_analyses" ADD CONSTRAINT "milk_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_analyses" ADD CONSTRAINT "milk_analyses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_analyses" ADD CONSTRAINT "milk_analyses_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_analyses" ADD CONSTRAINT "milk_analyses_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_quality_configs" ADD CONSTRAINT "milk_quality_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "milk_analyses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milk_analyses_org_isolation" ON "milk_analyses"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

ALTER TABLE "milk_quality_configs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milk_quality_configs_org_isolation" ON "milk_quality_configs"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));
