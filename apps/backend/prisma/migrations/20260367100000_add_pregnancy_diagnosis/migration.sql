-- CreateEnum
CREATE TYPE "DgResult" AS ENUM ('PREGNANT', 'EMPTY', 'LOSS', 'CYCLING');

-- CreateEnum
CREATE TYPE "DgMethod" AS ENUM ('PALPATION', 'ULTRASOUND', 'BLOOD_TEST', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "UterineCondition" AS ENUM ('NONE', 'PLACENTA_RETENTION', 'METRITIS_GRADE_1', 'METRITIS_GRADE_2', 'METRITIS_GRADE_3', 'ENDOMETRITIS_CLINICAL', 'ENDOMETRITIS_SUBCLINICAL', 'PYOMETRA');

-- CreateTable
CREATE TABLE "pregnancy_diagnoses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "diagnosisDate" DATE NOT NULL,
    "result" "DgResult" NOT NULL,
    "method" "DgMethod" NOT NULL,
    "gestationDays" INTEGER,
    "fetalSex" TEXT,
    "cyclicityStatus" TEXT,
    "expectedCalvingDate" DATE,
    "uterineCondition" "UterineCondition" NOT NULL DEFAULT 'NONE',
    "placentaRetentionHours" INTEGER,
    "reproductiveRestriction" BOOLEAN NOT NULL DEFAULT false,
    "restrictionEndDate" DATE,
    "inseminationId" TEXT,
    "naturalMatingId" TEXT,
    "linkedTreatmentId" TEXT,
    "bullId" TEXT,
    "bullBreedName" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmationDate" DATE,
    "lossDate" DATE,
    "lossReason" TEXT,
    "referredToIatf" BOOLEAN NOT NULL DEFAULT false,
    "referredProtocolId" TEXT,
    "veterinaryName" TEXT NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pregnancy_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pregnancy_diagnoses_organizationId_idx" ON "pregnancy_diagnoses"("organizationId");

-- CreateIndex
CREATE INDEX "pregnancy_diagnoses_farmId_idx" ON "pregnancy_diagnoses"("farmId");

-- CreateIndex
CREATE INDEX "pregnancy_diagnoses_animalId_idx" ON "pregnancy_diagnoses"("animalId");

-- CreateIndex
CREATE INDEX "pregnancy_diagnoses_diagnosisDate_idx" ON "pregnancy_diagnoses"("diagnosisDate");

-- CreateIndex
CREATE INDEX "pregnancy_diagnoses_result_idx" ON "pregnancy_diagnoses"("result");

-- CreateIndex
CREATE INDEX "pregnancy_diagnoses_expectedCalvingDate_idx" ON "pregnancy_diagnoses"("expectedCalvingDate");

-- AddForeignKey
ALTER TABLE "pregnancy_diagnoses" ADD CONSTRAINT "pregnancy_diagnoses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_diagnoses" ADD CONSTRAINT "pregnancy_diagnoses_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_diagnoses" ADD CONSTRAINT "pregnancy_diagnoses_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregnancy_diagnoses" ADD CONSTRAINT "pregnancy_diagnoses_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "pregnancy_diagnoses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pregnancy_diagnoses_org_isolation" ON "pregnancy_diagnoses"
  USING ("organizationId" = current_setting('app.current_org_id', true));
