import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  ConversionHistoryItem,
  ConversionHistoryResponse,
  OperationType,
} from '@/types/conversion-history';

interface UseConversionHistoryParams {
  farmId: string | null;
  operationType?: OperationType | '';
  productName?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface UseConversionHistoryResult {
  items: ConversionHistoryItem[];
  meta: ConversionHistoryResponse['meta'] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useConversionHistory(
  params: UseConversionHistoryParams,
): UseConversionHistoryResult {
  const [items, setItems] = useState<ConversionHistoryItem[]>([]);
  const [meta, setMeta] = useState<ConversionHistoryResponse['meta'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { farmId, operationType, productName, dateFrom, dateTo, page, limit } = params;

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (farmId) query.set('farmId', farmId);
      if (operationType) query.set('operationType', operationType);
      if (productName) query.set('productName', productName);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      if (page) query.set('page', String(page));
      if (limit) query.set('limit', String(limit));

      const qs = query.toString();
      const result = await api.get<ConversionHistoryResponse>(
        `/org/conversion-history${qs ? `?${qs}` : ''}`,
      );

      setItems(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico de conversões');
      setItems([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [farmId, operationType, productName, dateFrom, dateTo, page, limit]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return { items, meta, isLoading, error, refetch: fetchHistory };
}
