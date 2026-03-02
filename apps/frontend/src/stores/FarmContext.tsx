import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { FarmListItem, FarmsListResponse } from '@/types/farm';

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
      setFarms([]);
    } finally {
      setIsLoadingFarms(false);
    }
  }, [isAuthenticated]);

  // Fetch farms on mount / auth change
  useEffect(() => {
    void fetchFarms();
  }, [fetchFarms]);

  // Restore selection from localStorage
  useEffect(() => {
    if (!user || farms.length === 0) return;

    const key = getStorageKey(user.userId);
    const stored = localStorage.getItem(key);
    if (stored && farms.some((f) => f.id === stored)) {
      setSelectedFarmId(stored);
    } else {
      setSelectedFarmId(null);
      if (stored) localStorage.removeItem(key);
    }
  }, [user, farms]);

  const selectFarm = useCallback(
    (farmId: string | null) => {
      setSelectedFarmId(farmId);
      if (user) {
        const key = getStorageKey(user.userId);
        if (farmId) {
          localStorage.setItem(key, farmId);
        } else {
          localStorage.removeItem(key);
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
