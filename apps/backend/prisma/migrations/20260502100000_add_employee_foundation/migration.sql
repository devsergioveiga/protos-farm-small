-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ATIVO', 'AFASTADO', 'FERIAS', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CLT_INDETERMINATE', 'CLT_DETERMINATE', 'SEASONAL', 'INTERMITTENT', 'TRIAL', 'APPRENTICE');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PROMOTION', 'SALARY_ADJUSTMENT', 'TRANSFER', 'POSITION_CHANGE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RG', 'CPF', 'CTPS', 'ASO', 'CONTRATO', 'OUTRO');

-- CreateEnum
CREATE TYPE "WorkScheduleType" AS ENUM ('FIXED', 'SHIFT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmployeeBankAccountType" AS ENUM ('CORRENTE', 'POUPANCA');

-- CreateEnum
CREATE TYPE "SalaryBandLevel" AS ENUM ('JUNIOR', 'PLENO', 'SENIOR');

-- AlterTable: add employeeId to field_team_members
ALTER TABLE "field_team_members" ADD COLUMN "employeeId" TEXT;

-- CreateIndex for FieldTeamMember.employeeId
CREATE INDEX "field_team_members_employeeId_idx" ON "field_team_members"("employeeId");

-- CreateTable: employees
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "rg" TEXT,
    "rgIssuer" TEXT,
    "rgUf" VARCHAR(2),
    "pisPassep" TEXT,
    "ctpsNumber" TEXT,
    "ctpsSeries" TEXT,
    "ctpsUf" VARCHAR(2),
    "birthDate" DATE NOT NULL,
    "motherName" TEXT,
    "fatherName" TEXT,
    "educationLevel" TEXT,
    "maritalStatus" TEXT,
    "nationality" TEXT NOT NULL DEFAULT 'Brasileiro',
    "bloodType" TEXT,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "disabilityType" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "zipCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" VARCHAR(2),
    "bankCode" TEXT,
    "bankAgency" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" "EmployeeBankAccountType",
    "bankAccountDigit" TEXT,
    "initialVacationBalance" DECIMAL(5,2),
    "initialHourBankBalance" DECIMAL(8,2),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ATIVO',
    "photoUrl" TEXT,
    "notes" TEXT,
    "admissionDate" DATE NOT NULL,
    "terminationDate" DATE,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_dependents
CREATE TABLE "employee_dependents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT,
    "birthDate" DATE NOT NULL,
    "relationship" TEXT NOT NULL,
    "irrf" BOOLEAN NOT NULL DEFAULT false,
    "salaryFamily" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: positions
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cbo" TEXT,
    "description" TEXT,
    "additionalTypes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_bands
CREATE TABLE "salary_bands" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "level" "SalaryBandLevel" NOT NULL,
    "minSalary" DECIMAL(10,2) NOT NULL,
    "maxSalary" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable: work_schedules
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkScheduleType" NOT NULL,
    "workDays" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_farms
CREATE TABLE "employee_farms" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "positionId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_status_history
CREATE TABLE "employee_status_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromStatus" "EmployeeStatus" NOT NULL,
    "toStatus" "EmployeeStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_contracts
CREATE TABLE "employee_contracts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "workScheduleId" TEXT,
    "contractType" "ContractType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "salary" DECIMAL(10,2) NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 44,
    "union" TEXT,
    "costCenterId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: contract_amendments
CREATE TABLE "contract_amendments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effectiveAt" DATE NOT NULL,
    "changes" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_movements
CREATE TABLE "employee_movements" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "effectiveAt" DATE NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_salary_history
CREATE TABLE "employee_salary_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salary" DECIMAL(10,2) NOT NULL,
    "effectiveAt" DATE NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: employee_documents
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: employees unique(organizationId, cpf)
CREATE UNIQUE INDEX "employees_organizationId_cpf_key" ON "employees"("organizationId", "cpf");

-- CreateIndex: employees(organizationId, status)
CREATE INDEX "employees_organizationId_status_idx" ON "employees"("organizationId", "status");

-- CreateIndex: employees.userId unique
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex: employee_dependents(employeeId)
CREATE INDEX "employee_dependents_employeeId_idx" ON "employee_dependents"("employeeId");

-- CreateIndex: positions unique(organizationId, name)
CREATE UNIQUE INDEX "positions_organizationId_name_key" ON "positions"("organizationId", "name");

-- CreateIndex: positions(organizationId)
CREATE INDEX "positions_organizationId_idx" ON "positions"("organizationId");

-- CreateIndex: salary_bands unique(positionId, level)
CREATE UNIQUE INDEX "salary_bands_positionId_level_key" ON "salary_bands"("positionId", "level");

-- CreateIndex: work_schedules unique(organizationId, name)
CREATE UNIQUE INDEX "work_schedules_organizationId_name_key" ON "work_schedules"("organizationId", "name");

-- CreateIndex: work_schedules(organizationId)
CREATE INDEX "work_schedules_organizationId_idx" ON "work_schedules"("organizationId");

-- CreateIndex: employee_farms(employeeId)
CREATE INDEX "employee_farms_employeeId_idx" ON "employee_farms"("employeeId");

-- CreateIndex: employee_farms(farmId)
CREATE INDEX "employee_farms_farmId_idx" ON "employee_farms"("farmId");

-- CreateIndex: employee_farms(positionId)
CREATE INDEX "employee_farms_positionId_idx" ON "employee_farms"("positionId");

-- CreateIndex: employee_status_history(employeeId)
CREATE INDEX "employee_status_history_employeeId_idx" ON "employee_status_history"("employeeId");

-- CreateIndex: employee_contracts(employeeId)
CREATE INDEX "employee_contracts_employeeId_idx" ON "employee_contracts"("employeeId");

-- CreateIndex: employee_contracts(organizationId, contractType)
CREATE INDEX "employee_contracts_organizationId_contractType_idx" ON "employee_contracts"("organizationId", "contractType");

-- CreateIndex: employee_contracts(endDate)
CREATE INDEX "employee_contracts_endDate_idx" ON "employee_contracts"("endDate");

-- CreateIndex: contract_amendments(contractId)
CREATE INDEX "contract_amendments_contractId_idx" ON "contract_amendments"("contractId");

-- CreateIndex: employee_movements(employeeId, movementType)
CREATE INDEX "employee_movements_employeeId_movementType_idx" ON "employee_movements"("employeeId", "movementType");

-- CreateIndex: employee_salary_history(employeeId, effectiveAt)
CREATE INDEX "employee_salary_history_employeeId_effectiveAt_idx" ON "employee_salary_history"("employeeId", "effectiveAt");

-- CreateIndex: employee_documents(employeeId)
CREATE INDEX "employee_documents_employeeId_idx" ON "employee_documents"("employeeId");

-- AddForeignKey: employees -> organizations
ALTER TABLE "employees" ADD CONSTRAINT "employees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employees -> users (optional)
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: employee_dependents -> employees
ALTER TABLE "employee_dependents" ADD CONSTRAINT "employee_dependents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: positions -> organizations
ALTER TABLE "positions" ADD CONSTRAINT "positions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: salary_bands -> positions
ALTER TABLE "salary_bands" ADD CONSTRAINT "salary_bands_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: work_schedules -> organizations
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_farms -> employees
ALTER TABLE "employee_farms" ADD CONSTRAINT "employee_farms_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employee_farms -> farms
ALTER TABLE "employee_farms" ADD CONSTRAINT "employee_farms_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_farms -> positions (optional)
ALTER TABLE "employee_farms" ADD CONSTRAINT "employee_farms_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: employee_status_history -> employees
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employee_contracts -> employees
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employee_contracts -> organizations
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_contracts -> positions
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: employee_contracts -> work_schedules (optional)
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: employee_contracts -> cost_centers (optional)
ALTER TABLE "employee_contracts" ADD CONSTRAINT "employee_contracts_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: contract_amendments -> employee_contracts
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "employee_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employee_movements -> employees
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employee_salary_history -> employees
ALTER TABLE "employee_salary_history" ADD CONSTRAINT "employee_salary_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: employee_documents -> employees
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: field_team_members -> employees (optional)
ALTER TABLE "field_team_members" ADD CONSTRAINT "field_team_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
