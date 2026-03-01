-- ============================================================================
-- US-014: Vinculacao Produtor-Fazenda-Matricula e Condominio
-- ============================================================================
-- Adiciona campos de vigencia/ITR em producer_farm_links, cria tabela
-- producer_registration_links e aplica RLS.
-- ============================================================================

-- ─── Alteracoes em producer_farm_links ──────────────────────────────────────

ALTER TABLE producer_farm_links
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3),
  ADD COLUMN "isItrDeclarant" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_producer_farm_links_end_date ON producer_farm_links("endDate");

-- ─── Nova tabela producer_registration_links ────────────────────────────────

CREATE TABLE producer_registration_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "farmLinkId" TEXT NOT NULL REFERENCES producer_farm_links(id) ON DELETE CASCADE,
  "farmRegistrationId" TEXT NOT NULL REFERENCES farm_registrations(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_producer_registration_link_unique
  ON producer_registration_links("farmLinkId", "farmRegistrationId");

CREATE INDEX idx_producer_registration_links_farm_link_id
  ON producer_registration_links("farmLinkId");

CREATE INDEX idx_producer_registration_links_farm_registration_id
  ON producer_registration_links("farmRegistrationId");

-- ─── RLS: producer_registration_links ───────────────────────────────────────

ALTER TABLE producer_registration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE producer_registration_links FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON producer_registration_links
  USING (
    is_rls_bypassed()
    OR "farmLinkId" IN (
      SELECT pfl.id FROM producer_farm_links pfl
      JOIN producers p ON pfl."producerId" = p.id
      WHERE p."organizationId" = current_org_id()
    )
  );
