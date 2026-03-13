import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type {
  DiscountTableItem,
  ClassificationItem,
  DiscountBreakdown,
} from '@/types/grain-discounts';

interface DiscountTablesResponse {
  data: DiscountTableItem[];
  defaults: Record<
    string,
    Record<string, { thresholdPct: number; discountPctPerPoint: number; maxPct: number | null }>
  >;
}

interface ClassificationsResponse {
  data: ClassificationItem[];
  defaults: Record<
    string,
    Record<
      string,
      {
        maxMoisturePct: number;
        maxImpurityPct: number;
        maxDamagedPct: number;
        maxBrokenPct: number;
      }
    >
  >;
}

export function useGrainDiscounts() {
  const [discountTables, setDiscountTables] = useState<DiscountTableItem[]>([]);
  const [discountDefaults, setDiscountDefaults] = useState<DiscountTablesResponse['defaults']>({});
  const [classifications, setClassifications] = useState<ClassificationItem[]>([]);
  const [classificationDefaults, setClassificationDefaults] = useState<
    ClassificationsResponse['defaults']
  >({});
  const [breakdown, setBreakdown] = useState<DiscountBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiscountTables = useCallback(async (crop?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = crop ? `?crop=${encodeURIComponent(crop)}` : '';
      const result = await api.get<DiscountTablesResponse>(`/org/grain-discount-tables${qs}`);
      setDiscountTables(result.data);
      setDiscountDefaults(result.defaults);
    } catch {
      setError('Não foi possível carregar as tabelas de desconto.');
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertDiscountTable = useCallback(
    async (input: {
      crop: string;
      discountType: string;
      thresholdPct: number;
      discountPctPerPoint: number;
      maxPct?: number | null;
    }) => {
      await api.put<DiscountTableItem>('/org/grain-discount-tables', input);
    },
    [],
  );

  const deleteDiscountTable = useCallback(async (tableId: string) => {
    await api.delete(`/org/grain-discount-tables/${tableId}`);
  }, []);

  const fetchClassifications = useCallback(async (crop?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = crop ? `?crop=${encodeURIComponent(crop)}` : '';
      const result = await api.get<ClassificationsResponse>(`/org/grain-classifications${qs}`);
      setClassifications(result.data);
      setClassificationDefaults(result.defaults);
    } catch {
      setError('Não foi possível carregar as classificações.');
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertClassification = useCallback(
    async (input: {
      crop: string;
      gradeType: string;
      maxMoisturePct: number;
      maxImpurityPct: number;
      maxDamagedPct: number;
      maxBrokenPct: number;
    }) => {
      await api.put<ClassificationItem>('/org/grain-classifications', input);
    },
    [],
  );

  const deleteClassification = useCallback(async (classificationId: string) => {
    await api.delete(`/org/grain-classifications/${classificationId}`);
  }, []);

  const calculateDiscount = useCallback(
    async (input: {
      crop: string;
      grossProductionKg: number;
      moisturePct: number;
      impurityPct: number;
      damagedPct?: number;
      brokenPct?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<DiscountBreakdown>('/org/grain-discounts/calculate', input);
        setBreakdown(result);
        return result;
      } catch {
        setError('Não foi possível calcular os descontos.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    discountTables,
    discountDefaults,
    classifications,
    classificationDefaults,
    breakdown,
    loading,
    error,
    fetchDiscountTables,
    upsertDiscountTable,
    deleteDiscountTable,
    fetchClassifications,
    upsertClassification,
    deleteClassification,
    calculateDiscount,
  };
}
