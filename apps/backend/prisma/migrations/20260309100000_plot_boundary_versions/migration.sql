-- ============================================================================
-- US-022: Edição de geometria do talhão
-- ============================================================================
-- 1. Tabela field_plot_boundary_versions para histórico de alterações
-- 2. RLS para a nova tabela
-- ============================================================================

-- ─── Boundary Versions ─────────────────────────────────────────────────

CREATE TABLE field_plot_boundary_versions (
  id            TEXT        PRIMARY KEY,
  "plotId"      TEXT        NOT NULL REFERENCES field_plots(id) ON DELETE CASCADE,
  "farmId"      TEXT        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  boundary      geometry(Polygon, 4326) NOT NULL,
  "boundaryAreaHa" DECIMAL(12, 4) NOT NULL,
  "editedBy"    TEXT        NOT NULL REFERENCES users(id),
  "editedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "editSource"  TEXT        NOT NULL DEFAULT 'file_upload',
  version       INTEGER     NOT NULL DEFAULT 1
);

CREATE INDEX idx_field_plot_boundary_versions_plot_id ON field_plot_boundary_versions ("plotId");
CREATE INDEX idx_field_plot_boundary_versions_farm_id ON field_plot_boundary_versions ("farmId");

-- ─── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE field_plot_boundary_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_plot_boundary_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON field_plot_boundary_versions
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
