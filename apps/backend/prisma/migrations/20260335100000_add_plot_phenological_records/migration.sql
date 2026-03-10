-- CreateTable
CREATE TABLE "plot_phenological_records" (
    "id" TEXT NOT NULL,
    "field_plot_id" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "stage_code" TEXT NOT NULL,
    "stage_name" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "recorded_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "plot_phenological_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plot_phenological_records_plot_crop_idx"
    ON "plot_phenological_records" ("field_plot_id", "crop");

-- CreateIndex
CREATE INDEX "plot_phenological_records_plot_date_idx"
    ON "plot_phenological_records" ("field_plot_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "plot_phenological_records"
    ADD CONSTRAINT "plot_phenological_records_field_plot_id_fkey"
    FOREIGN KEY ("field_plot_id")
    REFERENCES "field_plots" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plot_phenological_records"
    ADD CONSTRAINT "plot_phenological_records_recorded_by_fkey"
    FOREIGN KEY ("recorded_by")
    REFERENCES "users" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "plot_phenological_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plot_phenological_records_org_isolation" ON "plot_phenological_records"
    USING (
        CASE
            WHEN current_setting('app.bypass_rls', true) = 'true' THEN true
            ELSE "field_plot_id" IN (
                SELECT fp.id FROM "field_plots" fp
                JOIN "farms" f ON fp."farmId" = f."id"
                WHERE f."organizationId" = current_setting('app.current_organization_id', true)
            )
        END
    );
