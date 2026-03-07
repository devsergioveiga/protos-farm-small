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
import { api } from '@/services/api';
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
