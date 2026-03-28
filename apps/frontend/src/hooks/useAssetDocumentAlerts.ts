import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────

export interface ExpiringDocItem {
  documentId: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  documentType: string;
  documentName: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface ExpiryBucket {
  count: number;
  items: ExpiringDocItem[];
}

export interface DocumentAlerts {
  expired: ExpiryBucket;
  urgent: ExpiryBucket;
  warning: ExpiryBucket;
  upcoming: ExpiryBucket;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAssetDocumentAlerts() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [alerts, setAlerts] = useState<DocumentAlerts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<DocumentAlerts>(`/org/${orgId}/asset-documents/expiring`);
      setAlerts(result);
    } catch {
      setError('Nao foi possivel carregar os alertas de documentos.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}
