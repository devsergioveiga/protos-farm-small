-- CreateTable
CREATE TABLE "operation_type_fields" (
    "id" TEXT NOT NULL,
    "operation_type_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'optional',
    "sort_order" INT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "operation_type_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operation_type_fields_operation_type_id_field_key_key"
    ON "operation_type_fields" ("operation_type_id", "field_key");

-- CreateIndex
CREATE INDEX "operation_type_fields_operation_type_id_idx"
    ON "operation_type_fields" ("operation_type_id");

-- AddForeignKey
ALTER TABLE "operation_type_fields"
    ADD CONSTRAINT "operation_type_fields_operation_type_id_fkey"
    FOREIGN KEY ("operation_type_id")
    REFERENCES "operation_types" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "operation_type_fields" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operation_type_fields_org_isolation" ON "operation_type_fields"
    USING (
        CASE
            WHEN current_setting('app.bypass_rls', true) = 'true' THEN true
            ELSE "operation_type_id" IN (
                SELECT id FROM "operation_types"
                WHERE "organization_id" = current_setting('app.current_organization_id', true)
            )
        END
    );
