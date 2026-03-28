-- CreateEnum
CREATE TYPE "AutoPostingSourceType" AS ENUM ('PAYROLL_RUN_CLOSE', 'PAYROLL_PROVISION_VACATION', 'PAYROLL_PROVISION_THIRTEENTH', 'PAYABLE_SETTLEMENT', 'RECEIVABLE_SETTLEMENT', 'DEPRECIATION_RUN', 'STOCK_ENTRY', 'STOCK_OUTPUT_CONSUMPTION', 'STOCK_OUTPUT_TRANSFER', 'STOCK_OUTPUT_DISPOSAL', 'PAYABLE_REVERSAL', 'RECEIVABLE_REVERSAL');

-- CreateEnum
CREATE TYPE "PendingPostingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR');

-- AlterEnum
ALTER TYPE "JournalEntryType" ADD VALUE 'AUTOMATIC';

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" "AutoPostingSourceType";

-- CreateTable
CREATE TABLE "accounting_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "AutoPostingSourceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "historyTemplate" VARCHAR(500) NOT NULL,
    "requireCostCenter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_rule_lines" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "lineOrder" INTEGER NOT NULL,
    "side" "LedgerSide" NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" VARCHAR(300),

    CONSTRAINT "accounting_rule_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_journal_postings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "AutoPostingSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "accountingRuleId" TEXT,
    "status" "PendingPostingStatus" NOT NULL DEFAULT 'PENDING',
    "journalEntryId" TEXT,
    "errorMessage" VARCHAR(1000),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "pending_journal_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_rules_organizationId_idx" ON "accounting_rules"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_rules_organizationId_sourceType_key" ON "accounting_rules"("organizationId", "sourceType");

-- CreateIndex
CREATE INDEX "accounting_rule_lines_ruleId_idx" ON "accounting_rule_lines"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "pending_journal_postings_journalEntryId_key" ON "pending_journal_postings"("journalEntryId");

-- CreateIndex
CREATE INDEX "pending_journal_postings_organizationId_status_idx" ON "pending_journal_postings"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pending_journal_postings_sourceType_sourceId_key" ON "pending_journal_postings"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_sourceType_sourceId_key" ON "journal_entries"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "accounting_rules" ADD CONSTRAINT "accounting_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_rule_lines" ADD CONSTRAINT "accounting_rule_lines_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "accounting_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_rule_lines" ADD CONSTRAINT "accounting_rule_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_journal_postings" ADD CONSTRAINT "pending_journal_postings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_journal_postings" ADD CONSTRAINT "pending_journal_postings_accountingRuleId_fkey" FOREIGN KEY ("accountingRuleId") REFERENCES "accounting_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_journal_postings" ADD CONSTRAINT "pending_journal_postings_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
