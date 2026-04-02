-- CreateEnum
CREATE TYPE "EmployeeFunction" AS ENUM ('INSEMINATOR', 'TRACTOR_DRIVER', 'VETERINARIAN', 'MILKING_OPERATOR');

-- CreateTable
CREATE TABLE "employee_function_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "function" "EmployeeFunction" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "employee_function_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_function_assignments_function_idx" ON "employee_function_assignments"("function");

-- CreateIndex
CREATE UNIQUE INDEX "employee_function_assignments_employeeId_function_key" ON "employee_function_assignments"("employeeId", "function");

-- AddColumn
ALTER TABLE "inseminations" ADD COLUMN "inseminatorId" TEXT;

-- CreateIndex
CREATE INDEX "inseminations_inseminatorId_idx" ON "inseminations"("inseminatorId");

-- AddForeignKey
ALTER TABLE "employee_function_assignments" ADD CONSTRAINT "employee_function_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inseminations" ADD CONSTRAINT "inseminations_inseminatorId_fkey" FOREIGN KEY ("inseminatorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
