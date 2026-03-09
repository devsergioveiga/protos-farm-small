-- CreateEnum
CREATE TYPE "InfestationLevel" AS ENUM ('AUSENTE', 'BAIXO', 'MODERADO', 'ALTO', 'CRITICO');

-- CreateTable
CREATE TABLE "monitoring_records" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "monitoringPointId" TEXT NOT NULL,
    "pestId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "infestationLevel" "InfestationLevel" NOT NULL,
    "sampleCount" INTEGER,
    "pestCount" INTEGER,
    "growthStage" TEXT,
    "hasNaturalEnemies" BOOLEAN NOT NULL DEFAULT false,
    "naturalEnemiesDesc" TEXT,
    "damagePercentage" DECIMAL(5,2),
    "photoUrl" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoring_records_farmId_idx" ON "monitoring_records"("farmId");

-- CreateIndex
CREATE INDEX "monitoring_records_fieldPlotId_idx" ON "monitoring_records"("fieldPlotId");

-- CreateIndex
CREATE INDEX "monitoring_records_monitoringPointId_idx" ON "monitoring_records"("monitoringPointId");

-- CreateIndex
CREATE INDEX "monitoring_records_pestId_idx" ON "monitoring_records"("pestId");

-- CreateIndex
CREATE INDEX "monitoring_records_observedAt_idx" ON "monitoring_records"("observedAt");

-- AddForeignKey
ALTER TABLE "monitoring_records" ADD CONSTRAINT "monitoring_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_records" ADD CONSTRAINT "monitoring_records_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_records" ADD CONSTRAINT "monitoring_records_monitoringPointId_fkey" FOREIGN KEY ("monitoringPointId") REFERENCES "monitoring_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_records" ADD CONSTRAINT "monitoring_records_pestId_fkey" FOREIGN KEY ("pestId") REFERENCES "pests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
