-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_centers_farmId_idx" ON "cost_centers"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_farmId_code_key" ON "cost_centers"("farmId", "code");

-- AlterTable
ALTER TABLE "field_teams" ADD COLUMN "costCenterId" TEXT;

-- CreateIndex
CREATE INDEX "field_teams_costCenterId_idx" ON "field_teams"("costCenterId");

-- AddForeignKey
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_teams" ADD CONSTRAINT "field_teams_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
