-- Fix vaccinations table column names to match Prisma schema (camelCase)
-- The original migration used snake_case but Prisma fields have no @map annotations

ALTER TABLE "vaccinations" RENAME COLUMN "organization_id" TO "organizationId";
ALTER TABLE "vaccinations" RENAME COLUMN "farm_id" TO "farmId";
ALTER TABLE "vaccinations" RENAME COLUMN "animal_id" TO "animalId";
ALTER TABLE "vaccinations" RENAME COLUMN "product_id" TO "productId";
ALTER TABLE "vaccinations" RENAME COLUMN "product_name" TO "productName";
ALTER TABLE "vaccinations" RENAME COLUMN "dosage_ml" TO "dosageMl";
ALTER TABLE "vaccinations" RENAME COLUMN "administration_route" TO "administrationRoute";
ALTER TABLE "vaccinations" RENAME COLUMN "product_batch_number" TO "productBatchNumber";
ALTER TABLE "vaccinations" RENAME COLUMN "product_expiry_date" TO "productExpiryDate";
ALTER TABLE "vaccinations" RENAME COLUMN "vaccination_date" TO "vaccinationDate";
ALTER TABLE "vaccinations" RENAME COLUMN "responsible_name" TO "responsibleName";
ALTER TABLE "vaccinations" RENAME COLUMN "veterinary_name" TO "veterinaryName";
ALTER TABLE "vaccinations" RENAME COLUMN "protocol_item_id" TO "protocolItemId";
ALTER TABLE "vaccinations" RENAME COLUMN "campaign_id" TO "campaignId";
ALTER TABLE "vaccinations" RENAME COLUMN "dose_number" TO "doseNumber";
ALTER TABLE "vaccinations" RENAME COLUMN "next_dose_date" TO "nextDoseDate";
ALTER TABLE "vaccinations" RENAME COLUMN "withdrawal_meat_days" TO "withdrawalMeatDays";
ALTER TABLE "vaccinations" RENAME COLUMN "withdrawal_milk_days" TO "withdrawalMilkDays";
ALTER TABLE "vaccinations" RENAME COLUMN "withdrawal_end_date" TO "withdrawalEndDate";
ALTER TABLE "vaccinations" RENAME COLUMN "stock_output_id" TO "stockOutputId";
ALTER TABLE "vaccinations" RENAME COLUMN "animal_lot_id" TO "animalLotId";
ALTER TABLE "vaccinations" RENAME COLUMN "recorded_by" TO "recordedBy";
ALTER TABLE "vaccinations" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "vaccinations" RENAME COLUMN "updated_at" TO "updatedAt";
