-- ============================================================================
-- CAR Registrations: Cadastro Ambiental Rural como entidade independente
-- ============================================================================
-- 1. Enum CarStatus (ATIVO, PENDENTE, CANCELADO, SUSPENSO)
-- 2. Tabela car_registrations (dados do CAR completo)
-- 3. Tabela car_registration_links (M:N CAR ↔ Matrícula)
-- 4. RLS para ambas as tabelas
-- ============================================================================

-- ─── Enum CarStatus ──────────────────────────────────────────────────

CREATE TYPE "CarStatus" AS ENUM ('ATIVO', 'PENDENTE', 'CANCELADO', 'SUSPENSO');

-- ─── CAR Registrations ──────────────────────────────────────────────

CREATE TABLE car_registrations (
  id                          TEXT          PRIMARY KEY,
  "farmId"                    TEXT          NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "carCode"                   TEXT          NOT NULL,
  status                      "CarStatus"   NOT NULL DEFAULT 'ATIVO',
  "inscriptionDate"           DATE,
  "lastRectificationDate"     DATE,

  -- Dimensão
  "areaHa"                    DECIMAL(12, 4),
  "modulosFiscais"            DECIMAL(12, 4),
  city                        TEXT,
  state                       VARCHAR(2),

  -- Cobertura do solo
  "nativeVegetationHa"        DECIMAL(12, 4),
  "consolidatedAreaHa"        DECIMAL(12, 4),
  "administrativeEasementHa"  DECIMAL(12, 4),

  -- Reserva Legal
  "legalReserveRecordedHa"    DECIMAL(12, 4),
  "legalReserveApprovedHa"    DECIMAL(12, 4),
  "legalReserveProposedHa"    DECIMAL(12, 4),

  -- APP
  "appTotalHa"                DECIMAL(12, 4),
  "appConsolidatedHa"         DECIMAL(12, 4),
  "appNativeVegetationHa"     DECIMAL(12, 4),

  -- Uso restrito
  "restrictedUseHa"           DECIMAL(12, 4),

  -- Regularidade
  "legalReserveSurplusDeficit" DECIMAL(12, 4),
  "legalReserveToRestoreHa"   DECIMAL(12, 4),
  "appToRestoreHa"            DECIMAL(12, 4),
  "restrictedUseToRestoreHa"  DECIMAL(12, 4),

  -- Boundary (PostGIS)
  boundary                    geometry(Polygon, 4326),
  "boundaryAreaHa"            DECIMAL(12, 4),

  "createdAt"                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_car_registrations_farm_id ON car_registrations ("farmId");
CREATE INDEX idx_car_registrations_car_code ON car_registrations ("carCode");
CREATE INDEX idx_car_registrations_boundary ON car_registrations USING GIST (boundary);

-- ─── CAR Registration Links (M:N CAR ↔ Matrícula) ──────────────────

CREATE TABLE car_registration_links (
  id                      TEXT    PRIMARY KEY,
  "carRegistrationId"     TEXT    NOT NULL REFERENCES car_registrations(id) ON DELETE CASCADE,
  "farmRegistrationId"    TEXT    NOT NULL REFERENCES farm_registrations(id) ON DELETE CASCADE,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE ("carRegistrationId", "farmRegistrationId")
);

CREATE INDEX idx_car_registration_links_car ON car_registration_links ("carRegistrationId");
CREATE INDEX idx_car_registration_links_reg ON car_registration_links ("farmRegistrationId");

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE car_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_registrations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON car_registrations
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );

ALTER TABLE car_registration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_registration_links FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON car_registration_links
  USING (
    is_rls_bypassed()
    OR "carRegistrationId" IN (
      SELECT id FROM car_registrations WHERE "farmId" IN (
        SELECT id FROM farms WHERE "organizationId" = current_org_id()
      )
    )
  );
