-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('MANUAL', 'OPENING_BALANCE', 'REVERSAL', 'TEMPLATE_INSTANCE');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LedgerSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL DEFAULT 0,
    "entryDate" DATE NOT NULL,
    "periodId" TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "entryType" "JournalEntryType" NOT NULL DEFAULT 'MANUAL',
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "reversedById" TEXT,
    "reversalOf" TEXT,
    "reversalReason" VARCHAR(500),
    "templateName" TEXT,
    "costCenterId" TEXT,
    "createdBy" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "side" "LedgerSide" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" VARCHAR(300),
    "costCenterId" TEXT,
    "lineOrder" INTEGER NOT NULL,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversedById_key" ON "journal_entries"("reversedById");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOf_key" ON "journal_entries"("reversalOf");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organizationId_entryNumber_key" ON "journal_entries"("organizationId", "entryNumber");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_periodId_idx" ON "journal_entries"("organizationId", "periodId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_status_idx" ON "journal_entries"("organizationId", "status");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_entryDate_idx" ON "journal_entries"("organizationId", "entryDate");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journalEntryId_idx" ON "journal_entry_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_accountId_idx" ON "journal_entry_lines"("accountId");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
