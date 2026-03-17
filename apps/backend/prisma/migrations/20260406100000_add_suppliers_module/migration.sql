-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SupplierCategory" AS ENUM ('INSUMO_AGRICOLA', 'PECUARIO', 'PECAS', 'COMBUSTIVEL', 'EPI', 'SERVICOS', 'OUTROS');

-- CreateEnum
CREATE TYPE "SupplierDocumentType" AS ENUM ('CONTRATO', 'CERTIDAO', 'ALVARA', 'OUTRO');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" VARCHAR(2),
    "zipCode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "paymentTerms" TEXT,
    "freightType" TEXT,
    "notes" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "categories" "SupplierCategory"[],
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_documents" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "type" "SupplierDocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ratings" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deadline" INTEGER NOT NULL,
    "quality" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "service" INTEGER NOT NULL,
    "comment" TEXT,
    "ratedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_organizationId_idx" ON "suppliers"("organizationId");

-- CreateIndex
CREATE INDEX "suppliers_organizationId_status_idx" ON "suppliers"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_document_organizationId_key" ON "suppliers"("document", "organizationId");

-- CreateIndex
CREATE INDEX "supplier_documents_supplierId_idx" ON "supplier_documents"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_ratings_supplierId_idx" ON "supplier_ratings"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_ratings_organizationId_idx" ON "supplier_ratings"("organizationId");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_documents" ADD CONSTRAINT "supplier_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ratings" ADD CONSTRAINT "supplier_ratings_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
