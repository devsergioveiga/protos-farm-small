-- CreateEnum
CREATE TYPE "MastitisGrade" AS ENUM ('GRADE_1_MILD', 'GRADE_2_MODERATE', 'GRADE_3_SEVERE');

-- CreateEnum
CREATE TYPE "MastitisClassification" AS ENUM ('CLINICAL', 'SUBCLINICAL', 'RECURRENT', 'CHRONIC');

-- CreateEnum
CREATE TYPE "MastitisQuarterStatus" AS ENUM ('IN_TREATMENT', 'IN_WITHDRAWAL', 'CURED', 'CHRONIC', 'QUARTER_LOST');

-- CreateEnum
CREATE TYPE "MastitisCaseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "mastitis_cases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "occurrenceDate" DATE NOT NULL,
    "occurrenceTime" TEXT,
    "identifiedBy" TEXT NOT NULL,
    "delAtOccurrence" INTEGER,
    "rectalTemperature" DOUBLE PRECISION,
    "temperatureAlert" BOOLEAN NOT NULL DEFAULT false,
    "classification" "MastitisClassification" NOT NULL DEFAULT 'CLINICAL',
    "status" "MastitisCaseStatus" NOT NULL DEFAULT 'OPEN',
    "cultureSampleCollected" BOOLEAN NOT NULL DEFAULT false,
    "cultureLab" TEXT,
    "cultureSampleNumber" TEXT,
    "cultureAgent" TEXT,
    "cultureAntibiogram" JSONB,
    "treatmentProtocolName" TEXT,
    "withdrawalEndDate" DATE,
    "closedAt" TIMESTAMP(3),
    "closureOutcome" TEXT,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mastitis_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastitis_quarters" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "grade" "MastitisGrade" NOT NULL,
    "milkAppearance" TEXT,
    "cmtResult" TEXT,
    "status" "MastitisQuarterStatus" NOT NULL DEFAULT 'IN_TREATMENT',
    "withdrawalEndDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mastitis_quarters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastitis_applications" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "applicationDate" DATE NOT NULL,
    "applicationTime" TEXT,
    "productName" TEXT NOT NULL,
    "productId" TEXT,
    "dose" TEXT NOT NULL,
    "administrationRoute" TEXT NOT NULL,
    "quarterTreated" TEXT,
    "responsibleName" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mastitis_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mastitis_cases_organizationId_idx" ON "mastitis_cases"("organizationId");
CREATE INDEX "mastitis_cases_farmId_idx" ON "mastitis_cases"("farmId");
CREATE INDEX "mastitis_cases_animalId_idx" ON "mastitis_cases"("animalId");
CREATE INDEX "mastitis_cases_occurrenceDate_idx" ON "mastitis_cases"("occurrenceDate");
CREATE INDEX "mastitis_cases_status_idx" ON "mastitis_cases"("status");

CREATE INDEX "mastitis_quarters_caseId_idx" ON "mastitis_quarters"("caseId");

CREATE INDEX "mastitis_applications_caseId_idx" ON "mastitis_applications"("caseId");
CREATE INDEX "mastitis_applications_applicationDate_idx" ON "mastitis_applications"("applicationDate");

-- AddForeignKey
ALTER TABLE "mastitis_cases" ADD CONSTRAINT "mastitis_cases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mastitis_cases" ADD CONSTRAINT "mastitis_cases_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastitis_cases" ADD CONSTRAINT "mastitis_cases_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastitis_cases" ADD CONSTRAINT "mastitis_cases_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mastitis_quarters" ADD CONSTRAINT "mastitis_quarters_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "mastitis_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mastitis_applications" ADD CONSTRAINT "mastitis_applications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "mastitis_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mastitis_applications" ADD CONSTRAINT "mastitis_applications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "mastitis_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mastitis_quarters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mastitis_applications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mastitis_cases_org_isolation" ON "mastitis_cases"
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "organizationId" = current_setting('app.current_org_id', true)
  );

CREATE POLICY "mastitis_quarters_org_isolation" ON "mastitis_quarters"
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "caseId" IN (
      SELECT id FROM "mastitis_cases"
      WHERE "organizationId" = current_setting('app.current_org_id', true)
    )
  );

CREATE POLICY "mastitis_applications_org_isolation" ON "mastitis_applications"
  USING (
    current_setting('app.bypass_rls', true) = 'true'
    OR "caseId" IN (
      SELECT id FROM "mastitis_cases"
      WHERE "organizationId" = current_setting('app.current_org_id', true)
    )
  );
