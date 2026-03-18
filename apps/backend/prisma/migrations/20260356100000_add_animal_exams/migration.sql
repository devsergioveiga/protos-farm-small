-- CreateEnum
CREATE TYPE "ExamCategory" AS ENUM ('MANDATORY', 'DIAGNOSTIC', 'ROUTINE');

-- CreateEnum
CREATE TYPE "ExamMethod" AS ENUM ('LABORATORY', 'FIELD', 'IMAGING');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResultIndicator" AS ENUM ('NORMAL', 'ABOVE', 'BELOW', 'POSITIVE', 'NEGATIVE');

-- CreateTable
CREATE TABLE "exam_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ExamCategory" NOT NULL,
    "method" "ExamMethod" NOT NULL,
    "material" TEXT,
    "defaultLab" TEXT,
    "isRegulatory" BOOLEAN NOT NULL DEFAULT false,
    "validityDays" INTEGER,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_type_params" (
    "id" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "paramName" TEXT NOT NULL,
    "unit" TEXT,
    "minReference" DOUBLE PRECISION,
    "maxReference" DOUBLE PRECISION,
    "isBooleanResult" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_type_params_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_exams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "examTypeName" TEXT NOT NULL,
    "collectionDate" DATE NOT NULL,
    "sendDate" DATE,
    "laboratory" TEXT,
    "protocolNumber" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'PENDING',
    "resultDate" DATE,
    "responsibleName" TEXT NOT NULL,
    "veterinaryName" TEXT,
    "veterinaryCrmv" TEXT,
    "certificateNumber" TEXT,
    "certificateValidity" DATE,
    "animalLotId" TEXT,
    "campaignId" TEXT,
    "linkedTreatmentId" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "paramName" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,
    "textValue" TEXT,
    "unit" TEXT,
    "minReference" DOUBLE PRECISION,
    "maxReference" DOUBLE PRECISION,
    "indicator" "ResultIndicator",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_types_name_organizationId_key" ON "exam_types"("name", "organizationId");
CREATE INDEX "exam_types_organizationId_idx" ON "exam_types"("organizationId");
CREATE INDEX "exam_types_category_idx" ON "exam_types"("category");

CREATE INDEX "exam_type_params_examTypeId_idx" ON "exam_type_params"("examTypeId");

CREATE INDEX "animal_exams_organizationId_idx" ON "animal_exams"("organizationId");
CREATE INDEX "animal_exams_farmId_idx" ON "animal_exams"("farmId");
CREATE INDEX "animal_exams_animalId_idx" ON "animal_exams"("animalId");
CREATE INDEX "animal_exams_examTypeId_idx" ON "animal_exams"("examTypeId");
CREATE INDEX "animal_exams_collectionDate_idx" ON "animal_exams"("collectionDate");
CREATE INDEX "animal_exams_status_idx" ON "animal_exams"("status");
CREATE INDEX "animal_exams_campaignId_idx" ON "animal_exams"("campaignId");
CREATE INDEX "animal_exams_certificateValidity_idx" ON "animal_exams"("certificateValidity");

CREATE INDEX "exam_results_examId_idx" ON "exam_results"("examId");

-- AddForeignKey
ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_type_params" ADD CONSTRAINT "exam_type_params_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "exam_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "animal_exams" ADD CONSTRAINT "animal_exams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "animal_exams" ADD CONSTRAINT "animal_exams_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "animal_exams" ADD CONSTRAINT "animal_exams_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "animal_exams" ADD CONSTRAINT "animal_exams_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "exam_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "animal_exams" ADD CONSTRAINT "animal_exams_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_examId_fkey" FOREIGN KEY ("examId") REFERENCES "animal_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
