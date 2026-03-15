import type { SQLiteDatabase } from 'expo-sqlite';
import { api } from './api';
import {
  createFarmRepository,
  createFieldPlotRepository,
  createFarmLocationRepository,
  createAnimalLotRepository,
  createAnimalRepository,
  createSyncMetaRepository,
  createPestRepository,
  createMonitoringPointRepository,
  createFieldTeamRepository,
  createCultivarRepository,
  createReferenceDataRepository,
} from './db';
import type { ReferenceEntityType } from './db';
import type {
  OfflineFarm,
  OfflineFieldPlot,
  OfflineFarmLocation,
  OfflineAnimalLot,
  OfflineAnimal,
  OfflineAnimalBreedComposition,
  OfflinePest,
  OfflineMonitoringPoint,
  OfflineFieldTeam,
  OfflineFieldTeamMember,
  OfflineCultivar,
  SyncEntity,
} from '@/types/offline';

// ─── API response types (camelCase) ────────────────────────────────────────

interface BoundaryResponse {
  hasBoundary: boolean;
  boundaryAreaHa: number | null;
  boundaryGeoJSON: { type: string; coordinates: number[][][] } | null;
}

interface ApiMapLocation {
  id: string;
  name: string;
  type: string;
  boundaryGeoJSON: { type: string; coordinates: number[][][] } | null;
  boundaryAreaHa: number | null;
  capacityUA: number | null;
  capacityAnimals: number | null;
  forageType: string | null;
  pastureStatus: string | null;
  facilityType: string | null;
  facilityStatus: string | null;
  description: string | null;
}

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

interface ApiPest {
  id: string;
  commonName: string;
  scientificName?: string;
  category: string;
  controlThreshold?: string;
  recommendedProducts?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ApiMonitoringPoint {
  id: string;
  farmId: string;
  fieldPlotId: string;
  code: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

interface ApiFieldTeamMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: string;
  leftAt: string | null;
}

interface ApiFieldTeam {
  id: string;
  farmId: string;
  name: string;
  teamType: string;
  isTemporary: boolean;
  leaderId: string;
  leaderName: string;
  notes: string | null;
  memberCount: number;
  members: ApiFieldTeamMember[];
  createdAt: string;
  updatedAt: string;
}

interface ApiCultivar {
  id: string;
  name: string;
  crop: string;
  obtainer?: string;
  cycleDays?: number;
  maturityGroup?: string;
  technology?: string;
  seedType?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Mappers: API → Offline ────────────────────────────────────────────────

function mapFarm(f: ApiFarm, boundaryGeoJSON?: string | null): OfflineFarm {
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
    boundary_geojson: boundaryGeoJSON ?? null,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

function mapFieldPlot(p: ApiFieldPlot, boundaryGeoJSON?: string | null): OfflineFieldPlot {
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
    boundary_geojson: boundaryGeoJSON ?? null,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt ?? p.createdAt,
  };
}

function mapFarmLocation(l: ApiFarmLocation, boundaryGeoJSON?: string | null): OfflineFarmLocation {
  return {
    id: l.id,
    farm_id: l.farmId,
    name: l.name,
    type: l.type as 'PASTURE' | 'FACILITY',
    boundary_area_ha: l.boundaryAreaHa ?? null,
    boundary_geojson: boundaryGeoJSON ?? null,
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

function mapLocationFromMap(l: ApiMapLocation, farmId: string): OfflineFarmLocation {
  return {
    id: l.id,
    farm_id: farmId,
    name: l.name,
    type: l.type as 'PASTURE' | 'FACILITY',
    boundary_area_ha: l.boundaryAreaHa ?? null,
    boundary_geojson: l.boundaryGeoJSON ? JSON.stringify(l.boundaryGeoJSON) : null,
    capacity_ua: l.capacityUA ?? null,
    capacity_animals: l.capacityAnimals ?? null,
    forage_type: l.forageType ?? null,
    pasture_status: l.pastureStatus ?? null,
    facility_type: l.facilityType ?? null,
    facility_status: l.facilityStatus ?? null,
    description: l.description ?? null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

function mapPest(p: ApiPest): OfflinePest {
  return {
    id: p.id,
    common_name: p.commonName,
    scientific_name: p.scientificName ?? null,
    category: p.category,
    control_threshold: p.controlThreshold ? parseFloat(p.controlThreshold) : null,
    recommended_products: p.recommendedProducts ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt ?? p.createdAt,
  };
}

function mapMonitoringPoint(mp: ApiMonitoringPoint): OfflineMonitoringPoint {
  return {
    id: mp.id,
    farm_id: mp.farmId,
    field_plot_id: mp.fieldPlotId,
    code: mp.code,
    latitude: mp.latitude,
    longitude: mp.longitude,
    created_at: mp.createdAt,
  };
}

function mapFieldTeam(t: ApiFieldTeam): OfflineFieldTeam {
  return {
    id: t.id,
    farm_id: t.farmId,
    name: t.name,
    team_type: t.teamType,
    is_temporary: t.isTemporary ? 1 : 0,
    leader_id: t.leaderId,
    leader_name: t.leaderName,
    notes: t.notes,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function mapFieldTeamMembers(t: ApiFieldTeam): OfflineFieldTeamMember[] {
  return t.members
    .filter((m) => !m.leftAt)
    .map((m) => ({
      id: m.id,
      team_id: t.id,
      user_id: m.userId,
      user_name: m.userName,
      joined_at: m.joinedAt,
      left_at: m.leftAt,
    }));
}

function mapCultivar(c: ApiCultivar): OfflineCultivar {
  return {
    id: c.id,
    name: c.name,
    crop: c.crop,
    obtainer: c.obtainer ?? null,
    cycle_days: c.cycleDays ?? null,
    maturity_group: c.maturityGroup ?? null,
    technology: c.technology ?? null,
    seed_type: c.seedType ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt ?? c.createdAt,
  };
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

// ─── Reference data sync mapping ────────────────────────────────────────────

interface ReferenceDataSyncConfig {
  syncEntity: SyncEntity;
  refType: ReferenceEntityType;
  label: string;
  /** If true, uses /org/farms/:farmId/ prefix. Otherwise uses /org/ prefix. */
  farmScoped: boolean;
  path: string;
}

const REFERENCE_DATA_SYNC_CONFIGS: ReferenceDataSyncConfig[] = [
  { syncEntity: 'ref_bulls', refType: 'bulls', label: 'Touros', farmScoped: true, path: 'bulls' },
  {
    syncEntity: 'ref_iatf_protocols',
    refType: 'iatf_protocols',
    label: 'Protocolos IATF',
    farmScoped: false,
    path: 'iatf-protocols',
  },
  {
    syncEntity: 'ref_diseases',
    refType: 'diseases',
    label: 'Doenças',
    farmScoped: false,
    path: 'diseases',
  },
  {
    syncEntity: 'ref_treatment_protocols',
    refType: 'treatment_protocols',
    label: 'Protocolos tratamento',
    farmScoped: false,
    path: 'treatment-protocols',
  },
  {
    syncEntity: 'ref_exam_types',
    refType: 'exam_types',
    label: 'Tipos de exame',
    farmScoped: false,
    path: 'exam-types',
  },
  {
    syncEntity: 'ref_feed_ingredients',
    refType: 'feed_ingredients',
    label: 'Ingredientes ração',
    farmScoped: false,
    path: 'feed-ingredients',
  },
  {
    syncEntity: 'ref_products',
    refType: 'products',
    label: 'Produtos',
    farmScoped: false,
    path: 'products',
  },
];

export function createSyncService(db: SQLiteDatabase) {
  const farmRepo = createFarmRepository(db);
  const plotRepo = createFieldPlotRepository(db);
  const locationRepo = createFarmLocationRepository(db);
  const lotRepo = createAnimalLotRepository(db);
  const animalRepo = createAnimalRepository(db);
  const pestRepo = createPestRepository(db);
  const monitoringPointRepo = createMonitoringPointRepository(db);
  const fieldTeamRepo = createFieldTeamRepository(db);
  const cultivarRepo = createCultivarRepository(db);
  const syncMetaRepo = createSyncMetaRepository(db);
  const refDataRepo = createReferenceDataRepository(db);

  const entities: SyncEntity[] = [
    'farms',
    'field_plots',
    'farm_locations',
    'animal_lots',
    'animals',
    'pests',
    'monitoring_points',
    'field_teams',
    'cultivars',
    ...REFERENCE_DATA_SYNC_CONFIGS.map((c) => c.syncEntity),
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

      // 1. Sync farms (with boundary for the selected farm)
      try {
        updateProgress(progress, 'farms', { status: 'syncing' }, onProgress);
        const apiFarms = await fetchAllPages<ApiFarm>('/org/farms');

        // Fetch boundary for the selected farm
        let farmBoundaryJson: string | null = null;
        try {
          const boundary = await api.get<BoundaryResponse>(`/org/farms/${farmId}/boundary`);
          if (boundary.hasBoundary && boundary.boundaryGeoJSON) {
            farmBoundaryJson = JSON.stringify(boundary.boundaryGeoJSON);
          }
        } catch {
          // Boundary fetch is optional — continue without it
        }

        const offlineFarms = apiFarms.map((f) =>
          mapFarm(f, f.id === farmId ? farmBoundaryJson : null),
        );
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

      // 2. Sync field plots for this farm (with boundaries)
      try {
        updateProgress(progress, 'field_plots', { status: 'syncing' }, onProgress);
        const apiPlots = await api.get<ApiFieldPlot[]>(`/org/farms/${farmId}/plots`);

        // Fetch boundaries for each plot
        const plotBoundaries = await Promise.allSettled(
          apiPlots.map((p) =>
            api.get<BoundaryResponse>(`/org/farms/${farmId}/plots/${p.id}/boundary`),
          ),
        );

        const offlinePlots = apiPlots.map((p, i) => {
          const result = plotBoundaries[i];
          let geojson: string | null = null;
          if (
            result?.status === 'fulfilled' &&
            result.value.hasBoundary &&
            result.value.boundaryGeoJSON
          ) {
            geojson = JSON.stringify(result.value.boundaryGeoJSON);
          }
          return mapFieldPlot(p, geojson);
        });

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

      // 3. Sync farm locations (using /map endpoint for boundaries)
      try {
        updateProgress(progress, 'farm_locations', { status: 'syncing' }, onProgress);

        // Try /locations/map first (includes boundaries)
        let offlineLocations: OfflineFarmLocation[];
        try {
          const mapLocations = await api.get<ApiMapLocation[]>(
            `/org/farms/${farmId}/locations/map`,
          );
          offlineLocations = mapLocations.map((l) => mapLocationFromMap(l, farmId));
        } catch {
          // Fallback to paginated list without boundaries
          const apiLocations = await fetchAllPages<ApiFarmLocation>(
            `/org/farms/${farmId}/locations`,
          );
          offlineLocations = apiLocations.map((l) => mapFarmLocation(l));
        }

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

      // 6. Sync pests (org-level, not farm-specific)
      try {
        updateProgress(progress, 'pests', { status: 'syncing' }, onProgress);
        const apiPests = await fetchAllPages<ApiPest>('/org/pests');
        const offlinePests = apiPests.map(mapPest);
        await pestRepo.clear();
        await pestRepo.upsertMany(offlinePests);
        await syncMetaRepo.upsert('pests', offlinePests.length);
        updateProgress(
          progress,
          'pests',
          { status: 'done', count: offlinePests.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'pests', { status: 'error', error: msg }, onProgress);
      }

      // 7. Sync monitoring points for each field plot
      try {
        updateProgress(progress, 'monitoring_points', { status: 'syncing' }, onProgress);
        const plotRepo2 = createFieldPlotRepository(db);
        const plots = await plotRepo2.getByFarmId(farmId);
        let totalPoints = 0;

        await monitoringPointRepo.deleteByFarmId(farmId);
        for (const plot of plots) {
          try {
            const apiPoints = await fetchAllPages<ApiMonitoringPoint>(
              `/org/farms/${farmId}/field-plots/${plot.id}/monitoring-points`,
            );
            const offlinePoints = apiPoints.map(mapMonitoringPoint);
            await monitoringPointRepo.upsertMany(offlinePoints);
            totalPoints += offlinePoints.length;
          } catch {
            // Skip plots without monitoring points
          }
        }

        await syncMetaRepo.upsert('monitoring_points', totalPoints);
        updateProgress(
          progress,
          'monitoring_points',
          { status: 'done', count: totalPoints },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'monitoring_points', { status: 'error', error: msg }, onProgress);
      }

      // 8. Sync field teams for this farm
      try {
        updateProgress(progress, 'field_teams', { status: 'syncing' }, onProgress);
        const apiTeams = await fetchAllPages<ApiFieldTeam>(`/org/farms/${farmId}/field-teams`);
        const offlineTeams = apiTeams.map(mapFieldTeam);
        const allMembers = apiTeams.flatMap(mapFieldTeamMembers);

        await fieldTeamRepo.deleteByFarmId(farmId);
        await fieldTeamRepo.upsertMany(offlineTeams);
        if (allMembers.length > 0) {
          await fieldTeamRepo.upsertMembers(allMembers);
        }
        await syncMetaRepo.upsert('field_teams', offlineTeams.length);
        updateProgress(
          progress,
          'field_teams',
          { status: 'done', count: offlineTeams.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'field_teams', { status: 'error', error: msg }, onProgress);
      }

      // 9. Sync cultivars (org-level)
      try {
        updateProgress(progress, 'cultivars', { status: 'syncing' }, onProgress);
        const apiCultivars = await fetchAllPages<ApiCultivar>('/org/cultivars');
        const offlineCultivars = apiCultivars.map(mapCultivar);
        await cultivarRepo.clear();
        await cultivarRepo.upsertMany(offlineCultivars);
        await syncMetaRepo.upsert('cultivars', offlineCultivars.length);
        updateProgress(
          progress,
          'cultivars',
          { status: 'done', count: offlineCultivars.length },
          onProgress,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        updateProgress(progress, 'cultivars', { status: 'error', error: msg }, onProgress);
      }

      // 10. Sync reference data (bulls, protocols, diseases, products, etc.)
      await refDataRepo.init();
      for (const config of REFERENCE_DATA_SYNC_CONFIGS) {
        try {
          updateProgress(progress, config.syncEntity, { status: 'syncing' }, onProgress);
          const apiPath = config.farmScoped
            ? `/org/farms/${farmId}/${config.path}`
            : `/org/${config.path}`;
          let items: unknown[];
          try {
            items = await fetchAllPages<unknown>(apiPath);
          } catch {
            // Some endpoints may return non-paginated arrays
            try {
              items = await api.get<unknown[]>(apiPath);
            } catch {
              items = [];
            }
          }
          await refDataRepo.upsertReferenceData(farmId, config.refType, items);
          await syncMetaRepo.upsert(config.syncEntity, items.length);
          updateProgress(
            progress,
            config.syncEntity,
            { status: 'done', count: items.length },
            onProgress,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido';
          updateProgress(progress, config.syncEntity, { status: 'error', error: msg }, onProgress);
        }
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
      await refDataRepo.clearAll();
      await cultivarRepo.clear();
      await fieldTeamRepo.clear();
      await monitoringPointRepo.clear();
      await pestRepo.clear();
      await animalRepo.clear();
      await lotRepo.clear();
      await locationRepo.clear();
      await plotRepo.clear();
      await farmRepo.clear();
      await syncMetaRepo.clear();
    },

    /**
     * Get reference data repository for cache management.
     */
    get referenceData() {
      return refDataRepo;
    },
  };
}
