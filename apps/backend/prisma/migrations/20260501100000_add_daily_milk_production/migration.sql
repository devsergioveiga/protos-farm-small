-- CreateTable
CREATE TABLE "daily_milk_productions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "totalLiters" DOUBLE PRECISION NOT NULL,
    "cowCount" INTEGER,
    "avgPerCow" DOUBLE PRECISION,
    "morningLiters" DOUBLE PRECISION,
    "afternoonLiters" DOUBLE PRECISION,
    "nightLiters" DOUBLE PRECISION,
    "dawnLiters" DOUBLE PRECISION,
    "collectionLiters" DOUBLE PRECISION,
    "nurseryLiters" DOUBLE PRECISION,
    "discardLiters" DOUBLE PRECISION,
    "calfLiters" DOUBLE PRECISION,
    "notes" TEXT,
    "source" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_milk_productions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_milk_productions_farmId_productionDate_key" ON "daily_milk_productions"("farmId", "productionDate");

-- CreateIndex
CREATE INDEX "daily_milk_productions_organizationId_idx" ON "daily_milk_productions"("organizationId");

-- CreateIndex
CREATE INDEX "daily_milk_productions_farmId_idx" ON "daily_milk_productions"("farmId");

-- CreateIndex
CREATE INDEX "daily_milk_productions_productionDate_idx" ON "daily_milk_productions"("productionDate");

-- AddForeignKey
ALTER TABLE "daily_milk_productions" ADD CONSTRAINT "daily_milk_productions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_milk_productions" ADD CONSTRAINT "daily_milk_productions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
