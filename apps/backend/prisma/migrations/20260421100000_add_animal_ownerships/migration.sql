-- CreateEnum
CREATE TYPE "AnimalOwnershipType" AS ENUM ('PROPRIETARIO', 'PARCEIRO', 'COMODATARIO', 'DEPOSITARIO');

-- CreateTable
CREATE TABLE "animal_ownerships" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "ownershipType" "AnimalOwnershipType" NOT NULL DEFAULT 'PROPRIETARIO',
    "participationPct" DECIMAL(5,2),
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_ownerships_animalId_idx" ON "animal_ownerships"("animalId");

-- CreateIndex
CREATE INDEX "animal_ownerships_producerId_idx" ON "animal_ownerships"("producerId");

-- CreateIndex
CREATE INDEX "animal_ownerships_endDate_idx" ON "animal_ownerships"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "animal_ownerships_animalId_producerId_ownershipType_startDat_key" ON "animal_ownerships"("animalId", "producerId", "ownershipType", "startDate");

-- AddForeignKey
ALTER TABLE "animal_ownerships" ADD CONSTRAINT "animal_ownerships_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_ownerships" ADD CONSTRAINT "animal_ownerships_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_ownerships" ADD CONSTRAINT "animal_ownerships_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
