import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface UnitItem {
  id: string;
  organizationId: string;
  name: string;
  abbreviation: string;
  category: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionItem {
  id: string;
  organizationId: string;
  fromUnitId: string;
  fromUnitName: string;
  fromUnitAbbreviation: string;
  toUnitId: string;
  toUnitName: string;
  toUnitAbbreviation: string;
  factor: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UnitsResponse {
  data: UnitItem[];
  meta: PaginationMeta;
}

interface ConversionsResponse {
  data: ConversionItem[];
  meta: PaginationMeta;
}

interface UseMeasurementUnitsParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  includeInactive?: boolean;
}

export function useMeasurementUnits(params: UseMeasurementUnitsParams) {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, limit = 50, category, search, includeInactive } = params;

  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (category) qs.set('category', category);
      if (search) qs.set('search', search);
      if (includeInactive) qs.set('includeInactive', 'true');

      const result = await api.get<UnitsResponse>(`/org/measurement-units?${qs}`);
      setUnits(result.data);
      setMeta(result.meta);
    } catch {
      setError('Não foi possível carregar as unidades de medida.');
      setUnits([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, category, search, includeInactive]);

  useEffect(() => {
    void fetchUnits();
  }, [fetchUnits]);

  return { units, meta, isLoading, error, refetch: fetchUnits };
}

interface UseConversionsParams {
  page?: number;
  limit?: number;
  unitId?: string;
}

export function useConversions(params: UseConversionsParams) {
  const [conversions, setConversions] = useState<ConversionItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, limit = 50, unitId } = params;

  const fetchConversions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (unitId) qs.set('unitId', unitId);

      const result = await api.get<ConversionsResponse>(`/org/unit-conversions?${qs}`);
      setConversions(result.data);
      setMeta(result.meta);
    } catch {
      setError('Não foi possível carregar as conversões.');
      setConversions([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, unitId]);

  useEffect(() => {
    void fetchConversions();
  }, [fetchConversions]);

  return { conversions, meta, isLoading, error, refetch: fetchConversions };
}
