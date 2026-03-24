-- CreateEnum
CREATE TYPE "payroll_run_type" AS ENUM ('MONTHLY', 'ADVANCE', 'THIRTEENTH_FIRST', 'THIRTEENTH_SECOND');

-- CreateEnum
CREATE TYPE "payroll_run_status" AS ENUM ('PENDING', 'PROCESSING', 'CALCULATED', 'COMPLETED', 'ERROR', 'REVERTED');

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "runType" "payroll_run_type" NOT NULL,
    "status" "payroll_run_status" NOT NULL DEFAULT 'PENDING',
    "triggeredBy" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "revertedAt" TIMESTAMP(3),
    "revertedBy" TEXT,
    "totalGross" DECIMAL(14,2),
    "totalNet" DECIMAL(14,2),
    "totalCharges" DECIMAL(14,2),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_items" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "baseSalary" DECIMAL(10,2) NOT NULL,
    "proRataDays" INTEGER,
    "overtime50" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtime100" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "dsrValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nightPremium" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salaryFamily" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherProvisions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "grossSalary" DECIMAL(10,2) NOT NULL,
    "inssAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "irrfAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vtDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "housingDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "foodDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "advanceDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(10,2) NOT NULL,
    "fgtsAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "inssPatronal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineItemsJson" JSONB,
    "payslipSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_advances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "advanceDate" DATE NOT NULL,
    "batchId" TEXT,
    "notes" TEXT,
    "payableId" TEXT,
    "deductedInRunId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organizationId_referenceMonth_runType_key" ON "payroll_runs"("organizationId", "referenceMonth", "runType");

-- CreateIndex
CREATE INDEX "payroll_runs_organizationId_status_idx" ON "payroll_runs"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_items_payrollRunId_employeeId_key" ON "payroll_run_items"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "payroll_run_items_employeeId_idx" ON "payroll_run_items"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_advances_payableId_key" ON "salary_advances"("payableId");

-- CreateIndex
CREATE INDEX "salary_advances_organizationId_referenceMonth_idx" ON "salary_advances"("organizationId", "referenceMonth");

-- CreateIndex
CREATE INDEX "salary_advances_employeeId_referenceMonth_idx" ON "salary_advances"("employeeId", "referenceMonth");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
