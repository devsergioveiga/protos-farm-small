-- CreateTable
CREATE TABLE "cooling_tanks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityLiters" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "serialNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cooling_tanks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tank_measurements" (
    "id" TEXT NOT NULL,
    "tankId" TEXT NOT NULL,
    "measureDate" DATE NOT NULL,
    "volumeLiters" DOUBLE PRECISION NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tank_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_collections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "tankId" TEXT,
    "collectionDate" DATE NOT NULL,
    "collectionTime" TEXT,
    "dairyCompany" TEXT NOT NULL,
    "driverName" TEXT,
    "volumeLiters" DOUBLE PRECISION NOT NULL,
    "sampleCollected" BOOLEAN NOT NULL DEFAULT false,
    "milkTemperature" DOUBLE PRECISION,
    "ticketNumber" TEXT,
    "ticketPhotoPath" TEXT,
    "ticketPhotoName" TEXT,
    "productionLiters" DOUBLE PRECISION,
    "divergencePercent" DOUBLE PRECISION,
    "divergenceAlert" BOOLEAN NOT NULL DEFAULT false,
    "pricePerLiter" DOUBLE PRECISION,
    "grossValue" DOUBLE PRECISION,
    "qualityDiscount" DOUBLE PRECISION,
    "freightDiscount" DOUBLE PRECISION,
    "otherDiscounts" DOUBLE PRECISION,
    "netValue" DOUBLE PRECISION,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cooling_tanks_organizationId_idx" ON "cooling_tanks"("organizationId");

-- CreateIndex
CREATE INDEX "cooling_tanks_farmId_idx" ON "cooling_tanks"("farmId");

-- CreateIndex
CREATE INDEX "tank_measurements_tankId_idx" ON "tank_measurements"("tankId");

-- CreateIndex
CREATE INDEX "tank_measurements_measureDate_idx" ON "tank_measurements"("measureDate");

-- CreateIndex
CREATE UNIQUE INDEX "tank_measurements_tankId_measureDate_key" ON "tank_measurements"("tankId", "measureDate");

-- CreateIndex
CREATE INDEX "milk_collections_organizationId_idx" ON "milk_collections"("organizationId");

-- CreateIndex
CREATE INDEX "milk_collections_farmId_idx" ON "milk_collections"("farmId");

-- CreateIndex
CREATE INDEX "milk_collections_collectionDate_idx" ON "milk_collections"("collectionDate");

-- AddForeignKey
ALTER TABLE "cooling_tanks" ADD CONSTRAINT "cooling_tanks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooling_tanks" ADD CONSTRAINT "cooling_tanks_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tank_measurements" ADD CONSTRAINT "tank_measurements_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "cooling_tanks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tank_measurements" ADD CONSTRAINT "tank_measurements_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_collections" ADD CONSTRAINT "milk_collections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_collections" ADD CONSTRAINT "milk_collections_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_collections" ADD CONSTRAINT "milk_collections_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "cooling_tanks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_collections" ADD CONSTRAINT "milk_collections_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS policies
ALTER TABLE "cooling_tanks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cooling_tanks_org_isolation" ON "cooling_tanks"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

ALTER TABLE "milk_collections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milk_collections_org_isolation" ON "milk_collections"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );
