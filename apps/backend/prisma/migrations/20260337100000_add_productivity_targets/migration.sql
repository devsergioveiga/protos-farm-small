-- CreateTable
CREATE TABLE "productivity_targets" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "operationType" "FieldOperationType" NOT NULL,
    "targetValue" DECIMAL(12,4) NOT NULL,
    "targetUnit" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'day',
    "ratePerUnit" DECIMAL(12,4),
    "rateUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productivity_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "productivity_targets_farmId_idx" ON "productivity_targets"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "productivity_targets_farmId_operationType_targetUnit_key" ON "productivity_targets"("farmId", "operationType", "targetUnit");

-- AddForeignKey
ALTER TABLE "productivity_targets" ADD CONSTRAINT "productivity_targets_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
