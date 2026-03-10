-- CreateTable
CREATE TABLE "crop_operation_sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "operation_type_id" TEXT NOT NULL,
    "sequence_order" INT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "crop_operation_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crop_operation_sequences_org_crop_operation_key"
    ON "crop_operation_sequences" ("organization_id", "crop", "operation_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "crop_operation_sequences_org_crop_order_key"
    ON "crop_operation_sequences" ("organization_id", "crop", "sequence_order");

-- CreateIndex
CREATE INDEX "crop_operation_sequences_org_crop_idx"
    ON "crop_operation_sequences" ("organization_id", "crop");

-- AddForeignKey
ALTER TABLE "crop_operation_sequences"
    ADD CONSTRAINT "crop_operation_sequences_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_operation_sequences"
    ADD CONSTRAINT "crop_operation_sequences_operation_type_id_fkey"
    FOREIGN KEY ("operation_type_id")
    REFERENCES "operation_types" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "crop_operation_sequences" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crop_operation_sequences_org_isolation" ON "crop_operation_sequences"
    USING (
        CASE
            WHEN current_setting('app.bypass_rls', true) = 'true' THEN true
            ELSE "organization_id" = current_setting('app.current_organization_id', true)
        END
    );
