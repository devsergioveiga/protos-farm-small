-- CreateTable
CREATE TABLE "operation_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "operation_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_types_organization_id_parent_id_idx" ON "operation_types"("organization_id", "parent_id");

-- CreateIndex
CREATE INDEX "operation_types_organization_id_level_idx" ON "operation_types"("organization_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "operation_types_name_parent_id_organization_id_key" ON "operation_types"("name", "parent_id", "organization_id") WHERE "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "operation_types" ADD CONSTRAINT "operation_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_types" ADD CONSTRAINT "operation_types_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "operation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
