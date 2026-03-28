import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  EsocialEvent,
  EsocialDashboard,
  UpdateEsocialStatusInput,
} from '@/types/esocial-event';

interface FetchEventsParams {
  referenceMonth?: string;
  eventGroup?: string;
  eventType?: string;
  status?: string;
}

interface GenerateBatchInput {
  eventType: string;
  referenceMonth?: string;
}

interface XsdValidationError {
  field: string;
  message: string;
}

export interface EsocialXsdError {
  validationErrors: XsdValidationError[];
}

export function useEsocialEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EsocialEvent[]>([]);
  const [dashboard, setDashboard] = useState<EsocialDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId = user?.organizationId;

  const fetchEvents = useCallback(
    async (params?: FetchEventsParams) => {
      if (!orgId) return;
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (params?.referenceMonth) qs.set('referenceMonth', params.referenceMonth);
        if (params?.eventGroup) qs.set('eventGroup', params.eventGroup);
        if (params?.eventType) qs.set('eventType', params.eventType);
        if (params?.status) qs.set('status', params.status);
        const query = qs.toString();
        const path = `/org/${orgId}/esocial-events${query ? `?${query}` : ''}`;
        const result = await api.get<EsocialEvent[] | { data: EsocialEvent[] }>(path);
        const items = Array.isArray(result) ? result : (result as { data: EsocialEvent[] }).data;
        setEvents(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar eventos eSocial';
        setError(message);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const fetchDashboard = useCallback(
    async (referenceMonth: string) => {
      if (!orgId) return;
      try {
        const data = await api.get<EsocialDashboard>(
          `/org/${orgId}/esocial-events/dashboard?referenceMonth=${referenceMonth}`,
        );
        setDashboard(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard eSocial';
        setError(message);
      }
    },
    [orgId],
  );

  const generateBatch = useCallback(
    async (input: GenerateBatchInput): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/esocial-events/generate-batch`, input);
        setSuccessMessage('Eventos gerados com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao gerar eventos';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  /**
   * Downloads a single eSocial event XML.
   * Returns null on success (file downloaded), or EsocialXsdError if XSD validation failed.
   */
  const downloadEvent = useCallback(
    async (id: string, eventType: string, version: number): Promise<EsocialXsdError | null> => {
      if (!orgId) return null;
      try {
        // Use raw fetch to check Content-Type before treating as blob
        const token = localStorage.getItem('protos_access_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`/api/org/${orgId}/esocial-events/${id}/download`, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? 'Erro ao baixar evento');
        }

        const contentType = response.headers.get('Content-Type') ?? '';

        if (contentType.includes('application/json')) {
          // XSD validation error response
          const body = (await response.json()) as EsocialXsdError;
          return body;
        }

        // Binary XML download
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${eventType}_v${version}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar evento';
        setError(message);
        return null;
      }
    },
    [orgId],
  );

  const downloadBatch = useCallback(
    async (ids: string[]): Promise<void> => {
      if (!orgId) return;
      try {
        const blob = await api.getBlob(`/org/${orgId}/esocial-events/download-batch`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `esocial-eventos-${ids.length}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao baixar eventos';
        setError(message);
      }
    },
    [orgId],
  );

  const updateStatus = useCallback(
    async (id: string, input: UpdateEsocialStatusInput): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.patch(`/org/${orgId}/esocial-events/${id}/status`, input);
        const label = input.status === 'ACEITO' ? 'aceito' : 'rejeitado';
        setSuccessMessage(`Evento marcado como ${label}`);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const reprocessEvent = useCallback(
    async (id: string): Promise<boolean> => {
      if (!orgId) return false;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await api.post(`/org/${orgId}/esocial-events/${id}/reprocess`, {});
        setSuccessMessage('Evento reprocessado com sucesso');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao reprocessar evento';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  return {
    events,
    dashboard,
    loading,
    error,
    successMessage,
    fetchEvents,
    fetchDashboard,
    generateBatch,
    downloadEvent,
    downloadBatch,
    updateStatus,
    reprocessEvent,
  };
}
