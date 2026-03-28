-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "accountantCpf" VARCHAR(14),
ADD COLUMN     "accountantCrc" VARCHAR(20),
ADD COLUMN     "accountantName" TEXT,
ADD COLUMN     "integratedReportNotes" TEXT;
