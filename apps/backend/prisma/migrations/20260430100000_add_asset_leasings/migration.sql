-- CreateEnum
CREATE TYPE "LeasingStatus" AS ENUM ('ACTIVE', 'PURCHASE_OPTION_EXERCISED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "asset_leasings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "rouAssetId" TEXT NOT NULL,
    "lessorName" TEXT NOT NULL,
    "lessorDocument" TEXT,
    "contractNumber" TEXT,
    "contractDate" DATE NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalContractValue" DECIMAL(15,2) NOT NULL,
    "monthlyInstallment" DECIMAL(15,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "purchaseOptionValue" DECIMAL(15,2),
    "purchaseOptionDate" DATE,
    "hasPurchaseOption" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeasingStatus" NOT NULL DEFAULT 'ACTIVE',
    "payableId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_leasings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_leasings_rouAssetId_key" ON "asset_leasings"("rouAssetId");

-- CreateIndex
CREATE INDEX "asset_leasings_organizationId_status_idx" ON "asset_leasings"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "asset_leasings" ADD CONSTRAINT "asset_leasings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_leasings" ADD CONSTRAINT "asset_leasings_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_leasings" ADD CONSTRAINT "asset_leasings_rouAssetId_fkey" FOREIGN KEY ("rouAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_leasings" ADD CONSTRAINT "asset_leasings_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
