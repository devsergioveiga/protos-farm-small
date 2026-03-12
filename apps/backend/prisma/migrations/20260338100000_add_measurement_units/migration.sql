-- CreateEnum
CREATE TYPE "UnitCategory" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT', 'AREA');

-- CreateTable
CREATE TABLE "measurement_units" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "category" "UnitCategory" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "factor" DECIMAL(20,10) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurement_units_organizationId_idx" ON "measurement_units"("organizationId");
CREATE INDEX "measurement_units_category_idx" ON "measurement_units"("category");
CREATE UNIQUE INDEX "measurement_units_organizationId_abbreviation_key" ON "measurement_units"("organizationId", "abbreviation");

-- CreateIndex
CREATE INDEX "unit_conversions_organizationId_idx" ON "unit_conversions"("organizationId");
CREATE INDEX "unit_conversions_fromUnitId_idx" ON "unit_conversions"("fromUnitId");
CREATE INDEX "unit_conversions_toUnitId_idx" ON "unit_conversions"("toUnitId");
CREATE UNIQUE INDEX "unit_conversions_organizationId_fromUnitId_toUnitId_key" ON "unit_conversions"("organizationId", "fromUnitId", "toUnitId");

-- AddForeignKey
ALTER TABLE "measurement_units" ADD CONSTRAINT "measurement_units_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "measurement_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "measurement_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS policies
ALTER TABLE "measurement_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unit_conversions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_measurement_units ON "measurement_units"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

CREATE POLICY rls_unit_conversions ON "unit_conversions"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );
