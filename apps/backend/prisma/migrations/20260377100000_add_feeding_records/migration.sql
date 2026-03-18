-- CreateEnum
CREATE TYPE "FeedingShift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- CreateTable
CREATE TABLE "feeding_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "feedingDate" DATE NOT NULL,
    "shift" "FeedingShift" NOT NULL,
    "dietId" TEXT,
    "dietName" TEXT,
    "animalCount" INTEGER NOT NULL,
    "totalProvidedKg" DOUBLE PRECISION NOT NULL,
    "totalLeftoverKg" DOUBLE PRECISION,
    "totalConsumedKg" DOUBLE PRECISION,
    "leftoverPercent" DOUBLE PRECISION,
    "leftoverAlert" BOOLEAN NOT NULL DEFAULT false,
    "consumptionPerAnimalKg" DOUBLE PRECISION,
    "responsibleName" TEXT NOT NULL,
    "stockOutputId" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeding_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeding_record_items" (
    "id" TEXT NOT NULL,
    "feedingRecordId" TEXT NOT NULL,
    "feedIngredientId" TEXT NOT NULL,
    "feedIngredientName" TEXT NOT NULL,
    "productId" TEXT,
    "quantityProvidedKg" DOUBLE PRECISION NOT NULL,
    "quantityLeftoverKg" DOUBLE PRECISION,
    "quantityConsumedKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feeding_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feeding_records_organizationId_idx" ON "feeding_records"("organizationId");

-- CreateIndex
CREATE INDEX "feeding_records_farmId_idx" ON "feeding_records"("farmId");

-- CreateIndex
CREATE INDEX "feeding_records_lotId_idx" ON "feeding_records"("lotId");

-- CreateIndex
CREATE INDEX "feeding_records_feedingDate_idx" ON "feeding_records"("feedingDate");

-- CreateIndex
CREATE INDEX "feeding_record_items_feedingRecordId_idx" ON "feeding_record_items"("feedingRecordId");

-- AddForeignKey
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "animal_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_records" ADD CONSTRAINT "feeding_records_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_record_items" ADD CONSTRAINT "feeding_record_items_feedingRecordId_fkey" FOREIGN KEY ("feedingRecordId") REFERENCES "feeding_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_record_items" ADD CONSTRAINT "feeding_record_items_feedIngredientId_fkey" FOREIGN KEY ("feedIngredientId") REFERENCES "feed_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "feeding_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feeding_record_items" ENABLE ROW LEVEL SECURITY;

-- RLS policies for feeding_records
CREATE POLICY "feeding_records_org_isolation" ON "feeding_records"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

CREATE POLICY "feeding_records_org_insert" ON "feeding_records"
  FOR INSERT WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- RLS policies for feeding_record_items (join through feeding_record)
CREATE POLICY "feeding_record_items_org_isolation" ON "feeding_record_items"
  USING (
    EXISTS (
      SELECT 1 FROM "feeding_records" fr WHERE fr."id" = "feeding_record_items"."feedingRecordId"
        AND (fr."organizationId" = current_setting('app.current_org_id', true)
             OR current_setting('app.bypass_rls', true) = 'true')
    )
  );

CREATE POLICY "feeding_record_items_org_insert" ON "feeding_record_items"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "feeding_records" fr WHERE fr."id" = "feeding_record_items"."feedingRecordId"
        AND (fr."organizationId" = current_setting('app.current_org_id', true)
             OR current_setting('app.bypass_rls', true) = 'true')
    )
  );
