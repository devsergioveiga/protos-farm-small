-- AlterTable
ALTER TABLE "grain_harvests" ADD COLUMN "grossWeightKg" DECIMAL(14,2);
ALTER TABLE "grain_harvests" ADD COLUMN "tareWeightKg" DECIMAL(14,2);
ALTER TABLE "grain_harvests" ADD COLUMN "netWeightKg" DECIMAL(14,2);
ALTER TABLE "grain_harvests" ADD COLUMN "weighingMethod" TEXT;
