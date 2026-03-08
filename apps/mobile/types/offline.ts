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

/** Entities that can be synced */
export type SyncEntity =
  | 'farms'
  | 'field_plots'
  | 'farm_locations'
  | 'animal_lots'
  | 'animals'
  | 'animal_breed_compositions';
