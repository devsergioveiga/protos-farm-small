-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'RECEIVED', 'PARTIAL', 'OVERDUE', 'CANCELLED', 'RENEGOTIATED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PayableCategory" AS ENUM ('INPUTS', 'MAINTENANCE', 'PAYROLL', 'RENT', 'SERVICES', 'TAXES', 'FINANCING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReceivableCategory" AS ENUM ('GRAIN_SALE', 'CATTLE_SALE', 'MILK_SALE', 'LEASE', 'SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "CostCenterAllocMode" AS ENUM ('PERCENTAGE', 'FIXED_VALUE');

-- CreateTable
CREATE TABLE "payables" (
    "id"                  TEXT NOT NULL,
    "organizationId"      TEXT NOT NULL,
    "farmId"              TEXT NOT NULL,
    "producerId"          TEXT,
    "supplierName"        TEXT NOT NULL,
    "category"            "PayableCategory" NOT NULL,
    "description"         TEXT NOT NULL,
    "totalAmount"         DECIMAL(15,2) NOT NULL,
    "dueDate"             TIMESTAMP(3) NOT NULL,
    "status"              "PayableStatus" NOT NULL DEFAULT 'PENDING',
    "documentNumber"      TEXT,
    "originType"          TEXT,
    "originId"            TEXT,
    "recurrenceFrequency" "RecurrenceFrequency",
    "recurrenceEndDate"   TIMESTAMP(3),
    "recurrenceParentId"  TEXT,
    "installmentCount"    INTEGER NOT NULL DEFAULT 1,
    "paidAt"              TIMESTAMP(3),
    "amountPaid"          DECIMAL(15,2),
    "bankAccountId"       TEXT,
    "interestAmount"      DECIMAL(15,2),
    "fineAmount"          DECIMAL(15,2),
    "discountAmount"      DECIMAL(15,2),
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_installments" (
    "id"         TEXT NOT NULL,
    "payableId"  TEXT NOT NULL,
    "number"     INTEGER NOT NULL,
    "amount"     DECIMAL(15,2) NOT NULL,
    "dueDate"    TIMESTAMP(3) NOT NULL,
    "status"     "PayableStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt"     TIMESTAMP(3),
    "amountPaid" DECIMAL(15,2),

    CONSTRAINT "payable_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_cost_center_items" (
    "id"           TEXT NOT NULL,
    "payableId"    TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "farmId"       TEXT NOT NULL,
    "allocMode"    "CostCenterAllocMode" NOT NULL,
    "percentage"   DECIMAL(5,2),
    "fixedAmount"  DECIMAL(15,2),

    CONSTRAINT "payable_cost_center_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "id"                  TEXT NOT NULL,
    "organizationId"      TEXT NOT NULL,
    "farmId"              TEXT NOT NULL,
    "producerId"          TEXT,
    "clientName"          TEXT NOT NULL,
    "category"            "ReceivableCategory" NOT NULL,
    "description"         TEXT NOT NULL,
    "totalAmount"         DECIMAL(15,2) NOT NULL,
    "dueDate"             TIMESTAMP(3) NOT NULL,
    "status"              "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "documentNumber"      TEXT,
    "nfeKey"              TEXT,
    "funruralRate"        DECIMAL(5,4),
    "funruralAmount"      DECIMAL(15,2),
    "originType"          TEXT,
    "originId"            TEXT,
    "recurrenceFrequency" "RecurrenceFrequency",
    "recurrenceEndDate"   TIMESTAMP(3),
    "recurrenceParentId"  TEXT,
    "installmentCount"    INTEGER NOT NULL DEFAULT 1,
    "receivedAt"          TIMESTAMP(3),
    "amountReceived"      DECIMAL(15,2),
    "bankAccountId"       TEXT,
    "interestAmount"      DECIMAL(15,2),
    "fineAmount"          DECIMAL(15,2),
    "discountAmount"      DECIMAL(15,2),
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivable_installments" (
    "id"             TEXT NOT NULL,
    "receivableId"   TEXT NOT NULL,
    "number"         INTEGER NOT NULL,
    "amount"         DECIMAL(15,2) NOT NULL,
    "dueDate"        TIMESTAMP(3) NOT NULL,
    "status"         "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt"     TIMESTAMP(3),
    "amountReceived" DECIMAL(15,2),

    CONSTRAINT "receivable_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivable_cost_center_items" (
    "id"           TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "farmId"       TEXT NOT NULL,
    "allocMode"    "CostCenterAllocMode" NOT NULL,
    "percentage"   DECIMAL(5,2),
    "fixedAmount"  DECIMAL(15,2),

    CONSTRAINT "receivable_cost_center_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payables_organizationId_status_dueDate_idx" ON "payables"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "payables_organizationId_farmId_idx" ON "payables"("organizationId", "farmId");

-- CreateIndex
CREATE INDEX "payable_installments_payableId_idx" ON "payable_installments"("payableId");

-- CreateIndex
CREATE INDEX "receivables_organizationId_status_dueDate_idx" ON "receivables"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "receivables_organizationId_farmId_idx" ON "receivables"("organizationId", "farmId");

-- CreateIndex
CREATE INDEX "receivable_installments_receivableId_idx" ON "receivable_installments"("receivableId");

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_recurrenceParentId_fkey" FOREIGN KEY ("recurrenceParentId") REFERENCES "payables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_installments" ADD CONSTRAINT "payable_installments_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_cost_center_items" ADD CONSTRAINT "payable_cost_center_items_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_cost_center_items" ADD CONSTRAINT "payable_cost_center_items_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_cost_center_items" ADD CONSTRAINT "payable_cost_center_items_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_recurrenceParentId_fkey" FOREIGN KEY ("recurrenceParentId") REFERENCES "receivables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_installments" ADD CONSTRAINT "receivable_installments_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_cost_center_items" ADD CONSTRAINT "receivable_cost_center_items_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "receivables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_cost_center_items" ADD CONSTRAINT "receivable_cost_center_items_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_cost_center_items" ADD CONSTRAINT "receivable_cost_center_items_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
