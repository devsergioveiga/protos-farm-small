-- AlterTable: add tank mix fields to pesticide_applications
ALTER TABLE "pesticide_applications" ADD COLUMN "adjuvant" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "adjuvantDose" DECIMAL(10,4);
ALTER TABLE "pesticide_applications" ADD COLUMN "tankMixOrder" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "tankMixPh" DECIMAL(4,2);
