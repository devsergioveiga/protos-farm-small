import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createFarmRepository,
  createFieldPlotRepository,
  createFarmLocationRepository,
  createAnimalLotRepository,
  createAnimalRepository,
  createSyncMetaRepository,
} from '@/services/db';
import { createSyncService } from '@/services/sync';

/**
 * Hook providing typed access to all offline data repositories and sync service.
 * Must be used within a SQLiteProvider.
 */
export function useOfflineData() {
  const db = useSQLiteContext();

  return useMemo(
    () => ({
      farms: createFarmRepository(db),
      fieldPlots: createFieldPlotRepository(db),
      farmLocations: createFarmLocationRepository(db),
      animalLots: createAnimalLotRepository(db),
      animals: createAnimalRepository(db),
      syncMeta: createSyncMetaRepository(db),
      sync: createSyncService(db),
    }),
    [db],
  );
}
