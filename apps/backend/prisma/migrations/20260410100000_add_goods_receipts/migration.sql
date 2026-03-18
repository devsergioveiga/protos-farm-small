-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('PENDENTE', 'EM_CONFERENCIA', 'CONFERIDO', 'CONFIRMADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "ReceivingType" AS ENUM ('STANDARD', 'NF_ANTECIPADA', 'MERCADORIA_ANTECIPADA', 'PARCIAL', 'NF_FRACIONADA', 'EMERGENCIAL');

-- CreateEnum
CREATE TYPE "DivergenceType" AS ENUM ('A_MAIS', 'A_MENOS', 'SUBSTITUIDO', 'DANIFICADO', 'ERRADO');

-- CreateEnum
CREATE TYPE "DivergenceAction" AS ENUM ('DEVOLVER', 'ACEITAR_COM_DESCONTO', 'REGISTRAR_PENDENCIA');

-- AlterTable: add receivedQuantity to purchase_order_items
ALTER TABLE "purchase_order_items" ADD COLUMN "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- AlterTable: add goodsReceiptId to stock_entries
ALTER TABLE "stock_entries" ADD COLUMN "goodsReceiptId" TEXT;

-- AlterTable: add goodsReceiptId to payables
ALTER TABLE "payables" ADD COLUMN "goodsReceiptId" TEXT;

-- CreateTable: goods_receipts
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequentialNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "supplierId" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'PENDENTE',
    "receivingType" "ReceivingType" NOT NULL DEFAULT 'STANDARD',
    "invoiceNumber" TEXT,
    "invoiceSerie" TEXT,
    "invoiceCfop" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "invoiceTotal" DECIMAL(14,2),
    "invoiceKey" TEXT,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "stockEntryId" TEXT,
    "payableId" TEXT,
    "storageFarmId" TEXT,
    "notes" TEXT,
    "emergencyJustification" TEXT,
    "receivedAt" TIMESTAMP(3),
    "conferredAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: goods_receipt_items
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "orderedQty" DECIMAL(12,3) NOT NULL,
    "invoiceQty" DECIMAL(12,3),
    "receivedQty" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "qualityVisualOk" BOOLEAN,
    "batchNumber" TEXT,
    "expirationDate" TIMESTAMP(3),
    "qualityNotes" TEXT,
    "hasDivergence" BOOLEAN NOT NULL DEFAULT false,
    "divergencePct" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: goods_receipt_divergences
CREATE TABLE "goods_receipt_divergences" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "divergenceType" "DivergenceType" NOT NULL,
    "action" "DivergenceAction" NOT NULL,
    "observation" TEXT,
    "photoUrl" TEXT,
    "photoFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_divergences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_organizationId_sequentialNumber_key" ON "goods_receipts"("organizationId", "sequentialNumber");

-- CreateIndex
CREATE INDEX "goods_receipts_organizationId_status_idx" ON "goods_receipts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "goods_receipt_divergences_goodsReceiptId_idx" ON "goods_receipt_divergences"("goodsReceiptId");

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_divergences" ADD CONSTRAINT "goods_receipt_divergences_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
