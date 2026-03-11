-- US-083: Planting Operations (Registro de Plantio)

CREATE TABLE "planting_operations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "cultivarId" TEXT,
    "operationTypeId" TEXT,
    "seasonYear" TEXT NOT NULL,
    "seasonType" "SeasonType" NOT NULL DEFAULT 'SAFRA',
    "crop" TEXT NOT NULL,
    "plantingDate" DATE NOT NULL,
    "plantedAreaPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "populationPerM" DECIMAL(8,2),
    "rowSpacingCm" DECIMAL(6,2),
    "depthCm" DECIMAL(6,2),
    "seedRateKgHa" DECIMAL(8,2),
    "seedTreatments" JSONB DEFAULT '[]',
    "baseFertilizations" JSONB DEFAULT '[]',
    "machineName" TEXT,
    "operatorName" TEXT,
    "averageSpeedKmH" DECIMAL(6,2),
    "seedCost" DECIMAL(12,2),
    "fertilizerCost" DECIMAL(12,2),
    "treatmentCost" DECIMAL(12,2),
    "operationCost" DECIMAL(12,2),
    "notes" TEXT,
    "photoUrl" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "planting_operations_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_fieldPlotId_fkey"
    FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_cultivarId_fkey"
    FOREIGN KEY ("cultivarId") REFERENCES "cultivars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_operationTypeId_fkey"
    FOREIGN KEY ("operationTypeId") REFERENCES "operation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "planting_operations" ADD CONSTRAINT "planting_operations_recordedBy_fkey"
    FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "planting_operations_farmId_idx" ON "planting_operations"("farmId");
CREATE INDEX "planting_operations_fieldPlotId_idx" ON "planting_operations"("fieldPlotId");
CREATE INDEX "planting_operations_cultivarId_idx" ON "planting_operations"("cultivarId");
CREATE INDEX "planting_operations_plantingDate_idx" ON "planting_operations"("plantingDate");
CREATE INDEX "planting_operations_operationTypeId_idx" ON "planting_operations"("operationTypeId");

-- RLS
ALTER TABLE planting_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE planting_operations FORCE ROW LEVEL SECURITY;

CREATE POLICY planting_operations_org_isolation ON planting_operations
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
