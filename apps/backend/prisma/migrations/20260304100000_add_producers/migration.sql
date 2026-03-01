-- ============================================================================
-- US-013: Cadastro de Produtor Rural (Entidade Fiscal)
-- ============================================================================
-- Cria enums, tabelas de produtores, participantes, inscricoes estaduais,
-- vinculos produtor-fazenda e documentos. Inclui RLS para todas as tabelas.
-- ============================================================================

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "ProducerType" AS ENUM ('PF', 'PJ', 'SOCIEDADE_EM_COMUM');
CREATE TYPE "ProducerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProducerFarmBondType" AS ENUM (
  'PROPRIETARIO', 'ARRENDATARIO', 'COMODATARIO',
  'PARCEIRO', 'MEEIRO', 'USUFRUTUARIO', 'CONDOMINO'
);
CREATE TYPE "TaxRegime" AS ENUM ('REAL', 'PRESUMIDO', 'SIMPLES', 'ISENTO');
CREATE TYPE "IeSituation" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "IeCategory" AS ENUM ('PRIMEIRO_ESTABELECIMENTO', 'DEMAIS', 'UNICO');

-- ─── Tabela producers ─────────────────────────────────────────────────────────

CREATE TABLE producers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL REFERENCES organizations(id),
  type "ProducerType" NOT NULL,
  name TEXT NOT NULL,
  "tradeName" TEXT,
  document TEXT,
  "birthDate" TIMESTAMP(3),
  "spouseCpf" TEXT,
  "incraRegistration" TEXT,
  "legalRepresentative" TEXT,
  "legalRepCpf" TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  "zipCode" TEXT,
  "taxRegime" "TaxRegime",
  "mainCnae" TEXT,
  "ruralActivityType" TEXT,
  status "ProducerStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_producers_organization_id ON producers("organizationId");
CREATE UNIQUE INDEX idx_producers_document_org ON producers(document, "organizationId")
  WHERE document IS NOT NULL;

-- ─── Tabela society_participants ──────────────────────────────────────────────

CREATE TABLE society_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "producerId" TEXT NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  "participationPct" DECIMAL(5,2) NOT NULL,
  "isMainResponsible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_society_participants_producer_id ON society_participants("producerId");
CREATE UNIQUE INDEX idx_society_participants_producer_cpf ON society_participants("producerId", cpf);

-- ─── Tabela producer_state_registrations (IEs) ───────────────────────────────

CREATE TABLE producer_state_registrations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "producerId" TEXT NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  "farmId" TEXT REFERENCES farms(id) ON DELETE SET NULL,
  "number" TEXT NOT NULL,
  state VARCHAR(2) NOT NULL,
  "cnaeActivity" TEXT,
  "assessmentRegime" TEXT,
  category "IeCategory",
  "inscriptionDate" TIMESTAMP(3),
  situation "IeSituation" NOT NULL DEFAULT 'ACTIVE',
  "contractEndDate" TIMESTAMP(3),
  "milkProgramOptIn" BOOLEAN NOT NULL DEFAULT false,
  "isDefaultForFarm" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_producer_state_registrations_producer_id ON producer_state_registrations("producerId");
CREATE INDEX idx_producer_state_registrations_farm_id ON producer_state_registrations("farmId");
CREATE UNIQUE INDEX idx_producer_ie_unique ON producer_state_registrations("producerId", "number", state);

-- ─── Tabela producer_farm_links ───────────────────────────────────────────────

CREATE TABLE producer_farm_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "producerId" TEXT NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "bondType" "ProducerFarmBondType" NOT NULL,
  "participationPct" DECIMAL(5,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_producer_farm_links_producer_id ON producer_farm_links("producerId");
CREATE INDEX idx_producer_farm_links_farm_id ON producer_farm_links("farmId");
CREATE UNIQUE INDEX idx_producer_farm_link_unique ON producer_farm_links("producerId", "farmId", "bondType");

-- ─── Tabela producer_documents (esqueleto) ────────────────────────────────────

CREATE TABLE producer_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "producerId" TEXT NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_producer_documents_producer_id ON producer_documents("producerId");

-- ─── RLS: producers ──────────────────────────────────────────────────────────

ALTER TABLE producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE producers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON producers
  USING (
    is_rls_bypassed()
    OR "organizationId" = current_org_id()
  );

-- ─── RLS: society_participants ───────────────────────────────────────────────

ALTER TABLE society_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_participants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON society_participants
  USING (
    is_rls_bypassed()
    OR "producerId" IN (
      SELECT id FROM producers WHERE "organizationId" = current_org_id()
    )
  );

-- ─── RLS: producer_state_registrations ───────────────────────────────────────

ALTER TABLE producer_state_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE producer_state_registrations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON producer_state_registrations
  USING (
    is_rls_bypassed()
    OR "producerId" IN (
      SELECT id FROM producers WHERE "organizationId" = current_org_id()
    )
  );

-- ─── RLS: producer_farm_links ────────────────────────────────────────────────

ALTER TABLE producer_farm_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE producer_farm_links FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON producer_farm_links
  USING (
    is_rls_bypassed()
    OR "producerId" IN (
      SELECT id FROM producers WHERE "organizationId" = current_org_id()
    )
  );

-- ─── RLS: producer_documents ─────────────────────────────────────────────────

ALTER TABLE producer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE producer_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON producer_documents
  USING (
    is_rls_bypassed()
    OR "producerId" IN (
      SELECT id FROM producers WHERE "organizationId" = current_org_id()
    )
  );
