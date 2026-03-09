-- AlterTable
ALTER TABLE "pesticide_applications"
ADD COLUMN "withdrawalPeriodDays" INTEGER,
ADD COLUMN "safeHarvestDate" TIMESTAMP(3);
