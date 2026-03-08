-- CreateEnum
CREATE TYPE "FieldOperationType" AS ENUM ('PULVERIZACAO', 'ADUBACAO', 'PLANTIO', 'COLHEITA', 'IRRIGACAO', 'MANEJO_PASTO', 'VACINACAO', 'VERMIFUGACAO', 'INSEMINACAO', 'MOVIMENTACAO', 'PESAGEM', 'OUTRO');

-- CreateEnum
CREATE TYPE "FieldOperationLocationType" AS ENUM ('PLOT', 'PASTURE', 'FACILITY');

-- CreateTable
CREATE TABLE "field_operations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "locationId" TEXT,
    "locationType" "FieldOperationLocationType",
    "locationName" TEXT,
    "operationType" "FieldOperationType" NOT NULL,
    "notes" TEXT,
    "photoUri" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_operations_farmId_idx" ON "field_operations"("farmId");
CREATE INDEX "field_operations_recordedAt_idx" ON "field_operations"("recordedAt");
CREATE INDEX "field_operations_operationType_idx" ON "field_operations"("operationType");

-- AddForeignKey
ALTER TABLE "field_operations" ADD CONSTRAINT "field_operations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_operations" ADD CONSTRAINT "field_operations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
