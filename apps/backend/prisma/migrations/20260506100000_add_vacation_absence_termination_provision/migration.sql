-- Phase 29: Férias, Afastamentos, Rescisão e Provisões
-- Migration: add_vacation_absence_termination_provision

-- Create enums
CREATE TYPE "VacationPeriodStatus" AS ENUM ('ACCRUING', 'AVAILABLE', 'SCHEDULED', 'EXPIRED');
CREATE TYPE "VacationScheduleStatus" AS ENUM ('SCHEDULED', 'PAID', 'CANCELLED');
CREATE TYPE "AbsenceType" AS ENUM ('MEDICAL_CERTIFICATE', 'INSS_LEAVE', 'WORK_ACCIDENT', 'MATERNITY', 'PATERNITY', 'MARRIAGE', 'BEREAVEMENT', 'MILITARY', 'OTHER');
CREATE TYPE "TerminationType" AS ENUM ('WITHOUT_CAUSE', 'WITH_CAUSE', 'VOLUNTARY', 'SEASONAL_END', 'MUTUAL_AGREEMENT');
CREATE TYPE "NoticePeriodType" AS ENUM ('WORKED', 'COMPENSATED', 'WAIVED');
CREATE TYPE "TerminationStatus" AS ENUM ('DRAFT', 'PROCESSED', 'PAID');
CREATE TYPE "ProvisionType" AS ENUM ('VACATION', 'THIRTEENTH');

-- Create vacation_acquisitive_periods table
CREATE TABLE "vacation_acquisitive_periods" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "daysEarned" INTEGER NOT NULL DEFAULT 30,
    "daysTaken" INTEGER NOT NULL DEFAULT 0,
    "daysLost" INTEGER NOT NULL DEFAULT 0,
    "status" "VacationPeriodStatus" NOT NULL DEFAULT 'ACCRUING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacation_acquisitive_periods_pkey" PRIMARY KEY ("id")
);

-- Create vacation_schedules table
CREATE TABLE "vacation_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "acquisitivePeriodId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "abono" INTEGER NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "inssAmount" DECIMAL(10,2) NOT NULL,
    "irrfAmount" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "fgtsAmount" DECIMAL(10,2) NOT NULL,
    "paymentDueDate" DATE NOT NULL,
    "status" "VacationScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "receiptUrl" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacation_schedules_pkey" PRIMARY KEY ("id")
);

-- Create employee_absences table
CREATE TABLE "employee_absences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceType" "AbsenceType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "totalDays" INTEGER,
    "catNumber" TEXT,
    "inssStartDate" DATE,
    "stabilityEndsAt" DATE,
    "returnDate" DATE,
    "asoRequired" BOOLEAN NOT NULL DEFAULT false,
    "asoDocumentId" TEXT,
    "payrollImpact" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_absences_pkey" PRIMARY KEY ("id")
);

-- Create employee_terminations table
CREATE TABLE "employee_terminations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "terminationType" "TerminationType" NOT NULL,
    "terminationDate" DATE NOT NULL,
    "noticePeriodDays" INTEGER NOT NULL,
    "noticePeriodType" "NoticePeriodType" NOT NULL,
    "balanceSalary" DECIMAL(10,2) NOT NULL,
    "thirteenthProp" DECIMAL(10,2) NOT NULL,
    "vacationVested" DECIMAL(10,2) NOT NULL,
    "vacationProp" DECIMAL(10,2) NOT NULL,
    "vacationBonus" DECIMAL(10,2) NOT NULL,
    "noticePay" DECIMAL(10,2) NOT NULL,
    "fgtsBalance" DECIMAL(10,2) NOT NULL,
    "fgtsPenalty" DECIMAL(10,2) NOT NULL,
    "totalGross" DECIMAL(10,2) NOT NULL,
    "inssAmount" DECIMAL(10,2) NOT NULL,
    "irrfAmount" DECIMAL(10,2) NOT NULL,
    "totalNet" DECIMAL(10,2) NOT NULL,
    "paymentDeadline" DATE NOT NULL,
    "trctPdfUrl" TEXT,
    "grfPdfUrl" TEXT,
    "status" "TerminationStatus" NOT NULL DEFAULT 'DRAFT',
    "processedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_terminations_pkey" PRIMARY KEY ("id")
);

-- Create payroll_provisions table
CREATE TABLE "payroll_provisions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "provisionType" "ProvisionType" NOT NULL,
    "baseSalary" DECIMAL(10,2) NOT NULL,
    "provisionAmount" DECIMAL(10,2) NOT NULL,
    "chargesAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "costCenterId" TEXT,
    "accountingEntryJson" JSONB,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_provisions_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "employee_terminations" ADD CONSTRAINT "employee_terminations_employeeId_key" UNIQUE ("employeeId");
ALTER TABLE "payroll_provisions" ADD CONSTRAINT "payroll_provisions_employeeId_referenceMonth_provisionType_key" UNIQUE ("employeeId", "referenceMonth", "provisionType");

-- Indexes
CREATE INDEX "vacation_acquisitive_periods_employeeId_status_idx" ON "vacation_acquisitive_periods"("employeeId", "status");
CREATE INDEX "vacation_schedules_employeeId_status_idx" ON "vacation_schedules"("employeeId", "status");
CREATE INDEX "vacation_schedules_paymentDueDate_idx" ON "vacation_schedules"("paymentDueDate");
CREATE INDEX "employee_absences_employeeId_absenceType_idx" ON "employee_absences"("employeeId", "absenceType");
CREATE INDEX "employee_absences_organizationId_startDate_idx" ON "employee_absences"("organizationId", "startDate");
CREATE INDEX "employee_terminations_organizationId_status_idx" ON "employee_terminations"("organizationId", "status");
CREATE INDEX "payroll_provisions_organizationId_referenceMonth_idx" ON "payroll_provisions"("organizationId", "referenceMonth");

-- Foreign keys
ALTER TABLE "vacation_acquisitive_periods" ADD CONSTRAINT "vacation_acquisitive_periods_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacation_schedules" ADD CONSTRAINT "vacation_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacation_schedules" ADD CONSTRAINT "vacation_schedules_acquisitivePeriodId_fkey" FOREIGN KEY ("acquisitivePeriodId") REFERENCES "vacation_acquisitive_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_absences" ADD CONSTRAINT "employee_absences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_terminations" ADD CONSTRAINT "employee_terminations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_provisions" ADD CONSTRAINT "payroll_provisions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_provisions" ADD CONSTRAINT "payroll_provisions_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
