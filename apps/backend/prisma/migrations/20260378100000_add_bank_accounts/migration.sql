-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'INVESTMENT', 'RURAL_CREDIT');

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BankAccountType" NOT NULL,
    "bankCode" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "agencyDigit" TEXT,
    "accountNumber" TEXT NOT NULL,
    "accountDigit" TEXT,
    "producerId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_farms" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,

    CONSTRAINT "bank_account_farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account_balances" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "initialBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_accounts_organizationId_idx" ON "bank_accounts"("organizationId");

-- CreateIndex
CREATE INDEX "bank_accounts_organizationId_type_idx" ON "bank_accounts"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_farms_bankAccountId_farmId_key" ON "bank_account_farms"("bankAccountId", "farmId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_balances_bankAccountId_key" ON "bank_account_balances"("bankAccountId");

-- CreateIndex
CREATE INDEX "bank_account_balances_organizationId_idx" ON "bank_account_balances"("organizationId");

-- CreateIndex
CREATE INDEX "financial_transactions_organizationId_bankAccountId_idx" ON "financial_transactions"("organizationId", "bankAccountId");

-- CreateIndex
CREATE INDEX "financial_transactions_organizationId_bankAccountId_transactionDate_idx" ON "financial_transactions"("organizationId", "bankAccountId", "transactionDate");

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_farms" ADD CONSTRAINT "bank_account_farms_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_farms" ADD CONSTRAINT "bank_account_farms_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_balances" ADD CONSTRAINT "bank_account_balances_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account_balances" ADD CONSTRAINT "bank_account_balances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
