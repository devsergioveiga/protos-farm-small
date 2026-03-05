-- ============================================================================
-- US-025: Cadastro individual de animal
-- ============================================================================
-- 1. Enums: AnimalSex, AnimalCategory, AnimalOrigin, GenealogyClass
-- 2. Tabela breeds (catálogo de raças, global + org-specific)
-- 3. Tabela animals (cadastro principal)
-- 4. Tabela animal_breed_compositions (composição racial 1:N)
-- 5. Tabela animal_genealogical_records (registro genealógico)
-- 6. RLS para todas as tabelas
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────

CREATE TYPE "AnimalSex" AS ENUM ('MALE', 'FEMALE');

CREATE TYPE "AnimalCategory" AS ENUM (
  'BEZERRO', 'BEZERRA',
  'NOVILHA', 'NOVILHO',
  'VACA_LACTACAO', 'VACA_SECA',
  'TOURO_REPRODUTOR', 'DESCARTE'
);

CREATE TYPE "AnimalOrigin" AS ENUM ('BORN', 'PURCHASED');

CREATE TYPE "GenealogyClass" AS ENUM (
  'PO', 'PC_OC', 'PC_OD',
  'GC_01', 'GC_02', 'GC_03',
  'PA', 'LA', 'CCG', 'SRD'
);

-- ─── Breeds ─────────────────────────────────────────────────────────

CREATE TABLE breeds (
  id                TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,
  code              TEXT,
  species           TEXT        NOT NULL DEFAULT 'BOVINO',
  category          TEXT        NOT NULL DEFAULT 'DUPLA_APTIDAO',
  "isDefault"       BOOLEAN     NOT NULL DEFAULT false,
  "organizationId"  TEXT        REFERENCES organizations(id) ON DELETE CASCADE,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_breeds_name_org ON breeds (
  name, COALESCE("organizationId", '___global___')
);

-- ─── Animals ────────────────────────────────────────────────────────

CREATE TABLE animals (
  id                      TEXT            PRIMARY KEY,
  "farmId"                TEXT            NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "earTag"                TEXT            NOT NULL,
  "rfidTag"               TEXT,
  name                    TEXT,
  sex                     "AnimalSex"     NOT NULL,
  "birthDate"             DATE,
  "birthDateEstimated"    BOOLEAN         NOT NULL DEFAULT false,
  category                "AnimalCategory" NOT NULL,
  "categorySuggested"     "AnimalCategory",
  origin                  "AnimalOrigin"  NOT NULL DEFAULT 'BORN',
  "entryWeightKg"         DECIMAL(8, 2),
  "bodyConditionScore"    INTEGER,
  "sireId"                TEXT            REFERENCES animals(id) ON DELETE SET NULL,
  "damId"                 TEXT            REFERENCES animals(id) ON DELETE SET NULL,
  "lotId"                 TEXT,
  "pastureId"             TEXT,
  "photoUrl"              TEXT,
  notes                   TEXT,
  "isCompositionEstimated" BOOLEAN        NOT NULL DEFAULT false,
  "deletedAt"             TIMESTAMPTZ,
  "createdBy"             TEXT            NOT NULL REFERENCES users(id),
  "createdAt"             TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_animals_farm_ear_tag ON animals ("farmId", "earTag") WHERE "deletedAt" IS NULL;
CREATE INDEX idx_animals_farm_id ON animals ("farmId");
CREATE INDEX idx_animals_category ON animals (category);
CREATE INDEX idx_animals_sex ON animals (sex);
CREATE INDEX idx_animals_sire_id ON animals ("sireId");
CREATE INDEX idx_animals_dam_id ON animals ("damId");

-- ─── Animal Breed Compositions ──────────────────────────────────────

CREATE TABLE animal_breed_compositions (
  id          TEXT          PRIMARY KEY,
  "animalId"  TEXT          NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "breedId"   TEXT          NOT NULL REFERENCES breeds(id) ON DELETE RESTRICT,
  fraction    TEXT,
  percentage  DECIMAL(5, 2) NOT NULL,
  "createdAt" TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_animal_breed_comp_unique ON animal_breed_compositions ("animalId", "breedId");
CREATE INDEX idx_animal_breed_comp_animal ON animal_breed_compositions ("animalId");

-- ─── Animal Genealogical Records ────────────────────────────────────

CREATE TABLE animal_genealogical_records (
  id                    TEXT              PRIMARY KEY,
  "animalId"            TEXT              NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "genealogyClass"      "GenealogyClass"  NOT NULL,
  "registrationNumber"  TEXT,
  "associationName"     TEXT,
  "registrationDate"    DATE,
  "girolando_grade"     TEXT,
  notes                 TEXT,
  "createdAt"           TIMESTAMPTZ       NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_animal_genealogy_unique ON animal_genealogical_records ("animalId", "genealogyClass");
CREATE INDEX idx_animal_genealogy_animal ON animal_genealogical_records ("animalId");

-- ─── RLS ────────────────────────────────────────────────────────────

-- breeds: global rows (organizationId IS NULL) visible to all; org-specific scoped
ALTER TABLE breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE breeds FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON breeds
  USING (
    is_rls_bypassed()
    OR "organizationId" IS NULL
    OR "organizationId" = current_org_id()
  );

-- animals: scoped via farms.organizationId
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON animals
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );

-- animal_breed_compositions: scoped via animals → farms
ALTER TABLE animal_breed_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_breed_compositions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON animal_breed_compositions
  USING (
    is_rls_bypassed()
    OR "animalId" IN (
      SELECT a.id FROM animals a
      JOIN farms f ON a."farmId" = f.id
      WHERE f."organizationId" = current_org_id()
    )
  );

-- animal_genealogical_records: scoped via animals → farms
ALTER TABLE animal_genealogical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_genealogical_records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON animal_genealogical_records
  USING (
    is_rls_bypassed()
    OR "animalId" IN (
      SELECT a.id FROM animals a
      JOIN farms f ON a."farmId" = f.id
      WHERE f."organizationId" = current_org_id()
    )
  );
