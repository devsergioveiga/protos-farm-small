-- Migration: add_asset_hierarchy_renovation_wip
-- Adds wipBudget/wipBudgetAlertPct to assets table
-- Adds AssetRenovation, AssetWipStage, AssetWipContribution tables

-- 1. Add new enum
CREATE TYPE "AssetRenovationDecision" AS ENUM ('CAPITALIZAR', 'DESPESA');

-- 2. Add WIP budget fields to assets table
ALTER TABLE "assets"
  ADD COLUMN "wipBudget" DECIMAL(15, 2),
  ADD COLUMN "wipBudgetAlertPct" DECIMAL(5, 2);

-- 3. Create asset_renovations table
CREATE TABLE "asset_renovations" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "assetId"             TEXT NOT NULL,
  "description"         TEXT NOT NULL,
  "renovationDate"      TIMESTAMP(3) NOT NULL,
  "totalCost"           DECIMAL(15, 2) NOT NULL,
  "accountingDecision"  "AssetRenovationDecision" NOT NULL,
  "newUsefulLifeMonths" INTEGER,
  "notes"               TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_renovations_pkey" PRIMARY KEY ("id")
);

-- 4. Create asset_wip_stages table
CREATE TABLE "asset_wip_stages" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assetId"        TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "targetDate"     TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "notes"          TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_wip_stages_pkey" PRIMARY KEY ("id")
);

-- 5. Create asset_wip_contributions table
CREATE TABLE "asset_wip_contributions" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "assetId"          TEXT NOT NULL,
  "stageId"          TEXT,
  "contributionDate" TIMESTAMP(3) NOT NULL,
  "amount"           DECIMAL(15, 2) NOT NULL,
  "description"      TEXT NOT NULL,
  "supplierId"       TEXT,
  "invoiceRef"       TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "asset_wip_contributions_pkey" PRIMARY KEY ("id")
);

-- 6. Add indexes
CREATE INDEX "asset_renovations_assetId_idx" ON "asset_renovations"("assetId");
CREATE INDEX "asset_renovations_organizationId_idx" ON "asset_renovations"("organizationId");
CREATE INDEX "asset_wip_stages_assetId_idx" ON "asset_wip_stages"("assetId");
CREATE INDEX "asset_wip_contributions_assetId_idx" ON "asset_wip_contributions"("assetId");
CREATE INDEX "asset_wip_contributions_organizationId_idx" ON "asset_wip_contributions"("organizationId");

-- 7. Add foreign key constraints
ALTER TABLE "asset_renovations"
  ADD CONSTRAINT "asset_renovations_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_renovations"
  ADD CONSTRAINT "asset_renovations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_wip_stages"
  ADD CONSTRAINT "asset_wip_stages_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_wip_stages"
  ADD CONSTRAINT "asset_wip_stages_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_wip_contributions"
  ADD CONSTRAINT "asset_wip_contributions_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_wip_contributions"
  ADD CONSTRAINT "asset_wip_contributions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_wip_contributions"
  ADD CONSTRAINT "asset_wip_contributions_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "asset_wip_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
