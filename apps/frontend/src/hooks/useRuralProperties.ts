import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import type {
  RuralPropertyItem,
  RuralPropertyDetail,
  CreateRuralPropertyPayload,
  UpdateRuralPropertyPayload,
  CreateOwnerPayload,
  UpdateOwnerPayload,
  PropertyOwner,
  PropertyDocumentItem,
} from '../types/rural-property';

// ─── All Properties Hook (org-wide) ─────────────────────────────────

export interface RuralPropertyWithFarm extends RuralPropertyItem {
  farmName: string;
}

interface UseAllRuralPropertiesResult {
  properties: RuralPropertyWithFarm[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAllRuralProperties(): UseAllRuralPropertiesResult {
  const [properties, setProperties] = useState<RuralPropertyWithFarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<RuralPropertyWithFarm[]>('/org/rural-properties');
      setProperties(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imóveis rurais');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { properties, isLoading, error, refetch: fetch };
}

// ─── List Hook ──────────────────────────────────────────────────────

interface UseRuralPropertiesParams {
  farmId: string | null;
}

interface UseRuralPropertiesResult {
  properties: RuralPropertyItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRuralProperties({ farmId }: UseRuralPropertiesParams): UseRuralPropertiesResult {
  const [properties, setProperties] = useState<RuralPropertyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!farmId) {
      setProperties([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<RuralPropertyItem[]>(`/org/farms/${farmId}/properties`);
      setProperties(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imóveis rurais');
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { properties, isLoading, error, refetch: fetch };
}

// ─── Detail Hook ────────────────────────────────────────────────────

interface UseRuralPropertyDetailParams {
  farmId: string | null;
  propertyId: string | null;
}

interface UseRuralPropertyDetailResult {
  property: RuralPropertyDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRuralPropertyDetail({
  farmId,
  propertyId,
}: UseRuralPropertyDetailParams): UseRuralPropertyDetailResult {
  const [property, setProperty] = useState<RuralPropertyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!farmId || !propertyId) {
      setProperty(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<RuralPropertyDetail>(
        `/org/farms/${farmId}/properties/${propertyId}`,
      );
      setProperty(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar imóvel rural');
    } finally {
      setIsLoading(false);
    }
  }, [farmId, propertyId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { property, isLoading, error, refetch: fetch };
}

// ─── Mutations ──────────────────────────────────────────────────────

export async function createRuralProperty(
  farmId: string,
  payload: CreateRuralPropertyPayload,
): Promise<RuralPropertyItem> {
  return api.post<RuralPropertyItem>(`/org/farms/${farmId}/properties`, payload);
}

export async function updateRuralProperty(
  farmId: string,
  propertyId: string,
  payload: UpdateRuralPropertyPayload,
): Promise<RuralPropertyDetail> {
  return api.patch<RuralPropertyDetail>(`/org/farms/${farmId}/properties/${propertyId}`, payload);
}

export async function deleteRuralProperty(farmId: string, propertyId: string): Promise<void> {
  await api.delete(`/org/farms/${farmId}/properties/${propertyId}`);
}

// ─── Owner Mutations ────────────────────────────────────────────────

export async function addPropertyOwner(
  farmId: string,
  propertyId: string,
  payload: CreateOwnerPayload,
): Promise<PropertyOwner> {
  return api.post<PropertyOwner>(`/org/farms/${farmId}/properties/${propertyId}/owners`, payload);
}

export async function updatePropertyOwner(
  farmId: string,
  propertyId: string,
  ownerId: string,
  payload: UpdateOwnerPayload,
): Promise<PropertyOwner> {
  return api.patch<PropertyOwner>(
    `/org/farms/${farmId}/properties/${propertyId}/owners/${ownerId}`,
    payload,
  );
}

export async function deletePropertyOwner(
  farmId: string,
  propertyId: string,
  ownerId: string,
): Promise<void> {
  await api.delete(`/org/farms/${farmId}/properties/${propertyId}/owners/${ownerId}`);
}

// ─── Document Mutations ─────────────────────────────────────────────

export async function listPropertyDocuments(
  farmId: string,
  propertyId: string,
): Promise<PropertyDocumentItem[]> {
  return api.get<PropertyDocumentItem[]>(`/org/farms/${farmId}/properties/${propertyId}/documents`);
}

export async function deletePropertyDocument(
  farmId: string,
  propertyId: string,
  docId: string,
): Promise<void> {
  await api.delete(`/org/farms/${farmId}/properties/${propertyId}/documents/${docId}`);
}

// ─── Boundary Mutations ─────────────────────────────────────────────

export interface BoundaryUploadResult {
  boundaryAreaHa: number;
  polygonCount: number;
  warnings: string[];
}

export interface PropertyBoundaryInfo {
  hasBoundary: boolean;
  boundaryAreaHa: number | null;
  boundaryGeoJSON: GeoJSON.MultiPolygon | null;
  polygonCount: number;
}

export async function uploadPropertyBoundary(
  farmId: string,
  propertyId: string,
  file: File,
): Promise<BoundaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  return api.postFormData<BoundaryUploadResult>(
    `/org/farms/${farmId}/properties/${propertyId}/boundary`,
    formData,
  );
}

export async function getPropertyBoundary(
  farmId: string,
  propertyId: string,
): Promise<PropertyBoundaryInfo> {
  return api.get<PropertyBoundaryInfo>(`/org/farms/${farmId}/properties/${propertyId}/boundary`);
}

export async function deletePropertyBoundary(farmId: string, propertyId: string): Promise<void> {
  await api.delete(`/org/farms/${farmId}/properties/${propertyId}/boundary`);
}
