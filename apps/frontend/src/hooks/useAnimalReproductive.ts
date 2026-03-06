import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  ReproductiveRecordItem,
  ReproductiveStats,
  ReproductiveEventType,
} from '@/types/animal';

interface CreateReproductiveRecordInput {
  type: ReproductiveEventType;
  eventDate: string;
  notes?: string | null;
  approvedBy?: string | null;
  criteriaDetails?: string | null;
  heatIntensity?: string | null;
  plannedSireId?: string | null;
  breedingMethod?: string | null;
  plannedDate?: string | null;
  sireId?: string | null;
  sireName?: string | null;
  semenBatch?: string | null;
  technicianName?: string | null;
  confirmationMethod?: string | null;
  confirmationDate?: string | null;
  expectedDueDate?: string | null;
  calvingType?: string | null;
  calvingComplications?: string | null;
  calfId?: string | null;
  calfSex?: string | null;
  calfWeightKg?: number | null;
}

interface UseAnimalReproductiveResult {
  records: ReproductiveRecordItem[];
  stats: ReproductiveStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRecord: (input: CreateReproductiveRecordInput) => Promise<ReproductiveRecordItem>;
  updateRecord: (
    recordId: string,
    input: Partial<CreateReproductiveRecordInput>,
  ) => Promise<ReproductiveRecordItem>;
  deleteRecord: (recordId: string) => Promise<void>;
}

export function useAnimalReproductive(
  farmId: string | null,
  animalId: string | null,
  typeFilter?: ReproductiveEventType | null,
): UseAnimalReproductiveResult {
  const [records, setRecords] = useState<ReproductiveRecordItem[]>([]);
  const [stats, setStats] = useState<ReproductiveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath =
    farmId && animalId ? `/org/farms/${farmId}/animals/${animalId}/reproductive` : null;

  const fetchData = useCallback(async () => {
    if (!basePath) {
      setRecords([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const listPath = typeFilter ? `${basePath}?type=${typeFilter}` : basePath;
      const [recordsData, statsData] = await Promise.all([
        api.get<ReproductiveRecordItem[]>(listPath),
        api.get<ReproductiveStats>(`${basePath}/stats`),
      ]);
      setRecords(recordsData);
      setStats(statsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico reprodutivo';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [basePath, typeFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createRecord = useCallback(
    async (input: CreateReproductiveRecordInput) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      const result = await api.post<ReproductiveRecordItem>(basePath, input);
      await fetchData();
      return result;
    },
    [basePath, fetchData],
  );

  const updateRecord = useCallback(
    async (recordId: string, input: Partial<CreateReproductiveRecordInput>) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      const result = await api.patch<ReproductiveRecordItem>(`${basePath}/${recordId}`, input);
      await fetchData();
      return result;
    },
    [basePath, fetchData],
  );

  const deleteRecord = useCallback(
    async (recordId: string) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      await api.delete(`${basePath}/${recordId}`);
      await fetchData();
    },
    [basePath, fetchData],
  );

  return {
    records,
    stats,
    isLoading,
    error,
    refetch: fetchData,
    createRecord,
    updateRecord,
    deleteRecord,
  };
}
