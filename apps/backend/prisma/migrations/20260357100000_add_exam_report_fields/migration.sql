-- AlterTable: add report file fields to animal_exams
ALTER TABLE "animal_exams" ADD COLUMN "reportFileName" TEXT;
ALTER TABLE "animal_exams" ADD COLUMN "reportMimeType" TEXT;
ALTER TABLE "animal_exams" ADD COLUMN "reportPath" TEXT;
