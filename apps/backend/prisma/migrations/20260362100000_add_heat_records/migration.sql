-- CreateEnum
CREATE TYPE "HeatIntensity" AS ENUM ('STRONG', 'MODERATE', 'WEAK');

-- CreateEnum
CREATE TYPE "HeatDetectionMethod" AS ENUM ('VISUAL', 'MARKER_PAINT', 'PEDOMETER', 'TEASER');

-- CreateEnum
CREATE TYPE "HeatStatus" AS ENUM ('AWAITING_AI', 'AI_DONE', 'NOT_INSEMINATED');

-- CreateTable
CREATE TABLE "heat_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "heatDate" DATE NOT NULL,
    "heatTime" TEXT,
    "heatPeriod" TEXT,
    "intensity" "HeatIntensity" NOT NULL,
    "signs" JSONB NOT NULL,
    "detectionMethod" "HeatDetectionMethod" NOT NULL,
    "status" "HeatStatus" NOT NULL DEFAULT 'AWAITING_AI',
    "recommendedAiTime" TIMESTAMP(3),
    "recommendedBullId" TEXT,
    "cyclicityStatus" TEXT,
    "previousHeatDate" DATE,
    "interHeatDays" INTEGER,
    "isIntervalIrregular" BOOLEAN NOT NULL DEFAULT false,
    "inseminationId" TEXT,
    "notInseminatedReason" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "heat_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "heat_records_organizationId_idx" ON "heat_records"("organizationId");

-- CreateIndex
CREATE INDEX "heat_records_farmId_idx" ON "heat_records"("farmId");

-- CreateIndex
CREATE INDEX "heat_records_animalId_idx" ON "heat_records"("animalId");

-- CreateIndex
CREATE INDEX "heat_records_heatDate_idx" ON "heat_records"("heatDate");

-- CreateIndex
CREATE INDEX "heat_records_status_idx" ON "heat_records"("status");

-- AddForeignKey
ALTER TABLE "heat_records" ADD CONSTRAINT "heat_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heat_records" ADD CONSTRAINT "heat_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heat_records" ADD CONSTRAINT "heat_records_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heat_records" ADD CONSTRAINT "heat_records_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "heat_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "heat_records_org_isolation" ON "heat_records"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
