import { useState, useCallback } from 'react';

export interface EsocialEvent {
  id: string;
  eventType: string;
  eventGroup: string;
  referenceMonth: string | null;
  status: string;
  xmlContent: string | null;
  xsdErrors: string | null;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export interface EsocialStats {
  total: number;
  pendente: number;
  exportado: number;
  rejeitado: number;
}

interface UseEsocialEventsResult {
  events: EsocialEvent[];
  stats: EsocialStats;
  loading: boolean;
  error: string | null;
  generating: boolean;
  fetchEvents: (group?: string, month?: string) => Promise<void>;
  generateEvents: (referenceMonth: string) => Promise<void>;
  downloadEvent: (id: string) => Promise<void>;
  rejectEvent: (id: string, reason: string) => Promise<void>;
  reprocessEvent: (id: string) => Promise<void>;
}

export function useEsocialEvents(): UseEsocialEventsResult {
  const [events, setEvents] = useState<EsocialEvent[]>([]);
  const [stats, setStats] = useState<EsocialStats>({ total: 0, pendente: 0, exportado: 0, rejeitado: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchEvents = useCallback(async (group?: string, month?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (group) params.set('group', group);
      if (month) params.set('referenceMonth', month);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/esocial-events${query}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar eventos eSocial');
      const data = await res.json() as { data: EsocialEvent[]; stats: EsocialStats };
      setEvents(data.data ?? []);
      setStats(data.stats ?? { total: 0, pendente: 0, exportado: 0, rejeitado: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateEvents = useCallback(async (referenceMonth: string) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/esocial-events/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referenceMonth }),
      });
      if (!res.ok) throw new Error('Erro ao gerar eventos eSocial');
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setGenerating(false);
    }
  }, [fetchEvents]);

  const downloadEvent = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/esocial-events/${id}/download`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json() as { errors?: unknown[] };
        if (data.errors) {
          throw new Error(`Erros de validação XSD: ${JSON.stringify(data.errors)}`);
        }
        throw new Error('Erro ao baixar XML');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esocial-${id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [fetchEvents]);

  const rejectEvent = useCallback(async (id: string, reason: string) => {
    try {
      const res = await fetch(`/api/esocial-events/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Erro ao rejeitar evento');
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [fetchEvents]);

  const reprocessEvent = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/esocial-events/${id}/reprocess`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao reprocessar evento');
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [fetchEvents]);

  return { events, stats, loading, error, generating, fetchEvents, generateEvents, downloadEvent, rejectEvent, reprocessEvent };
}
