-- CreateEnum
CREATE TYPE "DiseaseCategory" AS ENUM ('INFECTIOUS', 'METABOLIC', 'REPRODUCTIVE', 'LOCOMOTOR', 'PARASITIC', 'NUTRITIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "DiseaseSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "AffectedSystem" AS ENUM ('DIGESTIVE', 'REPRODUCTIVE', 'LOCOMOTOR', 'MAMMARY', 'RESPIRATORY', 'SYSTEMIC');

-- CreateTable
CREATE TABLE "diseases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scientific_name" TEXT,
    "code" TEXT,
    "category" "DiseaseCategory" NOT NULL,
    "severity" "DiseaseSeverity",
    "affected_system" "AffectedSystem",
    "symptoms" TEXT,
    "quarantine_days" INTEGER,
    "is_notifiable" BOOLEAN NOT NULL DEFAULT false,
    "photo_url" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diseases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diseases_organization_id_idx" ON "diseases"("organization_id");

-- CreateIndex
CREATE INDEX "diseases_category_idx" ON "diseases"("category");

-- CreateIndex
CREATE UNIQUE INDEX "diseases_name_organization_id_key" ON "diseases"("name", "organization_id");

-- AddForeignKey
ALTER TABLE "diseases" ADD CONSTRAINT "diseases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
