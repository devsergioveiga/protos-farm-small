-- AlterTable - Add prescription/receituário fields
ALTER TABLE "pesticide_applications" ADD COLUMN "artNumber" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "agronomistCrea" TEXT;
ALTER TABLE "pesticide_applications" ADD COLUMN "technicalJustification" TEXT;
