-- ============================================================================
-- US-012: Cadastro de Fazenda com Multiplas Matriculas
-- ============================================================================
-- Adiciona campos detalhados ao farms, cria tabela de matriculas (farm_registrations)
-- e esqueleto de documentos (farm_documents). Inclui RLS para novas tabelas.
-- ============================================================================

-- ─── Novos campos em farms ──────────────────────────────────────────────────

ALTER TABLE farms ADD COLUMN IF NOT EXISTS "ccirCode" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "landClassification" TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "productive" BOOLEAN;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "fiscalModuleHa" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "fiscalModulesCount" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "minPartitionFraction" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "appAreaHa" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "legalReserveHa" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "taxableAreaHa" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "usableAreaHa" DECIMAL(12,4);
ALTER TABLE farms ADD COLUMN IF NOT EXISTS "utilizationDegree" DECIMAL(5,2);

-- ─── Tabela farm_registrations (matriculas de cartorio) ─────────────────────

CREATE TABLE farm_registrations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "number" TEXT NOT NULL,
  "cnsCode" TEXT,
  "cartorioName" TEXT NOT NULL,
  comarca TEXT NOT NULL,
  state VARCHAR(2) NOT NULL,
  livro TEXT,
  "registrationDate" TIMESTAMP(3),
  "areaHa" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_farm_registrations_farm_id ON farm_registrations("farmId");

-- ─── Tabela farm_documents (esqueleto para CA10 futuro) ─────────────────────

CREATE TABLE farm_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_farm_documents_farm_id ON farm_documents("farmId");

-- ─── RLS para farm_registrations ────────────────────────────────────────────

ALTER TABLE farm_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_registrations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON farm_registrations
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );

-- ─── RLS para farm_documents ────────────────────────────────────────────────

ALTER TABLE farm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON farm_documents
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
