import type { SQLiteDatabase } from 'expo-sqlite';
import { api } from './api';
import {
  createFarmRepository,
  createFieldPlotRepository,
  createFarmLocationRepository,
  createAnimalLotRepository,
  createAnimalRepository,
  createSyncMetaRepository,
} from './db';
import type {
  OfflineFarm,
  OfflineFieldPlot,
  OfflineFarmLocation,
  OfflineAnimalLot,
  OfflineAnimal,
  OfflineAnimalBreedComposition,
  SyncEntity,
} from '@/types/offline';

// ─── API response types (camelCase) ────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface ApiFarm {
  id: string;
  name: string;
  nickname?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  totalAreaHa?: number;
  status: string;
  organizationId: string;
  location?: { coordinates?: [number, number] } | null;
  createdAt: string;
  updatedAt: string;
}

interface ApiFieldPlot {
  id: string;
  farmId: string;
  name: string;
  code?: string;
  soilType?: string;
  currentCrop?: string;
  previousCrop?: string;
  notes?: string;
  boundaryAreaHa?: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiFarmLocation {
  id: string;
  farmId: string;
  name: string;
  type: string;
  boundaryAreaHa?: number;
  capacityUA?: number;
  capacityAnimals?: number;
  forageType?: string;
  pastureStatus?: string;
  facilityType?: string;
  facilityStatus?: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiAnimalLot {
  id: string;
  farmId: string;
  name: string;
  predominantCategory?: string;
  currentLocation?: string;
  locationType?: string;
  locationId?: string;
  maxCapacity?: number;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiAnimal {
  id: string;
  farmId: string;
  earTag: string;
  rfidTag?: string;
  name?: string;
  sex: string;
  birthDate?: string;
  birthDateEstimated?: boolean;
  category: string;
  categorySuggested?: string;
  origin?: string;
  entryWeightKg?: number;
  bodyConditionScore?: number;
  sireId?: string;
  damId?: string;
  lotId?: string;
  pastureId?: string;
  photoUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  compositions?: Array<{
    id?: string;
    breed: { id: string; name: string };
    fraction?: number;
    percentage: number;
  }>;
}

// ─── Mappers: API → Offline ────────────────────────────────────────────────

function mapFarm(f: ApiFarm): OfflineFarm {
  const coords = f.location?.coordinates;
  return {
    id: f.id,
    name: f.name,
    nickname: f.nickname ?? null,
    address: f.address ?? null,
    city: f.city ?? null,
    state: f.state ?? null,
    zip_code: f.zipCode ?? null,
    total_area_ha: f.totalAreaHa ?? null,
    status: f.status as 'ACTIVE' | 'INACTIVE',
    organization_id: f.organizationId,
    latitude: coords ? coords[1] : null,
    longitude: coords ? coords[0] : null,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

function mapFieldPlot(p: ApiFieldPlot): OfflineFieldPlot {
  return {
    id: p.id,
    farm_id: p.farmId,
    name: p.name,
    code: p.code ?? null,
    soil_type: p.soilType ?? null,
    current_crop: p.currentCrop ?? null,
    previous_crop: p.previousCrop ?? null,
    notes: p.notes ?? null,
    boundary_area_ha: p.boundaryAreaHa ?? null,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt ?? p.createdAt,
  };
}

function mapFarmLocation(l: ApiFarmLocation): OfflineFarmLocation {
  return {
    id: l.id,
    farm_id: l.farmId,
    name: l.name,
    type: l.type as 'PASTURE' | 'FACILITY',
    boundary_area_ha: l.boundaryAreaHa ?? null,
    capacity_ua: l.capacityUA ?? null,
    capacity_animals: l.capacityAnimals ?? null,
    forage_type: l.forageType ?? null,
    pasture_status: l.pastureStatus ?? null,
    facility_type: l.facilityType ?? null,
    facility_status: l.facilityStatus ?? null,
    description: l.description ?? null,
    notes: l.notes ?? null,
    created_at: l.createdAt,
    updated_at: l.updatedAt ?? l.createdAt,
  };
}

function mapAnimalLot(l: ApiAnimalLot): OfflineAnimalLot {
  return {
    id: l.id,
    farm_id: l.farmId,
    name: l.name,
    predominant_category: l.predominantCategory ?? null,
    current_location: l.currentLocation ?? null,
    location_type: l.locationType ?? null,
    location_id: l.locationId ?? null,
    max_capacity: l.maxCapacity ?? null,
    description: l.description ?? null,
    notes: l.notes ?? null,
    created_at: l.createdAt,
    updated_at: l.updatedAt ?? l.createdAt,
  };
}

function mapAnimal(a: ApiAnimal): OfflineAnimal {
  return {
    id: a.id,
    farm_id: a.farmId,
    ear_tag: a.earTag,
    rfid_tag: a.rfidTag ?? null,
    name: a.name ?? null,
    sex: a.sex as 'MALE' | 'FEMALE',
    birth_date: a.birthDate ?? null,
    birth_date_estimated: a.birthDateEstimated ? 1 : 0,
    category: a.category,
    category_suggested: a.categorySuggested ?? null,
    origin: (a.origin as 'BORN' | 'PURCHASED') ?? 'BORN',
    entry_weight_kg: a.entryWeightKg ?? null,
    body_condition_score: a.bodyConditionScore ?? null,
    sire_id: a.sireId ?? null,
    dam_id: a.damId ?? null,
    lot_id: a.lotId ?? null,
    pasture_id: a.pastureId ?? null,
    photo_url: a.photoUrl ?? null,
    notes: a.notes ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt ?? a.createdAt,
  };
}

function mapBreedCompositions(a: ApiAnimal): OfflineAnimalBreedComposition[] {
  if (!a.compositions?.length) return [];
  return a.compositions.map((c, i) => ({
    id: c.id ?? `${a.id}_breed_${i}`,
    animal_id: a.id,
    breed_id: c.breed.id,
    breed_name: c.breed.name,
    fraction: c.fraction ?? c.percentage / 100,
    percentage: c.percentage,
  }));
}

// ─── Paginated fetcher ─────────────────────────────────────────────────────

async function fetchAllPages<T>(path: string, limit = 100): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await api.get<PaginatedResponse<T>>(
      `${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=${limit}`,
    );
    all.push(...res.data);
    totalPages = res.meta.totalPages;
    page++;
  } while (page <= totalPages);

  return all;
}

// ─── Sync progress ─────────────────────────────────────────────────────────

export interface SyncProgress {
  entity: SyncEntity;
  status: 'pending' | 'syncing' | 'done' | 'error';
  count: number;
  error?: string;
}

export type SyncProgressCallback = (progress: SyncProgress[]) => void;

// ─── Initial sync service ──────────────────────────────────────────────────

export function createSyncService(db: SQLiteDatabase) {
  const farmRepo = createFarmRepository(db);
  const plotRepo = createFieldPlotRepository(db);
  const locationRepo = createFarmLocationRepository(db);
  const lotRepo = createAnimalLotRepository(db);
  const animalRepo = createAnimalRepository(db);
  const syncMetaRepo = createSyncMetaRepository(db);

  const entities: SyncEntity[] = [
    'farms',
    'field_plots',
    'farm_locations',
    'animal_lots',
    'animals',
  ];

  function initProgress(): SyncProgress[] {
    return entities.map((entity) => ({
      entity,
      status: 'pending' as const,
      count: 0,
    }));
  }

  function updateProgress(
    progress: SyncProgress[],
    entity: SyncEntity,
    update: Partial<SyncProgress>,
    onProgress?: SyncProgressCallback,
  ): void {
    const item = progress.find((p) => p.entity === entity);
    if (item) {
      Object.assign(item, update);
    }
    onProgress?.(progress);
  }

  return {
    /**
     * Sync all essential data for a specific farm.
     * Downloads farms list + farm-specific data (plots, locations, lots, animals).
     */
    async syncFarmData(farmId: string, onProgress?: SyncProgressCallback): Promise<SyncProgress[]> {
      const progress = initProgress();
      onProgress?.(progress);

      // 1. Sync farms
      try {
        updateProgress(progress, 'farms', { status: 'syncing' }, onProgress);
        const apiFarms = await fetchAllPages<ApiFarm>('/org/farms');
        const offlineFarms = apiFarms.map(mapFarm);
        await farmRepo.upsertMany(offlineFarms);
        await syncMetaRepo.upsert('farms', offlineFarms.length);
        updateProgress(
          progress,
          'farms',
          { status: 'done', count: offlineFarms.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'farms', { status: 'error', error: msg }, onProgress);
      }

      // 2. Sync field plots for this farm
      try {
        updateProgress(progress, 'field_plots', { status: 'syncing' }, onProgress);
        const apiPlots = await api.get<ApiFieldPlot[]>(`/org/farms/${farmId}/plots`);
        const offlinePlots = apiPlots.map(mapFieldPlot);
        await plotRepo.deleteByFarmId(farmId);
        await plotRepo.upsertMany(offlinePlots);
        await syncMetaRepo.upsert('field_plots', offlinePlots.length);
        updateProgress(
          progress,
          'field_plots',
          { status: 'done', count: offlinePlots.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'field_plots', { status: 'error', error: msg }, onProgress);
      }

      // 3. Sync farm locations
      try {
        updateProgress(progress, 'farm_locations', { status: 'syncing' }, onProgress);
        const apiLocations = await fetchAllPages<ApiFarmLocation>(`/org/farms/${farmId}/locations`);
        const offlineLocations = apiLocations.map(mapFarmLocation);
        await locationRepo.deleteByFarmId(farmId);
        await locationRepo.upsertMany(offlineLocations);
        await syncMetaRepo.upsert('farm_locations', offlineLocations.length);
        updateProgress(
          progress,
          'farm_locations',
          { status: 'done', count: offlineLocations.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'farm_locations', { status: 'error', error: msg }, onProgress);
      }

      // 4. Sync animal lots
      try {
        updateProgress(progress, 'animal_lots', { status: 'syncing' }, onProgress);
        const apiLots = await fetchAllPages<ApiAnimalLot>(`/org/farms/${farmId}/lots`);
        const offlineLots = apiLots.map(mapAnimalLot);
        await lotRepo.deleteByFarmId(farmId);
        await lotRepo.upsertMany(offlineLots);
        await syncMetaRepo.upsert('animal_lots', offlineLots.length);
        updateProgress(
          progress,
          'animal_lots',
          { status: 'done', count: offlineLots.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'animal_lots', { status: 'error', error: msg }, onProgress);
      }

      // 5. Sync animals (with breed compositions)
      try {
        updateProgress(progress, 'animals', { status: 'syncing' }, onProgress);
        const apiAnimals = await fetchAllPages<ApiAnimal>(`/org/farms/${farmId}/animals`);
        const offlineAnimals = apiAnimals.map(mapAnimal);
        const allCompositions = apiAnimals.flatMap(mapBreedCompositions);

        await animalRepo.deleteByFarmId(farmId);
        await animalRepo.upsertMany(offlineAnimals);
        if (allCompositions.length > 0) {
          await animalRepo.upsertBreedCompositions(allCompositions);
        }
        await syncMetaRepo.upsert('animals', offlineAnimals.length);
        updateProgress(
          progress,
          'animals',
          { status: 'done', count: offlineAnimals.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'animals', { status: 'error', error: msg }, onProgress);
      }

      return progress;
    },

    /**
     * Check if data has ever been synced for a given entity.
     */
    async hasSyncedData(entity: SyncEntity): Promise<boolean> {
      const meta = await syncMetaRepo.get(entity);
      return !!meta;
    },

    /**
     * Get sync metadata for all entities.
     */
    async getSyncStatus(): Promise<SyncProgress[]> {
      const meta = await syncMetaRepo.getAll();
      return entities.map((entity) => {
        const m = meta.find((x) => x.entity === entity);
        return {
          entity,
          status: m ? ('done' as const) : ('pending' as const),
          count: m?.record_count ?? 0,
        };
      });
    },

    /**
     * Clear all offline data (used on logout or farm switch).
     */
    async clearAll(): Promise<void> {
      await animalRepo.clear();
      await lotRepo.clear();
      await locationRepo.clear();
      await plotRepo.clear();
      await farmRepo.clear();
      await syncMetaRepo.clear();
    },
  };
}
