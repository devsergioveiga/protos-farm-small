-- Add withdrawal period (carência) to health records
ALTER TABLE animal_health_records ADD COLUMN "withdrawalDays" INTEGER;
