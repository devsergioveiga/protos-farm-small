-- AlterTable
ALTER TABLE "rural_properties" ADD COLUMN "registeredAreaHa" DECIMAL(12,4),
ADD COLUMN "possessionByTitleHa" DECIMAL(12,4),
ADD COLUMN "possessionByOccupationHa" DECIMAL(12,4),
ADD COLUMN "measuredAreaHa" DECIMAL(12,4);
