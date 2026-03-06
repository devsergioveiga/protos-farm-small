-- US-028: Cadastro de Pastos e Instalações
-- 1. Enums: FarmLocationType, PastureStatus, FacilityStatus, ForageType, FacilityType
-- 2. Tabela farm_locations (pastos e instalações georreferenciados)
-- 3. FK animal_lots.locationId → farm_locations.id
-- 4. FK constraint animals.pastureId → farm_locations.id
-- 5. RLS para nova tabela

-- ─── Enums ─────────────────────────────────────────────────────────────

CREATE TYPE "FarmLocationType" AS ENUM (
  'PASTURE',
  'FACILITY'
);

CREATE TYPE "PastureStatus" AS ENUM (
  'EM_USO',
  'DESCANSO',
  'REFORMANDO'
);

CREATE TYPE "FacilityStatus" AS ENUM (
  'ATIVO',
  'MANUTENCAO',
  'INATIVO'
);

CREATE TYPE "ForageType" AS ENUM (
  'BRACHIARIA_BRIZANTHA',
  'BRACHIARIA_DECUMBENS',
  'BRACHIARIA_HUMIDICOLA',
  'PANICUM_MAXIMUM',
  'PANICUM_MOMBASA',
  'PANICUM_TANZANIA',
  'CYNODON_TIFTON',
  'CYNODON_COASTCROSS',
  'PENNISETUM_NAPIER',
  'ANDROPOGON',
  'ESTILOSANTES',
  'OUTRO'
);

CREATE TYPE "FacilityType" AS ENUM (
  'GALPAO',
  'BEZERREIRO',
  'CURRAL',
  'BAIA',
  'SALA_ORDENHA',
  'ESTABULO',
  'CONFINAMENTO',
  'OUTRO'
);

-- ─── farm_locations ───────────────────────────────────────────────────

CREATE TABLE farm_locations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type "FarmLocationType" NOT NULL,
  boundary geometry(Geometry, 4326),
  "boundaryAreaHa" DECIMAL(12,4),
  "capacityUA" DECIMAL(10,2),
  "capacityAnimals" INTEGER,
  "forageType" "ForageType",
  "pastureStatus" "PastureStatus",
  "facilityType" "FacilityType",
  "facilityStatus" "FacilityStatus",
  description TEXT,
  notes TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique parcial: nome único por fazenda (apenas ativos)
CREATE UNIQUE INDEX farm_locations_farm_name_unique
  ON farm_locations ("farmId", name)
  WHERE "deletedAt" IS NULL;

CREATE INDEX farm_locations_farm_id_idx ON farm_locations ("farmId");
CREATE INDEX farm_locations_type_idx ON farm_locations (type);
CREATE INDEX farm_locations_boundary_gist_idx ON farm_locations USING GIST (boundary);

-- ─── FK animal_lots.locationId ────────────────────────────────────────

ALTER TABLE animal_lots ADD COLUMN "locationId" TEXT REFERENCES farm_locations(id) ON DELETE SET NULL;
CREATE INDEX animal_lots_location_id_idx ON animal_lots ("locationId");

-- ─── FK animals.pastureId constraint ──────────────────────────────────

ALTER TABLE animals ADD CONSTRAINT animals_pasture_id_fkey
  FOREIGN KEY ("pastureId") REFERENCES farm_locations(id) ON DELETE SET NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE farm_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_locations FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON farm_locations
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
