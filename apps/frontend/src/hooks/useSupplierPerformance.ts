import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

interface PerformanceHistoryPoint {
  date: string;
  average: number;
}

interface PerformanceCriteriaBreakdown {
  deadline: number;
  quality: number;
  price: number;
  service: number;
}

interface PerformanceReportData {
  history: PerformanceHistoryPoint[];
  breakdown: PerformanceCriteriaBreakdown;
  totalRatings: number;
}

interface UseSupplierPerformanceReturn {
  data: PerformanceReportData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSupplierPerformance(
  supplierId: string | null,
  startDate?: string,
  endDate?: string,
): UseSupplierPerformanceReturn {
  const [data, setData] = useState<PerformanceReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!supplierId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      const url = `/org/suppliers/${supplierId}/performance${qs ? `?${qs}` : ''}`;
      const result = await api.get<PerformanceReportData>(url);
      setData(result);
    } catch {
      setError(
        'Nao foi possivel carregar os dados de performance. Verifique sua conexao e tente novamente.',
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, startDate, endDate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
