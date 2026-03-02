-- ============================================================================
-- US-024: Histórico de uso do talhão
-- ============================================================================
-- 1. Enum SeasonType (SAFRA, SAFRINHA, INVERNO)
-- 2. Tabela plot_crop_seasons (safras por talhão)
-- 3. Tabela plot_soil_analyses (análises de solo)
-- 4. RLS para ambas as tabelas
-- ============================================================================

-- ─── Enum SeasonType ──────────────────────────────────────────────────

CREATE TYPE "SeasonType" AS ENUM ('SAFRA', 'SAFRINHA', 'INVERNO');

-- ─── Plot Crop Seasons ────────────────────────────────────────────────

CREATE TABLE plot_crop_seasons (
  id              TEXT        PRIMARY KEY,
  "plotId"        TEXT        NOT NULL REFERENCES field_plots(id) ON DELETE CASCADE,
  "farmId"        TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "seasonType"    "SeasonType" NOT NULL,
  "seasonYear"    TEXT        NOT NULL,
  crop            TEXT        NOT NULL,
  "varietyName"   TEXT,
  "startDate"     DATE,
  "endDate"       DATE,
  "plantedAreaHa" DECIMAL(12, 4),
  "productivityKgHa" DECIMAL(12, 2),
  "totalProductionKg" DECIMAL(14, 2),
  operations      JSONB       DEFAULT '[]',
  notes           TEXT,
  "createdBy"     TEXT        NOT NULL REFERENCES users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plot_crop_seasons_plot_id ON plot_crop_seasons ("plotId");
CREATE INDEX idx_plot_crop_seasons_farm_id ON plot_crop_seasons ("farmId");
CREATE INDEX idx_plot_crop_seasons_start_date ON plot_crop_seasons ("startDate");

-- ─── Plot Soil Analyses ──────────────────────────────────────────────

CREATE TABLE plot_soil_analyses (
  id              TEXT        PRIMARY KEY,
  "plotId"        TEXT        NOT NULL REFERENCES field_plots(id) ON DELETE CASCADE,
  "farmId"        TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "analysisDate"  DATE        NOT NULL,
  "labName"       TEXT,
  "sampleDepthCm" TEXT,
  "phH2o"         DECIMAL(4, 2),
  "organicMatterPct" DECIMAL(5, 2),
  "phosphorusMgDm3"  DECIMAL(8, 2),
  "potassiumMgDm3"   DECIMAL(8, 2),
  "calciumCmolcDm3"  DECIMAL(8, 2),
  "magnesiumCmolcDm3" DECIMAL(8, 2),
  "aluminumCmolcDm3"  DECIMAL(8, 2),
  "ctcCmolcDm3"       DECIMAL(8, 2),
  "baseSaturationPct"  DECIMAL(5, 2),
  "sulfurMgDm3"        DECIMAL(8, 2),
  "clayContentPct"     DECIMAL(5, 2),
  notes           TEXT,
  "createdBy"     TEXT        NOT NULL REFERENCES users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plot_soil_analyses_plot_id ON plot_soil_analyses ("plotId");
CREATE INDEX idx_plot_soil_analyses_farm_id ON plot_soil_analyses ("farmId");
CREATE INDEX idx_plot_soil_analyses_date ON plot_soil_analyses ("analysisDate");

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE plot_crop_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_crop_seasons FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON plot_crop_seasons
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );

ALTER TABLE plot_soil_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_soil_analyses FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON plot_soil_analyses
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
