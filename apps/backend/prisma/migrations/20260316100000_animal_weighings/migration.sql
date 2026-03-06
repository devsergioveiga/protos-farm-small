-- US-029 CA2: Histórico de Pesagens
-- 1. Tabela animal_weighings (registros de pesagem)
-- 2. Índices para consultas frequentes
-- 3. RLS via farmId → farms → organizationId

-- ─── animal_weighings ───────────────────────────────────────────────

CREATE TABLE animal_weighings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "animalId" TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  "weightKg" DECIMAL(8,2) NOT NULL,
  "measuredAt" DATE NOT NULL,
  "bodyConditionScore" INTEGER,
  notes TEXT,
  "recordedBy" TEXT NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT animal_weighings_bcs_range CHECK ("bodyConditionScore" IS NULL OR ("bodyConditionScore" >= 1 AND "bodyConditionScore" <= 5))
);

CREATE INDEX animal_weighings_animal_id_idx ON animal_weighings ("animalId");
CREATE INDEX animal_weighings_farm_id_idx ON animal_weighings ("farmId");
CREATE INDEX animal_weighings_measured_at_idx ON animal_weighings ("measuredAt");

-- ─── RLS ────────────────────────────────────────────────────────────

ALTER TABLE animal_weighings ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_weighings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON animal_weighings
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );
