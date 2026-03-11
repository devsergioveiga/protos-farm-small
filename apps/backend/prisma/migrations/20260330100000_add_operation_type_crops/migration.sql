-- CreateTable
CREATE TABLE "operation_type_crops" (
    "id" TEXT NOT NULL,
    "operation_type_id" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_type_crops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operation_type_crops_operation_type_id_crop_key" ON "operation_type_crops"("operation_type_id", "crop");

-- CreateIndex
CREATE INDEX "operation_type_crops_operation_type_id_idx" ON "operation_type_crops"("operation_type_id");

-- AddForeignKey
ALTER TABLE "operation_type_crops" ADD CONSTRAINT "operation_type_crops_operation_type_id_fkey" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
