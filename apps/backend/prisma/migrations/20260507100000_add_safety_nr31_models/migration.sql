-- Phase 30: Segurança do Trabalho NR-31
-- Migration: 20260507100000_add_safety_nr31_models

-- New enums
CREATE TYPE "EpiType" AS ENUM ('CAPACETE', 'LUVA', 'BOTA', 'OCULOS', 'PROTETOR_AURICULAR', 'MASCARA', 'AVENTAL', 'CINTO', 'PERNEIRA', 'OUTROS');
CREATE TYPE "EpiDeliveryReason" AS ENUM ('NOVO', 'TROCA', 'DANIFICADO', 'EXTRAVIO');
CREATE TYPE "InstructorType" AS ENUM ('INTERNO', 'EXTERNO');
CREATE TYPE "AsoType" AS ENUM ('ADMISSIONAL', 'PERIODICO', 'RETORNO_TRABALHO', 'MUDANCA_RISCO', 'DEMISSIONAL');
CREATE TYPE "AsoResult" AS ENUM ('APTO', 'INAPTO', 'APTO_COM_RESTRICAO');

-- Modify Position: add asoPeriodicityMonths
ALTER TABLE "positions" ADD COLUMN "asoPeriodicityMonths" INTEGER NOT NULL DEFAULT 12;

-- EpiProduct: one-to-one with Product
CREATE TABLE "epi_products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "caNumber" TEXT NOT NULL,
    "caExpiry" TIMESTAMP(3),
    "epiType" "EpiType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epi_products_pkey" PRIMARY KEY ("id")
);

-- EpiDelivery
CREATE TABLE "epi_deliveries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "epiProductId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "EpiDeliveryReason" NOT NULL,
    "signatureUrl" TEXT,
    "observations" TEXT,
    "stockOutputId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epi_deliveries_pkey" PRIMARY KEY ("id")
);

-- PositionEpiRequirement
CREATE TABLE "position_epi_requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "epiProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_epi_requirements_pkey" PRIMARY KEY ("id")
);

-- TrainingType
CREATE TABLE "training_types" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minHours" INTEGER NOT NULL,
    "defaultValidityMonths" INTEGER NOT NULL,
    "nrReference" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_types_pkey" PRIMARY KEY ("id")
);

-- TrainingRecord
CREATE TABLE "training_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT,
    "trainingTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "instructorName" TEXT NOT NULL,
    "instructorType" "InstructorType" NOT NULL,
    "instructorRegistration" TEXT,
    "effectiveHours" DECIMAL(5,1) NOT NULL,
    "location" TEXT,
    "observations" TEXT,
    "certificateUrl" TEXT,
    "attendanceListUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_records_pkey" PRIMARY KEY ("id")
);

-- EmployeeTrainingRecord
CREATE TABLE "employee_training_records" (
    "id" TEXT NOT NULL,
    "trainingRecordId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_training_records_pkey" PRIMARY KEY ("id")
);

-- PositionTrainingRequirement
CREATE TABLE "position_training_requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "trainingTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_training_requirements_pkey" PRIMARY KEY ("id")
);

-- MedicalExam
CREATE TABLE "medical_exams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "farmId" TEXT,
    "type" "AsoType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "doctorName" TEXT NOT NULL,
    "doctorCrm" TEXT NOT NULL,
    "result" "AsoResult" NOT NULL,
    "restrictions" TEXT,
    "nextExamDate" TIMESTAMP(3),
    "documentUrl" TEXT,
    "observations" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_exams_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "epi_products_productId_key" ON "epi_products"("productId");
CREATE UNIQUE INDEX "epi_deliveries_stockOutputId_key" ON "epi_deliveries"("stockOutputId");
CREATE UNIQUE INDEX "position_epi_requirements_positionId_epiProductId_key" ON "position_epi_requirements"("positionId", "epiProductId");
CREATE UNIQUE INDEX "training_types_organizationId_name_key" ON "training_types"("organizationId", "name");
CREATE UNIQUE INDEX "employee_training_records_trainingRecordId_employeeId_key" ON "employee_training_records"("trainingRecordId", "employeeId");
CREATE UNIQUE INDEX "position_training_requirements_positionId_trainingTypeId_key" ON "position_training_requirements"("positionId", "trainingTypeId");

-- Indexes
CREATE INDEX "epi_products_organizationId_idx" ON "epi_products"("organizationId");
CREATE INDEX "epi_deliveries_organizationId_idx" ON "epi_deliveries"("organizationId");
CREATE INDEX "epi_deliveries_employeeId_idx" ON "epi_deliveries"("employeeId");
CREATE INDEX "training_records_organizationId_idx" ON "training_records"("organizationId");
CREATE INDEX "employee_training_records_employeeId_idx" ON "employee_training_records"("employeeId");
CREATE INDEX "medical_exams_organizationId_idx" ON "medical_exams"("organizationId");
CREATE INDEX "medical_exams_employeeId_idx" ON "medical_exams"("employeeId");

-- Foreign keys
ALTER TABLE "epi_products" ADD CONSTRAINT "epi_products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "epi_products" ADD CONSTRAINT "epi_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "epi_deliveries" ADD CONSTRAINT "epi_deliveries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "epi_deliveries" ADD CONSTRAINT "epi_deliveries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "epi_deliveries" ADD CONSTRAINT "epi_deliveries_epiProductId_fkey" FOREIGN KEY ("epiProductId") REFERENCES "epi_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "epi_deliveries" ADD CONSTRAINT "epi_deliveries_stockOutputId_fkey" FOREIGN KEY ("stockOutputId") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "position_epi_requirements" ADD CONSTRAINT "position_epi_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_epi_requirements" ADD CONSTRAINT "position_epi_requirements_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_epi_requirements" ADD CONSTRAINT "position_epi_requirements_epiProductId_fkey" FOREIGN KEY ("epiProductId") REFERENCES "epi_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training_records" ADD CONSTRAINT "training_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "training_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_training_records" ADD CONSTRAINT "employee_training_records_trainingRecordId_fkey" FOREIGN KEY ("trainingRecordId") REFERENCES "training_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_training_records" ADD CONSTRAINT "employee_training_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "position_training_requirements" ADD CONSTRAINT "position_training_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_training_requirements" ADD CONSTRAINT "position_training_requirements_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "position_training_requirements" ADD CONSTRAINT "position_training_requirements_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "training_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
