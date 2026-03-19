import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────

export type ImportStep = 'idle' | 'uploading' | 'mapping' | 'previewing' | 'confirming' | 'done';

export interface AssetPreviewRow {
  rowNumber: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; error: string }[];
}

export interface ParseResponse {
  columnHeaders: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  allRows: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

export interface PreviewResponse {
  valid: AssetPreviewRow[];
  invalid: AssetPreviewRow[];
  totalValid: number;
  totalInvalid: number;
}

export interface ImportState {
  step: ImportStep;
  columnHeaders: string[];
  suggestedMapping: Record<string, string>;
  columnMapping: Record<string, string>;
  allRows: Record<string, string>[];
  validRows: AssetPreviewRow[];
  invalidRows: AssetPreviewRow[];
  totalValid: number;
  totalInvalid: number;
  result: ImportResult | null;
  error: string | null;
  loading: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAssetBulkImport() {
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [state, setState] = useState<ImportState>({
    step: 'idle',
    columnHeaders: [],
    suggestedMapping: {},
    columnMapping: {},
    allRows: [],
    validRows: [],
    invalidRows: [],
    totalValid: 0,
    totalInvalid: 0,
    result: null,
    error: null,
    loading: false,
  });

  const uploadFile = useCallback(
    async (file: File) => {
      if (!orgId) return;

      setState((prev) => ({ ...prev, step: 'uploading', loading: true, error: null }));

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.postFormData<ParseResponse>(
          `/org/${orgId}/assets/import/parse`,
          formData,
        );

        setState((prev) => ({
          ...prev,
          step: 'mapping',
          loading: false,
          columnHeaders: response.columnHeaders,
          suggestedMapping: response.suggestedMapping,
          columnMapping: response.suggestedMapping, // Pre-select auto-mapped columns
          allRows: response.allRows,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          step: 'idle',
          loading: false,
          error: err instanceof Error ? err.message : 'Erro ao processar arquivo',
        }));
      }
    },
    [orgId],
  );

  const setMapping = useCallback((mapping: Record<string, string>) => {
    setState((prev) => ({ ...prev, columnMapping: mapping }));
  }, []);

  const preview = useCallback(async () => {
    if (!orgId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.post<PreviewResponse>(`/org/${orgId}/assets/import/preview`, {
        rows: state.allRows,
        columnMapping: state.columnMapping,
      });

      setState((prev) => ({
        ...prev,
        step: 'previewing',
        loading: false,
        validRows: response.valid,
        invalidRows: response.invalid,
        totalValid: response.totalValid,
        totalInvalid: response.totalInvalid,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Erro ao visualizar preview',
      }));
    }
  }, [orgId, state.allRows, state.columnMapping]);

  const confirm = useCallback(async () => {
    if (!orgId) return;

    setState((prev) => ({ ...prev, step: 'confirming', loading: true, error: null }));

    try {
      const response = await api.post<ImportResult>(`/org/${orgId}/assets/import/confirm`, {
        validRows: state.validRows,
      });

      setState((prev) => ({
        ...prev,
        step: 'done',
        loading: false,
        result: response,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        step: 'previewing',
        loading: false,
        error: err instanceof Error ? err.message : 'Erro ao importar ativos',
      }));
    }
  }, [orgId, state.validRows]);

  const downloadTemplate = useCallback(async () => {
    if (!orgId) return;

    try {
      const blob = await api.getBlob(`/org/${orgId}/assets/import/template`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modelo-ativos.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Template download failure is non-critical
    }
  }, [orgId]);

  const goToMapping = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'mapping', error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      columnHeaders: [],
      suggestedMapping: {},
      columnMapping: {},
      allRows: [],
      validRows: [],
      invalidRows: [],
      totalValid: 0,
      totalInvalid: 0,
      result: null,
      error: null,
      loading: false,
    });
  }, []);

  return {
    state,
    uploadFile,
    setMapping,
    preview,
    confirm,
    downloadTemplate,
    goToMapping,
    reset,
  };
}
