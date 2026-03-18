-- CreateTable
CREATE TABLE "diets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCategory" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "nutritionist" TEXT,
    "objective" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalDmKgDay" DOUBLE PRECISION,
    "totalCpGDay" DOUBLE PRECISION,
    "cpPercentDm" DOUBLE PRECISION,
    "ndfPercentDm" DOUBLE PRECISION,
    "adfPercentDm" DOUBLE PRECISION,
    "eePercentDm" DOUBLE PRECISION,
    "tdnPercentDm" DOUBLE PRECISION,
    "nelMcalDay" DOUBLE PRECISION,
    "nelMcalKgDm" DOUBLE PRECISION,
    "caGDay" DOUBLE PRECISION,
    "pGDay" DOUBLE PRECISION,
    "roughageConcentrateRatio" DOUBLE PRECISION,
    "costPerAnimalDay" DOUBLE PRECISION,
    "costPerKgDm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_ingredients" (
    "id" TEXT NOT NULL,
    "dietId" TEXT NOT NULL,
    "feedIngredientId" TEXT NOT NULL,
    "quantityKgDay" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diet_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_lot_assignments" (
    "id" TEXT NOT NULL,
    "dietId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diet_lot_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diets_organizationId_idx" ON "diets"("organizationId");

-- CreateIndex
CREATE INDEX "diets_isActive_idx" ON "diets"("isActive");

-- CreateIndex
CREATE INDEX "diet_ingredients_dietId_idx" ON "diet_ingredients"("dietId");

-- CreateIndex
CREATE INDEX "diet_lot_assignments_dietId_idx" ON "diet_lot_assignments"("dietId");

-- CreateIndex
CREATE INDEX "diet_lot_assignments_lotId_idx" ON "diet_lot_assignments"("lotId");

-- AddForeignKey
ALTER TABLE "diets" ADD CONSTRAINT "diets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diets" ADD CONSTRAINT "diets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diets" ADD CONSTRAINT "diets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "diets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_ingredients" ADD CONSTRAINT "diet_ingredients_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "diets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_ingredients" ADD CONSTRAINT "diet_ingredients_feedIngredientId_fkey" FOREIGN KEY ("feedIngredientId") REFERENCES "feed_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_lot_assignments" ADD CONSTRAINT "diet_lot_assignments_dietId_fkey" FOREIGN KEY ("dietId") REFERENCES "diets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diet_lot_assignments" ADD CONSTRAINT "diet_lot_assignments_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "animal_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "diets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diet_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diet_lot_assignments" ENABLE ROW LEVEL SECURITY;

-- RLS policies for diets
CREATE POLICY "diets_org_isolation" ON "diets"
  USING (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

CREATE POLICY "diets_org_insert" ON "diets"
  FOR INSERT WITH CHECK (
    "organizationId" = current_setting('app.current_org_id', true)
    OR current_setting('app.bypass_rls', true) = 'true'
  );

-- RLS policies for diet_ingredients (join through diet)
CREATE POLICY "diet_ingredients_org_isolation" ON "diet_ingredients"
  USING (
    EXISTS (
      SELECT 1 FROM "diets" d WHERE d."id" = "diet_ingredients"."dietId"
        AND (d."organizationId" = current_setting('app.current_org_id', true)
             OR current_setting('app.bypass_rls', true) = 'true')
    )
  );

CREATE POLICY "diet_ingredients_org_insert" ON "diet_ingredients"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "diets" d WHERE d."id" = "diet_ingredients"."dietId"
        AND (d."organizationId" = current_setting('app.current_org_id', true)
             OR current_setting('app.bypass_rls', true) = 'true')
    )
  );

-- RLS policies for diet_lot_assignments (join through diet)
CREATE POLICY "diet_lot_assignments_org_isolation" ON "diet_lot_assignments"
  USING (
    EXISTS (
      SELECT 1 FROM "diets" d WHERE d."id" = "diet_lot_assignments"."dietId"
        AND (d."organizationId" = current_setting('app.current_org_id', true)
             OR current_setting('app.bypass_rls', true) = 'true')
    )
  );

CREATE POLICY "diet_lot_assignments_org_insert" ON "diet_lot_assignments"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "diets" d WHERE d."id" = "diet_lot_assignments"."dietId"
        AND (d."organizationId" = current_setting('app.current_org_id', true)
             OR current_setting('app.bypass_rls', true) = 'true')
    )
  );
