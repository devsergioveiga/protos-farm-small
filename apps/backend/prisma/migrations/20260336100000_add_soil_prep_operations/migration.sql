-- CreateTable
CREATE TABLE "soil_prep_operations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "operationTypeId" TEXT,
    "operationTypeName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "machineName" TEXT,
    "implementName" TEXT,
    "operatorName" TEXT,
    "depthCm" DECIMAL(6,2),
    "inputs" JSONB DEFAULT '[]',
    "soilMoisturePercent" DECIMAL(5,2),
    "weatherCondition" TEXT,
    "durationHours" DECIMAL(6,2),
    "machineCostPerHour" DECIMAL(10,2),
    "laborCount" INTEGER,
    "laborHourCost" DECIMAL(10,2),
    "inputsCost" DECIMAL(10,2),
    "notes" TEXT,
    "photoUrl" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soil_prep_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "soil_prep_operations_farmId_idx" ON "soil_prep_operations"("farmId");

-- CreateIndex
CREATE INDEX "soil_prep_operations_fieldPlotId_idx" ON "soil_prep_operations"("fieldPlotId");

-- CreateIndex
CREATE INDEX "soil_prep_operations_startedAt_idx" ON "soil_prep_operations"("startedAt");

-- CreateIndex
CREATE INDEX "soil_prep_operations_operationTypeId_idx" ON "soil_prep_operations"("operationTypeId");

-- AddForeignKey
ALTER TABLE "soil_prep_operations" ADD CONSTRAINT "soil_prep_operations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_prep_operations" ADD CONSTRAINT "soil_prep_operations_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_prep_operations" ADD CONSTRAINT "soil_prep_operations_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "operation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_prep_operations" ADD CONSTRAINT "soil_prep_operations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
