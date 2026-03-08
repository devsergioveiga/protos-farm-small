-- AlterTable: add equipment fields to pesticide_applications
ALTER TABLE "pesticide_applications" ADD COLUMN "sprayerType" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "nozzleType" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "workingPressure" DECIMAL(7,2);
ALTER TABLE "pesticide_applications" ADD COLUMN "applicationSpeed" DECIMAL(5,2);
