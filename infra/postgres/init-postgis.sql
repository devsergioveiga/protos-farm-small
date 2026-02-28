-- Ensure PostGIS extension is enabled on database initialization.
-- This script runs automatically via /docker-entrypoint-initdb.d/.
CREATE EXTENSION IF NOT EXISTS postgis;
