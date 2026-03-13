-- CA8: Defensivos
ALTER TABLE "products" ADD COLUMN "toxicityClass" TEXT;
ALTER TABLE "products" ADD COLUMN "mapaRegistration" TEXT;
ALTER TABLE "products" ADD COLUMN "environmentalClass" TEXT;
ALTER TABLE "products" ADD COLUMN "actionMode" TEXT;
ALTER TABLE "products" ADD COLUMN "chemicalGroup" TEXT;
ALTER TABLE "products" ADD COLUMN "withdrawalPeriods" JSONB;

-- CA9: Fertilizantes
ALTER TABLE "products" ADD COLUMN "npkFormulation" TEXT;
ALTER TABLE "products" ADD COLUMN "nutrientForm" TEXT;
ALTER TABLE "products" ADD COLUMN "solubility" TEXT;
ALTER TABLE "products" ADD COLUMN "nutrientComposition" JSONB;

-- CA10: Foliares
ALTER TABLE "products" ADD COLUMN "nutritionalComposition" JSONB;
ALTER TABLE "products" ADD COLUMN "sprayCompatibility" JSONB;

-- CA11: Medicamentos veterinários
ALTER TABLE "products" ADD COLUMN "therapeuticClass" TEXT;
ALTER TABLE "products" ADD COLUMN "administrationRoute" TEXT;
ALTER TABLE "products" ADD COLUMN "milkWithdrawalHours" INTEGER;
ALTER TABLE "products" ADD COLUMN "slaughterWithdrawalDays" INTEGER;
ALTER TABLE "products" ADD COLUMN "vetMapaRegistration" TEXT;
ALTER TABLE "products" ADD COLUMN "requiresPrescription" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "storageCondition" TEXT;

-- CA12: Sementes
ALTER TABLE "products" ADD COLUMN "cultivarId" TEXT;
ALTER TABLE "products" ADD COLUMN "sieveSize" TEXT;
ALTER TABLE "products" ADD COLUMN "industrialTreatment" TEXT;
ALTER TABLE "products" ADD COLUMN "germinationPct" DECIMAL(5,2);
ALTER TABLE "products" ADD COLUMN "purityPct" DECIMAL(5,2);

-- FK: cultivarId -> cultivars
ALTER TABLE "products" ADD CONSTRAINT "products_cultivarId_fkey"
    FOREIGN KEY ("cultivarId") REFERENCES "cultivars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "products_cultivarId_idx" ON "products"("cultivarId");
