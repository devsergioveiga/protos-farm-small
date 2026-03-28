-- AlterTable: Split producers.address into separate address fields
ALTER TABLE "producers" RENAME COLUMN "address" TO "street";

ALTER TABLE "producers" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "producers" ADD COLUMN "complement" TEXT;
ALTER TABLE "producers" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "producers" ADD COLUMN "district" TEXT;
ALTER TABLE "producers" ADD COLUMN "locationReference" TEXT;
