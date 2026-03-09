-- CreateEnum
CREATE TYPE "CulturalOperationType" AS ENUM ('CAPINA_MANUAL', 'ROCAGEM_MECANICA', 'IRRIGACAO', 'PODA', 'DESBROTA', 'RALEIO', 'QUEBRA_VENTO');

-- CreateEnum
CREATE TYPE "PruningType" AS ENUM ('ESQUELETAMENTO', 'DECOTE', 'RECEPA');

-- CreateTable
CREATE TABLE "cultural_operations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "operationType" "CulturalOperationType" NOT NULL,
    "durationHours" DECIMAL(6,2),
    "machineName" TEXT,
    "laborCount" INTEGER,
    "laborHours" DECIMAL(6,2),
    "irrigationDepthMm" DECIMAL(8,2),
    "irrigationTimeMin" DECIMAL(8,2),
    "irrigationSystem" TEXT,
    "pruningType" "PruningType",
    "pruningPercentage" DECIMAL(5,2),
    "machineHourCost" DECIMAL(10,2),
    "laborHourCost" DECIMAL(10,2),
    "supplyCost" DECIMAL(10,2),
    "notes" TEXT,
    "photoUrl" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cultural_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cultural_operations_farmId_idx" ON "cultural_operations"("farmId");

-- CreateIndex
CREATE INDEX "cultural_operations_fieldPlotId_idx" ON "cultural_operations"("fieldPlotId");

-- CreateIndex
CREATE INDEX "cultural_operations_performedAt_idx" ON "cultural_operations"("performedAt");

-- CreateIndex
CREATE INDEX "cultural_operations_operationType_idx" ON "cultural_operations"("operationType");

-- AddForeignKey
ALTER TABLE "cultural_operations" ADD CONSTRAINT "cultural_operations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultural_operations" ADD CONSTRAINT "cultural_operations_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cultural_operations" ADD CONSTRAINT "cultural_operations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "cultural_operations" ENABLE ROW LEVEL SECURITY;
