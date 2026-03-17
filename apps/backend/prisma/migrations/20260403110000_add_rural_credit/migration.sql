-- CreateEnum
CREATE TYPE "RuralCreditLine" AS ENUM ('PRONAF', 'PRONAMP', 'FUNCAFE', 'CPR', 'CREDITO_LIVRE');

-- CreateEnum
CREATE TYPE "AmortizationSystem" AS ENUM ('SAC', 'PRICE', 'BULLET');

-- CreateEnum
CREATE TYPE "RuralCreditStatus" AS ENUM ('ATIVO', 'QUITADO', 'INADIMPLENTE', 'CANCELADO');

-- CreateTable
CREATE TABLE "rural_credit_contracts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "creditLine" "RuralCreditLine" NOT NULL,
    "amortizationSystem" "AmortizationSystem" NOT NULL,
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "annualRate" DECIMAL(8,6) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "gracePeriodMonths" INTEGER NOT NULL DEFAULT 0,
    "firstPaymentYear" INTEGER NOT NULL,
    "firstPaymentMonth" INTEGER NOT NULL,
    "paymentDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "iofAmount" DECIMAL(15,2),
    "tacAmount" DECIMAL(15,2),
    "guaranteeDescription" TEXT,
    "alertDaysBefore" INTEGER NOT NULL DEFAULT 15,
    "status" "RuralCreditStatus" NOT NULL DEFAULT 'ATIVO',
    "outstandingBalance" DECIMAL(15,2) NOT NULL,
    "totalPrincipalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalInterestPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rural_credit_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rural_credit_installments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "principal" DECIMAL(15,2) NOT NULL,
    "interest" DECIMAL(15,2) NOT NULL,
    "outstandingBalanceAfter" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rural_credit_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rural_credit_contracts_organizationId_idx" ON "rural_credit_contracts"("organizationId");

-- CreateIndex
CREATE INDEX "rural_credit_contracts_organizationId_status_idx" ON "rural_credit_contracts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "rural_credit_contracts_organizationId_farmId_idx" ON "rural_credit_contracts"("organizationId", "farmId");

-- CreateIndex
CREATE UNIQUE INDEX "rural_credit_installments_payableId_key" ON "rural_credit_installments"("payableId");

-- CreateIndex
CREATE INDEX "rural_credit_installments_contractId_idx" ON "rural_credit_installments"("contractId");

-- AddForeignKey
ALTER TABLE "rural_credit_contracts" ADD CONSTRAINT "rural_credit_contracts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rural_credit_contracts" ADD CONSTRAINT "rural_credit_contracts_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rural_credit_contracts" ADD CONSTRAINT "rural_credit_contracts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rural_credit_installments" ADD CONSTRAINT "rural_credit_installments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "rural_credit_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rural_credit_installments" ADD CONSTRAINT "rural_credit_installments_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
