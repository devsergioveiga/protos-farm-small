-- CreateTable
CREATE TABLE "vaccinations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "farm_id" TEXT NOT NULL,
  "animal_id" TEXT NOT NULL,
  "product_id" TEXT,
  "product_name" TEXT NOT NULL,
  "dosage_ml" DOUBLE PRECISION NOT NULL,
  "administration_route" "AdministrationRoute" NOT NULL,
  "product_batch_number" TEXT,
  "product_expiry_date" DATE,
  "vaccination_date" DATE NOT NULL,
  "responsible_name" TEXT NOT NULL,
  "veterinary_name" TEXT,
  "protocol_item_id" TEXT,
  "campaign_id" TEXT,
  "dose_number" INTEGER NOT NULL DEFAULT 1,
  "next_dose_date" DATE,
  "withdrawal_meat_days" INTEGER,
  "withdrawal_milk_days" INTEGER,
  "withdrawal_end_date" DATE,
  "stock_output_id" TEXT,
  "animal_lot_id" TEXT,
  "notes" TEXT,
  "recorded_by" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vaccinations_organization_id_idx" ON "vaccinations"("organization_id");
CREATE INDEX "vaccinations_farm_id_idx" ON "vaccinations"("farm_id");
CREATE INDEX "vaccinations_animal_id_idx" ON "vaccinations"("animal_id");
CREATE INDEX "vaccinations_product_id_idx" ON "vaccinations"("product_id");
CREATE INDEX "vaccinations_vaccination_date_idx" ON "vaccinations"("vaccination_date");
CREATE INDEX "vaccinations_campaign_id_idx" ON "vaccinations"("campaign_id");
CREATE INDEX "vaccinations_protocol_item_id_idx" ON "vaccinations"("protocol_item_id");

-- AddForeignKey
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_farm_id_fkey"
  FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_animal_id_fkey"
  FOREIGN KEY ("animal_id") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_protocol_item_id_fkey"
  FOREIGN KEY ("protocol_item_id") REFERENCES "sanitary_protocol_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_stock_output_id_fkey"
  FOREIGN KEY ("stock_output_id") REFERENCES "stock_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_recorded_by_fkey"
  FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
