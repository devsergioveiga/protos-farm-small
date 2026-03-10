-- CreateTable
CREATE TABLE "crop_phenological_stages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage_order" INT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "crop_phenological_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crop_phenological_stages_org_crop_code_key"
    ON "crop_phenological_stages" ("organization_id", "crop", "code");

-- CreateIndex
CREATE UNIQUE INDEX "crop_phenological_stages_org_crop_order_key"
    ON "crop_phenological_stages" ("organization_id", "crop", "stage_order");

-- CreateIndex
CREATE INDEX "crop_phenological_stages_org_crop_idx"
    ON "crop_phenological_stages" ("organization_id", "crop");

-- AddForeignKey
ALTER TABLE "crop_phenological_stages"
    ADD CONSTRAINT "crop_phenological_stages_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "crop_phenological_stages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crop_phenological_stages_org_isolation" ON "crop_phenological_stages"
    USING (
        CASE
            WHEN current_setting('app.bypass_rls', true) = 'true' THEN true
            ELSE "organization_id" = current_setting('app.current_organization_id', true)
        END
    );
