import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { AssetDocumentType } from '@/types/asset';

// ─── Types ────────────────────────────────────────────────────────────

export interface AssetDocument {
  id: string;
  assetId: string;
  documentType: AssetDocumentType;
  documentName: string;
  description: string | null;
  expiresAt: string | null;
  fileUrl: string | null;
  createdAt: string;
}

export interface ExpiringDocuments {
  expired: AssetDocument[];
  urgent: AssetDocument[];
  warning: AssetDocument[];
  upcoming: AssetDocument[];
}

export interface CreateAssetDocumentInput {
  assetId: string;
  documentType: AssetDocumentType;
  documentName: string;
  description?: string;
  expiresAt?: string;
}

interface DocumentListResponse {
  data: AssetDocument[];
  total: number;
}

// ─── useAssetDocuments ────────────────────────────────────────────────

export function useAssetDocuments(assetId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDocuments | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!orgId || !assetId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<DocumentListResponse>(
        `/org/${orgId}/asset-documents?assetId=${assetId}`,
      );
      setDocuments(result.data);
    } catch {
      setError('Nao foi possivel carregar os documentos.');
    } finally {
      setLoading(false);
    }
  }, [orgId, assetId]);

  const fetchExpiring = useCallback(async () => {
    if (!orgId) return;
    try {
      const result = await api.get<ExpiringDocuments>(`/org/${orgId}/asset-documents/expiring`);
      setExpiringDocs(result);
    } catch {
      // Non-critical — do not surface to user
    }
  }, [orgId]);

  const createDocument = useCallback(
    async (input: CreateAssetDocumentInput) => {
      if (!orgId) return;
      await api.post(`/org/${orgId}/asset-documents`, input);
      await fetchDocuments();
    },
    [orgId, fetchDocuments],
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!orgId) return;
      await api.delete(`/org/${orgId}/asset-documents/${id}`);
      await fetchDocuments();
    },
    [orgId, fetchDocuments],
  );

  return {
    documents,
    expiringDocs,
    loading,
    error,
    fetchDocuments,
    fetchExpiring,
    createDocument,
    deleteDocument,
  };
}
