-- CreateEnum: ReproductiveEventType
CREATE TYPE "ReproductiveEventType" AS ENUM ('CLEARANCE', 'HEAT', 'BREEDING_PLAN', 'AI', 'PREGNANCY', 'CALVING');

-- CreateEnum: HeatIntensity
CREATE TYPE "HeatIntensity" AS ENUM ('WEAK', 'MODERATE', 'STRONG');

-- CreateEnum: BreedingMethod
CREATE TYPE "BreedingMethod" AS ENUM ('NATURAL', 'AI', 'ET');

-- CreateEnum: CalvingType
CREATE TYPE "CalvingType" AS ENUM ('NORMAL', 'ASSISTED', 'CESAREAN', 'DYSTOCIC');

-- CreateEnum: PregnancyConfirmation
CREATE TYPE "PregnancyConfirmation" AS ENUM ('PALPATION', 'ULTRASOUND', 'BLOOD_TEST', 'OBSERVATION');

-- CreateTable: animal_reproductive_records
CREATE TABLE animal_reproductive_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "animalId" TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  type "ReproductiveEventType" NOT NULL,
  "eventDate" DATE NOT NULL,
  notes TEXT,
  "recordedBy" TEXT NOT NULL REFERENCES users(id),

  -- CLEARANCE fields
  "approvedBy" TEXT,
  "criteriaDetails" TEXT,

  -- HEAT fields
  "heatIntensity" "HeatIntensity",
  "intervalDays" INTEGER,

  -- BREEDING_PLAN fields
  "plannedSireId" TEXT REFERENCES animals(id) ON DELETE SET NULL,
  "breedingMethod" "BreedingMethod",
  "plannedDate" DATE,

  -- AI fields
  "sireId" TEXT REFERENCES animals(id) ON DELETE SET NULL,
  "sireName" TEXT,
  "semenBatch" TEXT,
  "technicianName" TEXT,

  -- PREGNANCY fields
  "confirmationMethod" "PregnancyConfirmation",
  "confirmationDate" DATE,
  "expectedDueDate" DATE,

  -- CALVING fields
  "calvingType" "CalvingType",
  "calvingComplications" TEXT,
  "calfId" TEXT REFERENCES animals(id) ON DELETE SET NULL,
  "calfSex" "AnimalSex",
  "calfWeightKg" DECIMAL(8,2),

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateIndex
CREATE INDEX animal_reproductive_records_animal_id_idx ON animal_reproductive_records ("animalId");
CREATE INDEX animal_reproductive_records_farm_id_idx ON animal_reproductive_records ("farmId");
CREATE INDEX animal_reproductive_records_event_date_idx ON animal_reproductive_records ("eventDate");
CREATE INDEX animal_reproductive_records_type_idx ON animal_reproductive_records (type);

-- EnableRLS
ALTER TABLE animal_reproductive_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_reproductive_records FORCE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY tenant_isolation_policy ON animal_reproductive_records
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
