-- CreateEnum
CREATE TYPE "AdministrationRoute" AS ENUM ('IM', 'SC', 'IV', 'ORAL', 'INTRAMMARY', 'TOPICAL');

-- CreateEnum
CREATE TYPE "DosageUnit" AS ENUM ('MG_KG', 'ML_ANIMAL', 'FIXED_DOSE');

-- CreateEnum
CREATE TYPE "ProtocolStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "treatment_protocols" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "severity" "DiseaseSeverity",
    "author_name" TEXT NOT NULL,
    "status" "ProtocolStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "original_id" TEXT,
    "withdrawal_meat_days" INTEGER,
    "withdrawal_milk_days" INTEGER,
    "estimated_cost_cents" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_protocol_diseases" (
    "id" TEXT NOT NULL,
    "protocol_id" TEXT NOT NULL,
    "disease_id" TEXT NOT NULL,

    CONSTRAINT "treatment_protocol_diseases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_protocol_steps" (
    "id" TEXT NOT NULL,
    "protocol_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION NOT NULL,
    "dosage_unit" "DosageUnit" NOT NULL,
    "administration_route" "AdministrationRoute" NOT NULL,
    "frequency_per_day" INTEGER NOT NULL DEFAULT 1,
    "start_day" INTEGER NOT NULL DEFAULT 1,
    "duration_days" INTEGER NOT NULL,
    "withdrawal_meat_days" INTEGER,
    "withdrawal_milk_days" INTEGER,
    "notes" TEXT,

    CONSTRAINT "treatment_protocol_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_protocols_organization_id_idx" ON "treatment_protocols"("organization_id");
CREATE INDEX "treatment_protocols_original_id_idx" ON "treatment_protocols"("original_id");
CREATE INDEX "treatment_protocols_status_idx" ON "treatment_protocols"("status");
CREATE UNIQUE INDEX "treatment_protocols_name_organization_id_version_key" ON "treatment_protocols"("name", "organization_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_protocol_diseases_protocol_id_disease_id_key" ON "treatment_protocol_diseases"("protocol_id", "disease_id");
CREATE INDEX "treatment_protocol_diseases_protocol_id_idx" ON "treatment_protocol_diseases"("protocol_id");
CREATE INDEX "treatment_protocol_diseases_disease_id_idx" ON "treatment_protocol_diseases"("disease_id");

-- CreateIndex
CREATE INDEX "treatment_protocol_steps_protocol_id_idx" ON "treatment_protocol_steps"("protocol_id");

-- AddForeignKey
ALTER TABLE "treatment_protocols" ADD CONSTRAINT "treatment_protocols_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treatment_protocols" ADD CONSTRAINT "treatment_protocols_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "treatment_protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_protocol_diseases" ADD CONSTRAINT "treatment_protocol_diseases_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "treatment_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "treatment_protocol_diseases" ADD CONSTRAINT "treatment_protocol_diseases_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_protocol_steps" ADD CONSTRAINT "treatment_protocol_steps_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "treatment_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "treatment_protocol_steps" ADD CONSTRAINT "treatment_protocol_steps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
