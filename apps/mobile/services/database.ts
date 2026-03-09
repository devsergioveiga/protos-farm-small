import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Database version — increment when adding new migrations.
 * Each version maps to a migration function in the migrations array.
 */
const DATABASE_VERSION = 6;

/**
 * Run migrations on database init (called by SQLiteProvider onInit).
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  if (currentVersion === 0) {
    await migrationV1(db);
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await migrationV2(db);
    currentVersion = 2;
  }

  if (currentVersion === 2) {
    await migrationV3(db);
    currentVersion = 3;
  }

  if (currentVersion === 3) {
    await migrationV4(db);
    currentVersion = 4;
  }

  if (currentVersion === 4) {
    await migrationV5(db);
    currentVersion = 5;
  }

  if (currentVersion === 5) {
    await migrationV6(db);
    currentVersion = 6;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

/**
 * V1 — Initial schema: essential offline data tables + sync metadata.
 */
async function migrationV1(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      nickname TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      total_area_ha REAL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      organization_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_plots (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      soil_type TEXT,
      current_crop TEXT,
      previous_crop TEXT,
      notes TEXT,
      boundary_area_ha REAL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS farm_locations (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      boundary_area_ha REAL,
      capacity_ua REAL,
      capacity_animals INTEGER,
      forage_type TEXT,
      pasture_status TEXT,
      facility_type TEXT,
      facility_status TEXT,
      description TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS animal_lots (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      name TEXT NOT NULL,
      predominant_category TEXT,
      current_location TEXT,
      location_type TEXT,
      location_id TEXT,
      max_capacity INTEGER,
      description TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES farm_locations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS animals (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      ear_tag TEXT NOT NULL,
      rfid_tag TEXT,
      name TEXT,
      sex TEXT NOT NULL,
      birth_date TEXT,
      birth_date_estimated INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      category_suggested TEXT,
      origin TEXT NOT NULL DEFAULT 'BORN',
      entry_weight_kg REAL,
      body_condition_score INTEGER,
      sire_id TEXT,
      dam_id TEXT,
      lot_id TEXT,
      pasture_id TEXT,
      photo_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY (lot_id) REFERENCES animal_lots(id) ON DELETE SET NULL,
      FOREIGN KEY (pasture_id) REFERENCES farm_locations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS animal_breed_compositions (
      id TEXT PRIMARY KEY NOT NULL,
      animal_id TEXT NOT NULL,
      breed_id TEXT NOT NULL,
      breed_name TEXT NOT NULL,
      fraction REAL NOT NULL,
      percentage REAL NOT NULL,
      FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      entity TEXT PRIMARY KEY NOT NULL,
      last_synced_at TEXT NOT NULL,
      record_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_field_plots_farm ON field_plots(farm_id);
    CREATE INDEX IF NOT EXISTS idx_farm_locations_farm ON farm_locations(farm_id);
    CREATE INDEX IF NOT EXISTS idx_animal_lots_farm ON animal_lots(farm_id);
    CREATE INDEX IF NOT EXISTS idx_animals_farm ON animals(farm_id);
    CREATE INDEX IF NOT EXISTS idx_animals_lot ON animals(lot_id);
    CREATE INDEX IF NOT EXISTS idx_animals_pasture ON animals(pasture_id);
    CREATE INDEX IF NOT EXISTS idx_animals_ear_tag ON animals(ear_tag);
    CREATE INDEX IF NOT EXISTS idx_animal_breed_comp_animal ON animal_breed_compositions(animal_id);
  `);
}

/**
 * V2 — Pending operations queue for offline CRUD.
 */
async function migrationV2(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_pending_ops_status ON pending_operations(status);
    CREATE INDEX IF NOT EXISTS idx_pending_ops_entity ON pending_operations(entity, entity_id);
  `);
}

/**
 * V3 — Conflict log for last-write-wins resolution.
 */
async function migrationV3(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conflict_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      local_payload TEXT NOT NULL,
      server_payload TEXT NOT NULL,
      resolution TEXT NOT NULL DEFAULT 'server_wins',
      resolved_at TEXT NOT NULL,
      reviewed INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_conflict_log_entity ON conflict_log(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_conflict_log_reviewed ON conflict_log(reviewed);
  `);
}

/**
 * V4 — Add boundary GeoJSON columns for offline map rendering + tile cache metadata.
 */
async function migrationV4(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE farms ADD COLUMN boundary_geojson TEXT;
    ALTER TABLE field_plots ADD COLUMN boundary_geojson TEXT;
    ALTER TABLE farm_locations ADD COLUMN boundary_geojson TEXT;

    CREATE TABLE IF NOT EXISTS tile_cache_meta (
      farm_id TEXT PRIMARY KEY NOT NULL,
      min_zoom INTEGER NOT NULL,
      max_zoom INTEGER NOT NULL,
      total_tiles INTEGER NOT NULL DEFAULT 0,
      downloaded_tiles INTEGER NOT NULL DEFAULT 0,
      cache_size_bytes INTEGER NOT NULL DEFAULT 0,
      bbox_south REAL NOT NULL,
      bbox_west REAL NOT NULL,
      bbox_north REAL NOT NULL,
      bbox_east REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );
  `);
}

/**
 * V5 — Field operations + operation templates for quick registration.
 */
async function migrationV5(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS field_operations (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      location_id TEXT,
      location_type TEXT,
      location_name TEXT,
      operation_type TEXT NOT NULL,
      notes TEXT,
      photo_uri TEXT,
      latitude REAL,
      longitude REAL,
      recorded_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_operations_farm ON field_operations(farm_id);
    CREATE INDEX IF NOT EXISTS idx_operations_synced ON field_operations(synced);

    CREATE TABLE IF NOT EXISTS operation_templates (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      name TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      default_notes TEXT,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_templates_farm ON operation_templates(farm_id);
  `);
}

/**
 * V6 — Pesticide applications for offline mobile registration.
 */
async function migrationV6(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pesticide_applications (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      field_plot_id TEXT NOT NULL,
      field_plot_name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      product_name TEXT NOT NULL,
      active_ingredient TEXT NOT NULL,
      dose REAL NOT NULL,
      dose_unit TEXT NOT NULL DEFAULT 'L_HA',
      spray_volume REAL NOT NULL,
      target TEXT NOT NULL,
      target_description TEXT,
      art_number TEXT,
      agronomist_crea TEXT,
      technical_justification TEXT,
      temperature REAL,
      relative_humidity REAL,
      wind_speed REAL,
      withdrawal_period_days INTEGER,
      notes TEXT,
      photo_uri TEXT,
      latitude REAL,
      longitude REAL,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pesticide_apps_farm ON pesticide_applications(farm_id);
    CREATE INDEX IF NOT EXISTS idx_pesticide_apps_synced ON pesticide_applications(synced);
    CREATE INDEX IF NOT EXISTS idx_pesticide_apps_applied ON pesticide_applications(applied_at);
  `);
}

export const DB_NAME = 'protosfarm.db';
