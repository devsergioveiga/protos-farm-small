-- CreateEnum
CREATE TYPE "FeedType" AS ENUM ('WHOLE_MILK', 'PASTEURIZED_DISCARD_MILK', 'MILK_REPLACER');

-- CreateEnum
CREATE TYPE "FeedingMethod" AS ENUM ('BUCKET_NIPPLE', 'BOTTLE', 'FOSTER_COLLECTIVE');

-- CreateTable
CREATE TABLE "calf_separations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "motherId" TEXT NOT NULL,
    "separationDate" DATE NOT NULL,
    "reason" TEXT,
    "destination" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calf_separations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calf_feeding_protocols" (
    "id" TEXT NOT NULL,
    "separationId" TEXT NOT NULL,
    "feedType" "FeedType" NOT NULL,
    "dailyVolumeLiters" DOUBLE PRECISION NOT NULL,
    "frequencyPerDay" INTEGER NOT NULL DEFAULT 2,
    "feedingMethod" "FeedingMethod" NOT NULL,
    "concentrateStartDate" DATE,
    "concentrateGramsPerDay" DOUBLE PRECISION,
    "roughageType" TEXT,
    "targetWeaningWeightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calf_feeding_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weaning_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "calfId" TEXT NOT NULL,
    "weaningDate" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "ageMonths" INTEGER,
    "concentrateConsumptionGrams" DOUBLE PRECISION,
    "previousCategory" TEXT,
    "targetLotId" TEXT,
    "observations" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weaning_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weaning_criteria" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "minAgeDays" INTEGER,
    "minWeightKg" DOUBLE PRECISION,
    "minConcentrateGrams" DOUBLE PRECISION,
    "consecutiveDays" INTEGER DEFAULT 3,
    "targetLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weaning_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calf_separations_organizationId_idx" ON "calf_separations"("organizationId");

-- CreateIndex
CREATE INDEX "calf_separations_farmId_idx" ON "calf_separations"("farmId");

-- CreateIndex
CREATE INDEX "calf_separations_calfId_idx" ON "calf_separations"("calfId");

-- CreateIndex
CREATE UNIQUE INDEX "calf_feeding_protocols_separationId_key" ON "calf_feeding_protocols"("separationId");

-- CreateIndex
CREATE INDEX "weaning_records_organizationId_idx" ON "weaning_records"("organizationId");

-- CreateIndex
CREATE INDEX "weaning_records_farmId_idx" ON "weaning_records"("farmId");

-- CreateIndex
CREATE INDEX "weaning_records_calfId_idx" ON "weaning_records"("calfId");

-- CreateIndex
CREATE INDEX "weaning_records_weaningDate_idx" ON "weaning_records"("weaningDate");

-- CreateIndex
CREATE UNIQUE INDEX "weaning_criteria_organizationId_key" ON "weaning_criteria"("organizationId");

-- AddForeignKey
ALTER TABLE "calf_separations" ADD CONSTRAINT "calf_separations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calf_separations" ADD CONSTRAINT "calf_separations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calf_separations" ADD CONSTRAINT "calf_separations_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calf_separations" ADD CONSTRAINT "calf_separations_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calf_separations" ADD CONSTRAINT "calf_separations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calf_feeding_protocols" ADD CONSTRAINT "calf_feeding_protocols_separationId_fkey" FOREIGN KEY ("separationId") REFERENCES "calf_separations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_records" ADD CONSTRAINT "weaning_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_records" ADD CONSTRAINT "weaning_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_records" ADD CONSTRAINT "weaning_records_calfId_fkey" FOREIGN KEY ("calfId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_records" ADD CONSTRAINT "weaning_records_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weaning_criteria" ADD CONSTRAINT "weaning_criteria_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "calf_separations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calf_feeding_protocols" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weaning_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weaning_criteria" ENABLE ROW LEVEL SECURITY;

-- RLS policies for calf_separations
CREATE POLICY "calf_separations_org_isolation" ON "calf_separations"
  USING ("organizationId" = current_setting('app.current_org_id', true));

-- RLS policies for calf_feeding_protocols (via join to calf_separations)
CREATE POLICY "calf_feeding_protocols_org_isolation" ON "calf_feeding_protocols"
  USING (
    EXISTS (
      SELECT 1 FROM "calf_separations" cs
      WHERE cs."id" = "separationId"
        AND cs."organizationId" = current_setting('app.current_org_id', true)
    )
  );

-- RLS policies for weaning_records
CREATE POLICY "weaning_records_org_isolation" ON "weaning_records"
  USING ("organizationId" = current_setting('app.current_org_id', true));

-- RLS policies for weaning_criteria
CREATE POLICY "weaning_criteria_org_isolation" ON "weaning_criteria"
  USING ("organizationId" = current_setting('app.current_org_id', true));
