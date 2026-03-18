-- AlterTable: change rural_properties.boundary from Polygon to MultiPolygon
-- Existing Polygon data is wrapped in ST_Multi to become MultiPolygon

ALTER TABLE "rural_properties"
  ALTER COLUMN "boundary" TYPE geometry(MultiPolygon, 4326)
  USING CASE
    WHEN boundary IS NOT NULL THEN ST_Multi(boundary)
    ELSE NULL
  END;
