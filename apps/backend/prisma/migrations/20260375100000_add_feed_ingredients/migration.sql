-- CreateEnum
CREATE TYPE "FeedIngredientType" AS ENUM ('ROUGHAGE', 'CONCENTRATE', 'MINERAL', 'ADDITIVE', 'BYPRODUCT');

-- CreateTable
CREATE TABLE "feed_ingredients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FeedIngredientType" NOT NULL,
    "subtype" TEXT,
    "measurementUnit" TEXT NOT NULL DEFAULT 'kg',
    "costPerKg" DOUBLE PRECISION,
    "refDmPercent" DOUBLE PRECISION,
    "refCpPercent" DOUBLE PRECISION,
    "refNdfPercent" DOUBLE PRECISION,
    "refAdfPercent" DOUBLE PRECISION,
    "refEePercent" DOUBLE PRECISION,
    "refMmPercent" DOUBLE PRECISION,
    "refTdnPercent" DOUBLE PRECISION,
    "refNelMcalKg" DOUBLE PRECISION,
    "refNfcPercent" DOUBLE PRECISION,
    "refCaPercent" DOUBLE PRECISION,
    "refPPercent" DOUBLE PRECISION,
    "refMgPercent" DOUBLE PRECISION,
    "refKPercent" DOUBLE PRECISION,
    "refNaPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bromatological_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "feedIngredientId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "collectionDate" DATE NOT NULL,
    "resultDate" DATE,
    "laboratory" TEXT,
    "protocolNumber" TEXT,
    "responsibleName" TEXT NOT NULL,
    "dmPercent" DOUBLE PRECISION,
    "cpPercent" DOUBLE PRECISION,
    "ndfPercent" DOUBLE PRECISION,
    "adfPercent" DOUBLE PRECISION,
    "eePercent" DOUBLE PRECISION,
    "mmPercent" DOUBLE PRECISION,
    "tdnPercent" DOUBLE PRECISION,
    "nelMcalKg" DOUBLE PRECISION,
    "nfcPercent" DOUBLE PRECISION,
    "caPercent" DOUBLE PRECISION,
    "pPercent" DOUBLE PRECISION,
    "mgPercent" DOUBLE PRECISION,
    "kPercent" DOUBLE PRECISION,
    "naPercent" DOUBLE PRECISION,
    "reportFileName" TEXT,
    "reportPath" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bromatological_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feed_ingredients_organizationId_name_key" ON "feed_ingredients"("organizationId", "name");

-- CreateIndex
CREATE INDEX "feed_ingredients_organizationId_idx" ON "feed_ingredients"("organizationId");

-- CreateIndex
CREATE INDEX "feed_ingredients_type_idx" ON "feed_ingredients"("type");

-- CreateIndex
CREATE INDEX "bromatological_analyses_organizationId_idx" ON "bromatological_analyses"("organizationId");

-- CreateIndex
CREATE INDEX "bromatological_analyses_feedIngredientId_idx" ON "bromatological_analyses"("feedIngredientId");

-- CreateIndex
CREATE INDEX "bromatological_analyses_collectionDate_idx" ON "bromatological_analyses"("collectionDate");

-- AddForeignKey
ALTER TABLE "feed_ingredients" ADD CONSTRAINT "feed_ingredients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bromatological_analyses" ADD CONSTRAINT "bromatological_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bromatological_analyses" ADD CONSTRAINT "bromatological_analyses_feedIngredientId_fkey" FOREIGN KEY ("feedIngredientId") REFERENCES "feed_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bromatological_analyses" ADD CONSTRAINT "bromatological_analyses_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "feed_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bromatological_analyses" ENABLE ROW LEVEL SECURITY;

-- RLS policies for feed_ingredients
CREATE POLICY "feed_ingredients_org_isolation" ON "feed_ingredients"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

CREATE POLICY "feed_ingredients_org_insert" ON "feed_ingredients"
  FOR INSERT WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- RLS policies for bromatological_analyses
CREATE POLICY "bromatological_analyses_org_isolation" ON "bromatological_analyses"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

CREATE POLICY "bromatological_analyses_org_insert" ON "bromatological_analyses"
  FOR INSERT WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );
