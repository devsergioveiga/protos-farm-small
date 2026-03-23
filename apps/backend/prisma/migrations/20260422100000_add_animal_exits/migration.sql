-- CreateEnum
CREATE TYPE "AnimalExitType" AS ENUM ('MORTE', 'VENDA', 'DOACAO', 'ABATE', 'TRANSFERENCIA', 'PERDA');

-- CreateTable
CREATE TABLE "animal_exits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "exitType" "AnimalExitType" NOT NULL,
    "exitDate" DATE NOT NULL,
    "deathType" TEXT,
    "deathCause" TEXT,
    "buyerName" TEXT,
    "salePriceTotal" DECIMAL(12,2),
    "salePricePerKg" DECIMAL(10,4),
    "saleWeightKg" DECIMAL(10,2),
    "gtaNumber" TEXT,
    "destinationFarm" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_exits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "animal_exits_animalId_key" ON "animal_exits"("animalId");

-- CreateIndex
CREATE INDEX "animal_exits_organizationId_idx" ON "animal_exits"("organizationId");

-- CreateIndex
CREATE INDEX "animal_exits_farmId_idx" ON "animal_exits"("farmId");

-- CreateIndex
CREATE INDEX "animal_exits_exitType_idx" ON "animal_exits"("exitType");

-- CreateIndex
CREATE INDEX "animal_exits_exitDate_idx" ON "animal_exits"("exitDate");

-- AddForeignKey
ALTER TABLE "animal_exits" ADD CONSTRAINT "animal_exits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_exits" ADD CONSTRAINT "animal_exits_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_exits" ADD CONSTRAINT "animal_exits_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_exits" ADD CONSTRAINT "animal_exits_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
