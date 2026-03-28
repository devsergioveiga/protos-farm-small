-- CreateEnum
CREATE TYPE "monthly_closing_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'REOPENED');

-- CreateTable
CREATE TABLE "monthly_closings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "monthly_closing_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "stepResults" JSONB,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_closings_organizationId_periodId_idx" ON "monthly_closings"("organizationId", "periodId");

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_closings" ADD CONSTRAINT "monthly_closings_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
