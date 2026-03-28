import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { TaxGuide, TaxGuideType, GenerateTaxGuidesInput } from '@/types/tax-guide';

interface ListGuidesParams {
  referenceMonth?: string;
  guideType?: TaxGuideType | '';
  status?: string;
  page?: number;
  limit?: number;
}

interface PaginatedGuidesResult {
  data: TaxGuide[];
  total: number;
  page: number;
  limit: number;
}

export function useTaxGuides() {
  const { user } = useAuth();
  const [guides, setGuides] = useState<TaxGuide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchGuides = useCallback(
    async (params?: ListGuidesParams) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.referenceMonth) qs.set('referenceMonth', params.referenceMonth);
        if (params?.guideType) qs.set('guideType', params.guideType);
        if (params?.status) qs.set('status', params.status);
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const path = `/org/${orgId}/tax-guides${qs.toString() ? `?${qs.toString()}` : ''}`;
        const result = await api.get<PaginatedGuidesResult | TaxGuide[]>(path);
        const items = Array.isArray(result) ? result : (result as PaginatedGuidesResult).data;
        setGuides(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao carregar guias de recolhimento';
        setError(message);
        setGuides([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const generateGuides = useCallback(
    async (input: GenerateTaxGuidesInput): Promise<TaxGuide[] | null> => {
      if (!orgId) return null;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await api.post<TaxGuide[]>(`/org/${orgId}/tax-guides/generate`, input);
        setSuccessMessage('Guias geradas com sucesso');
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao gerar guias';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const downloadGuide = useCallback(
    async (id: string, guideType: TaxGuideType, referenceMonth: string): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(`/org/${orgId}/tax-guides/${id}/download`);
        const url = URL.createObjectURL(blob);
        const ext = guideType === 'FGTS' ? '.RE' : '.pdf';
        // Format month as YYYYMM for filename
        const monthPart = referenceMonth
          ? referenceMonth.substring(0, 7).replace('-', '')
          : Date.now().toString();
        const filename = `guia-${guideType}-${monthPart}${ext}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar guia';
        setError(message);
      }
    },
    [orgId],
  );

  return {
    guides,
    loading,
    error,
    successMessage,
    fetchGuides,
    generateGuides,
    downloadGuide,
  };
}
