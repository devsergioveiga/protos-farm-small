-- CreateTable
CREATE TABLE "asset_trade_ins" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "tradedAssetId" TEXT NOT NULL,
    "newAssetId" TEXT NOT NULL,
    "tradeInDate" DATE NOT NULL,
    "tradedAssetValue" DECIMAL(15,2) NOT NULL,
    "newAssetValue" DECIMAL(15,2) NOT NULL,
    "netPayable" DECIMAL(15,2) NOT NULL,
    "payableId" TEXT,
    "gainLossOnTrade" DECIMAL(15,2) NOT NULL,
    "supplierName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_trade_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_trade_ins_tradedAssetId_key" ON "asset_trade_ins"("tradedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_trade_ins_newAssetId_key" ON "asset_trade_ins"("newAssetId");

-- CreateIndex
CREATE INDEX "asset_trade_ins_organizationId_idx" ON "asset_trade_ins"("organizationId");

-- CreateIndex
CREATE INDEX "asset_trade_ins_farmId_idx" ON "asset_trade_ins"("farmId");

-- AddForeignKey
ALTER TABLE "asset_trade_ins" ADD CONSTRAINT "asset_trade_ins_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trade_ins" ADD CONSTRAINT "asset_trade_ins_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trade_ins" ADD CONSTRAINT "asset_trade_ins_tradedAssetId_fkey" FOREIGN KEY ("tradedAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trade_ins" ADD CONSTRAINT "asset_trade_ins_newAssetId_fkey" FOREIGN KEY ("newAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_trade_ins" ADD CONSTRAINT "asset_trade_ins_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
