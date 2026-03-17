-- AlterTable (idempotent — columns may already exist from prior manual migration)
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "ccirIssuedAt" DATE;
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "ccirGeneratedAt" DATE;
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "certifiedAreaHa" DECIMAL(12,4);
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "locationDirections" TEXT;
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "lastProcessingDate" DATE;
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "ruralModuleHa" DECIMAL(12,4);
ALTER TABLE "rural_properties" ADD COLUMN IF NOT EXISTS "ruralModulesCount" DECIMAL(12,4);
