-- CreateEnum
CREATE TYPE "SanitaryProcedureType" AS ENUM ('VACCINATION', 'DEWORMING', 'EXAM', 'MEDICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SanitaryTriggerType" AS ENUM ('AGE', 'EVENT', 'CALENDAR');

-- CreateEnum
CREATE TYPE "SanitaryEventTrigger" AS ENUM ('BIRTH', 'WEANING', 'REPRODUCTIVE_RELEASE', 'PRE_IATF', 'DRYING', 'PRE_PARTUM', 'POST_PARTUM', 'TRANSITION', 'FARM_ENTRY', 'FARM_EXIT');

-- CreateEnum
CREATE TYPE "CalendarFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SanitaryProtocolStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "sanitary_protocols" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "author_name" TEXT NOT NULL,
    "status" "SanitaryProtocolStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "original_id" TEXT,
    "is_obligatory" BOOLEAN NOT NULL DEFAULT false,
    "target_categories" "AnimalCategory"[],
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sanitary_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanitary_protocol_items" (
    "id" TEXT NOT NULL,
    "protocol_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "procedure_type" "SanitaryProcedureType" NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION,
    "dosage_unit" "DosageUnit",
    "administration_route" "AdministrationRoute",
    "trigger_type" "SanitaryTriggerType" NOT NULL,
    "trigger_age_days" INTEGER,
    "trigger_age_max_days" INTEGER,
    "trigger_event" "SanitaryEventTrigger",
    "trigger_event_offset_days" INTEGER,
    "calendar_frequency" "CalendarFrequency",
    "calendar_months" INTEGER[],
    "is_reinforcement" BOOLEAN NOT NULL DEFAULT false,
    "reinforcement_interval_days" INTEGER,
    "reinforcement_dose_number" INTEGER,
    "withdrawal_meat_days" INTEGER,
    "withdrawal_milk_days" INTEGER,
    "notes" TEXT,

    CONSTRAINT "sanitary_protocol_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sanitary_protocols_organization_id_idx" ON "sanitary_protocols"("organization_id");
CREATE INDEX "sanitary_protocols_original_id_idx" ON "sanitary_protocols"("original_id");
CREATE INDEX "sanitary_protocols_status_idx" ON "sanitary_protocols"("status");
CREATE UNIQUE INDEX "sanitary_protocols_name_organization_id_version_key" ON "sanitary_protocols"("name", "organization_id", "version");

-- CreateIndex
CREATE INDEX "sanitary_protocol_items_protocol_id_idx" ON "sanitary_protocol_items"("protocol_id");

-- AddForeignKey
ALTER TABLE "sanitary_protocols" ADD CONSTRAINT "sanitary_protocols_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanitary_protocols" ADD CONSTRAINT "sanitary_protocols_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "sanitary_protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanitary_protocol_items" ADD CONSTRAINT "sanitary_protocol_items_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "sanitary_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanitary_protocol_items" ADD CONSTRAINT "sanitary_protocol_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
