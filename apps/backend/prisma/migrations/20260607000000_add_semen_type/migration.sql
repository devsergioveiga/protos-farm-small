-- CreateEnum
CREATE TYPE "SemenType" AS ENUM ('CONVENTIONAL', 'SEXED_FEMALE', 'SEXED_MALE');

-- AlterTable
ALTER TABLE "semen_batches" ADD COLUMN "semenType" "SemenType" NOT NULL DEFAULT 'SEXED_FEMALE';
