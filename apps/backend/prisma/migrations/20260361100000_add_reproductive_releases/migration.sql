-- CreateTable
CREATE TABLE "reproductive_releases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "releaseDate" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "ageMonths" INTEGER,
    "bodyConditionScore" DOUBLE PRECISION,
    "responsibleName" TEXT NOT NULL,
    "previousCategory" TEXT,
    "previousLotId" TEXT,
    "targetLotId" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reproductive_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reproductive_criteria" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "minWeightKg" DOUBLE PRECISION,
    "minAgeMonths" INTEGER,
    "minBodyScore" DOUBLE PRECISION,
    "targetLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reproductive_criteria_pkey" PRIMARY KEY ("id")
);

-- AlterTable - Add reproductivelyReleased flag to animals
ALTER TABLE "animals" ADD COLUMN "reproductivelyReleased" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "reproductive_releases_organizationId_idx" ON "reproductive_releases"("organizationId");
CREATE INDEX "reproductive_releases_farmId_idx" ON "reproductive_releases"("farmId");
CREATE INDEX "reproductive_releases_animalId_idx" ON "reproductive_releases"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "reproductive_criteria_organizationId_key" ON "reproductive_criteria"("organizationId");

-- AddForeignKey
ALTER TABLE "reproductive_releases" ADD CONSTRAINT "reproductive_releases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reproductive_releases" ADD CONSTRAINT "reproductive_releases_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reproductive_releases" ADD CONSTRAINT "reproductive_releases_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reproductive_releases" ADD CONSTRAINT "reproductive_releases_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reproductive_criteria" ADD CONSTRAINT "reproductive_criteria_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "reproductive_releases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reproductive_releases_org_isolation" ON "reproductive_releases"
  USING ("organizationId" = current_setting('app.current_org_id', true));

ALTER TABLE "reproductive_criteria" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reproductive_criteria_org_isolation" ON "reproductive_criteria"
  USING ("organizationId" = current_setting('app.current_org_id', true));
