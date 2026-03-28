import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type {
  JournalEntry,
  JournalEntryFilters,
  CreateJournalEntryInput,
  JournalEntryTemplate,
  SaveTemplateInput,
  CsvImportPreview,
} from '@/types/journal-entries';

// ─── useJournalEntries ────────────────────────────────────────────────────────

export function useJournalEntries(filters?: JournalEntryFilters) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.periodId) params.set('periodId', filters.periodId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.entryType) params.set('entryType', filters.entryType);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      const path = `/org/${orgId}/journal-entries${qs ? `?${qs}` : ''}`;
      const result = await api.get<JournalEntry[]>(path);
      setEntries(result);
    } catch {
      setError('Não foi possível carregar os lançamentos. Verifique sua conexão e tente novamente.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, filters?.periodId, filters?.status, filters?.entryType, filters?.page, filters?.limit]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  return { entries, isLoading, error, refetch: fetchEntries };
}

// ─── useJournalEntry ──────────────────────────────────────────────────────────

export function useJournalEntry(entryId: string | null) {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntry = useCallback(async () => {
    if (!orgId || !entryId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<JournalEntry>(`/org/${orgId}/journal-entries/${entryId}`);
      setEntry(result);
    } catch {
      setError('Não foi possível carregar o lançamento.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, entryId]);

  useEffect(() => {
    void fetchEntry();
  }, [fetchEntry]);

  return { entry, isLoading, error, refetch: fetchEntry };
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useJournalEntryActions() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const createDraft = useCallback(
    async (input: CreateJournalEntryInput): Promise<JournalEntry> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.post<JournalEntry>(`/org/${orgId}/journal-entries`, input);
    },
    [orgId],
  );

  const updateDraft = useCallback(
    async (entryId: string, input: CreateJournalEntryInput): Promise<JournalEntry> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.put<JournalEntry>(`/org/${orgId}/journal-entries/${entryId}`, input);
    },
    [orgId],
  );

  const postEntry = useCallback(
    async (entryId: string): Promise<JournalEntry> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.post<JournalEntry>(`/org/${orgId}/journal-entries/${entryId}/post`);
    },
    [orgId],
  );

  const reverseEntry = useCallback(
    async (entryId: string, reason: string): Promise<JournalEntry> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.post<JournalEntry>(`/org/${orgId}/journal-entries/${entryId}/reverse`, { reason });
    },
    [orgId],
  );

  const deleteDraft = useCallback(
    async (entryId: string): Promise<void> => {
      if (!orgId) throw new Error('Organização não encontrada');
      await api.delete<{ message: string }>(`/org/${orgId}/journal-entries/${entryId}`);
    },
    [orgId],
  );

  const saveTemplate = useCallback(
    async (input: SaveTemplateInput): Promise<JournalEntryTemplate> => {
      if (!orgId) throw new Error('Organização não encontrada');
      return api.post<JournalEntryTemplate>(`/org/${orgId}/journal-entries/templates`, input);
    },
    [orgId],
  );

  const listTemplates = useCallback(async (): Promise<JournalEntryTemplate[]> => {
    if (!orgId) throw new Error('Organização não encontrada');
    return api.get<JournalEntryTemplate[]>(`/org/${orgId}/journal-entries/templates`);
  }, [orgId]);

  const deleteTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      if (!orgId) throw new Error('Organização não encontrada');
      await api.delete<{ message: string }>(`/org/${orgId}/journal-entries/templates/${templateId}`);
    },
    [orgId],
  );

  const importCsv = useCallback(
    async (file: File): Promise<CsvImportPreview> => {
      if (!orgId) throw new Error('Organização não encontrada');
      const formData = new FormData();
      formData.append('file', file);
      return api.postFormData<CsvImportPreview>(`/org/${orgId}/journal-entries/import-csv`, formData);
    },
    [orgId],
  );

  return {
    createDraft,
    updateDraft,
    postEntry,
    reverseEntry,
    deleteDraft,
    saveTemplate,
    listTemplates,
    deleteTemplate,
    importCsv,
  };
}
