-- CreateEnum
CREATE TYPE "IatfProtocolStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "iatf_protocols" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetCategory" TEXT NOT NULL,
    "veterinaryAuthor" TEXT,
    "status" "IatfProtocolStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iatf_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iatf_protocol_steps" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "isAiDay" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iatf_protocol_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iatf_protocol_step_products" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "dose" DOUBLE PRECISION NOT NULL,
    "doseUnit" TEXT NOT NULL,
    "administrationRoute" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iatf_protocol_step_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "iatf_protocols_organizationId_idx" ON "iatf_protocols"("organizationId");
CREATE INDEX "iatf_protocols_status_idx" ON "iatf_protocols"("status");
CREATE INDEX "iatf_protocols_parentId_idx" ON "iatf_protocols"("parentId");
CREATE INDEX "iatf_protocol_steps_protocolId_idx" ON "iatf_protocol_steps"("protocolId");
CREATE INDEX "iatf_protocol_step_products_stepId_idx" ON "iatf_protocol_step_products"("stepId");

-- AddForeignKey
ALTER TABLE "iatf_protocols" ADD CONSTRAINT "iatf_protocols_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iatf_protocols" ADD CONSTRAINT "iatf_protocols_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iatf_protocols" ADD CONSTRAINT "iatf_protocols_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "iatf_protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "iatf_protocol_steps" ADD CONSTRAINT "iatf_protocol_steps_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "iatf_protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "iatf_protocol_step_products" ADD CONSTRAINT "iatf_protocol_step_products_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "iatf_protocol_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iatf_protocol_step_products" ADD CONSTRAINT "iatf_protocol_step_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "iatf_protocols" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "iatf_protocol_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "iatf_protocol_step_products" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iatf_protocols_org_isolation" ON "iatf_protocols"
  USING ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY "iatf_protocol_steps_org_isolation" ON "iatf_protocol_steps"
  USING ("protocolId" IN (
    SELECT "id" FROM "iatf_protocols"
    WHERE "organizationId" = current_setting('app.organization_id', true)
  ));

CREATE POLICY "iatf_protocol_step_products_org_isolation" ON "iatf_protocol_step_products"
  USING ("stepId" IN (
    SELECT s."id" FROM "iatf_protocol_steps" s
    JOIN "iatf_protocols" p ON s."protocolId" = p."id"
    WHERE p."organizationId" = current_setting('app.organization_id', true)
  ));
