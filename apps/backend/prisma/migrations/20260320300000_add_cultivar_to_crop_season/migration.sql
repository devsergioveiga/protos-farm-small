-- AlterTable
ALTER TABLE "plot_crop_seasons" ADD COLUMN "cultivarId" TEXT;

-- CreateIndex
CREATE INDEX "plot_crop_seasons_cultivarId_idx" ON "plot_crop_seasons"("cultivarId");

-- AddForeignKey
ALTER TABLE "plot_crop_seasons" ADD CONSTRAINT "plot_crop_seasons_cultivarId_fkey" FOREIGN KEY ("cultivarId") REFERENCES "cultivars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
