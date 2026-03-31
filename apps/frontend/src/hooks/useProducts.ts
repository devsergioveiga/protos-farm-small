import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface ManufacturerItem {
  id: string;
  name: string;
  cnpj: string | null;
}

export interface CompositionItem {
  id: string;
  activeIngredient: string;
  concentration: string | null;
  function: string | null;
}

export interface WithdrawalPeriod {
  crop: string;
  days: number;
}

export interface SprayCompatibility {
  compatible?: string[];
  incompatible?: string[];
}

export interface ProductItem {
  id: string;
  organizationId: string;
  nature: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
  notes: string | null;
  productClassId: string | null;
  productClassName: string | null;
  commercialName: string | null;
  manufacturer: ManufacturerItem | null;
  measurementUnitId: string | null;
  measurementUnitAbbreviation: string | null;
  barcode: string | null;
  photoUrl: string | null;
  technicalSheetUrl: string | null;
  chargeUnit: string | null;
  unitCost: number | null;
  typicalFrequency: string | null;
  requiresScheduling: boolean;
  linkedActivity: string | null;
  compositions: CompositionItem[];
  toxicityClass: string | null;
  mapaRegistration: string | null;
  environmentalClass: string | null;
  actionMode: string | null;
  chemicalGroup: string | null;
  withdrawalPeriods: WithdrawalPeriod[] | null;
  npkFormulation: string | null;
  nutrientForm: string | null;
  solubility: string | null;
  nutrientComposition: Record<string, number> | null;
  nutritionalComposition: Record<string, number> | null;
  sprayCompatibility: SprayCompatibility | null;
  therapeuticClass: string | null;
  administrationRoute: string | null;
  milkWithdrawalHours: number | null;
  slaughterWithdrawalDays: number | null;
  vetMapaRegistration: string | null;
  requiresPrescription: boolean;
  storageCondition: string | null;
  cultivarId: string | null;
  cultivarName: string | null;
  sieveSize: string | null;
  industrialTreatment: string | null;
  germinationPct: number | null;
  purityPct: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProductsResponse {
  data: ProductItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseProductsParams {
  page?: number;
  limit?: number;
  nature?: string;
  type?: string;
  status?: string;
  category?: string;
  search?: string;
  manufacturerId?: string;
}

export function useProducts(params: UseProductsParams) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, limit = 20, nature, type, status, category, search, manufacturerId } = params;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (nature) qs.set('nature', nature);
      if (type) qs.set('type', type);
      if (status) qs.set('status', status);
      if (category) qs.set('category', category);
      if (search) qs.set('search', search);
      if (manufacturerId) qs.set('manufacturerId', manufacturerId);

      const result = await api.get<ProductsResponse>(`/org/products?${qs}`);
      setProducts(result.data);
      setMeta({
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch {
      setError('Não foi possível carregar os produtos.');
      setProducts([]);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, nature, type, status, category, search, manufacturerId]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return { products, meta, isLoading, error, refetch: fetchProducts };
}
