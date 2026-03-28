import { useState, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import type { SpedValidationResult } from '@/types/sped-ecd';

const TOKEN_KEY = 'protos_access_token';

function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function downloadBlob(
  path: string,
  fallbackFilename: string,
): Promise<string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { method: 'GET', headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Erro ao baixar arquivo');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const filenameMatch = disposition.split('filename=')[1]?.replace(/"/g, '');
  const filename = filenameMatch ?? fallbackFilename;

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);

  return filename;
}

export function useSpedEcd(orgId: string | undefined) {
  // Validation state
  const [validationResult, setValidationResult] = useState<SpedValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Notes state
  const [notesText, setNotesText] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);

  // Download state
  const [spedDownloading, setSpedDownloading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const validate = useCallback(
    async (fiscalYearId: string) => {
      if (!orgId || !fiscalYearId) return;
      setValidationLoading(true);
      setValidationResult(null);
      try {
        const params = new URLSearchParams({ fiscalYearId });
        const result = await api.get<SpedValidationResult>(
          `/org/${orgId}/sped-ecd/validate?${params.toString()}`,
        );
        setValidationResult(result);
      } catch {
        showToast(
          'Nao foi possivel executar a pre-validacao. Verifique sua conexao e tente novamente.',
          'error',
        );
        setValidationResult(null);
      } finally {
        setValidationLoading(false);
      }
    },
    [orgId, showToast],
  );

  const downloadSped = useCallback(
    async (fiscalYearId: string) => {
      if (!orgId || !fiscalYearId) return;
      setSpedDownloading(true);
      try {
        const params = new URLSearchParams({ fiscalYearId });
        const filename = await downloadBlob(
          `/org/${orgId}/sped-ecd/download?${params.toString()}`,
          `SPED_ECD_${fiscalYearId}.txt`,
        );
        showToast(`Arquivo ${filename} baixado com sucesso.`, 'success');
      } catch {
        showToast('Nao foi possivel gerar o arquivo SPED. Tente novamente.', 'error');
      } finally {
        setSpedDownloading(false);
      }
    },
    [orgId, showToast],
  );

  const downloadPdf = useCallback(
    async (fiscalYearId: string, costCenterId?: string) => {
      if (!orgId || !fiscalYearId) return;
      setPdfDownloading(true);
      try {
        const params = new URLSearchParams({ fiscalYearId });
        if (costCenterId) params.set('costCenterId', costCenterId);
        await downloadBlob(
          `/org/${orgId}/integrated-report/download?${params.toString()}`,
          `relatorio-integrado-${fiscalYearId}.pdf`,
        );
        showToast('Relatorio integrado gerado com sucesso.', 'success');
      } catch {
        showToast('Nao foi possivel gerar o relatorio PDF. Tente novamente.', 'error');
      } finally {
        setPdfDownloading(false);
      }
    },
    [orgId, showToast],
  );

  const loadNotes = useCallback(async () => {
    if (!orgId) return;
    setNotesLoading(true);
    try {
      const result = await api.get<{ notesText: string | null }>(
        `/org/${orgId}/integrated-report/notes`,
      );
      setNotesText(result.notesText ?? '');
    } catch {
      // Non-blocking: notes load failure is not critical
    } finally {
      setNotesLoading(false);
    }
  }, [orgId]);

  const saveNotes = useCallback(
    async (text: string) => {
      if (!orgId) return;
      try {
        await api.patch<{ ok: true }>(`/org/${orgId}/integrated-report/notes`, {
          notesText: text,
        });
        setNotesSaved(true);
        if (notesSavedTimerRef.current) clearTimeout(notesSavedTimerRef.current);
        notesSavedTimerRef.current = setTimeout(() => setNotesSaved(false), 3000);
      } catch {
        showToast('Nao foi possivel salvar as notas. Tente novamente.', 'error');
      }
    },
    [orgId, showToast],
  );

  return {
    // Validation
    validationResult,
    validationLoading,
    validate,
    // SPED download
    spedDownloading,
    downloadSped,
    // PDF download
    pdfDownloading,
    downloadPdf,
    // Notes
    notesText,
    setNotesText,
    notesSaved,
    notesLoading,
    loadNotes,
    saveNotes,
    // Toast
    toast,
  };
}
