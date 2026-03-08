import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { useSQLiteContext } from 'expo-sqlite';
import { api } from '@/services/api';
import { createFarmRepository } from '@/services/db';
import { useAuth } from '@/stores/AuthContext';
import type { FarmListItem, FarmsListResponse } from '@/types/auth';

interface FarmContextValue {
  farms: FarmListItem[];
  isLoadingFarms: boolean;
  selectedFarmId: string | null;
  selectedFarm: FarmListItem | null;
  selectFarm: (farmId: string | null) => void;
  refreshFarms: () => Promise<void>;
}

const FarmContext = createContext<FarmContextValue | null>(null);

function getStorageKey(userId: string): string {
  return `protos_selected_farm_${userId}`;
}

function FarmProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const db = useSQLiteContext();
  const [farms, setFarms] = useState<FarmListItem[]>([]);
  const [isLoadingFarms, setIsLoadingFarms] = useState(true);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  const fetchFarms = useCallback(async () => {
    if (!isAuthenticated) {
      setFarms([]);
      setIsLoadingFarms(false);
      return;
    }
    setIsLoadingFarms(true);
    try {
      const result = await api.get<FarmsListResponse>('/org/farms?limit=100');
      setFarms(result.data);
    } catch {
      // Offline fallback: load from local SQLite
      try {
        const farmRepo = createFarmRepository(db);
        const localFarms = await farmRepo.getAll();
        if (localFarms.length > 0) {
          setFarms(
            localFarms.map((f) => ({
              id: f.id,
              name: f.name,
              nickname: f.nickname,
              city: f.city,
              state: f.state ?? '',
              totalAreaHa: f.total_area_ha ?? 0,
              boundaryAreaHa: null,
              status: f.status,
              landClassification: null,
              latitude: f.latitude,
              longitude: f.longitude,
              createdAt: f.created_at,
              _count: { registrations: 0, fieldPlots: 0 },
            })),
          );
        } else {
          setFarms([]);
        }
      } catch {
        setFarms([]);
      }
    } finally {
      setIsLoadingFarms(false);
    }
  }, [isAuthenticated, db]);

  useEffect(() => {
    void fetchFarms();
  }, [fetchFarms]);

  // Restore selection from SecureStore
  useEffect(() => {
    if (!user || farms.length === 0) return;

    const restore = async () => {
      const key = getStorageKey(user.userId);
      const stored = await SecureStore.getItemAsync(key);
      if (stored && farms.some((f) => f.id === stored)) {
        setSelectedFarmId(stored);
      } else {
        setSelectedFarmId(null);
      }
    };
    void restore();
  }, [user, farms]);

  const selectFarm = useCallback(
    (farmId: string | null) => {
      setSelectedFarmId(farmId);
      if (user) {
        const key = getStorageKey(user.userId);
        if (farmId) {
          void SecureStore.setItemAsync(key, farmId);
        } else {
          void SecureStore.deleteItemAsync(key);
        }
      }
    },
    [user],
  );

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) ?? null,
    [farms, selectedFarmId],
  );

  const value = useMemo<FarmContextValue>(
    () => ({
      farms,
      isLoadingFarms,
      selectedFarmId,
      selectedFarm,
      selectFarm,
      refreshFarms: fetchFarms,
    }),
    [farms, isLoadingFarms, selectedFarmId, selectedFarm, selectFarm, fetchFarms],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

function useFarmContext(): FarmContextValue {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarmContext deve ser usado dentro de FarmProvider');
  }
  return context;
}

export { FarmProvider, useFarmContext };
