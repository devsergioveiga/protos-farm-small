-- US-099 CA1+CA2+CA3: Grain discount tables and classification

-- Grain discount tables (moisture, impurity, damaged)
CREATE TABLE "grain_discount_tables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "thresholdPct" DECIMAL(5,2) NOT NULL,
    "discountPctPerPoint" DECIMAL(5,4) NOT NULL,
    "maxPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grain_discount_tables_pkey" PRIMARY KEY ("id")
);

-- Grain classification types
CREATE TABLE "grain_classifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "gradeType" TEXT NOT NULL,
    "maxMoisturePct" DECIMAL(5,2) NOT NULL,
    "maxImpurityPct" DECIMAL(5,2) NOT NULL,
    "maxDamagedPct" DECIMAL(5,2) NOT NULL,
    "maxBrokenPct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grain_classifications_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "grain_discount_tables_organizationId_idx" ON "grain_discount_tables"("organizationId");
CREATE UNIQUE INDEX "grain_discount_tables_organizationId_crop_discountType_key" ON "grain_discount_tables"("organizationId", "crop", "discountType");

CREATE INDEX "grain_classifications_organizationId_idx" ON "grain_classifications"("organizationId");
CREATE UNIQUE INDEX "grain_classifications_organizationId_crop_gradeType_key" ON "grain_classifications"("organizationId", "crop", "gradeType");

-- Foreign keys
ALTER TABLE "grain_discount_tables" ADD CONSTRAINT "grain_discount_tables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grain_classifications" ADD CONSTRAINT "grain_classifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
