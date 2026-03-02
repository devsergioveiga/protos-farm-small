-- US-015: Suporte a perímetro georreferenciado (fazenda e matrícula)

-- boundary em farm_registrations (farms já possui a coluna)
ALTER TABLE farm_registrations ADD COLUMN boundary geometry(Polygon, 4326);

-- Cache de área calculada pelo PostGIS (hectares)
ALTER TABLE farms ADD COLUMN "boundaryAreaHa" DECIMAL(12,4);
ALTER TABLE farm_registrations ADD COLUMN "boundaryAreaHa" DECIMAL(12,4);

-- Índices espaciais GiST para consultas geográficas performáticas
CREATE INDEX idx_farms_boundary_gist ON farms USING GIST (boundary);
CREATE INDEX idx_farm_registrations_boundary_gist ON farm_registrations USING GIST (boundary);
