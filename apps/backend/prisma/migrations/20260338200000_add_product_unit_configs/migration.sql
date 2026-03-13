-- CreateTable: product_unit_configs (CA3/CA4)
CREATE TABLE "product_unit_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseUnitId" TEXT,
    "stockUnitId" TEXT,
    "applicationUnitId" TEXT,
    "densityGPerMl" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_unit_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: product_conversions (CA3)
CREATE TABLE "product_conversions" (
    "id" TEXT NOT NULL,
    "productUnitConfigId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "factor" DECIMAL(20,10) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_conversions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "product_unit_configs_organizationId_idx" ON "product_unit_configs"("organizationId");
CREATE INDEX "product_unit_configs_productId_idx" ON "product_unit_configs"("productId");
CREATE UNIQUE INDEX "product_unit_configs_organizationId_productId_key" ON "product_unit_configs"("organizationId", "productId");

CREATE INDEX "product_conversions_productUnitConfigId_idx" ON "product_conversions"("productUnitConfigId");
CREATE UNIQUE INDEX "product_conversions_productUnitConfigId_fromUnitId_toUnitId_key" ON "product_conversions"("productUnitConfigId", "fromUnitId", "toUnitId");

-- Foreign keys
ALTER TABLE "product_unit_configs" ADD CONSTRAINT "product_unit_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_unit_configs" ADD CONSTRAINT "product_unit_configs_purchaseUnitId_fkey" FOREIGN KEY ("purchaseUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_unit_configs" ADD CONSTRAINT "product_unit_configs_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_unit_configs" ADD CONSTRAINT "product_unit_configs_applicationUnitId_fkey" FOREIGN KEY ("applicationUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "product_conversions" ADD CONSTRAINT "product_conversions_productUnitConfigId_fkey" FOREIGN KEY ("productUnitConfigId") REFERENCES "product_unit_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_conversions" ADD CONSTRAINT "product_conversions_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "measurement_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_conversions" ADD CONSTRAINT "product_conversions_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "measurement_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "product_unit_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_conversions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_product_unit_configs ON "product_unit_configs"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- product_conversions inherits access via product_unit_configs (CASCADE)
-- but we add a policy for direct queries
CREATE POLICY rls_product_conversions ON "product_conversions"
  USING (
    "productUnitConfigId" IN (
      SELECT "id" FROM "product_unit_configs"
      WHERE "organizationId" = current_setting('app.current_org_id', true)
    )
    OR current_setting('app.bypass_rls', true) = 'true'
  );
