-- AlterTable
ALTER TABLE "pesticide_applications"
ADD COLUMN "withdrawal_period_days" INTEGER,
ADD COLUMN "safe_harvest_date" TIMESTAMP(3);
