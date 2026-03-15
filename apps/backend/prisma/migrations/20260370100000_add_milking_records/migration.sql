-- CreateEnum
CREATE TYPE "MilkingShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- CreateTable
CREATE TABLE "milking_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "milkingDate" DATE NOT NULL,
    "shift" "MilkingShift" NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "variationPercent" DOUBLE PRECISION,
    "variationAlert" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milking_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milking_records_animalId_milkingDate_shift_key" ON "milking_records"("animalId", "milkingDate", "shift");

-- CreateIndex
CREATE INDEX "milking_records_organizationId_idx" ON "milking_records"("organizationId");

-- CreateIndex
CREATE INDEX "milking_records_farmId_idx" ON "milking_records"("farmId");

-- CreateIndex
CREATE INDEX "milking_records_animalId_idx" ON "milking_records"("animalId");

-- CreateIndex
CREATE INDEX "milking_records_milkingDate_idx" ON "milking_records"("milkingDate");

-- AddForeignKey
ALTER TABLE "milking_records" ADD CONSTRAINT "milking_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milking_records" ADD CONSTRAINT "milking_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milking_records" ADD CONSTRAINT "milking_records_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milking_records" ADD CONSTRAINT "milking_records_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "milking_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milking_records_org_isolation" ON "milking_records"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));
