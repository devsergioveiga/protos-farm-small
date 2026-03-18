-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('RASCUNHO', 'AGUARDANDO_PROPOSTA', 'EM_ANALISE', 'APROVADA', 'CANCELADA', 'FECHADA');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('RASCUNHO', 'EMITIDA', 'CONFIRMADA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADA');

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "sequentialNumber" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'RASCUNHO',
    "responseDeadline" TIMESTAMP(3),
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvalJustification" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_suppliers" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_proposals" (
    "id" TEXT NOT NULL,
    "quotationSupplierId" TEXT NOT NULL,
    "freightTotal" DECIMAL(12,2),
    "taxTotal" DECIMAL(12,2),
    "paymentTerms" TEXT,
    "validUntil" TIMESTAMP(3),
    "deliveryDays" INTEGER,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "notes" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_proposal_items" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "purchaseRequestItemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "quotation_proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_item_selections" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "purchaseRequestItemId" TEXT NOT NULL,
    "quotationSupplierId" TEXT NOT NULL,

    CONSTRAINT "quotation_item_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationId" TEXT,
    "supplierId" TEXT NOT NULL,
    "sequentialNumber" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'RASCUNHO',
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "emergencyJustification" TEXT,
    "notes" TEXT,
    "internalReference" TEXT,
    "expectedDeliveryDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "purchaseRequestItemId" TEXT,
    "productName" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_organizationId_sequentialNumber_key" ON "quotations"("organizationId", "sequentialNumber");

-- CreateIndex
CREATE INDEX "quotations_organizationId_status_idx" ON "quotations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "quotations_purchaseRequestId_idx" ON "quotations"("purchaseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_suppliers_quotationId_supplierId_key" ON "quotation_suppliers"("quotationId", "supplierId");

-- CreateIndex
CREATE INDEX "quotation_suppliers_quotationId_idx" ON "quotation_suppliers"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_proposals_quotationSupplierId_key" ON "quotation_proposals"("quotationSupplierId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_proposal_items_proposalId_purchaseRequestItemId_key" ON "quotation_proposal_items"("proposalId", "purchaseRequestItemId");

-- CreateIndex
CREATE INDEX "quotation_proposal_items_proposalId_idx" ON "quotation_proposal_items"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_item_selections_quotationId_purchaseRequestItemId_key" ON "quotation_item_selections"("quotationId", "purchaseRequestItemId");

-- CreateIndex
CREATE INDEX "quotation_item_selections_quotationId_idx" ON "quotation_item_selections"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organizationId_sequentialNumber_key" ON "purchase_orders"("organizationId", "sequentialNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_organizationId_status_idx" ON "purchase_orders"("organizationId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_suppliers" ADD CONSTRAINT "quotation_suppliers_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_suppliers" ADD CONSTRAINT "quotation_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_proposals" ADD CONSTRAINT "quotation_proposals_quotationSupplierId_fkey" FOREIGN KEY ("quotationSupplierId") REFERENCES "quotation_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_proposal_items" ADD CONSTRAINT "quotation_proposal_items_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "quotation_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_proposal_items" ADD CONSTRAINT "quotation_proposal_items_purchaseRequestItemId_fkey" FOREIGN KEY ("purchaseRequestItemId") REFERENCES "purchase_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item_selections" ADD CONSTRAINT "quotation_item_selections_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item_selections" ADD CONSTRAINT "quotation_item_selections_purchaseRequestItemId_fkey" FOREIGN KEY ("purchaseRequestItemId") REFERENCES "purchase_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item_selections" ADD CONSTRAINT "quotation_item_selections_quotationSupplierId_fkey" FOREIGN KEY ("quotationSupplierId") REFERENCES "quotation_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
