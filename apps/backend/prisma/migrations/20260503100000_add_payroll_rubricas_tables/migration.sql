-- Migration: add_payroll_rubricas_tables
-- Phase 26: Parâmetros de Folha e Motor de Cálculo

-- CreateEnum
CREATE TYPE "RubricaType" AS ENUM ('PROVENTO', 'DESCONTO', 'INFORMATIVO');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('FIXED_VALUE', 'PERCENTAGE', 'FORMULA', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SystemFormulaType" AS ENUM ('SYSTEM_INSS', 'SYSTEM_IRRF', 'SYSTEM_FGTS', 'SYSTEM_SALARY_FAMILY', 'SYSTEM_FUNRURAL');

-- CreateEnum
CREATE TYPE "LegalTableType" AS ENUM ('INSS', 'IRRF', 'SALARY_FAMILY', 'MINIMUM_WAGE', 'FUNRURAL');

-- CreateTable
CREATE TABLE "payroll_rubricas" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rubricaType" "RubricaType" NOT NULL,
    "calculationType" "CalculationType" NOT NULL,
    "formulaType" "SystemFormulaType",
    "baseFormula" TEXT,
    "rate" DECIMAL(8,6),
    "fixedValue" DECIMAL(10,2),
    "incideINSS" BOOLEAN NOT NULL DEFAULT false,
    "incideFGTS" BOOLEAN NOT NULL DEFAULT false,
    "incideIRRF" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "eSocialCode" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_rubricas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_legal_tables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "tableType" "LegalTableType" NOT NULL,
    "stateCode" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_legal_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_table_brackets" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "fromValue" DECIMAL(12,2) NOT NULL,
    "upTo" DECIMAL(12,2),
    "rate" DECIMAL(8,6) NOT NULL,
    "deduction" DECIMAL(10,2),
    "order" INTEGER NOT NULL,

    CONSTRAINT "payroll_table_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_table_scalars" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_table_scalars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_rubricas_organizationId_code_key" ON "payroll_rubricas"("organizationId", "code");

-- CreateIndex
CREATE INDEX "payroll_rubricas_organizationId_rubricaType_idx" ON "payroll_rubricas"("organizationId", "rubricaType");

-- CreateIndex
CREATE INDEX "payroll_legal_tables_tableType_effectiveFrom_idx" ON "payroll_legal_tables"("tableType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "payroll_legal_tables_organizationId_tableType_effectiveFrom_idx" ON "payroll_legal_tables"("organizationId", "tableType", "effectiveFrom");

-- CreateIndex
CREATE INDEX "payroll_table_brackets_tableId_order_idx" ON "payroll_table_brackets"("tableId", "order");

-- AddForeignKey
ALTER TABLE "payroll_rubricas" ADD CONSTRAINT "payroll_rubricas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_legal_tables" ADD CONSTRAINT "payroll_legal_tables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_table_brackets" ADD CONSTRAINT "payroll_table_brackets_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "payroll_legal_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_table_scalars" ADD CONSTRAINT "payroll_table_scalars_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "payroll_legal_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
