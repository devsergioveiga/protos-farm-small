-- ============================================================================
-- US-018: Edição e Exclusão de Fazenda
-- ============================================================================
-- 1. Soft delete: campo deletedAt em farms
-- 2. Boundary versioning: tabela farm_boundary_versions
-- 3. RLS para a nova tabela
-- ============================================================================

-- ─── Soft Delete ────────────────────────────────────────────────────────────

ALTER TABLE farms ADD COLUMN "deletedAt" TIMESTAMPTZ;

CREATE INDEX idx_farms_deleted_at ON farms ("deletedAt");

-- ─── Boundary Versions ─────────────────────────────────────────────────────

CREATE TABLE farm_boundary_versions (
  id            TEXT        PRIMARY KEY,
  "farmId"      TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "registrationId" TEXT     REFERENCES farm_registrations(id) ON DELETE CASCADE,
  boundary      geometry(Polygon, 4326) NOT NULL,
  "boundaryAreaHa" DECIMAL(12, 4) NOT NULL,
  "uploadedBy"  TEXT        NOT NULL REFERENCES users(id),
  "uploadedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  filename      TEXT,
  version       INTEGER     NOT NULL DEFAULT 1
);

CREATE INDEX idx_farm_boundary_versions_farm_id ON farm_boundary_versions ("farmId");
CREATE INDEX idx_farm_boundary_versions_registration_id ON farm_boundary_versions ("registrationId");

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE farm_boundary_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_boundary_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON farm_boundary_versions
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
