-- CreateEnum
CREATE TYPE "PropertyDocumentType" AS ENUM ('CAFIR', 'CCIR', 'CNIR', 'DITR', 'CAR_RECEIPT', 'MATRICULA', 'OTHER');
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'EXTRACTED', 'FAILED', 'MANUAL');
CREATE TYPE "OwnerType" AS ENUM ('PROPRIETARIO', 'USUFRUTUARIO', 'POSSUIDOR', 'CESSIONARIO', 'HERDEIRO', 'CONDOMINO');

-- CreateTable: rural_properties
CREATE TABLE "rural_properties" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "farmId" TEXT NOT NULL,
    "denomination" TEXT NOT NULL,
    "cib" TEXT,
    "incraCode" TEXT,
    "ccirCode" TEXT,
    "ccirValidUntil" DATE,
    "carCode" TEXT,
    "totalAreaHa" DECIMAL(12,4),
    "landClassification" TEXT,
    "productive" BOOLEAN,
    "fiscalModuleHa" DECIMAL(12,4),
    "fiscalModulesCount" DECIMAL(12,4),
    "minPartitionFraction" DECIMAL(12,4),
    "vtnPerHa" DECIMAL(12,2),
    "appAreaHa" DECIMAL(12,4),
    "legalReserveHa" DECIMAL(12,4),
    "taxableAreaHa" DECIMAL(12,4),
    "usableAreaHa" DECIMAL(12,4),
    "utilizationDegree" DECIMAL(5,2),
    "municipality" TEXT,
    "state" VARCHAR(2),
    "location" geometry(Point, 4326),
    "boundary" geometry(Polygon, 4326),
    "boundaryAreaHa" DECIMAL(12,4),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rural_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable: property_owners
CREATE TABLE "property_owners" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "ruralPropertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "documentType" TEXT,
    "fractionPct" DECIMAL(5,2),
    "ownerType" "OwnerType" NOT NULL DEFAULT 'PROPRIETARIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable: property_documents
CREATE TABLE "property_documents" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "ruralPropertyId" TEXT NOT NULL,
    "type" "PropertyDocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "fileData" BYTEA,
    "extractedData" JSONB,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- Add nullable ruralPropertyId to existing tables
ALTER TABLE "farm_registrations" ADD COLUMN "ruralPropertyId" TEXT;
ALTER TABLE "farm_boundary_versions" ADD COLUMN "ruralPropertyId" TEXT;
ALTER TABLE "field_plots" ADD COLUMN "ruralPropertyId" TEXT;
ALTER TABLE "car_registrations" ADD COLUMN "ruralPropertyId" TEXT;

-- CreateIndexes
CREATE INDEX "rural_properties_farmId_idx" ON "rural_properties"("farmId");
CREATE INDEX "property_owners_ruralPropertyId_idx" ON "property_owners"("ruralPropertyId");
CREATE INDEX "property_documents_ruralPropertyId_idx" ON "property_documents"("ruralPropertyId");
CREATE INDEX "property_documents_type_idx" ON "property_documents"("type");
CREATE INDEX "farm_registrations_ruralPropertyId_idx" ON "farm_registrations"("ruralPropertyId");
CREATE INDEX "farm_boundary_versions_ruralPropertyId_idx" ON "farm_boundary_versions"("ruralPropertyId");
CREATE INDEX "field_plots_ruralPropertyId_idx" ON "field_plots"("ruralPropertyId");
CREATE INDEX "car_registrations_ruralPropertyId_idx" ON "car_registrations"("ruralPropertyId");

-- AddForeignKey
ALTER TABLE "rural_properties" ADD CONSTRAINT "rural_properties_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_ruralPropertyId_fkey" FOREIGN KEY ("ruralPropertyId") REFERENCES "rural_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_ruralPropertyId_fkey" FOREIGN KEY ("ruralPropertyId") REFERENCES "rural_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "farm_registrations" ADD CONSTRAINT "farm_registrations_ruralPropertyId_fkey" FOREIGN KEY ("ruralPropertyId") REFERENCES "rural_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "farm_boundary_versions" ADD CONSTRAINT "farm_boundary_versions_ruralPropertyId_fkey" FOREIGN KEY ("ruralPropertyId") REFERENCES "rural_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_plots" ADD CONSTRAINT "field_plots_ruralPropertyId_fkey" FOREIGN KEY ("ruralPropertyId") REFERENCES "rural_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "car_registrations" ADD CONSTRAINT "car_registrations_ruralPropertyId_fkey" FOREIGN KEY ("ruralPropertyId") REFERENCES "rural_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: create RuralProperty for each Farm that has fundiário data
INSERT INTO "rural_properties" ("id", "farmId", "denomination", "cib", "incraCode", "ccirCode", "carCode",
    "totalAreaHa", "landClassification", "productive", "fiscalModuleHa", "fiscalModulesCount",
    "minPartitionFraction", "appAreaHa", "legalReserveHa", "taxableAreaHa", "usableAreaHa",
    "utilizationDegree", "municipality", "state", "boundaryAreaHa", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    f."id",
    f."name",
    f."cib",
    f."incraCode",
    f."ccirCode",
    f."carCode",
    f."totalAreaHa",
    f."landClassification",
    f."productive",
    f."fiscalModuleHa",
    f."fiscalModulesCount",
    f."minPartitionFraction",
    f."appAreaHa",
    f."legalReserveHa",
    f."taxableAreaHa",
    f."usableAreaHa",
    f."utilizationDegree",
    f."city",
    f."state",
    f."boundaryAreaHa",
    f."createdAt",
    NOW()
FROM "farms" f
WHERE f."deletedAt" IS NULL;

-- Link existing farm_registrations to their RuralProperty
UPDATE "farm_registrations" fr
SET "ruralPropertyId" = rp."id"
FROM "rural_properties" rp
WHERE rp."farmId" = fr."farmId";

-- Link existing field_plots to their RuralProperty
UPDATE "field_plots" fp
SET "ruralPropertyId" = rp."id"
FROM "rural_properties" rp
WHERE rp."farmId" = fp."farmId";

-- Link existing car_registrations to their RuralProperty
UPDATE "car_registrations" cr
SET "ruralPropertyId" = rp."id"
FROM "rural_properties" rp
WHERE rp."farmId" = cr."farmId";

-- Copy farm boundary to RuralProperty boundary
UPDATE "rural_properties" rp
SET "boundary" = f."boundary",
    "location" = f."location"
FROM "farms" f
WHERE rp."farmId" = f."id"
AND f."boundary" IS NOT NULL;
