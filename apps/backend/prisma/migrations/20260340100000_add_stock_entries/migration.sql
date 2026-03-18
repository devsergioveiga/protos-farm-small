-- US-090: Entrada de insumos no estoque (CA1-CA9)

-- ─── Enums ──────────────────────────────────────────────────────────

CREATE TYPE "StockEntryStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "ExpenseType" AS ENUM ('FREIGHT', 'INSURANCE', 'UNLOADING', 'TOLL', 'TEMPORARY_STORAGE', 'PACKAGING', 'PORT_FEE', 'ICMS_ST', 'IPI', 'OTHER');
CREATE TYPE "ApportionmentMethod" AS ENUM ('BY_VALUE', 'BY_QUANTITY', 'BY_WEIGHT', 'FIXED');
CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT');

-- ─── stock_entries (cabeçalho da entrada) ───────────────────────────

CREATE TABLE "stock_entries" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StockEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_name" TEXT,
    "invoice_number" TEXT,
    "invoice_file_url" TEXT,
    "storage_farm_id" TEXT,
    "storage_location" TEXT,
    "storage_sublocation" TEXT,
    "notes" TEXT,
    "total_merchandise_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_expenses_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "stock_entries_pkey" PRIMARY KEY ("id")
);

-- ─── stock_entry_items (itens da entrada — CA1, CA2, CA7) ──────────

CREATE TABLE "stock_entry_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "stock_entry_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "batch_number" TEXT,
    "manufacturing_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "apportioned_expenses" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "final_unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "final_total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "weight_kg" DECIMAL(14,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_entry_items_pkey" PRIMARY KEY ("id")
);

-- ─── stock_entry_expenses (despesas acessórias — CA3, CA4, CA6) ────

CREATE TABLE "stock_entry_expenses" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "stock_entry_id" TEXT NOT NULL,
    "expense_type" "ExpenseType" NOT NULL,
    "description" TEXT,
    "supplier_name" TEXT,
    "invoice_number" TEXT,
    "invoice_file_url" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "apportionment_method" "ApportionmentMethod" NOT NULL DEFAULT 'BY_VALUE',
    "is_retroactive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_entry_expenses_pkey" PRIMARY KEY ("id")
);

-- ─── stock_balances (saldo + custo médio por produto — CA5) ────────

CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "current_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "last_entry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ────────────────────────────────────────────────────────

CREATE INDEX "stock_entries_organization_id_idx" ON "stock_entries"("organization_id");
CREATE INDEX "stock_entries_status_idx" ON "stock_entries"("organization_id", "status");
CREATE INDEX "stock_entries_entry_date_idx" ON "stock_entries"("organization_id", "entry_date");
CREATE INDEX "stock_entries_supplier_idx" ON "stock_entries"("organization_id", "supplier_name");

CREATE INDEX "stock_entry_items_entry_id_idx" ON "stock_entry_items"("stock_entry_id");
CREATE INDEX "stock_entry_items_product_id_idx" ON "stock_entry_items"("product_id");

CREATE INDEX "stock_entry_expenses_entry_id_idx" ON "stock_entry_expenses"("stock_entry_id");

CREATE UNIQUE INDEX "stock_balances_org_product_idx" ON "stock_balances"("organization_id", "product_id");
CREATE INDEX "stock_balances_organization_id_idx" ON "stock_balances"("organization_id");

-- ─── Foreign Keys ───────────────────────────────────────────────────

ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_entries" ADD CONSTRAINT "stock_entries_storage_farm_id_fkey" FOREIGN KEY ("storage_farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_stock_entry_id_fkey" FOREIGN KEY ("stock_entry_id") REFERENCES "stock_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_entry_expenses" ADD CONSTRAINT "stock_entry_expenses_stock_entry_id_fkey" FOREIGN KEY ("stock_entry_id") REFERENCES "stock_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── RLS ────────────────────────────────────────────────────────────

ALTER TABLE "stock_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_balances" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_entries_org_isolation" ON "stock_entries"
    USING (
        organization_id = current_setting('app.current_org_id', true)
        OR current_setting('app.bypass_rls', true) = 'true'
    );

CREATE POLICY "stock_balances_org_isolation" ON "stock_balances"
    USING (
        organization_id = current_setting('app.current_org_id', true)
        OR current_setting('app.bypass_rls', true) = 'true'
    );
