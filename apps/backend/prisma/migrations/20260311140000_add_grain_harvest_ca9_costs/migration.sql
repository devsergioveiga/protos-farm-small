-- CA9: Custo de colheita (horas colheitadeira + transbordo + transporte)
ALTER TABLE "grain_harvests" ADD COLUMN "harvester_hours" DECIMAL(8, 2);
ALTER TABLE "grain_harvests" ADD COLUMN "harvester_cost_per_hour" DECIMAL(12, 2);
ALTER TABLE "grain_harvests" ADD COLUMN "transhipment_cost" DECIMAL(12, 2);
ALTER TABLE "grain_harvests" ADD COLUMN "transport_cost" DECIMAL(12, 2);
