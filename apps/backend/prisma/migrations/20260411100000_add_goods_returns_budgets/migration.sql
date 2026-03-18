-- AddedEnum RETURN to StockOutputType
ALTER TYPE "StockOutputType" ADD VALUE 'RETURN';

-- CreateEnum
CREATE TYPE "GoodsReturnStatus" AS ENUM ('PENDENTE', 'EM_ANALISE', 'APROVADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "GoodsReturnReason" AS ENUM ('DEFEITO', 'VALIDADE', 'PRODUTO_ERRADO', 'EXCEDENTE', 'ESPECIFICACAO_DIVERGENTE');

-- CreateEnum
CREATE TYPE "GoodsReturnAction" AS ENUM ('TROCA', 'CREDITO', 'ESTORNO');

-- CreateEnum
CREATE TYPE "GoodsReturnResolutionStatus" AS ENUM ('PENDING', 'RESOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BudgetPeriodType" AS ENUM ('MENSAL', 'TRIMESTRAL', 'SAFRA');

-- AlterTable Payable: add goodsReturnId and isCredit
ALTER TABLE "payables" ADD COLUMN "goods_return_id" TEXT;
ALTER TABLE "payables" ADD COLUMN "is_credit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable PurchaseRequest: add budgetExceeded
ALTER TABLE "purchase_requests" ADD COLUMN "budget_exceeded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable PurchaseOrder: add budgetExceeded
ALTER TABLE "purchase_orders" ADD COLUMN "budget_exceeded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable GoodsReturn
CREATE TABLE "goods_returns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sequential_number" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "GoodsReturnStatus" NOT NULL DEFAULT 'PENDENTE',
    "reason" "GoodsReturnReason" NOT NULL,
    "expected_action" "GoodsReturnAction" NOT NULL,
    "resolution_status" "GoodsReturnResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_deadline" TIMESTAMP(3),
    "return_invoice_number" TEXT,
    "return_invoice_date" TIMESTAMP(3),
    "notes" TEXT,
    "stock_output_id" TEXT,
    "credit_payable_id" TEXT,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable GoodsReturnItem
CREATE TABLE "goods_return_items" (
    "id" TEXT NOT NULL,
    "goods_return_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "unit_name" TEXT NOT NULL,
    "return_qty" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,4) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "batch_number" TEXT,
    "photo_url" TEXT,
    "photo_file_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable PurchaseBudget
CREATE TABLE "purchase_budgets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "farm_id" TEXT,
    "cost_center_id" TEXT,
    "category" "SupplierCategory" NOT NULL,
    "period_type" "BudgetPeriodType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "budgeted_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goods_returns_organization_id_sequential_number_key" ON "goods_returns"("organization_id", "sequential_number");
CREATE INDEX "goods_returns_organization_id_status_idx" ON "goods_returns"("organization_id", "status");
CREATE INDEX "goods_returns_goods_receipt_id_idx" ON "goods_returns"("goods_receipt_id");
CREATE INDEX "goods_return_items_goods_return_id_idx" ON "goods_return_items"("goods_return_id");
CREATE INDEX "purchase_budgets_organization_id_period_start_period_end_idx" ON "purchase_budgets"("organization_id", "period_start", "period_end");
CREATE INDEX "purchase_budgets_organization_id_category_idx" ON "purchase_budgets"("organization_id", "category");

-- AddForeignKey
ALTER TABLE "goods_returns" ADD CONSTRAINT "goods_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_returns" ADD CONSTRAINT "goods_returns_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_returns" ADD CONSTRAINT "goods_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_returns" ADD CONSTRAINT "goods_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_return_items" ADD CONSTRAINT "goods_return_items_goods_return_id_fkey" FOREIGN KEY ("goods_return_id") REFERENCES "goods_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_budgets" ADD CONSTRAINT "purchase_budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_budgets" ADD CONSTRAINT "purchase_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
