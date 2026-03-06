-- US-027: Gestão de Lotes e Categorias
-- 1. Enum LotLocationType
-- 2. Tabela animal_lots (lotes de manejo)
-- 3. Tabela animal_lot_movements (histórico de movimentações)
-- 4. FK animals.lotId → animal_lots.id
-- 5. RLS para novas tabelas

-- ─── Enum ─────────────────────────────────────────────────────────────

CREATE TYPE "LotLocationType" AS ENUM (
  'PASTO',
  'GALPAO',
  'BEZERREIRO',
  'CURRAL',
  'BAIA',
  'CONFINAMENTO',
  'OUTRO'
);

-- ─── animal_lots ──────────────────────────────────────────────────────

CREATE TABLE animal_lots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "farmId" TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "predominantCategory" "AnimalCategory" NOT NULL,
  "currentLocation" TEXT NOT NULL,
  "locationType" "LotLocationType" NOT NULL,
  "maxCapacity" INTEGER,
  description TEXT,
  notes TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique parcial: nome único por fazenda (apenas ativos)
CREATE UNIQUE INDEX animal_lots_farm_name_unique
  ON animal_lots ("farmId", name)
  WHERE "deletedAt" IS NULL;

CREATE INDEX animal_lots_farm_id_idx ON animal_lots ("farmId");
CREATE INDEX animal_lots_predominant_category_idx ON animal_lots ("predominantCategory");

-- ─── animal_lot_movements ─────────────────────────────────────────────

CREATE TABLE animal_lot_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "animalId" TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  "lotId" TEXT NOT NULL REFERENCES animal_lots(id) ON DELETE CASCADE,
  "previousLotId" TEXT REFERENCES animal_lots(id) ON DELETE SET NULL,
  "enteredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "exitedAt" TIMESTAMPTZ,
  "movedBy" TEXT NOT NULL REFERENCES users(id),
  reason TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX animal_lot_movements_animal_id_idx ON animal_lot_movements ("animalId");
CREATE INDEX animal_lot_movements_lot_id_idx ON animal_lot_movements ("lotId");
CREATE INDEX animal_lot_movements_entered_at_idx ON animal_lot_movements ("enteredAt");
CREATE INDEX animal_lot_movements_exited_at_idx ON animal_lot_movements ("exitedAt");

-- ─── FK animals.lotId ─────────────────────────────────────────────────

ALTER TABLE animals ADD CONSTRAINT animals_lot_id_fkey FOREIGN KEY ("lotId") REFERENCES animal_lots(id) ON DELETE SET NULL;
CREATE INDEX animals_lot_id_idx ON animals ("lotId");

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE animal_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_lots FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON animal_lots
  USING (
    is_rls_bypassed()
    OR "farmId" IN (
      SELECT id FROM farms WHERE "organizationId" = current_org_id()
    )
  );

ALTER TABLE animal_lot_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_lot_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON animal_lot_movements
  USING (
    is_rls_bypassed()
    OR "lotId" IN (
      SELECT al.id FROM animal_lots al
      JOIN farms f ON f.id = al."farmId"
      WHERE f."organizationId" = current_org_id()
    )
  );
