-- AlterTable: change farm_boundary_versions.boundary from Polygon to MultiPolygon
-- to match the farms table which now stores MultiPolygon boundaries

ALTER TABLE "farm_boundary_versions"
  ALTER COLUMN "boundary" TYPE geometry(MultiPolygon, 4326)
  USING CASE
    WHEN boundary IS NOT NULL THEN ST_Multi(boundary)
    ELSE NULL
  END;
