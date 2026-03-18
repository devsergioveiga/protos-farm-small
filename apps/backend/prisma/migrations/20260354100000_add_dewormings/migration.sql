-- CreateTable
CREATE TABLE "dewormings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "chemicalGroup" TEXT,
    "dosageMl" DOUBLE PRECISION NOT NULL,
    "administrationRoute" "AdministrationRoute" NOT NULL,
    "productBatchNumber" TEXT,
    "productExpiryDate" DATE,
    "dewormingDate" DATE NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "veterinaryName" TEXT,
    "protocolItemId" TEXT,
    "campaignId" TEXT,
    "opgPre" INTEGER,
    "opgPost" INTEGER,
    "opgPostDate" DATE,
    "efficacyPercentage" DOUBLE PRECISION,
    "withdrawalMeatDays" INTEGER,
    "withdrawalMilkDays" INTEGER,
    "withdrawalEndDate" DATE,
    "nextDewormingDate" DATE,
    "stockOutputId" TEXT,
    "animalLotId" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dewormings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dewormings_organizationId_idx" ON "dewormings"("organizationId");
CREATE INDEX "dewormings_farmId_idx" ON "dewormings"("farmId");
CREATE INDEX "dewormings_animalId_idx" ON "dewormings"("animalId");
CREATE INDEX "dewormings_productId_idx" ON "dewormings"("productId");
CREATE INDEX "dewormings_dewormingDate_idx" ON "dewormings"("dewormingDate");
CREATE INDEX "dewormings_campaignId_idx" ON "dewormings"("campaignId");
CREATE INDEX "dewormings_protocolItemId_idx" ON "dewormings"("protocolItemId");
CREATE INDEX "dewormings_animalId_chemicalGroup_idx" ON "dewormings"("animalId", "chemicalGroup");

-- AddForeignKey
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_protocolItemId_fkey" FOREIGN KEY ("protocolItemId") REFERENCES "sanitary_protocol_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_stockOutputId_fkey" FOREIGN KEY ("stockOutputId") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "dewormings" ADD CONSTRAINT "dewormings_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
