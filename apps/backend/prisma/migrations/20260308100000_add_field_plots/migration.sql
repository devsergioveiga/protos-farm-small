-- Enum para tipo de solo
CREATE TYPE "SoilType" AS ENUM (
  'LATOSSOLO_VERMELHO', 'LATOSSOLO_AMARELO', 'ARGISSOLO', 'NEOSSOLO',
  'CAMBISSOLO', 'GLEISSOLO', 'PLANOSSOLO', 'NITOSSOLO', 'OUTRO'
);

-- Tabela de talhões
CREATE TABLE field_plots (
  id                TEXT PRIMARY KEY,
  "farmId"          TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "registrationId"  TEXT REFERENCES farm_registrations(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  code              TEXT,
  "soilType"        "SoilType",
  "currentCrop"     TEXT,
  "previousCrop"    TEXT,
  notes             TEXT,
  boundary          geometry(Polygon, 4326) NOT NULL,
  "boundaryAreaHa"  DECIMAL(12, 4) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ACTIVE',
  "deletedAt"       TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_field_plots_farm_id ON field_plots ("farmId");
CREATE INDEX idx_field_plots_registration_id ON field_plots ("registrationId");
CREATE INDEX idx_field_plots_boundary ON field_plots USING GIST (boundary);
CREATE INDEX idx_field_plots_deleted_at ON field_plots ("deletedAt");

-- RLS (mesma pattern de farm_boundary_versions)
ALTER TABLE field_plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_plots FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON field_plots
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
