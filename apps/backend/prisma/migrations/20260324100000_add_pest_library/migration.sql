-- CreateEnum
CREATE TYPE "PestCategory" AS ENUM ('INSETO', 'ACARO', 'FUNGO', 'BACTERIA', 'VIRUS', 'NEMATOIDE', 'PLANTA_DANINHA', 'OUTRO');

-- CreateEnum
CREATE TYPE "PestSeverity" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateTable
CREATE TABLE "pests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT,
    "category" "PestCategory" NOT NULL,
    "affectedCrops" TEXT[],
    "severity" "PestSeverity",
    "ndeDescription" TEXT,
    "ncDescription" TEXT,
    "lifecycle" TEXT,
    "symptoms" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pests_organizationId_idx" ON "pests"("organizationId");

-- CreateIndex
CREATE INDEX "pests_category_idx" ON "pests"("category");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "pests_commonName_organizationId_key" ON "pests"("commonName", "organizationId");

-- AddForeignKey
ALTER TABLE "pests" ADD CONSTRAINT "pests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS Policy
ALTER TABLE "pests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pests_org_isolation" ON "pests"
  USING ("organizationId" = current_setting('app.current_org_id', true));
