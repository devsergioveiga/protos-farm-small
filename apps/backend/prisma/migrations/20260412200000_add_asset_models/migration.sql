-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MAQUINA', 'VEICULO', 'IMPLEMENTO', 'BENFEITORIA', 'TERRA');

-- CreateEnum
CREATE TYPE "AssetClassification" AS ENUM ('DEPRECIABLE_CPC27', 'NON_DEPRECIABLE_CPC27', 'FAIR_VALUE_CPC29', 'BEARER_PLANT_CPC27');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ATIVO', 'INATIVO', 'EM_MANUTENCAO', 'ALIENADO', 'EM_ANDAMENTO');

-- CreateEnum
CREATE TYPE "AssetDocumentType" AS ENUM ('CRLV', 'SEGURO', 'REVISAO', 'CCIR', 'ITR', 'LAUDO', 'GARANTIA', 'OUTRO');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "classification" "AssetClassification" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ATIVO',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assetTag" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionValue" DECIMAL(15,2),
    "supplierId" TEXT,
    "invoiceNumber" TEXT,
    "costCenterId" TEXT,
    "costCenterMode" TEXT NOT NULL DEFAULT 'FIXED',
    "costCenterPercent" DECIMAL(5,2),
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "yearOfManufacture" INTEGER,
    "engineHp" DECIMAL(8,2),
    "fuelType" TEXT,
    "renavamCode" TEXT,
    "licensePlate" TEXT,
    "parentAssetId" TEXT,
    "constructionMaterial" TEXT,
    "areaM2" DECIMAL(12,2),
    "capacity" TEXT,
    "geoPoint" geometry(Point, 4326),
    "geoBoundary" geometry(Polygon, 4326),
    "registrationNumber" TEXT,
    "areaHa" DECIMAL(12,4),
    "carCode" TEXT,
    "currentHourmeter" DECIMAL(12,2),
    "currentOdometer" DECIMAL(12,2),
    "photoUrls" JSONB DEFAULT '[]',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fuelDate" TIMESTAMP(3) NOT NULL,
    "liters" DECIMAL(10,3) NOT NULL,
    "pricePerLiter" DECIMAL(10,4) NOT NULL,
    "totalCost" DECIMAL(15,2) NOT NULL,
    "hourmeterAtFuel" DECIMAL(12,2),
    "odometerAtFuel" DECIMAL(12,2),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "readingType" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "previousValue" DECIMAL(12,2),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentType" "AssetDocumentType" NOT NULL,
    "documentName" TEXT NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_organizationId_assetTag_key" ON "assets"("organizationId", "assetTag");

-- CreateIndex
CREATE INDEX "assets_organizationId_assetType_idx" ON "assets"("organizationId", "assetType");

-- CreateIndex
CREATE INDEX "assets_organizationId_status_idx" ON "assets"("organizationId", "status");

-- CreateIndex
CREATE INDEX "assets_farmId_idx" ON "assets"("farmId");

-- CreateIndex
CREATE INDEX "fuel_records_assetId_idx" ON "fuel_records"("assetId");

-- CreateIndex
CREATE INDEX "fuel_records_organizationId_fuelDate_idx" ON "fuel_records"("organizationId", "fuelDate");

-- CreateIndex
CREATE INDEX "meter_readings_assetId_readingType_idx" ON "meter_readings"("assetId", "readingType");

-- CreateIndex
CREATE INDEX "asset_documents_assetId_idx" ON "asset_documents"("assetId");

-- CreateIndex
CREATE INDEX "asset_documents_organizationId_expiresAt_idx" ON "asset_documents"("organizationId", "expiresAt");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_documents" ADD CONSTRAINT "asset_documents_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
