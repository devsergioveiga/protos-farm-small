-- CreateEnum
CREATE TYPE "CultivarType" AS ENUM ('CONVENCIONAL', 'TRANSGENICO');

-- CreateTable
CREATE TABLE "cultivars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "breeder" TEXT,
    "cycleDays" INTEGER,
    "maturationGroup" TEXT,
    "type" "CultivarType" NOT NULL DEFAULT 'CONVENCIONAL',
    "technology" TEXT,
    "diseaseTolerances" TEXT,
    "regionalAptitude" TEXT,
    "populationRecommendation" TEXT,
    "plantingWindowStart" DATE,
    "plantingWindowEnd" DATE,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cultivars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cultivars_organizationId_idx" ON "cultivars"("organizationId");

-- CreateIndex
CREATE INDEX "cultivars_crop_idx" ON "cultivars"("crop");

-- CreateIndex
CREATE UNIQUE INDEX "cultivars_name_crop_organizationId_key" ON "cultivars"("name", "crop", "organizationId");

-- AddForeignKey
ALTER TABLE "cultivars" ADD CONSTRAINT "cultivars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
