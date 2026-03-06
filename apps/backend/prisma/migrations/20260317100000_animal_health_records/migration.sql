-- CreateEnum: HealthEventType
CREATE TYPE "HealthEventType" AS ENUM ('VACCINATION', 'DEWORMING', 'TREATMENT', 'EXAM');

-- CreateEnum: ApplicationMethod
CREATE TYPE "ApplicationMethod" AS ENUM ('INJECTABLE', 'ORAL', 'POUR_ON', 'OTHER');

-- CreateTable: animal_health_records
CREATE TABLE animal_health_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "animalId" TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  type "HealthEventType" NOT NULL,
  "eventDate" DATE NOT NULL,
  "productName" TEXT,
  dosage TEXT,
  "applicationMethod" "ApplicationMethod",
  "batchNumber" TEXT,
  diagnosis TEXT,
  "durationDays" INTEGER,
  "examResult" TEXT,
  "labName" TEXT,
  "isFieldExam" BOOLEAN DEFAULT false,
  "veterinaryName" TEXT,
  notes TEXT,
  "recordedBy" TEXT NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateIndex
CREATE INDEX animal_health_records_animal_id_idx ON animal_health_records ("animalId");
CREATE INDEX animal_health_records_farm_id_idx ON animal_health_records ("farmId");
CREATE INDEX animal_health_records_event_date_idx ON animal_health_records ("eventDate");
CREATE INDEX animal_health_records_type_idx ON animal_health_records (type);

-- EnableRLS
ALTER TABLE animal_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_health_records FORCE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY tenant_isolation_policy ON animal_health_records
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
