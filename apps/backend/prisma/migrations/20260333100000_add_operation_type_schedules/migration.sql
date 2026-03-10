-- CreateTable
CREATE TABLE "operation_type_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "operation_type_id" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "start_day" INT,
    "start_month" INT,
    "end_day" INT,
    "end_month" INT,
    "pheno_stage" TEXT,
    "offset_days" INT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "operation_type_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operation_type_schedules_org_op_crop_key"
    ON "operation_type_schedules" ("organization_id", "operation_type_id", "crop");

-- CreateIndex
CREATE INDEX "operation_type_schedules_org_crop_idx"
    ON "operation_type_schedules" ("organization_id", "crop");

-- CreateIndex
CREATE INDEX "operation_type_schedules_operation_type_id_idx"
    ON "operation_type_schedules" ("operation_type_id");

-- AddForeignKey
ALTER TABLE "operation_type_schedules"
    ADD CONSTRAINT "operation_type_schedules_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_type_schedules"
    ADD CONSTRAINT "operation_type_schedules_operation_type_id_fkey"
    FOREIGN KEY ("operation_type_id")
    REFERENCES "operation_types" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "operation_type_schedules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operation_type_schedules_org_isolation" ON "operation_type_schedules"
    USING (
        CASE
            WHEN current_setting('app.bypass_rls', true) = 'true' THEN true
            ELSE "organization_id" = current_setting('app.current_organization_id', true)
        END
    );

-- Add check constraints for schedule_type validation
ALTER TABLE "operation_type_schedules"
    ADD CONSTRAINT "operation_type_schedules_type_check"
    CHECK ("schedule_type" IN ('fixed_date', 'phenological'));

ALTER TABLE "operation_type_schedules"
    ADD CONSTRAINT "operation_type_schedules_fixed_date_check"
    CHECK (
        "schedule_type" != 'fixed_date'
        OR ("start_day" IS NOT NULL AND "start_month" IS NOT NULL
            AND "end_day" IS NOT NULL AND "end_month" IS NOT NULL
            AND "start_day" BETWEEN 1 AND 31 AND "start_month" BETWEEN 1 AND 12
            AND "end_day" BETWEEN 1 AND 31 AND "end_month" BETWEEN 1 AND 12)
    );

ALTER TABLE "operation_type_schedules"
    ADD CONSTRAINT "operation_type_schedules_phenological_check"
    CHECK (
        "schedule_type" != 'phenological'
        OR ("pheno_stage" IS NOT NULL AND "offset_days" IS NOT NULL)
    );
