/**
 * Offline entity types — mirrors backend models for local SQLite storage.
 * Field names use snake_case to match SQLite column conventions.
 */

export interface OfflineFarm {
  id: string;
  name: string;
  nickname: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  total_area_ha: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  organization_id: string;
  latitude: number | null;
  longitude: number | null;
  boundary_geojson: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineFieldPlot {
  id: string;
  farm_id: string;
  name: string;
  code: string | null;
  soil_type: string | null;
  current_crop: string | null;
  previous_crop: string | null;
  notes: string | null;
  boundary_area_ha: number | null;
  boundary_geojson: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineFarmLocation {
  id: string;
  farm_id: string;
  name: string;
  type: 'PASTURE' | 'FACILITY';
  boundary_area_ha: number | null;
  boundary_geojson: string | null;
  capacity_ua: number | null;
  capacity_animals: number | null;
  forage_type: string | null;
  pasture_status: string | null;
  facility_type: string | null;
  facility_status: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineAnimalLot {
  id: string;
  farm_id: string;
  name: string;
  predominant_category: string | null;
  current_location: string | null;
  location_type: string | null;
  location_id: string | null;
  max_capacity: number | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineAnimal {
  id: string;
  farm_id: string;
  ear_tag: string;
  rfid_tag: string | null;
  name: string | null;
  sex: 'MALE' | 'FEMALE';
  birth_date: string | null;
  birth_date_estimated: number;
  category: string;
  category_suggested: string | null;
  origin: 'BORN' | 'PURCHASED';
  entry_weight_kg: number | null;
  body_condition_score: number | null;
  sire_id: string | null;
  dam_id: string | null;
  lot_id: string | null;
  pasture_id: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineAnimalBreedComposition {
  id: string;
  animal_id: string;
  breed_id: string;
  breed_name: string;
  fraction: number;
  percentage: number;
}

export interface SyncMeta {
  entity: string;
  last_synced_at: string;
  record_count: number;
}

export interface TileCacheMeta {
  farm_id: string;
  min_zoom: number;
  max_zoom: number;
  total_tiles: number;
  downloaded_tiles: number;
  cache_size_bytes: number;
  bbox_south: number;
  bbox_west: number;
  bbox_north: number;
  bbox_east: number;
  status: 'pending' | 'downloading' | 'complete' | 'error';
  created_at: string;
  updated_at: string;
}

/** Operation types for field operations quick register */
export type FieldOperationType =
  | 'PULVERIZACAO'
  | 'ADUBACAO'
  | 'PLANTIO'
  | 'COLHEITA'
  | 'IRRIGACAO'
  | 'MANEJO_PASTO'
  | 'VACINACAO'
  | 'VERMIFUGACAO'
  | 'INSEMINACAO'
  | 'MOVIMENTACAO'
  | 'PESAGEM'
  | 'OUTRO';

/** Location type for field operations */
export type FieldOperationLocationType = 'PLOT' | 'PASTURE' | 'FACILITY';

export interface OfflineFieldOperation {
  id: string;
  farm_id: string;
  location_id: string | null;
  location_type: FieldOperationLocationType | null;
  location_name: string | null;
  operation_type: FieldOperationType;
  notes: string | null;
  photo_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string;
  synced: number;
  created_at: string;
  updated_at: string;
}

export interface OfflinePesticideApplication {
  id: string;
  farm_id: string;
  field_plot_id: string;
  field_plot_name: string;
  applied_at: string;
  product_name: string;
  active_ingredient: string;
  dose: number;
  dose_unit: string;
  spray_volume: number;
  target: string;
  target_description: string | null;
  art_number: string | null;
  agronomist_crea: string | null;
  technical_justification: string | null;
  temperature: number | null;
  relative_humidity: number | null;
  wind_speed: number | null;
  withdrawal_period_days: number | null;
  notes: string | null;
  photo_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  synced: number;
  created_at: string;
  updated_at: string;
}

export interface OfflineOperationTemplate {
  id: string;
  farm_id: string;
  name: string;
  operation_type: FieldOperationType;
  default_notes: string | null;
  usage_count: number;
  created_at: string;
}

export interface OfflinePest {
  id: string;
  common_name: string;
  scientific_name: string | null;
  category: string;
  control_threshold: number | null;
  recommended_products: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineMonitoringPoint {
  id: string;
  farm_id: string;
  field_plot_id: string;
  code: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export type InfestationLevel = 'AUSENTE' | 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';

export interface OfflineMonitoringRecord {
  id: string;
  farm_id: string;
  field_plot_id: string;
  monitoring_point_id: string;
  monitoring_point_code: string;
  pest_id: string;
  pest_name: string;
  observed_at: string;
  infestation_level: InfestationLevel;
  sample_count: number | null;
  pest_count: number | null;
  growth_stage: string | null;
  has_natural_enemies: number;
  natural_enemies_desc: string | null;
  damage_percentage: number | null;
  photo_uri: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  synced: number;
  created_at: string;
  updated_at: string;
}

/** Entities that can be synced */
export type SyncEntity =
  | 'farms'
  | 'field_plots'
  | 'farm_locations'
  | 'animal_lots'
  | 'animals'
  | 'animal_breed_compositions'
  | 'pests'
  | 'monitoring_points';
