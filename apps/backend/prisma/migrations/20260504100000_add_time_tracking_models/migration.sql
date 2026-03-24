-- CreateEnum
CREATE TYPE "time_entry_source" AS ENUM ('MOBILE', 'WEB', 'MANAGER');

-- CreateEnum
CREATE TYPE "overtime_bank_type" AS ENUM ('CREDIT', 'COMPENSATION', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "timesheet_status" AS ENUM ('DRAFT', 'PENDING_MANAGER', 'MANAGER_APPROVED', 'PENDING_RH', 'APPROVED', 'LOCKED', 'REJECTED');

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "breakStart" TIMESTAMP(3),
    "breakEnd" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "workedMinutes" INTEGER,
    "nightMinutes" INTEGER,
    "outOfRange" BOOLEAN NOT NULL DEFAULT false,
    "noBoundary" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "source" "time_entry_source" NOT NULL DEFAULT 'MOBILE',
    "managerNote" TEXT,
    "timesheetId" TEXT,
    "payrollRunId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_activities" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "fieldOperationId" TEXT,
    "fieldPlotId" TEXT,
    "farmLocationId" TEXT,
    "costCenterId" TEXT,
    "minutes" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(10,4) NOT NULL,
    "costAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "time_entry_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_bank_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "balanceType" "overtime_bank_type" NOT NULL,
    "description" TEXT,
    "expiresAt" DATE NOT NULL,
    "timesheetId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_bank_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "status" "timesheet_status" NOT NULL DEFAULT 'DRAFT',
    "totalWorked" INTEGER NOT NULL DEFAULT 0,
    "totalOvertime50" INTEGER NOT NULL DEFAULT 0,
    "totalOvertime100" INTEGER NOT NULL DEFAULT 0,
    "totalNightMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalAbsences" INTEGER NOT NULL DEFAULT 0,
    "closingDeadline" TIMESTAMP(3),
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "rhApprovedBy" TEXT,
    "rhApprovedAt" TIMESTAMP(3),
    "employeeAcceptedAt" TIMESTAMP(3),
    "employeeDisputeNote" TEXT,
    "payrollRunId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_corrections" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "timeEntryId" TEXT,
    "correctedBy" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "beforeJson" JSONB NOT NULL,
    "afterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_employeeId_date_idx" ON "time_entries"("employeeId", "date");

-- CreateIndex
CREATE INDEX "time_entries_organizationId_date_idx" ON "time_entries"("organizationId", "date");

-- CreateIndex
CREATE INDEX "time_entries_timesheetId_idx" ON "time_entries"("timesheetId");

-- CreateIndex
CREATE INDEX "time_entry_activities_timeEntryId_idx" ON "time_entry_activities"("timeEntryId");

-- CreateIndex
CREATE INDEX "overtime_bank_entries_employeeId_referenceMonth_idx" ON "overtime_bank_entries"("employeeId", "referenceMonth");

-- CreateIndex
CREATE INDEX "overtime_bank_entries_employeeId_expiresAt_idx" ON "overtime_bank_entries"("employeeId", "expiresAt");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "timesheets_employeeId_referenceMonth_key" ON "timesheets"("employeeId", "referenceMonth");

-- CreateIndex
CREATE INDEX "timesheets_organizationId_referenceMonth_status_idx" ON "timesheets"("organizationId", "referenceMonth", "status");

-- CreateIndex
CREATE INDEX "timesheet_corrections_timesheetId_idx" ON "timesheet_corrections"("timesheetId");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_activities" ADD CONSTRAINT "time_entry_activities_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_bank_entries" ADD CONSTRAINT "overtime_bank_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_corrections" ADD CONSTRAINT "timesheet_corrections_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
