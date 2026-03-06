import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { HealthRecordItem, HealthStats, HealthEventType } from '@/types/animal';

interface CreateHealthRecordInput {
  type: HealthEventType;
  eventDate: string;
  productName?: string | null;
  dosage?: string | null;
  applicationMethod?: string | null;
  batchNumber?: string | null;
  diagnosis?: string | null;
  durationDays?: number | null;
  examResult?: string | null;
  labName?: string | null;
  isFieldExam?: boolean | null;
  veterinaryName?: string | null;
  notes?: string | null;
}

interface UseAnimalHealthResult {
  records: HealthRecordItem[];
  stats: HealthStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRecord: (input: CreateHealthRecordInput) => Promise<HealthRecordItem>;
  updateRecord: (
    recordId: string,
    input: Partial<CreateHealthRecordInput>,
  ) => Promise<HealthRecordItem>;
  deleteRecord: (recordId: string) => Promise<void>;
}

export function useAnimalHealth(
  farmId: string | null,
  animalId: string | null,
  typeFilter?: HealthEventType | null,
): UseAnimalHealthResult {
  const [records, setRecords] = useState<HealthRecordItem[]>([]);
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const basePath = farmId && animalId ? `/org/farms/${farmId}/animals/${animalId}/health` : null;

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
        api.get<HealthRecordItem[]>(listPath),
        api.get<HealthStats>(`${basePath}/stats`),
      ]);
      setRecords(recordsData);
      setStats(statsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico sanitário';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [basePath, typeFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createRecord = useCallback(
    async (input: CreateHealthRecordInput) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      const result = await api.post<HealthRecordItem>(basePath, input);
      await fetchData();
      return result;
    },
    [basePath, fetchData],
  );

  const updateRecord = useCallback(
    async (recordId: string, input: Partial<CreateHealthRecordInput>) => {
      if (!basePath) throw new Error('Fazenda ou animal não selecionado');
      const result = await api.patch<HealthRecordItem>(`${basePath}/${recordId}`, input);
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
