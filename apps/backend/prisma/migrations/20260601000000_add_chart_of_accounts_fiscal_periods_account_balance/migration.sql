-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ATIVO', 'PASSIVO', 'PL', 'RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('DEVEDORA', 'CREDORA');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'BLOCKED');

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "nature" "AccountNature" NOT NULL,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "allowManualEntry" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFairValueAdj" BOOLEAN NOT NULL DEFAULT false,
    "spedRefCode" TEXT,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_balances" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "debitTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "creditTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costCenterId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chart_of_accounts_organizationId_accountType_idx" ON "chart_of_accounts"("organizationId", "accountType");

-- CreateIndex
CREATE INDEX "chart_of_accounts_parentId_idx" ON "chart_of_accounts"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_organizationId_code_key" ON "chart_of_accounts"("organizationId", "code");

-- CreateIndex
CREATE INDEX "fiscal_years_organizationId_idx" ON "fiscal_years"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_organizationId_startDate_key" ON "fiscal_years"("organizationId", "startDate");

-- CreateIndex
CREATE INDEX "accounting_periods_organizationId_status_idx" ON "accounting_periods"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_organizationId_fiscalYearId_month_year_key" ON "accounting_periods"("organizationId", "fiscalYearId", "month", "year");

-- CreateIndex
CREATE INDEX "account_balances_organizationId_fiscalYearId_idx" ON "account_balances"("organizationId", "fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_organizationId_accountId_fiscalYearId_mont_key" ON "account_balances"("organizationId", "accountId", "fiscalYearId", "month");

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_reopenedBy_fkey" FOREIGN KEY ("reopenedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
