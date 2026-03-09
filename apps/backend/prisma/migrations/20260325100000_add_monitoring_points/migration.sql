-- CreateTable
CREATE TABLE "monitoring_points" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoring_points_farmId_idx" ON "monitoring_points"("farmId");

-- CreateIndex
CREATE INDEX "monitoring_points_fieldPlotId_idx" ON "monitoring_points"("fieldPlotId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "monitoring_points_fieldPlotId_code_key" ON "monitoring_points"("fieldPlotId", "code");

-- AddForeignKey
ALTER TABLE "monitoring_points" ADD CONSTRAINT "monitoring_points_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_points" ADD CONSTRAINT "monitoring_points_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS Policy
ALTER TABLE "monitoring_points" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_points_farm_isolation" ON "monitoring_points"
  USING ("farmId" IN (SELECT id FROM farms WHERE "organizationId" = current_setting('app.current_org_id', true)));
