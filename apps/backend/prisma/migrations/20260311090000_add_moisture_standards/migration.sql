-- CreateTable
CREATE TABLE "moisture_standards" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "moisturePct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moisture_standards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moisture_standards_organizationId_idx" ON "moisture_standards"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "moisture_standards_organizationId_crop_key" ON "moisture_standards"("organizationId", "crop");

-- AddForeignKey
ALTER TABLE "moisture_standards" ADD CONSTRAINT "moisture_standards_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
