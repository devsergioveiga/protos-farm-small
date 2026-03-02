import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import type { BulkPreviewResult, BulkImportResult, ColumnMapping } from '@/types/farm';

export type BulkImportStep =
  | 'idle'
  | 'uploading'
  | 'mapping'
  | 'previewing'
  | 'confirming'
  | 'done';

export interface UseBulkImportReturn {
  step: BulkImportStep;
  preview: BulkPreviewResult | null;
  result: BulkImportResult | null;
  error: string | null;
  columnMapping: ColumnMapping;
  setColumnMapping: (m: ColumnMapping) => void;
  selectedIndices: Set<number>;
  toggleIndex: (i: number) => void;
  selectAllValid: () => void;
  deselectAll: () => void;
  uploadFile: (file: File, farmId: string) => Promise<void>;
  goToPreview: () => void;
  goToMapping: () => void;
  confirmImport: (
    file: File,
    farmId: string,
    registrationId?: string,
    defaultName?: string,
  ) => Promise<void>;
  reset: () => void;
}

export function useBulkImport(): UseBulkImportReturn {
  const [step, setStep] = useState<BulkImportStep>('idle');
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const uploadFile = useCallback(async (file: File, farmId: string) => {
    setStep('uploading');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const previewResult = await api.postFormData<BulkPreviewResult>(
        `/org/farms/${farmId}/plots/bulk/preview`,
        formData,
      );

      setPreview(previewResult);

      // Auto-map common property names
      const autoMapping: ColumnMapping = {};
      const keys = previewResult.propertyKeys.map((k) => k.toLowerCase());
      const rawKeys = previewResult.propertyKeys;

      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (['nome', 'name', 'talhao', 'talhão'].includes(k)) autoMapping.name = rawKeys[i];
        if (['codigo', 'código', 'code', 'cod'].includes(k)) autoMapping.code = rawKeys[i];
        if (['solo', 'soil', 'soiltype', 'tipo_solo'].includes(k))
          autoMapping.soilType = rawKeys[i];
        if (['cultura', 'crop', 'cultura_atual', 'currentcrop'].includes(k))
          autoMapping.currentCrop = rawKeys[i];
        if (['cultura_anterior', 'previouscrop', 'previous_crop'].includes(k))
          autoMapping.previousCrop = rawKeys[i];
        if (['notas', 'notes', 'obs', 'observacao', 'observação'].includes(k))
          autoMapping.notes = rawKeys[i];
      }
      setColumnMapping(autoMapping);

      // Auto-select all valid features
      const validIndices = new Set(
        previewResult.features.filter((f) => f.validation.valid).map((f) => f.index),
      );
      setSelectedIndices(validIndices);

      setStep('mapping');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setError(message);
      setStep('idle');
    }
  }, []);

  const confirmImport = useCallback(
    async (file: File, farmId: string, registrationId?: string, defaultName?: string) => {
      setStep('confirming');
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('columnMapping', JSON.stringify(columnMapping));
        formData.append('selectedIndices', JSON.stringify(Array.from(selectedIndices)));
        if (registrationId) formData.append('registrationId', registrationId);
        if (defaultName) formData.append('defaultName', defaultName);

        const importResult = await api.postFormData<BulkImportResult>(
          `/org/farms/${farmId}/plots/bulk`,
          formData,
        );

        setResult(importResult);
        setStep('done');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao importar talhões';
        setError(message);
        setStep('previewing');
      }
    },
    [columnMapping, selectedIndices],
  );

  const toggleIndex = useCallback((i: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }, []);

  const selectAllValid = useCallback(() => {
    if (!preview) return;
    const validIndices = new Set(
      preview.features.filter((f) => f.validation.valid).map((f) => f.index),
    );
    setSelectedIndices(validIndices);
  }, [preview]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const goToPreview = useCallback(() => {
    setStep('previewing');
  }, []);

  const goToMapping = useCallback(() => {
    setStep('mapping');
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setPreview(null);
    setResult(null);
    setError(null);
    setColumnMapping({});
    setSelectedIndices(new Set());
  }, []);

  return {
    step,
    preview,
    result,
    error,
    columnMapping,
    setColumnMapping,
    selectedIndices,
    toggleIndex,
    selectAllValid,
    deselectAll,
    uploadFile,
    goToPreview,
    goToMapping,
    confirmImport,
    reset,
  };
}
