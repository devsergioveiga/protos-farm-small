-- AlterTable: add environmental conditions fields to pesticide_applications
ALTER TABLE "pesticide_applications" ADD COLUMN "temperature" DECIMAL(5,2);
ALTER TABLE "pesticide_applications" ADD COLUMN "relativeHumidity" DECIMAL(5,2);
ALTER TABLE "pesticide_applications" ADD COLUMN "windSpeed" DECIMAL(5,2);
